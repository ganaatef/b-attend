type LogLevel = "info" | "warn" | "error";

interface LogContext {
  requestId?: string;
  tenantId?: string;
  userId?: string;
  action?: string;
}

export function log(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };
  if (level === "error") console.error(JSON.stringify(entry));
  else if (level === "warn") console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}
