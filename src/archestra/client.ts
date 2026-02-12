import axios, { AxiosInstance } from "axios";
import { log, LogLevel } from "../common/logger.js";
import { ArchestraApiError } from "../common/errors.js";
import type {
  McpServer,
  McpTool,
  ToolInvocationPolicy,
  TrustedDataPolicy,
  McpToolCall,
  Agent,
  LlmChatMessage,
  LlmChatResponse,
} from "./types.js";

export class ArchestraClient {
  private http: AxiosInstance;

  constructor(
    baseUrl: string = process.env.ARCHESTRA_API_URL || "http://localhost:9000",
    token?: string
  ) {
    this.http = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    this.http.interceptors.response.use(
      (res) => res,
      (err) => {
        const status = err.response?.status ?? 0;
        const message = err.response?.data?.message ?? err.message;
        log(LogLevel.ERROR, `Archestra API error: ${status} ${message}`);
        throw new ArchestraApiError(message, status);
      }
    );
  }

  // ─── MCP Servers ────────────────────────────────────────────────

  async listServers(): Promise<McpServer[]> {
    log(LogLevel.DEBUG, "Listing MCP servers");
    const { data } = await this.http.get("/api/mcp_server");
    return data;
  }

  async getServer(id: string): Promise<McpServer> {
    const { data } = await this.http.get(`/api/mcp_server/${id}`);
    return data;
  }

  // ─── Agents / Profiles ─────────────────────────────────────────

  async listAgents(): Promise<Agent[]> {
    const { data } = await this.http.get("/api/agents");
    return data;
  }

  async getAgent(id: string): Promise<Agent> {
    const { data } = await this.http.get(`/api/agents/${id}`);
    return data;
  }

  async getAgentTools(agentId: string): Promise<McpTool[]> {
    const { data } = await this.http.get(`/api/agents/${agentId}/tools`);
    return data;
  }

  // ─── Tool Invocation Policies ───────────────────────────────────

  async listToolInvocationPolicies(): Promise<ToolInvocationPolicy[]> {
    const { data } = await this.http.get("/api/tool-invocation");
    return data;
  }

  async createToolInvocationPolicy(
    policy: ToolInvocationPolicy
  ): Promise<ToolInvocationPolicy> {
    log(LogLevel.INFO, `Creating tool invocation policy`, {
      toolId: policy.toolId,
      action: policy.action,
    });
    const { data } = await this.http.post("/api/tool-invocation", policy);
    return data;
  }

  async updateToolInvocationPolicy(
    id: string,
    policy: Partial<ToolInvocationPolicy>
  ): Promise<ToolInvocationPolicy> {
    const { data } = await this.http.put(`/api/tool-invocation/${id}`, policy);
    return data;
  }

  async deleteToolInvocationPolicy(id: string): Promise<void> {
    await this.http.delete(`/api/tool-invocation/${id}`);
  }

  async bulkCreateToolInvocationPolicies(
    toolIds: string[],
    action: ToolInvocationPolicy["action"]
  ): Promise<void> {
    log(LogLevel.INFO, `Bulk creating tool invocation policies`, {
      count: toolIds.length,
      action,
    });
    await this.http.post("/api/tool-invocation/bulk-default", {
      toolIds,
      action,
    });
  }

  // ─── Trusted Data Policies ─────────────────────────────────────

  async listTrustedDataPolicies(): Promise<TrustedDataPolicy[]> {
    const { data } = await this.http.get("/api/trusted-data-policies");
    return data;
  }

  async createTrustedDataPolicy(
    policy: TrustedDataPolicy
  ): Promise<TrustedDataPolicy> {
    log(LogLevel.INFO, `Creating trusted data policy`, {
      toolId: policy.toolId,
      action: policy.action,
    });
    const { data } = await this.http.post(
      "/api/trusted-data-policies",
      policy
    );
    return data;
  }

  async updateTrustedDataPolicy(
    id: string,
    policy: Partial<TrustedDataPolicy>
  ): Promise<TrustedDataPolicy> {
    const { data } = await this.http.put(
      `/api/trusted-data-policies/${id}`,
      policy
    );
    return data;
  }

  async deleteTrustedDataPolicy(id: string): Promise<void> {
    await this.http.delete(`/api/trusted-data-policies/${id}`);
  }

  async bulkCreateTrustedDataPolicies(
    toolIds: string[],
    action: TrustedDataPolicy["action"]
  ): Promise<void> {
    log(LogLevel.INFO, `Bulk creating trusted data policies`, {
      count: toolIds.length,
      action,
    });
    await this.http.post("/api/trusted-data-policies/bulk-default", {
      toolIds,
      action,
    });
  }

  // ─── Tool Calls (Monitoring) ────────────────────────────────────

  async getToolCalls(): Promise<McpToolCall[]> {
    const { data } = await this.http.get("/api/mcp-tool-calls");
    return data;
  }

  // ─── LLM Proxy ─────────────────────────────────────────────────

  async chatCompletion(
    messages: LlmChatMessage[],
    model: string = "gpt-4o-mini"
  ): Promise<LlmChatResponse> {
    log(LogLevel.DEBUG, `LLM chat completion via Archestra proxy`, { model });
    const { data } = await this.http.post("/v1/openai/chat/completions", {
      model,
      messages,
      temperature: 0.1,
    });
    return data;
  }

  // ─── Limits ─────────────────────────────────────────────────────

  async listLimits(): Promise<unknown[]> {
    const { data } = await this.http.get("/api/limits");
    return data;
  }

  async createLimit(limit: {
    entityId: string;
    entityType: string;
    limitType: string;
    limitValue: number;
    model?: string[];
  }): Promise<unknown> {
    const { data } = await this.http.post("/api/limits", limit);
    return data;
  }
}

// Singleton instance
let _client: ArchestraClient | null = null;

export function getClient(): ArchestraClient {
  if (!_client) {
    _client = new ArchestraClient();
  }
  return _client;
}
