// generate_policy: this is the "closed loop" — we take scan results and
// translate each vulnerability into an Archestra security policy. In strict
// mode, critical things get block_always. In recommended mode, we use
// block_when_context_is_untrusted so the tool still works in safe contexts.
// Supports dry-run (preview) or live application via the Archestra API.

import { zodToJsonSchema } from "zod-to-json-schema";
import { GeneratePolicyInput } from "../schemas/inputs.js";
import type { PolicyResult } from "../schemas/outputs.js";
import { getClient } from "../archestra/client.js";
import { log, LogLevel } from "../common/logger.js";
import { scanServer } from "./scan-server.js";
import type { Vulnerability } from "../schemas/outputs.js";

interface PolicyRecommendation {
  type: "tool_invocation" | "trusted_data";
  toolName: string;
  toolId: string;
  action: string;
  reason: string;
}

function mapVulnerabilityToPolicy(
  vuln: Vulnerability,
  toolId: string,
  mode: "recommended" | "strict" | "permissive"
): PolicyRecommendation[] {
  const policies: PolicyRecommendation[] = [];

  switch (vuln.category) {
    case "Prompt Injection":
    case "Prompt Injection (LLM-detected)":
      if (mode === "strict" || vuln.severity === "critical") {
        policies.push({
          type: "tool_invocation",
          toolName: vuln.tool,
          toolId,
          action: "block_always",
          reason: `Critical prompt injection detected: ${vuln.description}`,
        });
      } else if (mode === "recommended") {
        policies.push({
          type: "tool_invocation",
          toolName: vuln.tool,
          toolId,
          action: "block_when_context_is_untrusted",
          reason: `Prompt injection risk: ${vuln.description}`,
        });
      }
      break;

    case "Data Exfiltration Risk":
      policies.push({
        type: "trusted_data",
        toolName: vuln.tool,
        toolId,
        action:
          mode === "permissive"
            ? "mark_as_untrusted"
            : "sanitize_with_dual_llm",
        reason: `Data exfiltration risk: ${vuln.description}`,
      });
      break;

    case "PII Exposure":
      policies.push({
        type: "trusted_data",
        toolName: vuln.tool,
        toolId,
        action:
          mode === "strict"
            ? "sanitize_with_dual_llm"
            : "mark_as_untrusted",
        reason: `PII exposure risk: ${vuln.description}`,
      });
      break;

    case "Excessive Permissions":
    case "Command Injection":
      if (mode !== "permissive") {
        policies.push({
          type: "tool_invocation",
          toolName: vuln.tool,
          toolId,
          action:
            mode === "strict"
              ? "block_always"
              : "block_when_context_is_untrusted",
          reason: `Security risk: ${vuln.description}`,
        });
      }
      break;

    case "Missing Input Validation":
      if (mode === "strict") {
        policies.push({
          type: "tool_invocation",
          toolName: vuln.tool,
          toolId,
          action: "block_when_context_is_untrusted",
          reason: `Missing input validation: ${vuln.description}`,
        });
      }
      break;

    case "ANSI/Steganography Attack":
      policies.push({
        type: "tool_invocation",
        toolName: vuln.tool,
        toolId,
        action: "block_always",
        reason: `Hidden content attack: ${vuln.description}`,
      });
      break;

    case "Path Traversal":
      policies.push({
        type: "tool_invocation",
        toolName: vuln.tool,
        toolId,
        action: mode === "permissive" ? "block_when_context_is_untrusted" : "block_always",
        reason: `Path traversal risk: ${vuln.description}`,
      });
      break;

    case "Tool Shadowing":
      if (mode !== "permissive") {
        policies.push({
          type: "tool_invocation",
          toolName: vuln.tool,
          toolId,
          action: "block_when_context_is_untrusted",
          reason: `Tool shadowing risk: ${vuln.description}`,
        });
      }
      break;

    case "Lethal Trifecta":
      policies.push({
        type: "tool_invocation",
        toolName: vuln.tool,
        toolId,
        action: "block_when_context_is_untrusted",
        reason: `Lethal Trifecta: ${vuln.description}`,
      });
      break;
  }

  return policies;
}

export async function generatePolicy(
  args: unknown
): Promise<PolicyResult> {
  const { serverName, mode, dryRun } = GeneratePolicyInput.parse(args);
  log(LogLevel.INFO, `Generating policies for ${serverName}`, { mode, dryRun });

  const scanResult = await scanServer({ serverName, deep: false });

  const client = getClient();
  const server = await client.findServer(serverName);
  const tools = await client.getServerTools(server.id);

  const toolIdMap = new Map<string, string>();
  for (const tool of tools) {
    toolIdMap.set(tool.name, tool.id);
  }

  const recommendations: PolicyRecommendation[] = [];
  const seen = new Set<string>();

  for (const vuln of scanResult.vulnerabilities) {
    const toolId = toolIdMap.get(vuln.tool) || vuln.tool;
    for (const p of mapVulnerabilityToPolicy(vuln, toolId, mode)) {
      const key = `${p.toolName}:${p.type}:${p.action}`;
      if (!seen.has(key)) {
        seen.add(key);
        recommendations.push(p);
      }
    }
  }

  // Deduplicate: keep the strongest action per (toolId, type) pair.
  const invocationStrength: Record<string, number> = {
    block_always: 3,
    block_when_context_is_untrusted: 2,
    allow_when_context_is_untrusted: 1,
  };
  const trustedDataStrength: Record<string, number> = {
    block_always: 4,
    sanitize_with_dual_llm: 3,
    mark_as_untrusted: 2,
    mark_as_trusted: 1,
  };

  const bestByTool = new Map<string, PolicyRecommendation>();
  for (const rec of recommendations) {
    const key = `${rec.toolId}:${rec.type}`;
    const existing = bestByTool.get(key);
    const strengths = rec.type === "tool_invocation" ? invocationStrength : trustedDataStrength;
    if (!existing || (strengths[rec.action] ?? 0) > (strengths[existing.action] ?? 0)) {
      bestByTool.set(key, rec);
    }
  }
  const deduped = Array.from(bestByTool.values());

  // Apply using bulk upsert endpoints (creates or updates, no duplicates)
  let allApplied = true;
  if (!dryRun) {
    // Group tool_invocation recs by action
    const invocationByAction = new Map<string, string[]>();
    for (const rec of deduped.filter((r) => r.type === "tool_invocation")) {
      const ids = invocationByAction.get(rec.action) || [];
      ids.push(rec.toolId);
      invocationByAction.set(rec.action, ids);
    }
    for (const [action, toolIds] of invocationByAction) {
      try {
        await client.bulkSetToolInvocationDefault(toolIds, action as any);
        log(LogLevel.INFO, `Bulk applied tool invocation ${action} to ${toolIds.length} tools`);
      } catch (error) {
        allApplied = false;
        log(LogLevel.ERROR, `Failed to bulk apply tool invocation ${action}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Group trusted_data recs by action
    const trustedByAction = new Map<string, string[]>();
    for (const rec of deduped.filter((r) => r.type === "trusted_data")) {
      const ids = trustedByAction.get(rec.action) || [];
      ids.push(rec.toolId);
      trustedByAction.set(rec.action, ids);
    }
    for (const [action, toolIds] of trustedByAction) {
      try {
        await client.bulkSetTrustedDataDefault(toolIds, action as any);
        log(LogLevel.INFO, `Bulk applied trusted data ${action} to ${toolIds.length} tools`);
      } catch (error) {
        allApplied = false;
        log(LogLevel.ERROR, `Failed to bulk apply trusted data ${action}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const appliedPolicies = deduped.map((rec) => ({
    type: rec.type,
    toolName: rec.toolName,
    action: rec.action,
    reason: rec.reason,
    applied: !dryRun && allApplied,
  }));

  return {
    serverName,
    policiesGenerated: appliedPolicies.length,
    policies: appliedPolicies,
  };
}

export const generatePolicyTool = {
  name: "generate_policy",
  description:
    "Auto-generate and optionally apply Archestra security policies (tool invocation + trusted data) based on vulnerability scan results. Supports recommended, strict, and permissive modes. Defaults to dry-run (preview only).",
  inputSchema: zodToJsonSchema(GeneratePolicyInput),
  handler: generatePolicy,
};
