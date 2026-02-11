export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LOG_LEVEL = process.env.LOG_LEVEL
  ? (LogLevel[process.env.LOG_LEVEL as keyof typeof LogLevel] ?? LogLevel.INFO)
  : LogLevel.INFO;

export function log(level: LogLevel, message: string, meta?: unknown) {
  if (level >= LOG_LEVEL) {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    console.error(`[${timestamp}] [${levelName}] ${message}${metaStr}`);
  }
}
