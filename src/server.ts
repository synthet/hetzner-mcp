import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig, type HcloudMcpConfig } from "./config.js";
import { HcloudClient } from "./hcloud/client.js";
import { registerDeploymentPrompts } from "./prompts/deployment-prompts.js";
import { registerProjectResources } from "./resources/project-summary.js";
import { registerCatalogTools } from "./tools/catalog-tools.js";
import { registerDiagnosticTools } from "./tools/diagnostic-tools.js";
import { registerFirewallTools } from "./tools/firewall-tools.js";
import { registerNetworkTools } from "./tools/network-tools.js";
import { registerServerTools } from "./tools/server-tools.js";
import { registerSshKeyTools } from "./tools/ssh-key-tools.js";
import { registerVolumeTools } from "./tools/volume-tools.js";

export function createMcpServer(
  config: HcloudMcpConfig = loadConfig(),
): { server: McpServer; client: HcloudClient } {
  const client = new HcloudClient(config);

  const server = new McpServer(
    {
      name: "hetzner-mcp",
      version: "0.1.0",
    },
    {
      instructions: `Hetzner Cloud MCP server wrapping the hcloud CLI.

Safety:
- Destructive operations require HCLOUD_MCP_ALLOW_DESTRUCTIVE=true and exact confirmation_text.
- hetzner_server_create defaults to dry_run=true.
- Never use arbitrary shell commands; only registered tools.

Workflow:
- Run hetzner_check first when diagnosing setup.
- Prefer read-only tools and hetzner:// resources before mutations.`,
    },
  );

  registerDiagnosticTools(server, client, config);
  registerServerTools(server, client);
  registerCatalogTools(server, client);
  registerSshKeyTools(server, client);
  registerNetworkTools(server, client);
  registerFirewallTools(server, client);
  registerVolumeTools(server, client);
  registerProjectResources(server, client);
  registerDeploymentPrompts(server);

  return { server, client };
}
