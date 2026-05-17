import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { HcloudClient } from "../hcloud/client.js";
import {
  confirmationSchema,
  labelsSchema,
  metricsTypeSchema,
  serverRefSchema,
} from "../hcloud/schemas.js";
import { summarizeUserData } from "../hcloud/validators.js";
import {
  compactServerSummary,
  handleHcloudResult,
  jsonOutputArgs,
  toToolResult,
} from "./common.js";

function buildServerCreateArgs(input: {
  name: string;
  server_type: string;
  image: string;
  location?: string;
  datacenter?: string;
  ssh_keys?: string[];
  labels?: Record<string, string>;
  firewalls?: string[];
  networks?: string[];
  user_data?: string;
  start_after_create?: boolean;
}): string[] {
  const args = [
    "server",
    "create",
    "--name",
    input.name,
    "--type",
    input.server_type,
    "--image",
    input.image,
  ];
  if (input.location) args.push("--location", input.location);
  if (input.datacenter) args.push("--datacenter", input.datacenter);
  if (input.ssh_keys?.length) {
    for (const key of input.ssh_keys) args.push("--ssh-key", key);
  }
  if (input.labels) {
    for (const [k, v] of Object.entries(input.labels)) {
      args.push("--label", `${k}=${v}`);
    }
  }
  if (input.firewalls?.length) {
    for (const fw of input.firewalls) args.push("--firewall", fw);
  }
  if (input.networks?.length) {
    for (const net of input.networks) args.push("--network", net);
  }
  if (input.start_after_create === false) {
    args.push("--start-after-create=false");
  }
  return args;
}

export function registerServerTools(
  server: McpServer,
  client: HcloudClient,
): void {
  server.registerTool(
    "hetzner_server_list",
    {
      description: "List servers in the project.",
      inputSchema: z.object({
        selector: z.string().optional(),
        sort: z.string().optional(),
      }),
    },
    async ({ selector, sort }) => {
      const args = ["server", "list", ...jsonOutputArgs()];
      if (selector) args.push("--selector", selector);
      if (sort) args.push("--sort", sort);
      const result = await client.run(args, { expectJson: true });
      const servers = (result.json as Record<string, unknown>[]) ?? [];
      return handleHcloudResult(
        result,
        `Listed ${servers.length} server(s).`,
        {
          servers: servers.map((s) => compactServerSummary(s)),
          raw: result.json,
        },
      );
    },
  );

  server.registerTool(
    "hetzner_server_get",
    {
      description: "Describe a server by name or ID.",
      inputSchema: z.object({ server: serverRefSchema }),
    },
    async ({ server: serverRef }) => {
      const result = await client.run(
        ["server", "describe", serverRef, ...jsonOutputArgs()],
        { expectJson: true },
      );
      const serverObj = result.json as Record<string, unknown>;
      return handleHcloudResult(result, `Server ${serverRef} retrieved.`, {
        summary: compactServerSummary(serverObj),
        server: result.json,
      });
    },
  );

  server.registerTool(
    "hetzner_server_metrics",
    {
      description:
        "Fetch server metrics (ALPHA in hcloud). Returns unsupported if CLI lacks the command.",
      inputSchema: z.object({
        server: serverRefSchema,
        type: metricsTypeSchema,
        start: z.string(),
        end: z.string(),
        step: z.string().optional(),
      }),
    },
    async ({ server: serverRef, type, start, end, step }) => {
      const args = [
        "server",
        "metrics",
        serverRef,
        "--type",
        type,
        "--start",
        start,
        "--end",
        end,
      ];
      if (step) args.push("--step", step);
      const result = await client.run([...args, ...jsonOutputArgs()], {
        expectJson: true,
      });
      if (
        !result.ok &&
        result.stderr.toLowerCase().includes("unknown command")
      ) {
        return toToolResult({
          ok: false,
          summary: "Server metrics not supported by this hcloud version.",
          error: {
            code: "UNSUPPORTED_BY_HCLOUD_VERSION",
            message:
              "hcloud server metrics is not available in the installed CLI.",
            hint: "Upgrade hcloud or use the Hetzner Cloud API directly.",
          },
          command: { executable: client.executable, args },
        });
      }
      return handleHcloudResult(result, `Metrics for ${serverRef} retrieved.`, {
        metrics: result.json,
      });
    },
  );

  server.registerTool(
    "hetzner_server_create",
    {
      description:
        "Create a server. Defaults to dry_run=true (plan only, no execution).",
      inputSchema: z.object({
        name: z.string().min(1).max(63),
        server_type: z.string().min(1),
        image: z.string().min(1),
        location: z.string().optional(),
        datacenter: z.string().optional(),
        ssh_keys: z.array(z.string()).optional(),
        labels: labelsSchema,
        firewalls: z.array(z.string()).optional(),
        networks: z.array(z.string()).optional(),
        user_data: z.string().max(65536).optional(),
        start_after_create: z.boolean().default(true),
        dry_run: z.boolean().default(true),
      }),
    },
    async (input) => {
      const plannedArgs = buildServerCreateArgs(input);
      if (input.dry_run) {
        const dryArgs = [...plannedArgs];
        if (input.user_data) {
          dryArgs.push("--user-data-from-file", "<cloud-init>");
        }
        return toToolResult({
          ok: true,
          summary: "Dry run: server create planned but not executed.",
          data: {
            planned_command: { executable: client.executable, args: dryArgs },
            validation: {
              name: input.name,
              server_type: input.server_type,
              image: input.image,
              location: input.location,
              datacenter: input.datacenter,
              user_data_summary: summarizeUserData(input.user_data),
            },
          },
          command: { executable: client.executable, args: dryArgs },
          warnings: ["Set dry_run=false to execute this command."],
        });
      }

      let execArgs = plannedArgs;
      let tempDir: string | undefined;
      if (input.user_data) {
        tempDir = await mkdtemp(join(tmpdir(), "hetzner-mcp-"));
        const userDataPath = join(tempDir, "user-data");
        await writeFile(userDataPath, input.user_data, "utf8");
        execArgs = [...plannedArgs, "--user-data-from-file", userDataPath];
      }

      try {
        const result = await client.run(execArgs, { expectJson: true });
        return handleHcloudResult(result, `Server ${input.name} created.`, {
          server: result.json,
        });
      } finally {
        if (tempDir) await rm(tempDir, { recursive: true, force: true });
      }
    },
  );

  server.registerTool(
    "hetzner_server_poweron",
    {
      description: "Power on a server.",
      inputSchema: z.object({ server: serverRefSchema }),
    },
    async ({ server: serverRef }) => {
      const result = await client.run(["server", "poweron", serverRef]);
      return handleHcloudResult(result, `Power on requested for ${serverRef}.`, {
        action: result.stdout.trim() || "poweron initiated",
      });
    },
  );

  server.registerTool(
    "hetzner_server_shutdown",
    {
      description: "Gracefully shut down a server (requires confirmation).",
      inputSchema: z.object({
        server: serverRefSchema,
        ...confirmationSchema.shape,
      }),
    },
    async ({ server: serverRef, confirm, confirmation_text }) => {
      const phrase = `shutdown server ${serverRef}`;
      const result = await client.runDestructive(
        ["server", "shutdown", serverRef],
        phrase,
        { confirm, confirmation_text },
      );
      return handleHcloudResult(
        result,
        `Shutdown requested for ${serverRef}.`,
        { action: result.stdout.trim() || "shutdown initiated" },
      );
    },
  );

  server.registerTool(
    "hetzner_server_delete",
    {
      description: "Delete a server (destructive, requires confirmation).",
      inputSchema: z.object({
        server: serverRefSchema,
        ...confirmationSchema.shape,
      }),
    },
    async ({ server: serverRef, confirm, confirmation_text }) => {
      const phrase = `delete server ${serverRef}`;
      const result = await client.runDestructive(
        ["server", "delete", serverRef],
        phrase,
        { confirm, confirmation_text },
      );
      return handleHcloudResult(result, `Server ${serverRef} deleted.`, {
        deleted: serverRef,
      });
    },
  );
}
