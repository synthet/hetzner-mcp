import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { HcloudClient } from "../hcloud/client.js";
import { handleHcloudResult, jsonOutputArgs } from "./common.js";

export function registerCatalogTools(
  server: McpServer,
  client: HcloudClient,
): void {
  server.registerTool(
    "hetzner_location_list",
    {
      description: "List available Hetzner Cloud locations.",
      inputSchema: z.object({}),
    },
    async () => {
      const result = await client.run(
        ["location", "list", ...jsonOutputArgs()],
        { expectJson: true },
      );
      return handleHcloudResult(
        result,
        "Listed locations.",
        { locations: result.json },
      );
    },
  );

  server.registerTool(
    "hetzner_datacenter_list",
    {
      description: "List available Hetzner Cloud datacenters.",
      inputSchema: z.object({}),
    },
    async () => {
      const result = await client.run(
        ["datacenter", "list", ...jsonOutputArgs()],
        { expectJson: true },
      );
      return handleHcloudResult(
        result,
        "Listed datacenters.",
        { datacenters: result.json },
      );
    },
  );

  server.registerTool(
    "hetzner_server_type_list",
    {
      description: "List available server types.",
      inputSchema: z.object({}),
    },
    async () => {
      const result = await client.run(
        ["server-type", "list", ...jsonOutputArgs()],
        { expectJson: true },
      );
      return handleHcloudResult(
        result,
        "Listed server types.",
        { server_types: result.json },
      );
    },
  );

  server.registerTool(
    "hetzner_image_list",
    {
      description: "List images with optional client-side filters.",
      inputSchema: z.object({
        architecture: z.string().optional(),
        type: z.string().optional(),
        name_contains: z.string().optional(),
      }),
    },
    async ({ architecture, type, name_contains }) => {
      const result = await client.run(
        ["image", "list", ...jsonOutputArgs()],
        { expectJson: true },
      );
      if (!result.ok) {
        return handleHcloudResult(result, "Failed to list images.", {});
      }
      let images = (result.json as unknown[]) ?? [];
      if (architecture) {
        images = images.filter(
          (img) =>
            (img as { architecture?: string }).architecture === architecture,
        );
      }
      if (type) {
        images = images.filter(
          (img) => (img as { type?: string }).type === type,
        );
      }
      if (name_contains) {
        const needle = name_contains.toLowerCase();
        images = images.filter((img) => {
          const name = (img as { name?: string }).name?.toLowerCase() ?? "";
          const desc =
            (img as { description?: string }).description?.toLowerCase() ??
            "";
          return name.includes(needle) || desc.includes(needle);
        });
      }
      return handleHcloudResult(
        result,
        `Listed ${images.length} image(s).`,
        { images, count: images.length },
      );
    },
  );
}
