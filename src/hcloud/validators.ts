import { HcloudError, errorInfo } from "./errors.js";

export type ConfirmationInput = {
  confirm?: boolean;
  confirmation_text?: string;
};

export function requireConfirmation(
  expectedPhrase: string,
  confirmation?: ConfirmationInput,
): void {
  if (!confirmation?.confirm) {
    throw new HcloudError(
      errorInfo(
        "CONFIRMATION_REQUIRED",
        "This operation requires explicit confirmation.",
        `Set confirm: true and confirmation_text to exactly: "${expectedPhrase}"`,
        expectedPhrase,
      ),
    );
  }
  if (confirmation.confirmation_text !== expectedPhrase) {
    throw new HcloudError(
      errorInfo(
        "CONFIRMATION_MISMATCH",
        "Confirmation text does not match the required phrase.",
        `confirmation_text must be exactly: "${expectedPhrase}"`,
        expectedPhrase,
      ),
    );
  }
}

export function requireDestructiveAllowed(allowDestructive: boolean): void {
  if (!allowDestructive) {
    throw new HcloudError(
      errorInfo(
        "DESTRUCTIVE_DISABLED",
        "Destructive operations are disabled.",
        'Set HCLOUD_MCP_ALLOW_DESTRUCTIVE=true to enable destructive operations.',
      ),
    );
  }
}

const SECRET_PATTERNS = [
  /HCLOUD_TOKEN[=:\s]+\S+/gi,
  /Bearer\s+\S+/gi,
  /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/gi,
];

export function sanitizeOutput(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

export function summarizeUserData(userData?: string): string | undefined {
  if (!userData) return undefined;
  if (userData.length <= 80) return userData;
  return `${userData.slice(0, 40)}…[${userData.length} chars total]`;
}
