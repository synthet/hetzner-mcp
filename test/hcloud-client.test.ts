import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config.js";
import { HcloudClient, type SpawnFn } from "../src/hcloud/client.js";

function mockSpawn(output: {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: NodeJS.ErrnoException;
}): SpawnFn {
  return () => {
    const child = new EventEmitter() as ReturnType<SpawnFn> & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      kill: ReturnType<typeof vi.fn>;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = vi.fn();

    queueMicrotask(() => {
      if (output.error) {
        child.emit("error", output.error);
        return;
      }
      if (output.stdout) child.stdout.emit("data", Buffer.from(output.stdout));
      if (output.stderr) child.stderr.emit("data", Buffer.from(output.stderr));
      child.emit("close", output.exitCode ?? 0);
    });

    return child;
  };
}

describe("HcloudClient", () => {
  it("runs command with json output", async () => {
    const config = loadConfig({
      HCLOUD_TOKEN: "test-token",
      HCLOUD_MCP_HCLOUD_PATH: "hcloud",
    });
    const client = new HcloudClient(
      config,
      mockSpawn({ stdout: '[{"id":1}]' }),
    );
    const result = await client.run(["server", "list", "-o", "json"], {
      expectJson: true,
    });
    expect(result.ok).toBe(true);
    expect(result.json).toEqual([{ id: 1 }]);
    expect(result.command).toEqual(["hcloud", "server", "list", "-o", "json"]);
  });

  it("returns HCLOUD_TOKEN_MISSING when token absent", async () => {
    const config = loadConfig({});
    const client = new HcloudClient(config, mockSpawn({ stdout: "[]" }));
    const result = await client.run(["server", "list", "-o", "json"]);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("HCLOUD_TOKEN_MISSING");
  });

  it("returns HCLOUD_NOT_FOUND on ENOENT", async () => {
    const config = loadConfig({ HCLOUD_TOKEN: "t" });
    const err = Object.assign(new Error("spawn ENOENT"), {
      code: "ENOENT",
    }) as NodeJS.ErrnoException;
    const client = new HcloudClient(config, mockSpawn({ error: err }));
    const result = await client.run(["version"], { requireToken: false });
    expect(result.error?.code).toBe("HCLOUD_NOT_FOUND");
  });

  it("returns HCLOUD_JSON_PARSE_ERROR on invalid json", async () => {
    const config = loadConfig({ HCLOUD_TOKEN: "t" });
    const client = new HcloudClient(
      config,
      mockSpawn({ stdout: "not json" }),
    );
    const result = await client.run(["server", "list", "-o", "json"], {
      expectJson: true,
    });
    expect(result.error?.code).toBe("HCLOUD_JSON_PARSE_ERROR");
  });

  it("blocks destructive when disabled", async () => {
    const config = loadConfig({
      HCLOUD_TOKEN: "t",
      HCLOUD_MCP_ALLOW_DESTRUCTIVE: "false",
    });
    const client = new HcloudClient(config, mockSpawn({ stdout: "" }));
    const result = await client.runDestructive(
      ["server", "delete", "my-server"],
      "delete server my-server",
      { confirm: true, confirmation_text: "delete server my-server" },
    );
    expect(result.error?.code).toBe("DESTRUCTIVE_DISABLED");
  });

  it("requires confirmation phrase", async () => {
    const config = loadConfig({
      HCLOUD_TOKEN: "t",
      HCLOUD_MCP_ALLOW_DESTRUCTIVE: "true",
    });
    const client = new HcloudClient(config, mockSpawn({ stdout: "" }));
    const result = await client.runDestructive(
      ["server", "delete", "my-server"],
      "delete server my-server",
      { confirm: true, confirmation_text: "wrong" },
    );
    expect(result.error?.code).toBe("CONFIRMATION_MISMATCH");
  });

  it("runs destructive when enabled and confirmed", async () => {
    const config = loadConfig({
      HCLOUD_TOKEN: "t",
      HCLOUD_MCP_ALLOW_DESTRUCTIVE: "true",
    });
    const spawn = mockSpawn({ stdout: "deleted" });
    const client = new HcloudClient(config, spawn);
    const result = await client.runDestructive(
      ["server", "delete", "my-server"],
      "delete server my-server",
      { confirm: true, confirmation_text: "delete server my-server" },
    );
    expect(result.ok).toBe(true);
  });

  it("sanitizes token-like stderr", async () => {
    const config = loadConfig({ HCLOUD_TOKEN: "t" });
    const client = new HcloudClient(
      config,
      mockSpawn({
        stderr: "HCLOUD_TOKEN=secret123 failed",
        exitCode: 1,
      }),
    );
    const result = await client.run(["server", "list"]);
    expect(result.stderr).not.toContain("secret123");
    expect(result.stderr).toContain("[REDACTED]");
  });
});
