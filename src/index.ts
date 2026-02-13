#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { tools, executeTool } from "./tools/index.js";
import { z } from "zod";
import { isGuardianError, formatError } from "./common/errors.js";
import { VERSION } from "./common/version.js";
import { log, LogLevel } from "./common/logger.js";
import express from "express";
import cors from "cors";

const server = new Server(
  { name: "mcp-guardian", version: VERSION },
  { capabilities: { tools: {} } }
);

// Register tool listing
log(LogLevel.INFO, `Registering ${tools.length} Guardian tools`);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  log(LogLevel.DEBUG, "Handling ListToolsRequest");
  return {
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  };
});

// Register tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const startTime = Date.now();

  try {
    log(LogLevel.INFO, `Executing tool: ${toolName}`);

    if (!request.params.arguments) {
      return {
        content: [{ type: "text", text: "Error: Arguments are required" }],
        isError: true,
      };
    }

    const result = await executeTool(toolName, request.params.arguments);
    const duration = Date.now() - startTime;

    log(LogLevel.INFO, `Tool completed: ${toolName}`, {
      duration: `${duration}ms`,
    });

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    log(LogLevel.ERROR, `Tool failed: ${toolName}`, {
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof z.ZodError) {
      return {
        content: [
          {
            type: "text",
            text: `Invalid input: ${JSON.stringify(error.errors)}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: formatError(error) }],
      isError: true,
    };
  }
});

// Transport selection
const transportMode = process.env.TRANSPORT || "stdio";

async function runServer() {
  if (transportMode === "sse") {
    log(LogLevel.INFO, "Starting Guardian in SSE mode");

    const app = express();
    const port = parseInt(process.env.PORT || "8080", 10);

    app.use(
      cors({
        origin: process.env.CORS_ORIGIN || "*",
        methods: "GET, POST, OPTIONS",
        allowedHeaders: "Content-Type, Authorization",
      })
    );

    // Health check
    app.get("/health", (_req, res) => {
      res.status(200).json({
        status: "ok",
        version: VERSION,
        transport: "sse",
        tools: tools.length,
      });
    });

    // SSE connections
    const connections = new Map<
      string,
      { transport: SSEServerTransport; res: express.Response }
    >();

    app.get("/sse", (req, res) => {
      const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      log(LogLevel.INFO, `SSE connection established`, { connectionId });

      res.setHeader("X-Accel-Buffering", "no");
      const transport = new SSEServerTransport("/messages", res);
      connections.set(connectionId, { transport, res });

      server.connect(transport).catch((error) => {
        log(LogLevel.ERROR, `Failed to connect transport`, {
          connectionId,
          error: error instanceof Error ? error.message : String(error),
        });
      });

      // Keep alive
      const keepAlive = setInterval(() => {
        try {
          res.write(`:keepalive ${new Date().toISOString()}\n\n`);
        } catch {
          clearInterval(keepAlive);
          connections.delete(connectionId);
        }
      }, 30000);

      req.on("close", () => {
        log(LogLevel.INFO, `SSE connection closed`, { connectionId });
        clearInterval(keepAlive);
        connections.delete(connectionId);
      });
    });

    app.post("/messages", express.json({ limit: "1mb" }), (req, res) => {
      const allConnections = Array.from(connections.entries());
      if (allConnections.length === 0) {
        res.status(503).json({ error: "No active connections" });
        return;
      }

      // Use the most recent connection
      const [, conn] = allConnections[allConnections.length - 1];
      conn.transport.handlePostMessage(req, res);
    });

    app.listen(port, () => {
      log(
        LogLevel.INFO,
        `MCP Guardian running in SSE mode on port ${port}`
      );
    });
  } else {
    log(LogLevel.INFO, "Starting Guardian in stdio mode");
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log(LogLevel.INFO, "MCP Guardian running on stdio");
  }
}

runServer().catch((error) => {
  log(LogLevel.ERROR, `Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
