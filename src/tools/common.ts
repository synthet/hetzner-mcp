import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { HcloudErrorInfo } from "../hcloud/errors.js";
import type { HcloudResult } from "../hcloud/client.js";
import { sanitizeOutput } from "../hcloud/validators.js";

export type ToolResponse = {
  ok: boolean;
  summary: string;
  data?: unknown;
  warnings?: string[];
  command: {
    executable: string;
    args: string[];
  };
  error?: HcloudErrorInfo;
  stderr?: string;
};

export function commandFromResult(result: HcloudResult): ToolResponse["command"] {
  const [executable, ...args] = result.command;
  return { executable: executable ?? "hcloud", args };
}

export function successResult(
  summary: string,
  data: unknown,
  result: HcloudResult,
  warnings?: string[],
): ToolResponse {
  return {
    ok: true,
    summary,
    data,
    warnings,
    command: commandFromResult(result),
  };
}

export function failureResult(
  result: HcloudResult,
  fallbackMessage?: string,
): ToolResponse {
  return {
    ok: false,
    summary: result.error?.message ?? fallbackMessage ?? "Command failed",
    error: result.error,
    stderr: result.stderr ? sanitizeOutput(result.stderr) : undefined,
    command: commandFromResult(result),
  };
}

export function failureFromError(
  error: HcloudErrorInfo,
  command: { executable: string; args: string[] },
): ToolResponse {
  return {
    ok: false,
    summary: error.message,
    error,
    command,
  };
}

export function toToolResult(response: ToolResponse): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
  };
}

export function handleHcloudResult(
  result: HcloudResult,
  summary: string,
  data: unknown,
  warnings?: string[],
): CallToolResult {
  if (!result.ok) {
    return toToolResult(failureResult(result));
  }
  return toToolResult(successResult(summary, data, result, warnings));
}

export function compactServerSummary(
  server: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const serverType = server?.server_type as Record<string, unknown> | undefined;
  const image = server?.image as Record<string, unknown> | undefined;
  const datacenter = server?.datacenter as Record<string, unknown> | undefined;
  const location = datacenter?.location as Record<string, unknown> | undefined;
  const publicNet = server?.public_net as Record<string, unknown> | undefined;
  const ipv4 = publicNet?.ipv4 as Record<string, unknown> | undefined;
  const ipv6 = publicNet?.ipv6 as Record<string, unknown> | undefined;

  return {
    id: server?.id,
    name: server?.name,
    status: server?.status,
    server_type: serverType?.name ?? server?.server_type,
    image: image?.name ?? image?.description ?? server?.image,
    datacenter: datacenter?.name ?? server?.datacenter,
    location: location?.name ?? server?.location,
    public_net: {
      ipv4: ipv4?.ip,
      ipv6: ipv6?.ip,
    },
    labels: server?.labels,
    created: server?.created,
  };
}

export function jsonOutputArgs(): string[] {
  return ["-o", "json"];
}
