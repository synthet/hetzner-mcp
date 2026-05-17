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

export function registerVolumeTools(
  server: McpServer,
  client: HcloudClient,
): void {
  server.registerTool(
    "hetzner_volume_list",
    {
      description: "List volumes.",
      inputSchema: z.object({}),
    },
    async () => {
      const result = await client.run(
        ["volume", "list", ...jsonOutputArgs()],
        { expectJson: true },
      );
      return handleHcloudResult(result, "Listed volumes.", {
        volumes: result.json,
      });
    },
  );

  server.registerTool(
    "hetzner_volume_get",
    {
      description: "Describe a volume by name or ID.",
      inputSchema: z.object({ volume: serverRefSchema }),
    },
    async ({ volume }) => {
      const result = await client.run(
        ["volume", "describe", volume, ...jsonOutputArgs()],
        { expectJson: true },
      );
      return handleHcloudResult(result, `Volume ${volume} retrieved.`, {
        volume: result.json,
      });
    },
  );

  server.registerTool(
    "hetzner_volume_create",
    {
      description: "Create a volume (requires confirmation).",
      inputSchema: z.object({
        name: resourceNameSchema,
        size: z.number().int().positive(),
        location: z.string(),
        labels: labelsSchema,
        ...confirmationSchema.shape,
      }),
    },
    async ({ name, size, location, labels, confirm, confirmation_text }) => {
      const phrase = `create volume ${name}`;
      const args = [
        "volume",
        "create",
        "--name",
        name,
        "--size",
        String(size),
        "--location",
        location,
      ];
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
      return handleHcloudResult(result, `Volume ${name} created.`, {
        volume: result.json,
      });
    },
  );

  server.registerTool(
    "hetzner_volume_attach",
    {
      description: "Attach a volume to a server (requires confirmation).",
      inputSchema: z.object({
        volume: serverRefSchema,
        server: serverRefSchema,
        ...confirmationSchema.shape,
      }),
    },
    async ({ volume, server, confirm, confirmation_text }) => {
      const phrase = `attach volume ${volume} to server ${server}`;
      const result = await client.runDestructive(
        ["volume", "attach", volume, "--server", server],
        phrase,
        { confirm, confirmation_text },
        { expectJson: true },
      );
      return handleHcloudResult(
        result,
        `Volume ${volume} attached to ${server}.`,
        { action: result.json },
      );
    },
  );

  server.registerTool(
    "hetzner_volume_detach",
    {
      description: "Detach a volume (requires confirmation).",
      inputSchema: z.object({
        volume: serverRefSchema,
        ...confirmationSchema.shape,
      }),
    },
    async ({ volume, confirm, confirmation_text }) => {
      const phrase = `detach volume ${volume}`;
      const result = await client.runDestructive(
        ["volume", "detach", volume],
        phrase,
        { confirm, confirmation_text },
      );
      return handleHcloudResult(result, `Volume ${volume} detached.`, {
        volume,
      });
    },
  );

  server.registerTool(
    "hetzner_volume_delete",
    {
      description: "Delete a volume (requires confirmation).",
      inputSchema: z.object({
        volume: serverRefSchema,
        ...confirmationSchema.shape,
      }),
    },
    async ({ volume, confirm, confirmation_text }) => {
      const phrase = `delete volume ${volume}`;
      const result = await client.runDestructive(
        ["volume", "delete", volume],
        phrase,
        { confirm, confirmation_text },
      );
      return handleHcloudResult(result, `Volume ${volume} deleted.`, {
        deleted: volume,
      });
    },
  );
}
