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

export function registerNetworkTools(
  server: McpServer,
  client: HcloudClient,
): void {
  server.registerTool(
    "hetzner_network_list",
    {
      description: "List private networks.",
      inputSchema: z.object({}),
    },
    async () => {
      const result = await client.run(
        ["network", "list", ...jsonOutputArgs()],
        { expectJson: true },
      );
      return handleHcloudResult(result, "Listed networks.", {
        networks: result.json,
      });
    },
  );

  server.registerTool(
    "hetzner_network_get",
    {
      description: "Describe a network by name or ID.",
      inputSchema: z.object({ network: serverRefSchema }),
    },
    async ({ network }) => {
      const result = await client.run(
        ["network", "describe", network, ...jsonOutputArgs()],
        { expectJson: true },
      );
      return handleHcloudResult(result, `Network ${network} retrieved.`, {
        network: result.json,
      });
    },
  );

  server.registerTool(
    "hetzner_subnet_list",
    {
      description: "List subnets for a network (from network describe).",
      inputSchema: z.object({ network: serverRefSchema }),
    },
    async ({ network }) => {
      const result = await client.run(
        ["network", "describe", network, ...jsonOutputArgs()],
        { expectJson: true },
      );
      const net = result.json as { subnets?: unknown[] };
      return handleHcloudResult(result, `Subnets for network ${network}.`, {
        subnets: net?.subnets ?? [],
      });
    },
  );

  server.registerTool(
    "hetzner_network_create",
    {
      description: "Create a private network (requires confirmation).",
      inputSchema: z.object({
        name: resourceNameSchema,
        ip_range: z.string(),
        labels: labelsSchema,
        ...confirmationSchema.shape,
      }),
    },
    async ({ name, ip_range, labels, confirm, confirmation_text }) => {
      const phrase = `create network ${name}`;
      const args = ["network", "create", "--name", name, "--ip-range", ip_range];
      if (labels) {
        for (const [k, v] of Object.entries(labels)) {
          args.push("--label", `${k}=${v}`);
        }
      }
      const result = await client.runDestructive(args, phrase, {
        confirm,
        confirmation_text,
      });
      return handleHcloudResult(result, `Network ${name} created.`, {
        network: result.json,
      });
    },
  );

  server.registerTool(
    "hetzner_network_delete",
    {
      description: "Delete a network (requires confirmation).",
      inputSchema: z.object({
        network: serverRefSchema,
        ...confirmationSchema.shape,
      }),
    },
    async ({ network, confirm, confirmation_text }) => {
      const phrase = `delete network ${network}`;
      const result = await client.runDestructive(
        ["network", "delete", network],
        phrase,
        { confirm, confirmation_text },
      );
      return handleHcloudResult(result, `Network ${network} deleted.`, {
        deleted: network,
      });
    },
  );

  server.registerTool(
    "hetzner_subnet_add",
    {
      description: "Add a subnet to a network (requires confirmation).",
      inputSchema: z.object({
        network: serverRefSchema,
        type: z.enum(["cloud", "vswitch"]),
        network_zone: z.string(),
        ip_range: z.string(),
        ...confirmationSchema.shape,
      }),
    },
    async ({
      network,
      type,
      network_zone,
      ip_range,
      confirm,
      confirmation_text,
    }) => {
      const phrase = `add subnet to network ${network}`;
      const result = await client.runDestructive(
        [
          "network",
          "add-subnet",
          network,
          "--type",
          type,
          "--network-zone",
          network_zone,
          "--ip-range",
          ip_range,
        ],
        phrase,
        { confirm, confirmation_text },
        { expectJson: true },
      );
      return handleHcloudResult(result, `Subnet added to ${network}.`, {
        subnet: result.json,
      });
    },
  );

  server.registerTool(
    "hetzner_subnet_delete",
    {
      description: "Delete a subnet from a network (requires confirmation).",
      inputSchema: z.object({
        network: serverRefSchema,
        subnet: z.string(),
        ...confirmationSchema.shape,
      }),
    },
    async ({ network, subnet, confirm, confirmation_text }) => {
      const phrase = `delete subnet ${subnet} from network ${network}`;
      const result = await client.runDestructive(
        ["network", "delete-subnet", network, "--subnet", subnet],
        phrase,
        { confirm, confirmation_text },
      );
      return handleHcloudResult(result, `Subnet removed from ${network}.`, {
        network,
        subnet,
      });
    },
  );

  server.registerTool(
    "hetzner_network_attach_server",
    {
      description: "Attach a server to a network (requires confirmation).",
      inputSchema: z.object({
        network: serverRefSchema,
        server: serverRefSchema,
        ip: z.string().optional(),
        ...confirmationSchema.shape,
      }),
    },
    async ({ network, server, ip, confirm, confirmation_text }) => {
      const phrase = `attach server ${server} to network ${network}`;
      const args = [
        "server",
        "attach-to-network",
        server,
        "--network",
        network,
      ];
      if (ip) args.push("--ip", ip);
      const result = await client.runDestructive(
        args,
        phrase,
        { confirm, confirmation_text },
        { expectJson: true },
      );
      return handleHcloudResult(
        result,
        `Server ${server} attached to ${network}.`,
        { action: result.json },
      );
    },
  );

  server.registerTool(
    "hetzner_network_detach_server",
    {
      description: "Detach a server from a network (requires confirmation).",
      inputSchema: z.object({
        network: serverRefSchema,
        server: serverRefSchema,
        ...confirmationSchema.shape,
      }),
    },
    async ({ network, server, confirm, confirmation_text }) => {
      const phrase = `detach server ${server} from network ${network}`;
      const result = await client.runDestructive(
        ["server", "detach-from-network", server, "--network", network],
        phrase,
        { confirm, confirmation_text },
      );
      return handleHcloudResult(
        result,
        `Server ${server} detached from ${network}.`,
        { server, network },
      );
    },
  );
}
