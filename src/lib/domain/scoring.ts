import { differenceInMinutes } from "date-fns";

import type {
  DecisionValue,
  NormalizedOrder,
  OrderDecision,
  OrderStatus,
  RecommendedAction,
  RiskAssessment,
  RiskLevel,
  RiskReason,
  RuleConfig,
  WhatsAppOutcome,
} from "@/lib/domain/types";

type DecisionThresholds = {
  autoApproveMax: number;
  confirmationMax: number;
  blockMin: number;
  noResponseEscalationMinutes: number;
};

const defaultThresholds: DecisionThresholds = {
  autoApproveMax: 14,
  confirmationMax: 34,
  blockMin: 70,
  noResponseEscalationMinutes: 120,
};

export function createDefaultRuleConfigs(merchantId: string): RuleConfig[] {
  return [
    {
      id: `${merchantId}-phone-validity`,
      merchantId,
      code: "phone_validity",
      title: "Phone validity",
      description: "Escalate orders that cannot be reliably reached on WhatsApp.",
      enabled: true,
      points: 42,
      severity: "critical",
      hardStop: false,
      config: {},
    },
    {
      id: `${merchantId}-address-quality`,
      merchantId,
      code: "address_quality",
      title: "Address completeness",
      description: "Weak or partial addresses should request clarification before shipping.",
      enabled: true,
      points: 28,
      severity: "high",
      hardStop: false,
      config: { minScore: 70 },
    },
    {
      id: `${merchantId}-duplicate-phone`,
      merchantId,
      code: "duplicate_recent_orders",
      title: "Duplicate recent phone activity",
      description: "Multiple recent COD attempts from the same phone increase risk.",
      enabled: true,
      points: 22,
      severity: "high",
      hardStop: false,
      config: { minimumCount: 1 },
    },
    {
      id: `${merchantId}-risky-behavior`,
      merchantId,
      code: "repeated_risky_behavior",
      title: "Repeated risky behavior",
      description: "Past refusals or unreachable deliveries should heavily affect the decision.",
      enabled: true,
      points: 35,
      severity: "critical",
      hardStop: false,
      config: { minimumCount: 2 },
    },
    {
      id: `${merchantId}-risky-city`,
      merchantId,
      code: "risky_city",
      title: "Risky city list",
      description: "Orders from cities with elevated COD issues get a moderate uplift.",
      enabled: true,
      points: 18,
      severity: "medium",
      hardStop: false,
      config: { cities: ["Tanger", "Safi", "Meknes"] },
    },
    {
      id: `${merchantId}-high-value`,
      merchantId,
      code: "high_value_threshold",
      title: "High value threshold",
      description: "Large COD values should not skip customer confirmation without strong signals.",
      enabled: true,
      points: 16,
      severity: "medium",
      hardStop: false,
      config: { threshold: 900 },
    },
    {
      id: `${merchantId}-non-response`,
      merchantId,
      code: "non_response_timeout",
      title: "WhatsApp non-response timeout",
      description: "No response after the configured timeout escalates to manual review.",
      enabled: true,
      points: 26,
      severity: "high",
      hardStop: false,
      config: { minutes: 120 },
    },
    {
      id: `${merchantId}-blacklist`,
      merchantId,
      code: "hard_stop_blacklist",
      title: "Blacklist hard stop",
      description: "Known bad actors should be blocked immediately.",
      enabled: true,
      points: 100,
      severity: "critical",
      hardStop: true,
      config: { blockedPhones: [] },
    },
  ];
}

function mapRiskLevel(score: number, hasHardStop: boolean): RiskLevel {
  if (hasHardStop || score >= 70) {
    return "critical";
  }
  if (score >= 40) {
    return "high";
  }
  if (score >= 18) {
    return "medium";
  }
  return "low";
}

function makeReason(
  code: string,
  label: string,
  detail: string,
  points: number,
  severity: RiskReason["severity"],
  hardStop = false,
): RiskReason {
  return {
    code,
    label,
    detail,
    points,
    severity,
    hardStop,
  };
}

function summarizeReasons(reasons: RiskReason[]) {
  if (!reasons.length) {
    return "Clean order signals. Eligible for conservative auto-approval.";
  }

  return reasons.map((reason) => reason.label).join(" • ");
}

export function evaluateRisk(
  normalized: NormalizedOrder,
  rules: RuleConfig[],
  thresholds: Partial<DecisionThresholds> = {},
): RiskAssessment {
  const activeThresholds = { ...defaultThresholds, ...thresholds };
  const ruleByCode = new Map(rules.map((rule) => [rule.code, rule]));
  const reasons: RiskReason[] = [];

  const pushReason = (reason: RiskReason) => {
    reasons.push(reason);
  };

  if (!normalized.validPhone) {
    const rule = ruleByCode.get("phone_validity");
    pushReason(
      makeReason(
        "phone_invalid",
        "Phone number cannot be trusted",
        "The normalized Moroccan phone could not be validated for WhatsApp outreach.",
        rule?.points ?? 42,
        rule?.severity ?? "critical",
        rule?.hardStop ?? false,
      ),
    );
  }

  if (normalized.addressNeedsClarification) {
    const rule = ruleByCode.get("address_quality");
    pushReason(
      makeReason(
        "address_incomplete",
        "Address needs clarification",
        "The delivery address is not detailed enough for same-pass shipping confidence.",
        rule?.points ?? 28,
        rule?.severity ?? "high",
      ),
    );
  }

  if (normalized.duplicateRecentOrders > 0) {
    const rule = ruleByCode.get("duplicate_recent_orders");
    pushReason(
      makeReason(
        "duplicate_recent_orders",
        "Recent duplicate COD activity",
        `${normalized.duplicateRecentOrders} recent orders were found from the same phone number.`,
        rule?.points ?? 22,
        rule?.severity ?? "high",
      ),
    );
  }

  if (normalized.recentRiskyBehaviorCount >= 2) {
    const rule = ruleByCode.get("repeated_risky_behavior");
    pushReason(
      makeReason(
        "repeated_risky_behavior",
        "Past refusal or unreachable pattern",
        `${normalized.recentRiskyBehaviorCount} recent risky outcomes were detected for this customer phone.`,
        rule?.points ?? 35,
        rule?.severity ?? "critical",
      ),
    );
  }

  if (normalized.riskyCity) {
    const rule = ruleByCode.get("risky_city");
    pushReason(
      makeReason(
        "risky_city",
        "Risky city uplift",
        `${normalized.city} is currently in the merchant's risky-city watch list.`,
        rule?.points ?? 18,
        rule?.severity ?? "medium",
      ),
    );
  }

  if (normalized.highValue) {
    const rule = ruleByCode.get("high_value_threshold");
    pushReason(
      makeReason(
        "high_value_threshold",
        "High-value COD order",
        "The order amount is above the pilot's conservative confirmation threshold.",
        rule?.points ?? 16,
        rule?.severity ?? "medium",
      ),
    );
  }

  if (normalized.blacklisted) {
    const rule = ruleByCode.get("hard_stop_blacklist");
    pushReason(
      makeReason(
        "hard_stop_blacklist",
        "Hard-stop blacklist match",
        "The normalized phone is already marked as blocked for this merchant.",
        rule?.points ?? 100,
        rule?.severity ?? "critical",
        rule?.hardStop ?? true,
      ),
    );
  }

  const riskScore = reasons.reduce((sum, reason) => sum + reason.points, 0);
  const hasHardStop = reasons.some((reason) => reason.hardStop);
  const riskLevel = mapRiskLevel(riskScore, hasHardStop);

  let recommendedAction: RecommendedAction = "auto_approve";
  let systemDecision: DecisionValue = "approved_for_shipping";

  if (hasHardStop || riskScore >= activeThresholds.blockMin) {
    recommendedAction = "block";
    systemDecision = "blocked";
  } else if (normalized.addressNeedsClarification) {
    recommendedAction = "request_address";
    systemDecision = "hold";
  } else if (riskScore > activeThresholds.autoApproveMax && riskScore <= activeThresholds.confirmationMax) {
    recommendedAction = "send_confirmation";
    systemDecision = "awaiting_customer";
  } else if (riskScore > activeThresholds.confirmationMax) {
    recommendedAction = "manual_review";
    systemDecision = "manual_review";
  }

  return {
    id: `assessment-${normalized.orderId}`,
    orderId: normalized.orderId,
    assessedAt: new Date().toISOString(),
    riskScore,
    riskLevel,
    recommendedAction,
    reasonCodes: reasons.map((reason) => reason.code),
    systemDecision,
    reasons,
    summary: summarizeReasons(reasons),
  };
}

function decisionFromOutcome(outcome: WhatsAppOutcome): {
  status: OrderStatus;
  systemDecision: DecisionValue;
  recommendedAction: RecommendedAction;
} {
  switch (outcome) {
    case "confirmed":
      return {
        status: "approved_for_shipping",
        systemDecision: "approved_for_shipping",
        recommendedAction: "auto_approve",
      };
    case "canceled":
      return {
        status: "blocked",
        systemDecision: "blocked",
        recommendedAction: "block",
      };
    case "address_updated":
    case "location_shared":
    case "unclear_reply":
    case "no_response":
    default:
      return {
        status: "manual_review",
        systemDecision: "manual_review",
        recommendedAction: "manual_review",
      };
  }
}

export function buildOrderDecision(
  assessment: RiskAssessment,
  normalized: NormalizedOrder,
  options?: {
    lastMessageOutcome?: WhatsAppOutcome | null;
    deadlineAt?: string | null;
  },
): OrderDecision {
  const outcomeDecision = options?.lastMessageOutcome
    ? decisionFromOutcome(options.lastMessageOutcome)
    : null;

  const currentStatus = outcomeDecision
    ? outcomeDecision.status
    : assessment.recommendedAction === "block"
      ? "blocked"
      : assessment.recommendedAction === "manual_review"
        ? "manual_review"
        : assessment.recommendedAction === "request_address"
          ? "awaiting_address"
          : assessment.recommendedAction === "send_confirmation"
            ? "awaiting_confirmation"
            : "approved_for_shipping";

  return {
    orderId: assessment.orderId,
    currentStatus,
    recommendedAction: outcomeDecision?.recommendedAction ?? assessment.recommendedAction,
    systemDecision: outcomeDecision?.systemDecision ?? assessment.systemDecision,
    merchantFinalDecision: null,
    awaitingResponseDeadlineAt: options?.deadlineAt ?? null,
    lastMessageOutcome: options?.lastMessageOutcome ?? null,
    explanationSummary:
      normalized.addressNeedsClarification && assessment.recommendedAction !== "block"
        ? "Address clarification is required before shipping."
        : assessment.summary,
    classificationFeedback: null,
  };
}

export function shouldEscalateForTimeout(
  awaitingResponseDeadlineAt: string | null | undefined,
  now = new Date(),
) {
  if (!awaitingResponseDeadlineAt) {
    return false;
  }

  return (
    differenceInMinutes(now, new Date(awaitingResponseDeadlineAt)) >= 0
  );
}
