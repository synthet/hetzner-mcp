import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { buildProjectSummary } from "../src/services/inventory.js";
import { HcloudClient, type SpawnFn } from "../src/hcloud/client.js";
import { createMcpServer } from "../src/server.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function mockSpawn(responses: Record<string, string>): SpawnFn {
  return (_cmd, args) => {
    const key = args.join(" ");
    const child = new EventEmitter() as ReturnType<SpawnFn> & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      kill: () => void;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => undefined;
    queueMicrotask(() => {
      const body = responses[key] ?? "[]";
      child.stdout.emit("data", Buffer.from(body));
      child.emit("close", 0);
    });
    return child;
  };
}

describe("inventory", () => {
  it("builds empty project summary", async () => {
    const config = loadConfig({ HCLOUD_TOKEN: "t" });
    const client = new HcloudClient(
      config,
      mockSpawn({
        "server list -o json": "[]",
        "location list -o json": '[{"name":"fsn1"}]',
        "volume list -o json": "[]",
        "network list -o json": "[]",
        "firewall list -o json": "[]",
      }),
    );
    const summary = await buildProjectSummary(client);
    expect(summary.servers.total).toBe(0);
    expect(summary.locations).toContain("fsn1");
  });
});

describe("security", () => {
  it("creates MCP server without raw command tools in source", () => {
    const { server } = createMcpServer(
      loadConfig({ HCLOUD_TOKEN: "t", HCLOUD_MCP_HCLOUD_PATH: "hcloud" }),
    );
    expect(server).toBeDefined();
    const source = readFileSync(join(repoRoot, "src/server.ts"), "utf8");
    expect(source).not.toMatch(/hcloud_raw|hetzner_raw/);
  });
});

describe("config", () => {
  it("rejects invalid timeout", () => {
    expect(() =>
      loadConfig({ HCLOUD_MCP_DEFAULT_TIMEOUT_MS: "not-a-number" }),
    ).toThrow(/Invalid HCLOUD_MCP_DEFAULT_TIMEOUT_MS/);
  });

  it("uses custom hcloud path", () => {
    const config = loadConfig({
      HCLOUD_MCP_HCLOUD_PATH: "/usr/local/bin/hcloud",
    });
    expect(config.hcloudPath).toBe("/usr/local/bin/hcloud");
  });
});
