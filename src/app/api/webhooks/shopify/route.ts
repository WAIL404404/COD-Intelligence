import { NextResponse } from "next/server";

import { getAppRepository } from "@/lib/data/repository";
import { isDemoMode } from "@/lib/env";
import {
  extractShopifyEventKey,
  processShopifyOrderWebhook,
  verifyShopifyWebhook,
} from "@/lib/integrations/shopify";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const headers = {
    hmac: request.headers.get("x-shopify-hmac-sha256"),
    topic: request.headers.get("x-shopify-topic"),
    shopDomain: request.headers.get("x-shopify-shop-domain"),
    webhookId: request.headers.get("x-shopify-webhook-id"),
  };

  if (!verifyShopifyWebhook(rawBody, headers.hmac)) {
    return NextResponse.json({ error: "Invalid Shopify signature." }, { status: 401 });
  }

  const repository = getAppRepository();
  const merchant = await repository.getMerchantByShopDomain(headers.shopDomain || "");

  if (!merchant) {
    return NextResponse.json(
      { error: "No pilot merchant is connected to this Shopify store." },
      { status: 404 },
    );
  }

  const eventKey = extractShopifyEventKey(headers);
  const payload = JSON.parse(rawBody);

  if (!isDemoMode) {
    const admin = createSupabaseAdminClient();
    const { data: existing } = await admin
      .from("webhook_events")
      .select("id, processing_status")
      .eq("event_key", eventKey)
      .maybeSingle();

    if (existing?.processing_status === "processed") {
      return NextResponse.json({ ok: true, deduplicated: true });
    }

    await admin.from("webhook_events").upsert(
      {
        merchant_id: merchant.id,
        provider: "shopify",
        event_key: eventKey,
        topic: headers.topic || "orders/create",
        headers: Object.fromEntries(request.headers.entries()),
        payload,
        processing_status: "processing",
      },
      { onConflict: "event_key" },
    );
  }

  if (!merchant.goLiveEnabled) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Merchant is not live yet.",
    });
  }

  const result = await processShopifyOrderWebhook({
    repository,
    merchant,
    payload,
  });

  if (!isDemoMode) {
    const admin = createSupabaseAdminClient();
    await admin
      .from("webhook_events")
      .update({
        processed_at: new Date().toISOString(),
        processing_status: "processed",
      })
      .eq("event_key", eventKey);
  }

  return NextResponse.json({
    ok: true,
    orderId: result.orderId,
    status: result.status,
    riskScore: result.assessment.riskScore,
    recommendedAction: result.assessment.recommendedAction,
  });
}
