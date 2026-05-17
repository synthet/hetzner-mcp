import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { HcloudClient } from "../hcloud/client.js";
import {
  confirmationSchema,
  labelsSchema,
  resourceNameSchema,
  serverRefSchema,
} from "../hcloud/schemas.js";
import { handleHcloudResult, jsonOutputArgs } from "./common.js";

export function registerFirewallTools(
  server: McpServer,
  client: HcloudClient,
): void {
  server.registerTool(
    "hetzner_firewall_list",
    {
      description: "List firewalls.",
      inputSchema: z.object({}),
    },
    async () => {
      const result = await client.run(
        ["firewall", "list", ...jsonOutputArgs()],
        { expectJson: true },
      );
      return handleHcloudResult(result, "Listed firewalls.", {
        firewalls: result.json,
      });
    },
  );

  server.registerTool(
    "hetzner_firewall_get",
    {
      description: "Describe a firewall by name or ID.",
      inputSchema: z.object({ firewall: serverRefSchema }),
    },
    async ({ firewall }) => {
      const result = await client.run(
        ["firewall", "describe", firewall, ...jsonOutputArgs()],
        { expectJson: true },
      );
      return handleHcloudResult(result, `Firewall ${firewall} retrieved.`, {
        firewall: result.json,
      });
    },
  );

  server.registerTool(
    "hetzner_firewall_create",
    {
      description: "Create a firewall (requires confirmation).",
      inputSchema: z.object({
        name: resourceNameSchema,
        labels: labelsSchema,
        ...confirmationSchema.shape,
      }),
    },
    async ({ name, labels, confirm, confirmation_text }) => {
      const phrase = `create firewall ${name}`;
      const args = ["firewall", "create", "--name", name];
      if (labels) {
        for (const [k, v] of Object.entries(labels)) {
          args.push("--label", `${k}=${v}`);
        }
      }
      const result = await client.runDestructive(
        args,
        phrase,
        { confirm, confirmation_text },
        { expectJson: true },
      );
      return handleHcloudResult(result, `Firewall ${name} created.`, {
        firewall: result.json,
      });
    },
  );

  server.registerTool(
    "hetzner_firewall_delete",
    {
      description: "Delete a firewall (requires confirmation).",
      inputSchema: z.object({
        firewall: serverRefSchema,
        ...confirmationSchema.shape,
      }),
    },
    async ({ firewall, confirm, confirmation_text }) => {
      const phrase = `delete firewall ${firewall}`;
      const result = await client.runDestructive(
        ["firewall", "delete", firewall],
        phrase,
        { confirm, confirmation_text },
      );
      return handleHcloudResult(result, `Firewall ${firewall} deleted.`, {
        deleted: firewall,
      });
    },
  );

  server.registerTool(
    "hetzner_firewall_apply_to_resources",
    {
      description:
        "Apply firewall to servers/labels (requires confirmation).",
      inputSchema: z.object({
        firewall: serverRefSchema,
        servers: z.array(z.string()).optional(),
        label_selectors: z.array(z.string()).optional(),
        ...confirmationSchema.shape,
      }),
    },
    async ({
      firewall,
      servers,
      label_selectors,
      confirm,
      confirmation_text,
    }) => {
      const phrase = `apply firewall ${firewall}`;
      const args = ["firewall", "apply-to-resources", firewall];
      if (servers?.length) {
        for (const s of servers) args.push("--server", s);
      }
      if (label_selectors?.length) {
        for (const sel of label_selectors) {
          args.push("--label-selector", sel);
        }
      }
      const result = await client.runDestructive(
        args,
        phrase,
        { confirm, confirmation_text },
        { expectJson: true },
      );
      return handleHcloudResult(
        result,
        `Firewall ${firewall} applied to resources.`,
        { result: result.json },
      );
    },
  );
}
