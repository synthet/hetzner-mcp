import { spawn as nodeSpawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { HcloudMcpConfig } from "../config.js";
import { getHcloudEnv } from "../config.js";
import { HcloudError, errorInfo, type HcloudErrorInfo } from "./errors.js";
import {
  requireConfirmation,
  requireDestructiveAllowed,
  sanitizeOutput,
  type ConfirmationInput,
} from "./validators.js";

export type HcloudResult = {
  ok: boolean;
  command: string[];
  stdout: string;
  stderr: string;
  json?: unknown;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  error?: HcloudErrorInfo;
};

export type RunOptions = {
  timeoutMs?: number;
  expectJson?: boolean;
  destructive?: boolean;
  confirmation?: ConfirmationInput;
  requireToken?: boolean;
};

export type DependencyCheckResult = {
  available: boolean;
  hcloudPath: string;
  version?: string;
  hasToken: boolean;
  error?: HcloudErrorInfo;
};

export type SpawnFn = (
  command: string,
  args: string[],
  options: { env: NodeJS.ProcessEnv; shell: false },
) => ChildProcessWithoutNullStreams;

export class HcloudClient {
  private readonly config: HcloudMcpConfig;
  private readonly spawnFn: SpawnFn;

  constructor(config: HcloudMcpConfig, spawnFn: SpawnFn = nodeSpawn) {
    this.config = config;
    this.spawnFn = spawnFn;
  }

  get executable(): string {
    return this.config.hcloudPath;
  }

  fullCommand(args: string[]): string[] {
    return [this.config.hcloudPath, ...args];
  }

  async checkAvailable(): Promise<DependencyCheckResult> {
    const base = {
      hcloudPath: this.config.hcloudPath,
      hasToken: this.config.hasToken,
    };
    try {
      const result = await this.run(["version"], {
        requireToken: false,
        timeoutMs: 10_000,
      });
      if (!result.ok) {
        return {
          ...base,
          available: false,
          error: result.error,
        };
      }
      return {
        ...base,
        available: true,
        version: result.stdout.trim(),
      };
    } catch (err) {
      const info =
        err instanceof HcloudError
          ? err.info
          : errorInfo(
              "HCLOUD_NOT_FOUND",
              err instanceof Error ? err.message : "hcloud check failed",
            );
      return { ...base, available: false, error: info };
    }
  }

  async run(args: string[], options: RunOptions = {}): Promise<HcloudResult> {
    const {
      timeoutMs = this.config.defaultTimeoutMs,
      expectJson = false,
      destructive = false,
      requireToken = true,
    } = options;

    if (requireToken && !this.config.hasToken) {
      return this.failureResult(
        args,
        errorInfo(
          "HCLOUD_TOKEN_MISSING",
          "HCLOUD_TOKEN is not set.",
          "Export HCLOUD_TOKEN with your Hetzner Cloud API token.",
        ),
      );
    }

    if (destructive) {
      try {
        requireDestructiveAllowed(this.config.allowDestructive);
      } catch (err) {
        if (err instanceof HcloudError) {
          return this.failureResult(args, err.info);
        }
        throw err;
      }
    }

    const command = this.fullCommand(args);
    const start = Date.now();

    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let settled = false;

      const child = this.spawnFn(this.config.hcloudPath, args, {
        env: getHcloudEnv(),
        shell: false,
      });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 1000).unref();
      }, timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      const finish = (exitCode: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const durationMs = Date.now() - start;
        const sanitizedStdout = sanitizeOutput(stdout);
        const sanitizedStderr = sanitizeOutput(stderr);

        if (timedOut) {
          resolve({
            ok: false,
            command,
            stdout: sanitizedStdout,
            stderr: sanitizedStderr,
            exitCode,
            timedOut: true,
            durationMs,
            error: errorInfo(
              "HCLOUD_TIMEOUT",
              `hcloud command timed out after ${timeoutMs}ms.`,
            ),
          });
          return;
        }

        if (exitCode !== 0) {
          resolve({
            ok: false,
            command,
            stdout: sanitizedStdout,
            stderr: sanitizedStderr,
            exitCode,
            timedOut: false,
            durationMs,
            error: errorInfo(
              "HCLOUD_EXIT_NONZERO",
              `hcloud exited with code ${exitCode}.`,
              sanitizedStderr.trim() || undefined,
            ),
          });
          return;
        }

        let json: unknown;
        if (expectJson) {
          const trimmed = sanitizedStdout.trim();
          if (!trimmed) {
            resolve({
              ok: false,
              command,
              stdout: sanitizedStdout,
              stderr: sanitizedStderr,
              exitCode,
              timedOut: false,
              durationMs,
              error: errorInfo(
                "HCLOUD_JSON_PARSE_ERROR",
                "Expected JSON output but received empty stdout.",
              ),
            });
            return;
          }
          try {
            json = JSON.parse(trimmed) as unknown;
          } catch {
            resolve({
              ok: false,
              command,
              stdout: sanitizedStdout,
              stderr: sanitizedStderr,
              exitCode,
              timedOut: false,
              durationMs,
              error: errorInfo(
                "HCLOUD_JSON_PARSE_ERROR",
                "Failed to parse hcloud JSON output.",
              ),
            });
            return;
          }
        }

        resolve({
          ok: true,
          command,
          stdout: sanitizedStdout,
          stderr: sanitizedStderr,
          json,
          exitCode,
          timedOut: false,
          durationMs,
        });
      };

      child.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "ENOENT") {
          resolve({
            ok: false,
            command,
            stdout: sanitizeOutput(stdout),
            stderr: sanitizeOutput(stderr),
            exitCode: null,
            timedOut: false,
            durationMs: Date.now() - start,
            error: errorInfo(
              "HCLOUD_NOT_FOUND",
              "hcloud CLI was not found on PATH.",
              "Install hcloud or set HCLOUD_MCP_HCLOUD_PATH.",
            ),
          });
          return;
        }
        resolve({
          ok: false,
          command,
          stdout: sanitizeOutput(stdout),
          stderr: sanitizeOutput(stderr),
          exitCode: null,
          timedOut: false,
          durationMs: Date.now() - start,
          error: errorInfo(
            "HCLOUD_EXIT_NONZERO",
            err.message,
          ),
        });
      });

      child.on("close", (code) => finish(code));
    });
  }

  async runJson<T>(args: string[], options: RunOptions = {}): Promise<T> {
    const result = await this.run(args, { ...options, expectJson: true });
    if (!result.ok || result.error) {
      throw new HcloudError(
        result.error ??
          errorInfo("HCLOUD_EXIT_NONZERO", "hcloud command failed."),
      );
    }
    return result.json as T;
  }

  async runDestructive(
    args: string[],
    expectedConfirmation: string,
    confirmation: ConfirmationInput | undefined,
    options: Omit<RunOptions, "destructive" | "confirmation"> = {},
  ): Promise<HcloudResult> {
    try {
      requireDestructiveAllowed(this.config.allowDestructive);
      requireConfirmation(expectedConfirmation, confirmation);
    } catch (err) {
      if (err instanceof HcloudError) {
        return this.failureResult(args, err.info);
      }
      throw err;
    }
    return this.run(args, { ...options, destructive: true });
  }

  private failureResult(
    args: string[],
    error: HcloudErrorInfo,
  ): HcloudResult {
    return {
      ok: false,
      command: this.fullCommand(args),
      stdout: "",
      stderr: "",
      exitCode: null,
      timedOut: false,
      durationMs: 0,
      error,
    };
  }
}
