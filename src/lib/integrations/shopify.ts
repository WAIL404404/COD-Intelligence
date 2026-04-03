/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "node:crypto";

import { normalizeMoroccanPhone, normalizeShopifyOrder } from "@/lib/domain/normalize";
import { buildOrderDecision, evaluateRisk } from "@/lib/domain/scoring";
import type { Merchant, OrderRecord } from "@/lib/domain/types";
import { env } from "@/lib/env";
import type { AppRepository } from "@/lib/data/repository";
import { renderPilotTemplate } from "@/lib/integrations/whatsapp";

type ShopifyWebhookHeaders = {
  hmac?: string | null;
  topic?: string | null;
  shopDomain?: string | null;
  webhookId?: string | null;
};

type ShopifyOrderPayload = {
  id: number | string;
  name?: string | null;
  order_number?: number | string | null;
  total_price?: string | number | null;
  currency?: string | null;
  created_at?: string | null;
  phone?: string | null;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
  } | null;
  shipping_address?: Record<string, unknown> | null;
} & Record<string, any>;

export function verifyShopifyWebhook(rawBody: string, hmacHeader: string | null | undefined) {
  if (!env.shopifyWebhookSecret) {
    return true;
  }

  if (!hmacHeader) {
    return false;
  }

  const digest = crypto
    .createHmac("sha256", env.shopifyWebhookSecret)
    .update(rawBody, "utf8")
    .digest("base64");

  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
}

export function extractShopifyEventKey(headers: ShopifyWebhookHeaders) {
  return `shopify:${headers.webhookId || "missing"}:${headers.topic || "orders/create"}`;
}

function getRuleCities(orders: OrderRecord[]) {
  const cities = orders[0]?.assessment.reasons
    .filter((reason) => reason.code === "risky_city")
    .map((reason) => reason.detail.match(/^(.+?) is /)?.[1])
    .filter(Boolean) as string[] | undefined;

  return cities?.length ? cities : ["Tanger", "Safi", "Meknes"];
}

function deriveSignals(orders: OrderRecord[], phoneNormalized: string | null) {
  const matchingOrders = phoneNormalized
    ? orders.filter(
        (order) => order.normalizedOrder.phoneNormalized === phoneNormalized,
      )
    : [];

  return {
    duplicateRecentOrders: matchingOrders.length,
    recentRiskyBehaviorCount: matchingOrders.filter(
      (order) =>
        order.outcome?.finalOutcome === "refused" ||
        order.outcome?.finalOutcome === "unreachable" ||
        order.status === "blocked",
    ).length,
    blacklistPhones: [] as string[],
  };
}

export async function processShopifyOrderWebhook(params: {
  repository: AppRepository;
  merchant: Merchant;
  payload: ShopifyOrderPayload;
}) {
  const dashboard = await params.repository.getMerchantDashboard(params.merchant.id);
  const phoneNormalized = normalizeMoroccanPhone(
    params.payload.phone || params.payload.customer?.phone || "",
  );
  const derivedSignals = deriveSignals(dashboard.orders, phoneNormalized);
  const rules = dashboard.rules;
  const riskyCities =
    (rules.find((rule) => rule.code === "risky_city")?.config.cities as string[] | undefined) ??
    getRuleCities(dashboard.orders);
  const blacklistPhones =
    (rules.find((rule) => rule.code === "hard_stop_blacklist")?.config
      .blockedPhones as string[] | undefined) ?? derivedSignals.blacklistPhones;
  const highValueThreshold = Number(
    rules.find((rule) => rule.code === "high_value_threshold")?.config.threshold ?? 900,
  );

  const normalized = normalizeShopifyOrder(params.payload, {
    duplicateRecentOrders: derivedSignals.duplicateRecentOrders,
    recentRiskyBehaviorCount: derivedSignals.recentRiskyBehaviorCount,
    riskyCities,
    blacklistPhones,
    highValueThreshold,
  });
  const assessment = evaluateRisk(normalized, rules);
  const decision = buildOrderDecision(assessment, normalized, {
    deadlineAt:
      assessment.recommendedAction === "send_confirmation" ||
      assessment.recommendedAction === "request_address"
        ? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        : null,
  });
  const template =
    decision.currentStatus === "awaiting_address"
      ? await params.repository.getTemplateByJourney(
          params.merchant.id,
          "address_clarification",
        )
      : decision.currentStatus === "awaiting_confirmation"
        ? await params.repository.getTemplateByJourney(params.merchant.id, "confirmation")
        : null;
  const outboundMessageBody = template
    ? renderPilotTemplate(template.body, {
        customerName: normalized.customerName,
        orderNumber: params.payload.name || `#${params.payload.order_number}`,
        amount: `${Math.round(normalized.totalAmount)} ${normalized.currency}`,
      })
    : null;
  const outboundTemplate = template
    ? {
        name: template.name,
        locale: template.locale,
        parameters: template.variables.map((variable) => {
          switch (variable) {
            case "customerName":
              return normalized.customerName;
            case "orderNumber":
              return params.payload.name || `#${params.payload.order_number}`;
            case "amount":
              return `${Math.round(normalized.totalAmount)} ${normalized.currency}`;
            default:
              return "";
          }
        }),
      }
    : null;

  const result = await params.repository.persistProcessedOrder({
    merchantId: params.merchant.id,
    externalId: String(params.payload.id),
    orderNumber: params.payload.name || `#${params.payload.order_number}`,
    customerName: normalized.customerName,
    customerPhone: normalized.phoneRaw,
    city: normalized.city,
    totalAmount: normalized.totalAmount,
    currency: normalized.currency,
    shippingAddress: params.payload.shipping_address ?? {},
    sourceCreatedAt: normalized.sourceCreatedAt,
    rawPayload: params.payload,
    normalizedOrder: normalized,
    assessment,
    decision,
    outboundMessageBody,
    outboundTemplate,
  });

  return {
    ...result,
    assessment,
    decision,
  };
}
