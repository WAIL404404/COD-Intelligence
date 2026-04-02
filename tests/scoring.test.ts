import { describe, expect, it } from "vitest";

import { normalizeShopifyOrder } from "@/lib/domain/normalize";
import { buildOrderDecision, createDefaultRuleConfigs, evaluateRisk } from "@/lib/domain/scoring";

const merchantId = "merchant-test";
const rules = createDefaultRuleConfigs(merchantId);

describe("evaluateRisk", () => {
  it("auto-approves low-risk complete orders", () => {
    const normalized = normalizeShopifyOrder(
      {
        id: 2001,
        total_price: "320",
        currency: "MAD",
        phone: "0612345678",
        created_at: "2026-04-03T10:00:00.000Z",
        customer: {
          first_name: "Sara",
          last_name: "T.",
        },
        shipping_address: {
          city: "Casablanca",
          address1: "23 Rue Ibn Sina",
          address2: "Maarif",
          zip: "20250",
        },
      },
      {
        duplicateRecentOrders: 0,
        recentRiskyBehaviorCount: 0,
        riskyCities: ["Tanger", "Safi"],
        blacklistPhones: [],
        highValueThreshold: 900,
      },
    );

    const assessment = evaluateRisk(normalized, rules);
    const decision = buildOrderDecision(assessment, normalized);

    expect(assessment.riskScore).toBe(0);
    expect(decision.currentStatus).toBe("approved_for_shipping");
  });

  it("lets hard-stop blacklist rules override everything else", () => {
    const normalized = normalizeShopifyOrder(
      {
        id: 2002,
        total_price: "1500",
        currency: "MAD",
        phone: "0612345678",
        created_at: "2026-04-03T10:00:00.000Z",
        customer: {
          first_name: "Omar",
          last_name: "B.",
        },
        shipping_address: {
          city: "Tanger",
          address1: "Route Principale 18",
          address2: "Residence Atlantic",
          zip: "90000",
        },
      },
      {
        duplicateRecentOrders: 2,
        recentRiskyBehaviorCount: 3,
        riskyCities: ["Tanger", "Safi"],
        blacklistPhones: ["+212612345678"],
        highValueThreshold: 900,
      },
    );

    const assessment = evaluateRisk(normalized, rules);

    expect(assessment.systemDecision).toBe("blocked");
    expect(assessment.reasonCodes).toContain("hard_stop_blacklist");
  });
});
