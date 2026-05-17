import { describe, expect, it } from "vitest";
import { loadConfig, redactConfig } from "../src/config.js";

describe("config", () => {
  it("defaults allowDestructive to false", () => {
    const config = loadConfig({});
    expect(config.allowDestructive).toBe(false);
    expect(config.hasToken).toBe(false);
  });

  it("redacts secrets from diagnostic output", () => {
    const config = loadConfig({ HCLOUD_TOKEN: "super-secret" });
    const redacted = redactConfig(config);
    expect(redacted).not.toHaveProperty("HCLOUD_TOKEN");
    expect(redacted.hasToken).toBe(true);
    expect(JSON.stringify(redacted)).not.toContain("super-secret");
  });
});
