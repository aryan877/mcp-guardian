import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ScanServerInput } from "../schemas/inputs.js";
import type { ScanResult } from "../schemas/outputs.js";
import { getClient } from "../archestra/client.js";
import { ServerNotFoundError } from "../common/errors.js";
import { log, LogLevel } from "../common/logger.js";
import {
  analyzeToolVulnerabilities,
  calculateBasicTrustScore,
  detectLethalTrifecta,
} from "../analysis/vulnerability-patterns.js";
import { analyzeWithLlm } from "../analysis/prompt-injection.js";
import type { McpTool } from "../archestra/types.js";

async function getServerTools(serverName: string): Promise<McpTool[]> {
  const client = getClient();

  // List all servers, find the one matching the name
  const servers = await client.listServers();
  const server = servers.find(
    (s) => s.name.toLowerCase() === serverName.toLowerCase()
  );

  if (!server) {
    throw new ServerNotFoundError(serverName);
  }

  // Get agents and find tools associated with this server
  const agents = await client.listAgents();
  const allTools: McpTool[] = [];

  for (const agent of agents) {
    try {
      const tools = await client.getAgentTools(agent.id);
      const serverTools = tools
        .filter((t) => t.serverId === server.id || t.serverName === serverName)
        .map((t) => ({ ...t, serverName }));
      allTools.push(...serverTools);
    } catch {
      // Agent might not have tools, skip
    }
  }

  // If we didn't find tools through agents, the tools might be at the server level
  // Try getting all tools from all agents (some APIs return tools with server metadata)
  if (allTools.length === 0) {
    for (const agent of agents) {
      try {
        const tools = await client.getAgentTools(agent.id);
        for (const tool of tools) {
          allTools.push({ ...tool, serverName: tool.serverName || serverName });
        }
      } catch {
        // skip
      }
    }
  }

  return allTools;
}

export async function scanServer(
  args: z.infer<typeof ScanServerInput>
): Promise<ScanResult> {
  const { serverName, deep } = ScanServerInput.parse(args);
  log(LogLevel.INFO, `Scanning server: ${serverName}`, { deep });

  const tools = await getServerTools(serverName);
  log(LogLevel.INFO, `Found ${tools.length} tools on server "${serverName}"`);

  const allVulnerabilities = [];

  // Static pattern analysis for each tool
  for (const tool of tools) {
    const vulns = analyzeToolVulnerabilities(tool, tools);
    allVulnerabilities.push(...vulns);
  }

  // Cross-tool analysis: Lethal Trifecta detection
  allVulnerabilities.push(...detectLethalTrifecta(tools));

  // Deep scan: LLM-based analysis
  if (deep) {
    log(LogLevel.INFO, "Running deep LLM-based analysis...");
    for (const tool of tools) {
      const llmVulns = await analyzeWithLlm(tool);
      allVulnerabilities.push(...llmVulns);
    }
  }

  const trustScore = calculateBasicTrustScore(allVulnerabilities);

  const result: ScanResult = {
    serverName,
    toolCount: tools.length,
    vulnerabilities: allVulnerabilities,
    trustScore,
    scannedAt: new Date().toISOString(),
  };

  log(LogLevel.INFO, `Scan complete: ${serverName}`, {
    vulnerabilities: allVulnerabilities.length,
    trustScore,
  });

  return result;
}

export const scanServerTool = {
  name: "scan_server",
  description:
    "Analyze an MCP server's tools for security vulnerabilities including prompt injection, excessive permissions, data exfiltration risks, command injection, PII exposure, and missing input validation. Returns a vulnerability report with trust score.",
  inputSchema: zodToJsonSchema(ScanServerInput),
  handler: async (args: unknown) => {
    const parsed = ScanServerInput.parse(args);
    return await scanServer(parsed);
  },
};
