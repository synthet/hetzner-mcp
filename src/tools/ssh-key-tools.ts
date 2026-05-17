import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { HcloudClient } from "../hcloud/client.js";
import { serverRefSchema } from "../hcloud/schemas.js";
import { handleHcloudResult, jsonOutputArgs } from "./common.js";

export function registerSshKeyTools(
  server: McpServer,
  client: HcloudClient,
): void {
  server.registerTool(
    "hetzner_ssh_key_list",
    {
      description: "List SSH keys in the project.",
      inputSchema: z.object({}),
    },
    async () => {
      const result = await client.run(
        ["ssh-key", "list", ...jsonOutputArgs()],
        { expectJson: true },
      );
      const keys = (result.json as unknown[]) ?? [];
      const summaries = keys.map((k) => {
        const key = k as { id?: number; name?: string; fingerprint?: string };
        return {
          id: key.id,
          name: key.name,
          fingerprint: key.fingerprint,
        };
      });
      return handleHcloudResult(result, `Listed ${summaries.length} SSH key(s).`, {
        ssh_keys: summaries,
        raw: result.json,
      });
    },
  );

  server.registerTool(
    "hetzner_ssh_key_get",
    {
      description: "Describe an SSH key by name or ID.",
      inputSchema: z.object({ ssh_key: serverRefSchema }),
    },
    async ({ ssh_key }) => {
      const result = await client.run(
        ["ssh-key", "describe", ssh_key, ...jsonOutputArgs()],
        { expectJson: true },
      );
      const key = result.json as { id?: number; name?: string; fingerprint?: string };
      return handleHcloudResult(result, `SSH key ${ssh_key} retrieved.`, {
        summary: {
          id: key?.id,
          name: key?.name,
          fingerprint: key?.fingerprint,
        },
        ssh_key: result.json,
      });
    },
  );
}
