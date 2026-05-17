import { describe, expect, it } from "vitest";
import { HcloudError } from "../src/hcloud/errors.js";
import {
  requireConfirmation,
  requireDestructiveAllowed,
  sanitizeOutput,
  summarizeUserData,
} from "../src/hcloud/validators.js";

describe("validators", () => {
  it("requireConfirmation throws when missing", () => {
    expect(() => requireConfirmation("delete server x")).toThrow(HcloudError);
    try {
      requireConfirmation("delete server x");
    } catch (e) {
      expect((e as HcloudError).info.code).toBe("CONFIRMATION_REQUIRED");
    }
  });

  it("requireConfirmation throws on mismatch", () => {
    expect(() =>
      requireConfirmation("delete server x", {
        confirm: true,
        confirmation_text: "wrong",
      }),
    ).toThrow(HcloudError);
  });

  it("requireDestructiveAllowed throws when disabled", () => {
    expect(() => requireDestructiveAllowed(false)).toThrow(HcloudError);
  });

  it("sanitizeOutput redacts tokens", () => {
    expect(sanitizeOutput("HCLOUD_TOKEN=abc")).not.toContain("abc");
    expect(sanitizeOutput("HCLOUD_TOKEN=abc")).toContain("[REDACTED]");
  });

  it("summarizeUserData truncates long input", () => {
    const long = "a".repeat(100);
    const summary = summarizeUserData(long);
    expect(summary).toContain("100 chars");
  });
});
