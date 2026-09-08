export type StatusLevel = "ok" | "warning" | "error" | "unknown";

export type CheckResult<T> = {
  level: StatusLevel;
  summary: string;
  details?: T;
};

export type DashboardStatus = {
  overall: StatusLevel;
  app: CheckResult<{ responseMs?: number; httpStatus?: number }>;
  database: CheckResult<{ fieldDays?: number; materials?: number }>;
  storage: CheckResult<{ bytes?: number; files?: number }>;
  system: CheckResult<{ diskUsedPercent?: number; diskAvailableBytes?: number; memoryTotalBytes?: number; memoryAvailableBytes?: number; uptimeSeconds?: number; loadAverage?: number[] }>;
  errors: CheckResult<string[]>;
  checkedAt: Date;
};
