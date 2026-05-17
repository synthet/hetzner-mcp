import type { HcloudClient } from "../hcloud/client.js";
import { jsonOutputArgs } from "../tools/common.js";

type ServerRecord = {
  status?: string;
  public_net?: { ipv4?: { ip?: string }; ipv6?: { ip?: string } };
  datacenter?: {
    location?: { name?: string } | string;
    name?: string;
  };
  location?: string;
};

type LocationRecord = { name?: string };

export async function listServers(client: HcloudClient): Promise<ServerRecord[]> {
  return client.runJson<ServerRecord[]>(["server", "list", ...jsonOutputArgs()]);
}

export async function listLocations(
  client: HcloudClient,
): Promise<LocationRecord[]> {
  return client.runJson<LocationRecord[]>([
    "location",
    "list",
    ...jsonOutputArgs(),
  ]);
}

export async function listServerTypes(
  client: HcloudClient,
): Promise<unknown[]> {
  return client.runJson<unknown[]>(["server-type", "list", ...jsonOutputArgs()]);
}

export async function listVolumes(client: HcloudClient): Promise<unknown[]> {
  return client.runJson<unknown[]>(["volume", "list", ...jsonOutputArgs()]);
}

export async function listNetworks(client: HcloudClient): Promise<unknown[]> {
  return client.runJson<unknown[]>(["network", "list", ...jsonOutputArgs()]);
}

export async function listFirewalls(client: HcloudClient): Promise<unknown[]> {
  return client.runJson<unknown[]>(["firewall", "list", ...jsonOutputArgs()]);
}

export async function buildProjectSummary(client: HcloudClient): Promise<{
  servers: { total: number; running: number; off: number };
  locations: string[];
  public_ips: number;
  volumes: number;
  networks: number;
  firewalls: number;
}> {
  const [servers, locations, volumes, networks, firewalls] = await Promise.all([
    listServers(client),
    listLocations(client),
    listVolumes(client),
    listNetworks(client),
    listFirewalls(client),
  ]);

  const running = servers.filter((s) => s.status === "running").length;
  const off = servers.filter(
    (s) => s.status === "off" || s.status === "stopped",
  ).length;

  const publicIps = servers.reduce((count, s) => {
    return s.public_net?.ipv4?.ip || s.public_net?.ipv6?.ip ? count + 1 : count;
  }, 0);

  const locationNames = [
    ...new Set(
      servers
        .map((s) => {
          const loc = s.datacenter?.location;
          if (typeof loc === "object" && loc?.name) return loc.name;
          if (typeof loc === "string") return loc;
          return s.location;
        })
        .filter((name): name is string => Boolean(name)),
    ),
  ];

  return {
    servers: { total: servers.length, running, off },
    locations:
      locationNames.length > 0
        ? locationNames
        : locations.map((l) => l.name).filter((n): n is string => Boolean(n)),
    public_ips: publicIps,
    volumes: volumes.length,
    networks: networks.length,
    firewalls: firewalls.length,
  };
}
