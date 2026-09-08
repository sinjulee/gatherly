import path from "node:path";

function integer(name: string, fallback: number, minimum: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= minimum ? Math.floor(value) : fallback;
}

function databasePath(projectRoot: string) {
  const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
  if (!databaseUrl.startsWith("file:")) return path.join(projectRoot, "prisma", "dev.db");
  const file = decodeURIComponent(databaseUrl.slice("file:".length));
  return path.isAbsolute(file) ? file : path.resolve(projectRoot, "prisma", file);
}

export const config = {
  projectRoot: process.cwd(),
  token: process.env.GATHERLY_TELEGRAM_BOT_TOKEN?.trim() || "",
  allowedUserId: process.env.GATHERLY_TELEGRAM_ALLOWED_USER_ID?.trim() || "",
  healthUrl: process.env.GATHERLY_APP_HEALTH_URL?.trim() || "http://127.0.0.1:3001/api/health",
  accessUrl: process.env.GATHERLY_ACCESS_URL?.trim() || "",
  storageRoot: path.resolve(process.cwd(), process.env.GATHERLY_STORAGE_PATH || process.env.STORAGE_ROOT || "storage"),
  databasePath: databasePath(process.cwd()),
  logPath: process.env.GATHERLY_LOG_PATH?.trim() || "",
  diskWarnPercent: integer("GATHERLY_DISK_WARN_PERCENT", 80, 1),
  diskCriticalPercent: integer("GATHERLY_DISK_CRITICAL_PERCENT", 90, 1),
  healthTimeoutMs: integer("GATHERLY_HEALTH_TIMEOUT_MS", 5000, 100),
  healthSlowMs: integer("GATHERLY_HEALTH_SLOW_MS", 2000, 1),
  auditLogPath: path.join(process.cwd(), "logs", "status-bot-audit.log"),
} as const;
