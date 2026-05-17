import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  auditFocusSchema,
  budgetSensitivitySchema,
  serverRefSchema,
  trafficLevelSchema,
} from "../hcloud/schemas.js";

export function registerDeploymentPrompts(server: McpServer): void {
  server.registerPrompt(
    "plan_hetzner_deployment",
    {
      description:
        "Plan a minimal Hetzner deployment using catalog and inventory tools first.",
      argsSchema: {
        app_description: z.string().describe("What the application does"),
        expected_traffic: trafficLevelSchema.describe("Expected traffic level"),
        region_preference: z
          .string()
          .optional()
          .describe("Preferred region/location"),
        budget_sensitivity: budgetSensitivitySchema.describe(
          "How sensitive to cost",
        ),
      },
    },
    async ({
      app_description,
      expected_traffic,
      region_preference,
      budget_sensitivity,
    }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Plan a Hetzner Cloud deployment for: ${app_description}

Constraints:
- Expected traffic: ${expected_traffic}
- Region preference: ${region_preference ?? "none specified"}
- Budget sensitivity: ${budget_sensitivity}

Instructions:
1. Call hetzner_location_list and hetzner_server_type_list (or read hetzner://catalog/* resources) before recommending sizes.
2. Prefer the simplest architecture (single server) unless complexity is justified.
3. Use hetzner_server_create with dry_run=true to show the planned hcloud command before any create.
4. Do not create resources without explicit user approval.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "audit_hetzner_project",
    {
      description:
        "Audit the current Hetzner project for cost, security, or reliability.",
      argsSchema: {
        focus: auditFocusSchema.describe("Audit focus area"),
      },
    },
    async ({ focus }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Audit this Hetzner Cloud project with focus: ${focus}

Instructions:
1. Read hetzner://project/summary and list servers, networks, firewalls, and volumes.
2. Identify unused or stopped resources, public IP exposure, and missing firewalls where relevant.
3. Suggest improvements only — do not run mutating tools automatically.
4. For security focus: review firewalls and public networking.
5. For cost focus: flag stopped servers and unattached volumes.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "safe_server_maintenance",
    {
      description:
        "Plan safe maintenance for a server with confirmation before changes.",
      argsSchema: {
        server: serverRefSchema.describe("Server name or ID"),
        maintenance_goal: z.string().describe("What maintenance should achieve"),
      },
    },
    async ({ server, maintenance_goal }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Plan safe maintenance for server "${server}".

Goal: ${maintenance_goal}

Instructions:
1. Call hetzner_server_get to inspect current state.
2. Propose a step-by-step sequence (snapshots/backups if available).
3. Require explicit confirmation before shutdown, delete, or other state-changing tools.
4. Use hetzner_server_shutdown or hetzner_server_delete only with correct confirmation_text and HCLOUD_MCP_ALLOW_DESTRUCTIVE=true.`,
          },
        },
      ],
    }),
  );
}
