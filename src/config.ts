export type LogLevel = "debug" | "info" | "warn" | "error";

export type HcloudMcpConfig = {
  hcloudPath: string;
  defaultTimeoutMs: number;
  allowDestructive: boolean;
  logLevel: LogLevel;
  hasToken: boolean;
};

const LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === "") return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

function parseTimeout(value: string | undefined, defaultMs: number): number {
  if (value === undefined || value === "") return defaultMs;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid HCLOUD_MCP_DEFAULT_TIMEOUT_MS: ${value}. Must be a positive integer.`,
    );
  }
  return parsed;
}

function parseLogLevel(value: string | undefined): LogLevel {
  if (!value) return "info";
  const level = value.toLowerCase() as LogLevel;
  if (!LOG_LEVELS.includes(level)) {
    throw new Error(
      `Invalid HCLOUD_MCP_LOG_LEVEL: ${value}. Must be one of: ${LOG_LEVELS.join(", ")}`,
    );
  }
  return level;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): HcloudMcpConfig {
  return {
    hcloudPath: env.HCLOUD_MCP_HCLOUD_PATH?.trim() || "hcloud",
    defaultTimeoutMs: parseTimeout(env.HCLOUD_MCP_DEFAULT_TIMEOUT_MS, 30_000),
    allowDestructive: parseBoolean(env.HCLOUD_MCP_ALLOW_DESTRUCTIVE, false),
    logLevel: parseLogLevel(env.HCLOUD_MCP_LOG_LEVEL),
    hasToken: Boolean(env.HCLOUD_TOKEN?.trim()),
  };
}

export function redactConfig(config: HcloudMcpConfig): Record<string, unknown> {
  return {
    hcloudPath: config.hcloudPath,
    defaultTimeoutMs: config.defaultTimeoutMs,
    allowDestructive: config.allowDestructive,
    logLevel: config.logLevel,
    hasToken: config.hasToken,
  };
}

export function getHcloudEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return { ...env };
}
