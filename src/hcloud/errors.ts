export type HcloudErrorCode =
  | "HCLOUD_NOT_FOUND"
  | "HCLOUD_TOKEN_MISSING"
  | "HCLOUD_EXIT_NONZERO"
  | "HCLOUD_TIMEOUT"
  | "HCLOUD_JSON_PARSE_ERROR"
  | "INVALID_ARGUMENT"
  | "UNSUPPORTED_BY_HCLOUD_VERSION"
  | "DESTRUCTIVE_DISABLED"
  | "CONFIRMATION_REQUIRED"
  | "CONFIRMATION_MISMATCH";

export type HcloudErrorInfo = {
  code: HcloudErrorCode;
  message: string;
  hint?: string;
  expectedConfirmation?: string;
};

export class HcloudError extends Error {
  readonly info: HcloudErrorInfo;

  constructor(info: HcloudErrorInfo) {
    super(info.message);
    this.name = "HcloudError";
    this.info = info;
  }
}

export function errorInfo(
  code: HcloudErrorCode,
  message: string,
  hint?: string,
  expectedConfirmation?: string,
): HcloudErrorInfo {
  return { code, message, hint, expectedConfirmation };
}
