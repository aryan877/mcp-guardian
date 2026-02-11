export class GuardianError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "GuardianError";
  }
}

export class ArchestraApiError extends GuardianError {
  constructor(message: string, statusCode: number) {
    super(message, "ARCHESTRA_API_ERROR", statusCode);
    this.name = "ArchestraApiError";
  }
}

export class ServerNotFoundError extends GuardianError {
  constructor(serverName: string) {
    super(
      `MCP server "${serverName}" not found in Archestra`,
      "SERVER_NOT_FOUND",
      404
    );
    this.name = "ServerNotFoundError";
  }
}

export function isGuardianError(error: unknown): error is GuardianError {
  return error instanceof GuardianError;
}

export function formatError(error: unknown): string {
  if (error instanceof GuardianError) {
    return `[${error.code}] ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
