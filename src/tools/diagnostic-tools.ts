import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { HcloudClient } from "../hcloud/client.js";
import { redactConfig, type HcloudMcpConfig } from "../config.js";
import { handleHcloudResult, toToolResult } from "./common.js";

export function registerDiagnosticTools(
  server: McpServer,
  client: HcloudClient,
  config: HcloudMcpConfig,
): void {
  server.registerTool(
    "hetzner_check",
    {
      description:
        "Verify hcloud CLI setup: binary availability, version, and token presence (token value is never returned).",
      inputSchema: z.object({}),
    },
    async () => {
      const check = await client.checkAvailable();
      const data = {
        hcloud_available: check.available,
        hcloud_path: check.hcloudPath,
        version: check.version,
        has_token: check.hasToken,
        config: redactConfig(config),
        error: check.error,
      };
      const summary = check.available
        ? check.hasToken
          ? "hcloud is available and HCLOUD_TOKEN is set."
          : "hcloud is available but HCLOUD_TOKEN is not set."
        : "hcloud is not available or failed version check.";
      return toToolResult({
        ok: check.available,
        summary,
        data,
        command: { executable: client.executable, args: ["version"] },
        warnings: check.hasToken ? undefined : ["HCLOUD_TOKEN is not set"],
      });
    },
  );

  server.registerTool(
    "hetzner_hcloud_version",
    {
      description: "Return hcloud CLI version information.",
      inputSchema: z.object({}),
    },
    async () => {
      const result = await client.run(["version"], { requireToken: false });
      return handleHcloudResult(result, "hcloud version retrieved.", {
        version: result.stdout.trim(),
        raw: result.stdout.trim(),
      });
    },
  );
}
