import crypto from "node:crypto";

import { describe, expect, it, vi } from "vitest";

describe("verifyShopifyWebhook", () => {
  it("validates a correct HMAC signature", async () => {
    vi.resetModules();
    vi.stubEnv("SHOPIFY_WEBHOOK_SECRET", "pilot-secret");

    const body = JSON.stringify({ id: 1001, name: "#1001" });
    const signature = crypto
      .createHmac("sha256", "pilot-secret")
      .update(body, "utf8")
      .digest("base64");

    const { verifyShopifyWebhook } = await import("@/lib/integrations/shopify");

    expect(verifyShopifyWebhook(body, signature)).toBe(true);
  });
});
