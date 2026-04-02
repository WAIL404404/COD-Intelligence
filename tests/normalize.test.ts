import { describe, expect, it } from "vitest";

import { normalizeMoroccanPhone, normalizeShopifyOrder } from "@/lib/domain/normalize";

describe("normalizeMoroccanPhone", () => {
  it("normalizes local Moroccan mobile numbers to +212 format", () => {
    expect(normalizeMoroccanPhone("06 12 34 56 78")).toBe("+212612345678");
    expect(normalizeMoroccanPhone("212661234567")).toBe("+212661234567");
  });

  it("rejects invalid numbers", () => {
    expect(normalizeMoroccanPhone("1234")).toBeNull();
  });
});

describe("normalizeShopifyOrder", () => {
  it("flags weak addresses for clarification", () => {
    const normalized = normalizeShopifyOrder(
      {
        id: 1001,
        total_price: "480",
        currency: "MAD",
        phone: "0612345678",
        created_at: "2026-04-03T10:00:00.000Z",
        customer: {
          first_name: "Meriem",
          last_name: "A.",
        },
        shipping_address: {
          city: "Rabat",
          address1: "Hay Riad",
        },
      },
      {
        duplicateRecentOrders: 0,
        recentRiskyBehaviorCount: 0,
        riskyCities: ["Tanger"],
        blacklistPhones: [],
        highValueThreshold: 900,
      },
    );

    expect(normalized.addressNeedsClarification).toBe(true);
    expect(normalized.validPhone).toBe(true);
    expect(normalized.highValue).toBe(false);
  });
});
