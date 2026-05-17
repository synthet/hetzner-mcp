import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HcloudClient } from "../hcloud/client.js";
import {
  buildProjectSummary,
  listLocations,
  listServerTypes,
  listServers,
} from "../services/inventory.js";
import { compactServerSummary } from "../tools/common.js";

export function registerProjectResources(
  server: McpServer,
  client: HcloudClient,
): void {
  server.registerResource(
    "hetzner-project-summary",
    "hetzner://project/summary",
    {
      description: "Compact summary of the Hetzner Cloud project",
      mimeType: "application/json",
    },
    async () => {
      try {
        const summary = await buildProjectSummary(client);
        return {
          contents: [
            {
              uri: "hetzner://project/summary",
              mimeType: "application/json",
              text: JSON.stringify(summary, null, 2),
            },
          ],
        };
      } catch {
        const empty = {
          servers: { total: 0, running: 0, off: 0 },
          locations: [],
          public_ips: 0,
          volumes: 0,
          networks: 0,
          firewalls: 0,
        };
        return {
          contents: [
            {
              uri: "hetzner://project/summary",
              mimeType: "application/json",
              text: JSON.stringify(empty, null, 2),
            },
          ],
        };
      }
    },
  );

  server.registerResource(
    "hetzner-servers",
    "hetzner://servers",
    {
      description: "Current server inventory",
      mimeType: "application/json",
    },
    async () => {
      const servers = await listServers(client);
      const compact = servers.map((s) => compactServerSummary(s));
      return {
        contents: [
          {
            uri: "hetzner://servers",
            mimeType: "application/json",
            text: JSON.stringify(compact, null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    "hetzner-catalog-server-types",
    "hetzner://catalog/server-types",
    {
      description: "Available server types",
      mimeType: "application/json",
    },
    async () => {
      const types = await listServerTypes(client);
      return {
        contents: [
          {
            uri: "hetzner://catalog/server-types",
            mimeType: "application/json",
            text: JSON.stringify(types, null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    "hetzner-catalog-locations",
    "hetzner://catalog/locations",
    {
      description: "Available locations",
      mimeType: "application/json",
    },
    async () => {
      const locations = await listLocations(client);
      return {
        contents: [
          {
            uri: "hetzner://catalog/locations",
            mimeType: "application/json",
            text: JSON.stringify(locations, null, 2),
          },
        ],
      };
    },
  );
}
