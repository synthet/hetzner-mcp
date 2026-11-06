# hetzner-mcp

MCP server for [Hetzner Cloud](https://www.hetzner.com/cloud) that wraps the official [`hcloud`](https://github.com/hetznercloud/cli) CLI. It exposes structured tools, resources, and prompts for AI agents to inspect and optionally manage infrastructure safely.

## Security model

- **No arbitrary shell execution** — every tool maps to a fixed `hcloud` argv array via `spawn` (never `exec` with user strings).
- **Secrets** — `HCLOUD_TOKEN` is never logged or returned. stderr/stdout are sanitized defensively.
- **Destructive operations** — disabled by default (`HCLOUD_MCP_ALLOW_DESTRUCTIVE=false`). When enabled, tools require `confirm: true` and an exact `confirmation_text` phrase.
- **Server create** — `hetzner_server_create` defaults to `dry_run: true` (plan only).

## Requirements

- Node.js 20+
- [hcloud CLI](https://github.com/hetznercloud/cli) on `PATH` (or set `HCLOUD_MCP_HCLOUD_PATH`)
- `HCLOUD_TOKEN` — [Hetzner Cloud API token](https://docs.hetzner.cloud/#authentication)

## Installation

```bash
git clone git@github.com:synthet/hetzner-mcp.git
cd hetzner-mcp
npm install
npm run build
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `HCLOUD_TOKEN` | — | API token (required for API calls) |
| `HCLOUD_MCP_HCLOUD_PATH` | `hcloud` | Path to hcloud binary |
| `HCLOUD_MCP_DEFAULT_TIMEOUT_MS` | `30000` | Command timeout |
| `HCLOUD_MCP_ALLOW_DESTRUCTIVE` | `false` | Allow delete/shutdown and other confirmed mutations |
| `HCLOUD_MCP_LOG_LEVEL` | `info` | Log level |

Copy [`.env.example`](.env.example) for a local template. The server reads process environment variables only; it does not load `.env`. Pass `HCLOUD_TOKEN` in the client `env` block below, or start the process with `node --env-file=.env dist/index.js`.

`hcloud version` does not prove the token works. Check API access with `hcloud server list` after the token is in the environment, and do not print the token.

## Run

```bash
npm run start
```

Stdio transport only (for Cursor, Claude Desktop, etc.). `npm start` does not load `.env`.

## MCP client config (Cursor)

```json
{
  "mcpServers": {
    "hetzner": {
      "command": "node",
      "args": ["D:/Projects/hetzner-mcp/dist/index.js"],
      "env": {
        "HCLOUD_TOKEN": "your-token-here",
        "HCLOUD_MCP_ALLOW_DESTRUCTIVE": "false"
      }
    }
  }
}
```

Use an absolute path to `dist/index.js` on your machine.

## Development

```bash
npm test
npm run typecheck
npm run lint
```

## Tools

### Diagnostics

- `hetzner_check` — verify hcloud + token presence
- `hetzner_hcloud_version` — CLI version

### Servers

- `hetzner_server_list`, `hetzner_server_get`, `hetzner_server_metrics`
- `hetzner_server_create` (dry-run default), `hetzner_server_poweron`
- `hetzner_server_shutdown`, `hetzner_server_delete` (confirmed)

### Catalog

- `hetzner_location_list`, `hetzner_datacenter_list`
- `hetzner_server_type_list`, `hetzner_image_list`

### SSH keys

- `hetzner_ssh_key_list`, `hetzner_ssh_key_get`

### Networks

- `hetzner_network_list`, `hetzner_network_get`, `hetzner_subnet_list`
- `hetzner_network_create`, `hetzner_network_delete`
- `hetzner_subnet_add`, `hetzner_subnet_delete`
- `hetzner_network_attach_server`, `hetzner_network_detach_server`

### Firewalls

- `hetzner_firewall_list`, `hetzner_firewall_get`
- `hetzner_firewall_create`, `hetzner_firewall_delete`
- `hetzner_firewall_apply_to_resources`

### Volumes

- `hetzner_volume_list`, `hetzner_volume_get`
- `hetzner_volume_create`, `hetzner_volume_attach`, `hetzner_volume_detach`, `hetzner_volume_delete`

## Resources

- `hetzner://project/summary`
- `hetzner://servers`
- `hetzner://catalog/server-types`
- `hetzner://catalog/locations`

## Prompts

- `plan_hetzner_deployment`
- `audit_hetzner_project`
- `safe_server_maintenance`

## Destructive operations

1. Set `HCLOUD_MCP_ALLOW_DESTRUCTIVE=true`
2. Call the tool with `confirm: true` and exact `confirmation_text` (e.g. `"delete server my-server"`)

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `HCLOUD_NOT_FOUND` | Install hcloud or set `HCLOUD_MCP_HCLOUD_PATH` |
| `HCLOUD_TOKEN_MISSING` | Export `HCLOUD_TOKEN` |
| `DESTRUCTIVE_DISABLED` | Set `HCLOUD_MCP_ALLOW_DESTRUCTIVE=true` |
| `CONFIRMATION_REQUIRED` | Add `confirm` and matching `confirmation_text` |

## Limitations

- Stdio transport only (no HTTP/SSE in v1)
- Wraps CLI only (no direct REST API)
- `hcloud server metrics` is ALPHA; older CLI versions may not support it
- Load balancers, floating IPs, DNS zones, storage boxes not exposed yet

## License

MIT
