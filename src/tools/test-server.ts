import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { TestServerInput } from "../schemas/inputs.js";
import type { TestResult } from "../schemas/outputs.js";
import { getClient } from "../archestra/client.js";
import { log, LogLevel } from "../common/logger.js";
import { generateTestCases } from "../analysis/test-generator.js";
import { ServerNotFoundError } from "../common/errors.js";
import type { McpTool } from "../archestra/types.js";

export async function testServer(
  args: z.infer<typeof TestServerInput>
): Promise<TestResult> {
  const { serverName, toolName, testTypes } = TestServerInput.parse(args);
  log(LogLevel.INFO, `Testing server: ${serverName}`, { toolName, testTypes });

  const client = getClient();

  // Get server and tools
  const servers = await client.listServers();
  const server = servers.find(
    (s) => s.name.toLowerCase() === serverName.toLowerCase()
  );
  if (!server) throw new ServerNotFoundError(serverName);

  // Collect tools
  const agents = await client.listAgents();
  let tools: McpTool[] = [];
  for (const agent of agents) {
    try {
      const agentTools = await client.getAgentTools(agent.id);
      tools.push(
        ...agentTools
          .filter((t) => t.serverId === server.id || t.serverName === serverName)
          .map((t) => ({ ...t, serverName }))
      );
    } catch {
      // skip
    }
  }

  // Filter to specific tool if requested
  if (toolName) {
    tools = tools.filter((t) => t.name === toolName);
    if (tools.length === 0) {
      throw new Error(
        `Tool "${toolName}" not found on server "${serverName}"`
      );
    }
  }

  // Generate test cases
  const allTestCases = tools.flatMap((tool) =>
    generateTestCases(tool, testTypes)
  );

  log(LogLevel.INFO, `Generated ${allTestCases.length} test cases`);

  // Execute tests (using LLM proxy to simulate tool calls safely)
  const results: TestResult["results"] = [];
  let passed = 0;
  let failed = 0;
  let errors = 0;

  for (const tc of allTestCases) {
    try {
      // Use LLM to analyze how the tool would handle this input
      const response = await client.chatCompletion(
        [
          {
            role: "system",
            content: `You are analyzing how an MCP tool would handle a specific test input. The tool is "${tc.tool}". Analyze the input and determine if the tool would handle it safely. Respond with JSON: {"status": "pass"|"fail"|"error", "result": "description of what would happen", "issue": "description of any security issue found (optional)"}`,
          },
          {
            role: "user",
            content: `Test type: ${tc.testType}\nInput: ${JSON.stringify(tc.input)}\nExpected: ${tc.expectedBehavior}`,
          },
        ],
        "gpt-4o-mini"
      );

      const content = response.choices?.[0]?.message?.content ?? "";
      let analysis: {
        status: "pass" | "fail" | "error";
        result: string;
        issue?: string;
      };

      try {
        analysis = JSON.parse(content);
      } catch {
        analysis = {
          status: "error",
          result: "Failed to parse analysis",
        };
      }

      results.push({
        tool: tc.tool,
        testType: tc.testType,
        input: tc.input,
        expectedBehavior: tc.expectedBehavior,
        actualResult: analysis.result,
        status: analysis.status,
        issue: analysis.issue,
      });

      if (analysis.status === "pass") passed++;
      else if (analysis.status === "fail") failed++;
      else errors++;
    } catch (error) {
      errors++;
      results.push({
        tool: tc.tool,
        testType: tc.testType,
        input: tc.input,
        expectedBehavior: tc.expectedBehavior,
        actualResult: `Error: ${error instanceof Error ? error.message : String(error)}`,
        status: "error",
        issue: "Test execution failed",
      });
    }
  }

  return {
    serverName,
    totalTests: allTestCases.length,
    passed,
    failed,
    errors,
    results,
  };
}

export const testServerTool = {
  name: "test_server",
  description:
    "Auto-generate and run security test cases against an MCP server's tools. Tests include valid inputs, edge cases, malformed inputs, injection payloads, and overflow inputs. Uses LLM analysis to evaluate tool safety.",
  inputSchema: zodToJsonSchema(TestServerInput),
  handler: async (args: unknown) => {
    const parsed = TestServerInput.parse(args);
    return await testServer(parsed);
  },
};
