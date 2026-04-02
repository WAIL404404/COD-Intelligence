/* eslint-disable @typescript-eslint/no-explicit-any */
import { addHours } from "date-fns";

import { demoDashboardData, demoInternalOperations } from "@/lib/data/demo-data";
import { buildDashboardKpis } from "@/lib/domain/kpis";
import type {
  AppSession,
  DecisionValue,
  InternalOperationsData,
  Merchant,
  MerchantDashboardData,
  MessageJourney,
  MessageTemplate,
  NormalizedOrder,
  OrderOutcomeRecord,
  OrderRecord,
  OrderStatus,
  RiskAssessment,
  RuleConfig,
  WhatsAppOutcome,
} from "@/lib/domain/types";
import { isDemoMode } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ProcessedOrderInput = {
  merchantId: string;
  externalId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  city: string;
  totalAmount: number;
  currency: string;
  shippingAddress: Record<string, unknown>;
  sourceCreatedAt: string;
  rawPayload: Record<string, unknown>;
  normalizedOrder: NormalizedOrder;
  assessment: RiskAssessment;
  decision: OrderRecord["decision"];
  outboundMessageBody?: string | null;
};

export type InboundWhatsAppInput = {
  referencedProviderMessageId?: string | null;
  providerMessageId?: string | null;
  body: string;
  outcome: WhatsAppOutcome;
  payload: Record<string, unknown>;
};

export type WorkerJob = {
  id: string;
  merchantId?: string | null;
  orderId?: string | null;
  jobType: string;
  status: string;
  runAt: string;
  attempts: number;
  payload: Record<string, unknown>;
};

export type UpdateDecisionInput = {
  orderId: string;
  merchantId?: string;
  actorName: string;
  actorId?: string;
  newDecision: DecisionValue;
  newStatus: OrderStatus;
  overrideReason: string;
  classificationFeedback?: string;
};

export type RecordOutcomeInput = {
  orderId: string;
  merchantId?: string;
  actorName: string;
  actorId?: string;
  finalOutcome: OrderOutcomeRecord["finalOutcome"];
  note?: string;
};

export type AppRepository = {
  mode: "demo" | "live";
  getMerchantDashboard(merchantId?: string): Promise<MerchantDashboardData>;
  getOrder(orderId: string, merchantId?: string): Promise<OrderRecord | null>;
  getInternalOperations(): Promise<InternalOperationsData>;
  updateDecision(input: UpdateDecisionInput): Promise<void>;
  recordOutcome(input: RecordOutcomeInput): Promise<void>;
  getMerchantByShopDomain(shopDomain: string): Promise<Merchant | null>;
  getTemplateByJourney(
    merchantId: string,
    journey: MessageJourney,
  ): Promise<MessageTemplate | null>;
  persistProcessedOrder(input: ProcessedOrderInput): Promise<{ orderId: string; status: OrderStatus }>;
  persistWhatsAppInbound(
    input: InboundWhatsAppInput,
  ): Promise<{ orderId?: string; outcome: WhatsAppOutcome; status: OrderStatus | null }>;
  leaseDueJobs(limit: number): Promise<WorkerJob[]>;
  completeJob(jobId: string, note?: string): Promise<void>;
  failJob(jobId: string, errorMessage: string): Promise<void>;
};

const demoRepository: AppRepository = {
  mode: "demo",
  async getMerchantDashboard() {
    return demoDashboardData;
  },
  async getOrder(orderId) {
    return demoDashboardData.orders.find((order) => order.id === orderId) ?? null;
  },
  async getInternalOperations() {
    return demoInternalOperations;
  },
  async updateDecision() {},
  async recordOutcome() {},
  async getMerchantByShopDomain() {
    return demoDashboardData.merchant;
  },
  async getTemplateByJourney(_merchantId, journey) {
    return demoDashboardData.templates.find((template) => template.journey === journey) ?? null;
  },
  async persistProcessedOrder(input) {
    return { orderId: input.externalId, status: input.decision.currentStatus };
  },
  async persistWhatsAppInbound(input) {
    return {
      orderId: demoDashboardData.orders[0]?.id,
      outcome: input.outcome,
      status: "manual_review",
    };
  },
  async leaseDueJobs(limit) {
    return demoInternalOperations.pendingJobs.slice(0, limit).map((job) => ({
      id: job.id,
      merchantId:
        demoInternalOperations.merchants.find(
          (merchant) => merchant.name === job.merchantName,
        )?.id ?? null,
      orderId: null,
      jobType: job.jobType,
      status: "pending",
      runAt: job.runAt,
      attempts: job.attempts,
      payload: {},
    }));
  },
  async completeJob() {},
  async failJob() {},
};

function buildReadiness(data: {
  merchant: Merchant;
  connections: Array<{ provider: string; status: string }>;
}) {
  const shopifyConnected = data.connections.some(
    (connection) =>
      connection.provider === "shopify" && connection.status === "connected",
  );
  const whatsappConnected = data.connections.some(
    (connection) =>
      connection.provider === "whatsapp_cloud" && connection.status === "connected",
  );

  return [
    {
      id: "account",
      label: "Merchant account configured",
      description: "Merchant admin and pilot defaults are in place.",
      status: "complete" as const,
    },
    {
      id: "shopify",
      label: "Shopify connection",
      description: "Custom app credentials and webhook verification are ready.",
      status: shopifyConnected ? ("complete" as const) : ("pending" as const),
    },
    {
      id: "whatsapp",
      label: "WhatsApp configuration",
      description: "Meta sender and approved templates are validated for outreach.",
      status: whatsappConnected ? ("complete" as const) : ("pending" as const),
    },
    {
      id: "go-live",
      label: "Controlled go-live",
      description: "Live processing starts only after the merchant explicitly enables it.",
      status: data.merchant.goLiveEnabled ? ("complete" as const) : ("pending" as const),
    },
  ];
}

function mapMerchant(row: Record<string, any>): Merchant {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    locale: row.locale ?? "fr-MA",
    timezone: row.timezone ?? "Africa/Casablanca",
    onboardingStatus: row.onboarding_status ?? "setup",
    automationMode: "conservative",
    goLiveEnabled: Boolean(row.go_live_enabled),
    liveSince: row.live_since ?? null,
    reviewSlaMinutes: row.review_sla_minutes ?? 30,
    urgentReviewSlaMinutes: row.urgent_review_sla_minutes ?? 15,
    supportEmail: row.support_email ?? "ops@codintelligence.ma",
    pilotNote: row.pilot_note ?? "Pilot merchant profile",
  };
}

function mapTemplate(row: Record<string, any>): MessageTemplate {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    journey: row.journey,
    locale: row.locale,
    name: row.name,
    body: row.body,
    variables: row.variables ?? [],
    updatedAt: row.updated_at,
    toneHint: row.tone_hint ?? "",
  };
}

function mapRule(row: Record<string, any>): RuleConfig {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    code: row.code,
    title: row.title,
    description: row.description,
    enabled: row.enabled,
    points: row.points,
    severity: row.severity,
    hardStop: row.hard_stop,
    config: row.config ?? {},
  };
}

function mapOrderRows(params: {
  orderRows: Array<Record<string, any>>;
  normalizedRows: Array<Record<string, any>>;
  assessmentRows: Array<Record<string, any>>;
  reasonRows: Array<Record<string, any>>;
  decisionRows: Array<Record<string, any>>;
  outcomeRows: Array<Record<string, any>>;
  threadRows: Array<Record<string, any>>;
  eventRows: Array<Record<string, any>>;
  overrideRows: Array<Record<string, any>>;
  logRows: Array<Record<string, any>>;
}) {
  const normalizedByOrder = new Map(
    params.normalizedRows.map((row) => [row.order_id, row]),
  );
  const decisionByOrder = new Map(params.decisionRows.map((row) => [row.order_id, row]));
  const outcomeByOrder = new Map(params.outcomeRows.map((row) => [row.order_id, row]));
  const assessmentByOrder = new Map<string, Record<string, any>>();

  params.assessmentRows.forEach((row) => {
    if (!assessmentByOrder.has(row.order_id)) {
      assessmentByOrder.set(row.order_id, row);
    }
  });

  const reasonsByOrder = new Map<string, Array<Record<string, any>>>();
  params.reasonRows.forEach((row) => {
    const current = reasonsByOrder.get(row.order_id) ?? [];
    current.push(row);
    reasonsByOrder.set(row.order_id, current);
  });

  const threadByOrder = new Map(params.threadRows.map((row) => [row.order_id, row]));
  const eventsByThread = new Map<string, Array<Record<string, any>>>();
  params.eventRows.forEach((row) => {
    const current = eventsByThread.get(row.thread_id) ?? [];
    current.push(row);
    eventsByThread.set(row.thread_id, current);
  });

  const overridesByOrder = new Map<string, Array<Record<string, any>>>();
  params.overrideRows.forEach((row) => {
    const current = overridesByOrder.get(row.order_id) ?? [];
    current.push(row);
    overridesByOrder.set(row.order_id, current);
  });

  const logsByOrder = new Map<string, Array<Record<string, any>>>();
  params.logRows.forEach((row) => {
    const current = logsByOrder.get(row.order_id) ?? [];
    current.push(row);
    logsByOrder.set(row.order_id, current);
  });

  return params.orderRows.map((orderRow) => {
    const normalized = normalizedByOrder.get(orderRow.id);
    const assessmentRow = assessmentByOrder.get(orderRow.id);
    const reasonRows = reasonsByOrder.get(orderRow.id) ?? [];
    const decisionRow = decisionByOrder.get(orderRow.id);
    const outcomeRow = outcomeByOrder.get(orderRow.id);
    const threadRow = threadByOrder.get(orderRow.id);
    const eventRows = threadRow ? eventsByThread.get(threadRow.id) ?? [] : [];

    return {
      id: orderRow.id,
      merchantId: orderRow.merchant_id,
      sourceProvider: orderRow.source_provider,
      externalId: orderRow.external_id,
      orderNumber: orderRow.order_number,
      customerName: orderRow.customer_name,
      customerPhone: orderRow.customer_phone,
      city: orderRow.city,
      totalAmount: Number(orderRow.total_amount ?? 0),
      currency: orderRow.currency ?? "MAD",
      createdAt: orderRow.source_created_at ?? orderRow.created_at,
      updatedAt: orderRow.updated_at,
      status: decisionRow?.current_status ?? "new",
      normalizedOrder: {
        orderId: orderRow.id,
        customerName: orderRow.customer_name,
        phoneRaw: orderRow.customer_phone,
        phoneNormalized: normalized?.phone_normalized ?? null,
        validPhone: Boolean(normalized?.valid_phone),
        city: orderRow.city,
        addressLine: normalized?.address_line ?? "",
        postalCode: normalized?.postal_code ?? null,
        addressQualityScore: normalized?.address_quality_score ?? 0,
        addressNeedsClarification: Boolean(normalized?.address_needs_clarification),
        duplicateRecentOrders: normalized?.duplicate_recent_orders ?? 0,
        recentRiskyBehaviorCount: normalized?.recent_risky_behavior_count ?? 0,
        riskyCity: Boolean(normalized?.risky_city),
        blacklisted: Boolean(normalized?.blacklisted),
        highValue: Boolean(normalized?.high_value),
        totalAmount: Number(orderRow.total_amount ?? 0),
        currency: orderRow.currency ?? "MAD",
        sourceCreatedAt: orderRow.source_created_at ?? orderRow.created_at,
        sourceSnapshot: normalized?.normalized_snapshot ?? {},
      },
      assessment: {
        id: assessmentRow?.id ?? `assessment-${orderRow.id}`,
        orderId: orderRow.id,
        assessedAt: assessmentRow?.created_at ?? orderRow.created_at,
        riskScore: assessmentRow?.risk_score ?? 0,
        riskLevel: assessmentRow?.risk_level ?? "low",
        recommendedAction: assessmentRow?.recommended_action ?? "manual_review",
        reasonCodes: reasonRows.map((row) => row.code),
        systemDecision: assessmentRow?.system_decision ?? "manual_review",
        reasons: reasonRows.map((row) => ({
          code: row.code,
          label: row.label,
          detail: row.detail,
          points: row.points,
          severity: row.severity,
          hardStop: row.hard_stop,
        })),
        summary: assessmentRow?.summary ?? "",
      },
      decision: {
        orderId: orderRow.id,
        currentStatus: decisionRow?.current_status ?? "new",
        recommendedAction: decisionRow?.recommended_action ?? "manual_review",
        systemDecision: decisionRow?.system_decision ?? "manual_review",
        merchantFinalDecision: decisionRow?.merchant_final_decision ?? null,
        awaitingResponseDeadlineAt: decisionRow?.awaiting_response_deadline_at ?? null,
        lastMessageOutcome: decisionRow?.last_message_outcome ?? null,
        explanationSummary: decisionRow?.explanation_summary ?? "",
        classificationFeedback: decisionRow?.classification_feedback ?? null,
      },
      outcome: outcomeRow
        ? {
            id: outcomeRow.id,
            orderId: outcomeRow.order_id,
            finalOutcome: outcomeRow.final_outcome,
            note: outcomeRow.note,
            recordedBy: outcomeRow.recorded_by_name ?? outcomeRow.recorded_by,
            recordedAt: outcomeRow.recorded_at,
            source: outcomeRow.source,
          }
        : null,
      messageThread: threadRow
        ? {
            id: threadRow.id,
            merchantId: threadRow.merchant_id,
            orderId: threadRow.order_id,
            journey: threadRow.journey,
            latestOutcome: threadRow.latest_outcome,
            lastInboundAt: threadRow.last_inbound_at,
            lastOutboundAt: threadRow.last_outbound_at,
            events: eventRows.map((eventRow) => ({
              id: eventRow.id,
              direction: eventRow.direction,
              status: eventRow.delivery_status,
              body: eventRow.body,
              providerMessageId: eventRow.provider_message_id,
              outcome: eventRow.classified_outcome,
              createdAt: eventRow.created_at,
            })),
          }
        : null,
      overrides: (overridesByOrder.get(orderRow.id) ?? []).map((row) => ({
        id: row.id,
        orderId: row.order_id,
        actorName: row.actor_name ?? row.actor_user_id,
        actorRole: "merchant_admin",
        previousDecision: row.previous_decision,
        newDecision: row.new_decision,
        reason: row.override_reason,
        classificationFeedback: row.classification_feedback,
        createdAt: row.created_at,
      })),
      actionLog: (logsByOrder.get(orderRow.id) ?? []).map((row) => ({
        id: row.id,
        orderId: row.order_id,
        actorName: row.actor_name ?? row.actor_id ?? "System",
        actorType: row.actor_type,
        actionType: row.action_type,
        summary: row.summary,
        createdAt: row.created_at,
      })),
    } satisfies OrderRecord;
  });
}

async function hydrateOrders(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  merchantId: string,
) {
  const { data: orderRows, error: orderError } = await admin
    .from("orders")
    .select("*")
    .eq("merchant_id", merchantId)
    .order("source_created_at", { ascending: false })
    .limit(50);

  if (orderError) {
    throw orderError;
  }

  const orders = orderRows ?? [];
  const orderIds = orders.map((order) => order.id);

  if (!orderIds.length) {
    return [] satisfies OrderRecord[];
  }

  const [
    { data: normalizedRows },
    { data: assessmentRows },
    { data: reasonRows },
    { data: decisionRows },
    { data: outcomeRows },
    { data: threadRows },
    { data: overrideRows },
    { data: logRows },
  ] = await Promise.all([
    admin.from("normalized_orders").select("*").in("order_id", orderIds),
    admin
      .from("risk_assessments")
      .select("*")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false }),
    admin.from("risk_reasons").select("*").in("order_id", orderIds),
    admin.from("order_decisions").select("*").in("order_id", orderIds),
    admin.from("order_outcomes").select("*").in("order_id", orderIds),
    admin.from("message_threads").select("*").in("order_id", orderIds),
    admin.from("decision_overrides").select("*").in("order_id", orderIds),
    admin.from("order_action_logs").select("*").in("order_id", orderIds),
  ]);

  const threadIds = (threadRows ?? []).map((thread) => thread.id);
  const { data: eventRows } = threadIds.length
    ? await admin.from("message_events").select("*").in("thread_id", threadIds)
    : { data: [] };

  return mapOrderRows({
    orderRows: orders,
    normalizedRows: normalizedRows ?? [],
    assessmentRows: assessmentRows ?? [],
    reasonRows: reasonRows ?? [],
    decisionRows: decisionRows ?? [],
    outcomeRows: outcomeRows ?? [],
    threadRows: threadRows ?? [],
    eventRows: eventRows ?? [],
    overrideRows: overrideRows ?? [],
    logRows: logRows ?? [],
  });
}

function createLiveRepository(session?: AppSession): AppRepository {
  const admin = createSupabaseAdminClient();

  const resolveMerchantId = async (merchantId?: string) => {
    if (merchantId) {
      return merchantId;
    }

    if (session?.mode === "live" && session.role === "merchant_admin") {
      return session.merchantId!;
    }

    const { data } = await admin.from("merchants").select("id").limit(1).maybeSingle();
    return data?.id;
  };

  return {
    mode: "live",
    async getMerchantDashboard(merchantIdArg) {
      const merchantId = await resolveMerchantId(merchantIdArg);
      const { data: merchantRow, error: merchantError } = await admin
        .from("merchants")
        .select("*")
        .eq("id", merchantId)
        .maybeSingle();

      if (merchantError || !merchantRow) {
        throw merchantError ?? new Error("Merchant not found");
      }

      const [{ data: connectionRows }, { data: ruleRows }, { data: templateRows }] =
        await Promise.all([
          admin.from("channel_connections").select("*").eq("merchant_id", merchantId),
          admin.from("rule_configs").select("*").eq("merchant_id", merchantId),
          admin.from("message_templates").select("*").eq("merchant_id", merchantId),
        ]);

      const merchant = mapMerchant(merchantRow);
      const orders = await hydrateOrders(admin, merchantId);
      const connections =
        connectionRows?.map((row) => ({
          id: row.id,
          provider: row.provider,
          status: row.status,
          label: row.label,
          externalAccountId: row.external_account_id,
          configSummary: row.config_summary,
          lastSyncAt: row.last_sync_at,
          errorMessage: row.error_message,
        })) ?? [];

      return {
        merchant,
        connections,
        readiness: buildReadiness({ merchant, connections }),
        rules: (ruleRows ?? []).map(mapRule),
        templates: (templateRows ?? []).map(mapTemplate),
        orders,
        kpis: buildDashboardKpis(orders),
      };
    },
    async getOrder(orderId, merchantIdArg) {
      const merchantId = await resolveMerchantId(merchantIdArg);
      const orders = await hydrateOrders(admin, merchantId);
      return orders.find((order) => order.id === orderId) ?? null;
    },
    async getInternalOperations() {
      const [{ data: merchantRows }, { data: jobRows }, { data: webhookRows }] =
        await Promise.all([
          admin.from("merchants").select("*").order("created_at"),
          admin
            .from("job_queue")
            .select("*")
            .in("status", ["pending", "retrying"])
            .order("run_at", { ascending: true })
            .limit(12),
          admin
            .from("webhook_events")
            .select("*")
            .order("processed_at", { ascending: false })
            .limit(20),
        ]);

      const merchants = await Promise.all(
        (merchantRows ?? []).map(async (row) => {
          const merchantId = row.id;
          const orders = await hydrateOrders(admin, merchantId);
          const connections = await admin
            .from("channel_connections")
            .select("id")
            .eq("merchant_id", merchantId);

          return {
            ...mapMerchant(row),
            connectedChannels: connections.data?.length ?? 0,
            openManualReviewOrders: orders.filter(
              (order) => order.status === "manual_review",
            ).length,
            responseRate:
              orders.length === 0
                ? 0
                : Math.round(
                    (orders.filter((order) => order.decision.lastMessageOutcome).length /
                      orders.length) *
                      100,
                  ),
          };
        }),
      );

      const alerts = (webhookRows ?? []).slice(0, 6).map((row) => ({
        id: row.id,
        merchantName:
          merchants.find((merchant) => merchant.id === row.merchant_id)?.name ??
          "Unknown merchant",
        title:
          row.processing_status === "failed"
            ? "Webhook processing failure"
            : "Webhook processed",
        severity:
          row.processing_status === "failed"
            ? ("critical" as const)
            : ("info" as const),
        detail: row.error_message ?? `${row.provider} ${row.topic} handled successfully.`,
        createdAt: row.created_at,
      }));

      return {
        merchants,
        alerts,
        pendingJobs: (jobRows ?? []).map((row) => ({
          id: row.id,
          jobType: row.job_type,
          merchantName:
            merchants.find((merchant) => merchant.id === row.merchant_id)?.name ??
            "Unknown merchant",
          runAt: row.run_at,
          attempts: row.attempts ?? 0,
        })),
        webhookHealth: (webhookRows ?? []).slice(0, 10).map((row) => ({
          provider: row.provider,
          merchantName:
            merchants.find((merchant) => merchant.id === row.merchant_id)?.name ??
            "Unknown merchant",
          lastProcessedAt: row.processed_at ?? row.created_at,
          status: row.processing_status === "failed" ? "degraded" : "healthy",
        })),
      };
    },
    async updateDecision(input) {
      const merchantId = await resolveMerchantId(input.merchantId);
      const { data: currentDecision } = await admin
        .from("order_decisions")
        .select("*")
        .eq("order_id", input.orderId)
        .maybeSingle();

      await admin.from("order_decisions").upsert(
        {
          order_id: input.orderId,
          merchant_id: merchantId,
          system_decision: currentDecision?.system_decision ?? input.newDecision,
          merchant_final_decision: input.newDecision,
          current_status: input.newStatus,
          recommended_action: currentDecision?.recommended_action ?? "manual_review",
          awaiting_response_deadline_at:
            currentDecision?.awaiting_response_deadline_at ?? null,
          last_message_outcome: currentDecision?.last_message_outcome ?? null,
          explanation_summary:
            currentDecision?.explanation_summary ?? input.overrideReason,
          classification_feedback: input.classificationFeedback ?? null,
        },
        { onConflict: "order_id" },
      );

      await admin.from("decision_overrides").insert({
        order_id: input.orderId,
        merchant_id: merchantId,
        actor_user_id: input.actorId ?? null,
        actor_name: input.actorName,
        previous_decision:
          currentDecision?.merchant_final_decision ?? currentDecision?.system_decision,
        new_decision: input.newDecision,
        override_reason: input.overrideReason,
        classification_feedback: input.classificationFeedback ?? null,
      });

      await admin.from("order_action_logs").insert({
        merchant_id: merchantId,
        order_id: input.orderId,
        actor_type: "merchant",
        actor_id: input.actorId ?? input.actorName,
        actor_name: input.actorName,
        action_type: "decision_override",
        summary: input.overrideReason,
      });
    },
    async recordOutcome(input) {
      const merchantId = await resolveMerchantId(input.merchantId);

      await admin.from("order_outcomes").upsert(
        {
          order_id: input.orderId,
          merchant_id: merchantId,
          final_outcome: input.finalOutcome,
          note: input.note ?? null,
          recorded_by: input.actorId ?? null,
          recorded_by_name: input.actorName,
          source: "manual",
        },
        { onConflict: "order_id" },
      );

      await admin.from("order_action_logs").insert({
        merchant_id: merchantId,
        order_id: input.orderId,
        actor_type: "merchant",
        actor_id: input.actorId ?? input.actorName,
        actor_name: input.actorName,
        action_type: "outcome_recorded",
        summary: `Final outcome marked as ${input.finalOutcome}.`,
      });
    },
    async getMerchantByShopDomain(shopDomain) {
      const { data: connection } = await admin
        .from("channel_connections")
        .select("merchant_id")
        .eq("provider", "shopify")
        .eq("external_account_id", shopDomain)
        .eq("status", "connected")
        .maybeSingle();

      if (!connection) {
        return null;
      }

      const { data: merchantRow } = await admin
        .from("merchants")
        .select("*")
        .eq("id", connection.merchant_id)
        .maybeSingle();

      return merchantRow ? mapMerchant(merchantRow) : null;
    },
    async getTemplateByJourney(merchantId, journey) {
      const { data } = await admin
        .from("message_templates")
        .select("*")
        .eq("merchant_id", merchantId)
        .eq("journey", journey)
        .maybeSingle();

      return data ? mapTemplate(data) : null;
    },
    async persistProcessedOrder(input) {
      const { data: orderRow, error: orderError } = await admin
        .from("orders")
        .upsert(
          {
            merchant_id: input.merchantId,
            source_provider: "shopify",
            external_id: input.externalId,
            order_number: input.orderNumber,
            customer_name: input.customerName,
            customer_phone: input.customerPhone,
            city: input.city,
            total_amount: input.totalAmount,
            currency: input.currency,
            shipping_address: input.shippingAddress,
            raw_payload: input.rawPayload,
            source_created_at: input.sourceCreatedAt,
          },
          { onConflict: "merchant_id,source_provider,external_id" },
        )
        .select("*")
        .single();

      if (orderError) {
        throw orderError;
      }

      await admin.from("normalized_orders").upsert(
        {
          order_id: orderRow.id,
          merchant_id: input.merchantId,
          normalized_snapshot: input.normalizedOrder.sourceSnapshot,
          phone_normalized: input.normalizedOrder.phoneNormalized,
          valid_phone: input.normalizedOrder.validPhone,
          address_line: input.normalizedOrder.addressLine,
          postal_code: input.normalizedOrder.postalCode,
          address_quality_score: input.normalizedOrder.addressQualityScore,
          address_needs_clarification: input.normalizedOrder.addressNeedsClarification,
          duplicate_recent_orders: input.normalizedOrder.duplicateRecentOrders,
          recent_risky_behavior_count: input.normalizedOrder.recentRiskyBehaviorCount,
          risky_city: input.normalizedOrder.riskyCity,
          blacklisted: input.normalizedOrder.blacklisted,
          high_value: input.normalizedOrder.highValue,
        },
        { onConflict: "order_id" },
      );

      const { data: assessmentRow } = await admin
        .from("risk_assessments")
        .insert({
          order_id: orderRow.id,
          merchant_id: input.merchantId,
          risk_score: input.assessment.riskScore,
          risk_level: input.assessment.riskLevel,
          recommended_action: input.assessment.recommendedAction,
          system_decision: input.assessment.systemDecision,
          summary: input.assessment.summary,
          reason_codes: input.assessment.reasonCodes,
          engine_version: "pilot-v1",
        })
        .select("id")
        .single();

      if (input.assessment.reasons.length) {
        await admin.from("risk_reasons").insert(
          input.assessment.reasons.map((reason) => ({
            assessment_id: assessmentRow?.id,
            order_id: orderRow.id,
            merchant_id: input.merchantId,
            code: reason.code,
            label: reason.label,
            detail: reason.detail,
            points: reason.points,
            severity: reason.severity,
            hard_stop: reason.hardStop ?? false,
          })),
        );
      }

      await admin.from("order_decisions").upsert(
        {
          order_id: orderRow.id,
          merchant_id: input.merchantId,
          system_decision: input.decision.systemDecision,
          merchant_final_decision: input.decision.merchantFinalDecision,
          current_status: input.decision.currentStatus,
          recommended_action: input.decision.recommendedAction,
          awaiting_response_deadline_at: input.decision.awaitingResponseDeadlineAt,
          last_message_outcome: input.decision.lastMessageOutcome,
          explanation_summary: input.decision.explanationSummary,
          classification_feedback: input.decision.classificationFeedback,
        },
        { onConflict: "order_id" },
      );

      if (
        input.decision.currentStatus === "awaiting_confirmation" ||
        input.decision.currentStatus === "awaiting_address"
      ) {
        const { data: threadRow } = await admin
          .from("message_threads")
          .insert({
            merchant_id: input.merchantId,
            order_id: orderRow.id,
            journey:
              input.decision.currentStatus === "awaiting_address"
                ? "address_clarification"
                : "confirmation",
            latest_outcome: null,
            last_outbound_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        await admin.from("message_events").insert({
          thread_id: threadRow?.id,
          merchant_id: input.merchantId,
          order_id: orderRow.id,
          direction: "outbound",
          delivery_status: "queued",
          body: input.outboundMessageBody ?? "",
        });

        await admin.from("job_queue").insert([
          {
            merchant_id: input.merchantId,
            order_id: orderRow.id,
            job_type: "send_whatsapp_message",
            status: "pending",
            run_at: new Date().toISOString(),
            payload: {
              orderId: orderRow.id,
              threadId: threadRow?.id,
              to: input.normalizedOrder.phoneNormalized,
              messageBody: input.outboundMessageBody,
            },
          },
          {
            merchant_id: input.merchantId,
            order_id: orderRow.id,
            job_type: "check_message_timeout",
            status: "pending",
            run_at:
              input.decision.awaitingResponseDeadlineAt ??
              addHours(new Date(), 2).toISOString(),
            payload: {
              orderId: orderRow.id,
              expectedStatus: input.decision.currentStatus,
            },
          },
        ]);
      }

      await admin.from("order_action_logs").insert({
        merchant_id: input.merchantId,
        order_id: orderRow.id,
        actor_type: "system",
        actor_id: "cod-intelligence",
        actor_name: "COD Intelligence",
        action_type: "order_ingested",
        summary: input.assessment.summary,
      });

      return {
        orderId: orderRow.id,
        status: input.decision.currentStatus,
      };
    },
    async persistWhatsAppInbound(input) {
      const { data: referencedEvent } = input.referencedProviderMessageId
        ? await admin
            .from("message_events")
            .select("thread_id, order_id, merchant_id")
            .eq("provider_message_id", input.referencedProviderMessageId)
            .maybeSingle()
        : { data: null };

      if (!referencedEvent) {
        return {
          outcome: input.outcome,
          status: null,
        };
      }

      await admin.from("message_events").insert({
        thread_id: referencedEvent.thread_id,
        merchant_id: referencedEvent.merchant_id,
        order_id: referencedEvent.order_id,
        direction: "inbound",
        delivery_status: "received",
        provider_message_id: input.providerMessageId ?? null,
        body: input.body,
        classified_outcome: input.outcome,
        payload: input.payload,
      });

      await admin.from("message_threads").update({
        latest_outcome: input.outcome,
        last_inbound_at: new Date().toISOString(),
      }).eq("id", referencedEvent.thread_id);

      let nextStatus: OrderStatus = "manual_review";
      let nextDecision: DecisionValue = "manual_review";

      if (input.outcome === "confirmed") {
        nextStatus = "approved_for_shipping";
        nextDecision = "approved_for_shipping";
      } else if (input.outcome === "canceled") {
        nextStatus = "blocked";
        nextDecision = "blocked";
      }

      await admin.from("order_decisions").update({
        current_status: nextStatus,
        merchant_final_decision: null,
        system_decision: nextDecision,
        recommended_action:
          nextStatus === "approved_for_shipping" ? "auto_approve" : "manual_review",
        last_message_outcome: input.outcome,
      }).eq("order_id", referencedEvent.order_id);

      await admin.from("order_action_logs").insert({
        merchant_id: referencedEvent.merchant_id,
        order_id: referencedEvent.order_id,
        actor_type: "system",
        actor_id: "whatsapp-webhook",
        actor_name: "WhatsApp webhook",
        action_type: "message_classified",
        summary: `Inbound reply classified as ${input.outcome}.`,
      });

      return {
        orderId: referencedEvent.order_id,
        outcome: input.outcome,
        status: nextStatus,
      };
    },
    async leaseDueJobs(limit) {
      const { data: jobs } = await admin
        .from("job_queue")
        .select("*")
        .in("status", ["pending", "retrying"])
        .lte("run_at", new Date().toISOString())
        .order("run_at", { ascending: true })
        .limit(limit);

      const leasedJobs = jobs ?? [];
      await Promise.all(
        leasedJobs.map((job) =>
          admin
            .from("job_queue")
            .update({
              status: "processing",
              locked_at: new Date().toISOString(),
              locked_by: "next-worker",
            })
            .eq("id", job.id),
        ),
      );

      return leasedJobs.map((job) => ({
        id: job.id,
        merchantId: job.merchant_id,
        orderId: job.order_id,
        jobType: job.job_type,
        status: job.status,
        runAt: job.run_at,
        attempts: job.attempts ?? 0,
        payload: job.payload ?? {},
      }));
    },
    async completeJob(jobId, note) {
      await admin
        .from("job_queue")
        .update({
          status: "completed",
          last_error: note ?? null,
        })
        .eq("id", jobId);
    },
    async failJob(jobId, errorMessage) {
      await admin
        .from("job_queue")
        .update({
          status: "retrying",
          attempts: 1,
          last_error: errorMessage,
        })
        .eq("id", jobId);
    },
  };
}

export function getAppRepository(session?: AppSession) {
  if (isDemoMode) {
    return demoRepository;
  }

  return createLiveRepository(session);
}
