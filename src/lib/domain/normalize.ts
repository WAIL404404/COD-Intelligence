import type { Json, NormalizedOrder } from "@/lib/domain/types";

export type NormalizationSignals = {
  duplicateRecentOrders: number;
  recentRiskyBehaviorCount: number;
  riskyCities: string[];
  blacklistPhones: string[];
  highValueThreshold: number;
};

type ShopifyAddress = {
  city?: string | null;
  zip?: string | null;
  address1?: string | null;
  address2?: string | null;
};

type ShopifyOrderInput = {
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
  shipping_address?: ShopifyAddress | null;
  billing_address?: ShopifyAddress | null;
};

export function normalizeMoroccanPhone(phone: string | null | undefined) {
  if (!phone) {
    return null;
  }

  const digits = phone.replace(/[^\d+]/g, "");
  const normalized = digits.startsWith("+")
    ? digits
    : digits.startsWith("212")
      ? `+${digits}`
      : digits.startsWith("0")
        ? `+212${digits.slice(1)}`
        : digits.length === 9
          ? `+212${digits}`
          : digits;

  return /^\+212[5-7]\d{8}$/.test(normalized) ? normalized : null;
}

export function buildAddressLine(address: ShopifyAddress | null | undefined) {
  return [address?.address1, address?.address2].filter(Boolean).join(", ").trim();
}

export function scoreAddressQuality(addressLine: string, city: string, postalCode?: string | null) {
  let score = 0;

  if (addressLine.length >= 12) {
    score += 50;
  } else if (addressLine.length >= 6) {
    score += 25;
  }

  if (city.trim().length > 1) {
    score += 30;
  }

  if ((postalCode || "").trim().length >= 4) {
    score += 20;
  }

  return Math.min(score, 100);
}

export function normalizeShopifyOrder(
  order: ShopifyOrderInput,
  signals: NormalizationSignals,
): NormalizedOrder {
  const shipping = order.shipping_address ?? order.billing_address ?? null;
  const customerName = [order.customer?.first_name, order.customer?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim() || "Customer";
  const phoneRaw = order.phone || order.customer?.phone || "";
  const phoneNormalized = normalizeMoroccanPhone(phoneRaw);
  const city = shipping?.city?.trim() || "Unknown city";
  const addressLine = buildAddressLine(shipping);
  const addressQualityScore = scoreAddressQuality(addressLine, city, shipping?.zip);
  const cityNormalized = city.toLowerCase();
  const riskyCity = signals.riskyCities.some(
    (value) => value.toLowerCase() === cityNormalized,
  );
  const blacklisted = Boolean(
    phoneNormalized && signals.blacklistPhones.includes(phoneNormalized),
  );
  const totalAmount = Number(order.total_price || 0);

  return {
    orderId: String(order.id),
    customerName,
    phoneRaw,
    phoneNormalized,
    validPhone: Boolean(phoneNormalized),
    city,
    addressLine,
    postalCode: shipping?.zip || null,
    addressQualityScore,
    addressNeedsClarification: addressQualityScore < 70,
    duplicateRecentOrders: signals.duplicateRecentOrders,
    recentRiskyBehaviorCount: signals.recentRiskyBehaviorCount,
    riskyCity,
    blacklisted,
    highValue: totalAmount >= signals.highValueThreshold,
    totalAmount,
    currency: order.currency || "MAD",
    sourceCreatedAt: order.created_at || new Date().toISOString(),
    sourceSnapshot: order as unknown as Record<string, Json>,
  };
}
