import { addHours, subHours, subMinutes } from "date-fns";

import { buildDashboardKpis } from "@/lib/domain/kpis";
import { normalizeShopifyOrder } from "@/lib/domain/normalize";
import { buildOrderDecision, createDefaultRuleConfigs, evaluateRisk } from "@/lib/domain/scoring";
import type {
  ChannelConnection,
  InternalOperationsData,
  Merchant,
  MerchantDashboardData,
  MessageTemplate,
  OrderActionLog,
  OrderOutcomeRecord,
  OrderRecord,
  WhatsAppOutcome,
} from "@/lib/domain/types";

const now = new Date("2026-04-03T11:00:00.000Z");

const merchant: Merchant = {
  id: "merchant-atlas",
  slug: "atlas-home",
  name: "Atlas Home",
  locale: "fr-MA",
  timezone: "Africa/Casablanca",
  onboardingStatus: "live",
  automationMode: "conservative",
  goLiveEnabled: true,
  liveSince: subHours(now, 24).toISOString(),
  reviewSlaMinutes: 30,
  urgentReviewSlaMinutes: 15,
  supportEmail: "ops@codintelligence.ma",
  pilotNote:
    "Pilot merchant with COD-heavy weekly flow and a same-day packing cutoff at 15:30.",
};

const connections: ChannelConnection[] = [
  {
    id: "conn-shopify-atlas",
    provider: "shopify",
    status: "connected",
    label: "Shopify custom app",
    externalAccountId: "atlas-home.myshopify.com",
    configSummary: "Webhook intake active for new paid and pending COD orders.",
    lastSyncAt: subMinutes(now, 4).toISOString(),
  },
  {
    id: "conn-whatsapp-atlas",
    provider: "whatsapp_cloud",
    status: "connected",
    label: "Platform-managed WhatsApp sender",
    externalAccountId: "+212600100100",
    configSummary: "French-first confirmation and address clarification templates approved.",
    lastSyncAt: subMinutes(now, 12).toISOString(),
  },
];

const templates: MessageTemplate[] = [
  {
    id: "template-confirmation",
    merchantId: merchant.id,
    journey: "confirmation",
    locale: "fr-MA",
    name: "Confirmation COD",
    body: "Bonjour {{customerName}}, nous confirmons votre commande {{orderNumber}} de {{amount}}. Repondez OUI pour confirmer ou ANNULER si vous ne la souhaitez plus.",
    variables: ["customerName", "orderNumber", "amount"],
    updatedAt: subHours(now, 10).toISOString(),
    toneHint: "Warm, concise, trust-building",
  },
  {
    id: "template-address",
    merchantId: merchant.id,
    journey: "address_clarification",
    locale: "fr-MA",
    name: "Clarification adresse",
    body: "Bonjour {{customerName}}, il nous manque un detail pour livrer la commande {{orderNumber}}. Merci d'envoyer l'adresse complete ou votre localisation WhatsApp.",
    variables: ["customerName", "orderNumber"],
    updatedAt: subHours(now, 10).toISOString(),
    toneHint: "Polite, low-friction, asks only for missing delivery details",
  },
];

const rules = createDefaultRuleConfigs(merchant.id);

function actionLog(orderId: string, items: Array<[string, string, string, string]>): OrderActionLog[] {
  return items.map(([actorName, actorType, actionType, summary], index) => ({
    id: `${orderId}-log-${index + 1}`,
    orderId,
    actorName,
    actorType: actorType as OrderActionLog["actorType"],
    actionType,
    summary,
    createdAt: subMinutes(now, 150 - index * 18).toISOString(),
  }));
}

function makeOrderRecord(input: {
  orderId: string;
  orderNumber: string;
  phone: string;
  totalAmount: number;
  city: string;
  address1: string;
  address2?: string;
  duplicateRecentOrders: number;
  recentRiskyBehaviorCount: number;
  riskyCities: string[];
  blacklistPhones?: string[];
  createdAt: string;
  lastMessageOutcome?: WhatsAppOutcome | null;
  outcome?: OrderOutcomeRecord | null;
  override?: OrderRecord["overrides"][number];
  merchantDecision?: OrderRecord["decision"]["merchantFinalDecision"];
  forceStatus?: OrderRecord["status"];
}) {
  const normalized = normalizeShopifyOrder(
    {
      id: input.orderId,
      name: input.orderNumber,
      order_number: input.orderNumber.replace("#", ""),
      total_price: input.totalAmount,
      currency: "MAD",
      created_at: input.createdAt,
      phone: input.phone,
      customer: {
        first_name: "Youssef",
        last_name: "B.",
      },
      shipping_address: {
        city: input.city,
        address1: input.address1,
        address2: input.address2,
      },
    },
    {
      duplicateRecentOrders: input.duplicateRecentOrders,
      recentRiskyBehaviorCount: input.recentRiskyBehaviorCount,
      riskyCities: input.riskyCities,
      blacklistPhones: input.blacklistPhones ?? [],
      highValueThreshold: 900,
    },
  );

  const assessment = evaluateRisk(normalized, rules);
  const decision = buildOrderDecision(assessment, normalized, {
    lastMessageOutcome: input.lastMessageOutcome ?? null,
    deadlineAt:
      assessment.recommendedAction === "send_confirmation" ||
      assessment.recommendedAction === "request_address"
        ? addHours(new Date(input.createdAt), 2).toISOString()
        : null,
  });

  const status = input.forceStatus ?? decision.currentStatus;

  return {
    id: input.orderId,
    merchantId: merchant.id,
    sourceProvider: "shopify" as const,
    externalId: input.orderId,
    orderNumber: input.orderNumber,
    customerName: normalized.customerName,
    customerPhone: input.phone,
    city: input.city,
    totalAmount: input.totalAmount,
    currency: "MAD",
    createdAt: input.createdAt,
    updatedAt: subMinutes(now, 6).toISOString(),
    status,
    normalizedOrder: normalized,
    assessment,
    decision: {
      ...decision,
      currentStatus: status,
      merchantFinalDecision: input.merchantDecision ?? null,
    },
    outcome: input.outcome ?? null,
    messageThread:
      decision.currentStatus === "approved_for_shipping" &&
      !input.lastMessageOutcome
        ? null
        : {
            id: `${input.orderId}-thread`,
            merchantId: merchant.id,
            orderId: input.orderId,
            journey:
              assessment.recommendedAction === "request_address"
                ? "address_clarification"
                : "confirmation",
            latestOutcome: input.lastMessageOutcome ?? null,
            lastInboundAt: input.lastMessageOutcome
              ? subMinutes(now, 30).toISOString()
              : null,
            lastOutboundAt: subMinutes(now, 100).toISOString(),
            events: [
              {
                id: `${input.orderId}-event-out`,
                direction: "outbound",
                status: "delivered",
                body:
                  assessment.recommendedAction === "request_address"
                    ? templates[1].body
                    : templates[0].body,
                providerMessageId: `${input.orderId}-meta-out`,
                createdAt: subMinutes(now, 95).toISOString(),
              },
              ...(input.lastMessageOutcome
                ? [
                    {
                      id: `${input.orderId}-event-in`,
                      direction: "inbound" as const,
                      status: "received" as const,
                      body:
                        input.lastMessageOutcome === "confirmed"
                          ? "Oui"
                          : input.lastMessageOutcome === "address_updated"
                            ? "Appartement 6, immeuble Atlas, rue Tansift"
                            : "??",
                      providerMessageId: `${input.orderId}-meta-in`,
                      outcome: input.lastMessageOutcome,
                      createdAt: subMinutes(now, 70).toISOString(),
                    },
                  ]
                : []),
            ],
          },
    overrides: input.override ? [input.override] : [],
    actionLog: actionLog(input.orderId, [
      ["COD Intelligence", "system", "order_scored", assessment.summary],
      [
        "COD Intelligence",
        "system",
        "decision_prepared",
        `Recommended action: ${assessment.recommendedAction}`,
      ],
      ...(input.override
        ? [
            [
              input.override.actorName,
              "merchant",
              "decision_override",
              input.override.reason,
            ] as [string, string, string, string],
          ]
        : []),
    ]),
  } satisfies OrderRecord;
}

const orders: OrderRecord[] = [
  makeOrderRecord({
    orderId: "order-1001",
    orderNumber: "#1001",
    phone: "0612345678",
    totalAmount: 420,
    city: "Casablanca",
    address1: "23 Rue Ibn Sina",
    address2: "Maarif",
    duplicateRecentOrders: 0,
    recentRiskyBehaviorCount: 0,
    riskyCities: ["Tanger", "Safi"],
    createdAt: subHours(now, 2).toISOString(),
    forceStatus: "approved_for_shipping",
  }),
  makeOrderRecord({
    orderId: "order-1002",
    orderNumber: "#1002",
    phone: "0669988877",
    totalAmount: 690,
    city: "Rabat",
    address1: "Hay Riad",
    duplicateRecentOrders: 0,
    recentRiskyBehaviorCount: 0,
    riskyCities: ["Tanger", "Safi"],
    createdAt: subHours(now, 1).toISOString(),
    lastMessageOutcome: "address_updated",
    forceStatus: "manual_review",
  }),
  makeOrderRecord({
    orderId: "order-1003",
    orderNumber: "#1003",
    phone: "0671112233",
    totalAmount: 1200,
    city: "Tanger",
    address1: "Avenue Moulay Youssef",
    address2: "Bloc 8",
    duplicateRecentOrders: 1,
    recentRiskyBehaviorCount: 1,
    riskyCities: ["Tanger", "Safi"],
    createdAt: subMinutes(now, 55).toISOString(),
    forceStatus: "awaiting_confirmation",
  }),
  makeOrderRecord({
    orderId: "order-1004",
    orderNumber: "#1004",
    phone: "0650001122",
    totalAmount: 1350,
    city: "Safi",
    address1: "Route du Port",
    address2: "Lotissement Amal",
    duplicateRecentOrders: 2,
    recentRiskyBehaviorCount: 2,
    riskyCities: ["Tanger", "Safi"],
    createdAt: subMinutes(now, 82).toISOString(),
    override: {
      id: "override-1004",
      orderId: "order-1004",
      actorName: "Lina Atlas",
      actorRole: "merchant_admin",
      previousDecision: "blocked",
      newDecision: "manual_review",
      reason: "Customer is known to the store; retry with a call before canceling.",
      classificationFeedback: "Duplicate risk weight was too strong for this returning buyer.",
      createdAt: subMinutes(now, 40).toISOString(),
    },
    merchantDecision: "manual_review",
    forceStatus: "manual_review",
  }),
  makeOrderRecord({
    orderId: "order-1005",
    orderNumber: "#1005",
    phone: "0611111111",
    totalAmount: 510,
    city: "Mohammedia",
    address1: "Residence Palmier",
    address2: "Imm B",
    duplicateRecentOrders: 0,
    recentRiskyBehaviorCount: 0,
    riskyCities: ["Tanger", "Safi"],
    createdAt: subHours(now, 4).toISOString(),
    lastMessageOutcome: "confirmed",
    outcome: {
      id: "outcome-1005",
      orderId: "order-1005",
      finalOutcome: "delivered",
      note: "Delivered successfully during same-day route.",
      recordedBy: "Lina Atlas",
      recordedAt: subMinutes(now, 20).toISOString(),
      source: "manual",
    },
    forceStatus: "closed",
  }),
];

export const demoDashboardData: MerchantDashboardData = {
  merchant,
  connections,
  readiness: [
    {
      id: "readiness-account",
      label: "Merchant account configured",
      description: "Merchant admin is active and pilot defaults are seeded.",
      status: "complete",
    },
    {
      id: "readiness-shopify",
      label: "Shopify custom app connected",
      description: "Webhook secret and live store domain verified.",
      status: "complete",
    },
    {
      id: "readiness-whatsapp",
      label: "WhatsApp sender approved",
      description: "Platform-managed sender and approved templates ready.",
      status: "complete",
    },
    {
      id: "readiness-golive",
      label: "Go-live guardrail",
      description: "Only new orders created after activation enter live processing.",
      status: "complete",
    },
  ],
  rules,
  templates,
  orders,
  kpis: buildDashboardKpis(orders),
};

export const demoInternalOperations: InternalOperationsData = {
  merchants: [
    {
      ...merchant,
      connectedChannels: 2,
      openManualReviewOrders: orders.filter((order) => order.status === "manual_review").length,
      responseRate: 62,
    },
    {
      ...merchant,
      id: "merchant-riad",
      slug: "riad-deco",
      name: "Riad Deco",
      liveSince: subHours(now, 48).toISOString(),
      pilotNote: "Higher-value home decor orders, active clarification workflow.",
      connectedChannels: 2,
      openManualReviewOrders: 4,
      responseRate: 54,
    },
  ],
  alerts: [
    {
      id: "alert-1",
      merchantName: "Atlas Home",
      title: "Manual review queue approaching SLA",
      severity: "attention",
      detail: "2 orders are within 10 minutes of same-day cutoff visibility.",
      createdAt: subMinutes(now, 6).toISOString(),
    },
    {
      id: "alert-2",
      merchantName: "Riad Deco",
      title: "WhatsApp template retry spike",
      severity: "critical",
      detail: "Two outbound messages were retried after temporary provider failure.",
      createdAt: subMinutes(now, 18).toISOString(),
    },
  ],
  pendingJobs: [
    {
      id: "job-1",
      jobType: "check_message_timeout",
      merchantName: "Atlas Home",
      runAt: addHours(now, 1).toISOString(),
      attempts: 0,
    },
    {
      id: "job-2",
      jobType: "send_whatsapp_message",
      merchantName: "Riad Deco",
      runAt: subMinutes(now, 1).toISOString(),
      attempts: 1,
    },
  ],
  webhookHealth: [
    {
      provider: "shopify",
      merchantName: "Atlas Home",
      lastProcessedAt: subMinutes(now, 4).toISOString(),
      status: "healthy",
    },
    {
      provider: "whatsapp_cloud",
      merchantName: "Riad Deco",
      lastProcessedAt: subMinutes(now, 15).toISOString(),
      status: "degraded",
    },
  ],
};
