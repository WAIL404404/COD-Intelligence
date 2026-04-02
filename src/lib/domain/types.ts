export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export const orderStatuses = [
  "new",
  "normalized",
  "scored",
  "awaiting_confirmation",
  "awaiting_address",
  "manual_review",
  "approved_for_shipping",
  "blocked",
  "closed",
] as const;

export const riskLevels = ["low", "medium", "high", "critical"] as const;

export const recommendedActions = [
  "auto_approve",
  "send_confirmation",
  "request_address",
  "manual_review",
  "block",
] as const;

export const decisionValues = [
  "approved_for_shipping",
  "hold",
  "manual_review",
  "blocked",
  "awaiting_customer",
] as const;

export const whatsappOutcomes = [
  "confirmed",
  "canceled",
  "address_updated",
  "location_shared",
  "unclear_reply",
  "no_response",
] as const;

export const finalOutcomes = [
  "delivered",
  "refused",
  "canceled",
  "unreachable",
] as const;

export const messageJourneys = ["confirmation", "address_clarification"] as const;

export const connectionProviders = ["shopify", "whatsapp_cloud"] as const;

export type OrderStatus = (typeof orderStatuses)[number];
export type RiskLevel = (typeof riskLevels)[number];
export type RecommendedAction = (typeof recommendedActions)[number];
export type DecisionValue = (typeof decisionValues)[number];
export type WhatsAppOutcome = (typeof whatsappOutcomes)[number];
export type FinalOutcome = (typeof finalOutcomes)[number];
export type MessageJourney = (typeof messageJourneys)[number];
export type ConnectionProvider = (typeof connectionProviders)[number];

export type Merchant = {
  id: string;
  slug: string;
  name: string;
  locale: string;
  timezone: string;
  onboardingStatus: "setup" | "ready" | "live";
  automationMode: "conservative";
  goLiveEnabled: boolean;
  liveSince?: string | null;
  reviewSlaMinutes: number;
  urgentReviewSlaMinutes: number;
  supportEmail: string;
  pilotNote: string;
};

export type ChannelConnection = {
  id: string;
  provider: ConnectionProvider;
  status: "connected" | "pending" | "needs_attention";
  label: string;
  externalAccountId?: string | null;
  configSummary: string;
  lastSyncAt?: string | null;
  errorMessage?: string | null;
};

export type RuleConfig = {
  id: string;
  merchantId: string;
  code: string;
  title: string;
  description: string;
  enabled: boolean;
  points: number;
  severity: "low" | "medium" | "high" | "critical";
  hardStop: boolean;
  config: Record<string, Json>;
};

export type MessageTemplate = {
  id: string;
  merchantId: string;
  journey: MessageJourney;
  locale: string;
  name: string;
  body: string;
  variables: string[];
  updatedAt: string;
  toneHint: string;
};

export type MessageEvent = {
  id: string;
  direction: "inbound" | "outbound";
  status: "queued" | "sent" | "delivered" | "read" | "received";
  body: string;
  providerMessageId?: string | null;
  outcome?: WhatsAppOutcome | null;
  createdAt: string;
};

export type MessageThread = {
  id: string;
  merchantId: string;
  orderId: string;
  journey: MessageJourney;
  latestOutcome?: WhatsAppOutcome | null;
  lastInboundAt?: string | null;
  lastOutboundAt?: string | null;
  events: MessageEvent[];
};

export type RiskReason = {
  code: string;
  label: string;
  detail: string;
  points: number;
  severity: "low" | "medium" | "high" | "critical";
  hardStop?: boolean;
};

export type RiskAssessment = {
  id: string;
  orderId: string;
  assessedAt: string;
  riskScore: number;
  riskLevel: RiskLevel;
  recommendedAction: RecommendedAction;
  reasonCodes: string[];
  systemDecision: DecisionValue;
  reasons: RiskReason[];
  summary: string;
};

export type DecisionOverride = {
  id: string;
  orderId: string;
  actorName: string;
  actorRole: string;
  previousDecision: DecisionValue;
  newDecision: DecisionValue;
  reason: string;
  classificationFeedback?: string | null;
  createdAt: string;
};

export type OrderOutcomeRecord = {
  id: string;
  orderId: string;
  finalOutcome: FinalOutcome;
  note?: string | null;
  recordedBy: string;
  recordedAt: string;
  source: "manual" | "imported";
};

export type OrderActionLog = {
  id: string;
  orderId: string;
  actorName: string;
  actorType: "system" | "merchant" | "internal_staff";
  actionType: string;
  summary: string;
  createdAt: string;
};

export type NormalizedOrder = {
  orderId: string;
  customerName: string;
  phoneRaw: string;
  phoneNormalized: string | null;
  validPhone: boolean;
  city: string;
  addressLine: string;
  postalCode?: string | null;
  addressQualityScore: number;
  addressNeedsClarification: boolean;
  duplicateRecentOrders: number;
  recentRiskyBehaviorCount: number;
  riskyCity: boolean;
  blacklisted: boolean;
  highValue: boolean;
  totalAmount: number;
  currency: string;
  sourceCreatedAt: string;
  sourceSnapshot: Record<string, Json>;
};

export type OrderDecision = {
  orderId: string;
  currentStatus: OrderStatus;
  recommendedAction: RecommendedAction;
  systemDecision: DecisionValue;
  merchantFinalDecision?: DecisionValue | null;
  awaitingResponseDeadlineAt?: string | null;
  lastMessageOutcome?: WhatsAppOutcome | null;
  explanationSummary: string;
  classificationFeedback?: string | null;
};

export type OrderRecord = {
  id: string;
  merchantId: string;
  sourceProvider: "shopify";
  externalId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  city: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  normalizedOrder: NormalizedOrder;
  assessment: RiskAssessment;
  decision: OrderDecision;
  outcome?: OrderOutcomeRecord | null;
  messageThread?: MessageThread | null;
  overrides: DecisionOverride[];
  actionLog: OrderActionLog[];
};

export type KpiMetric = {
  label: string;
  value: string;
  hint: string;
  trend: "positive" | "neutral" | "attention";
};

export type ReadinessItem = {
  id: string;
  label: string;
  description: string;
  status: "complete" | "pending";
};

export type MerchantDashboardData = {
  merchant: Merchant;
  connections: ChannelConnection[];
  readiness: ReadinessItem[];
  rules: RuleConfig[];
  templates: MessageTemplate[];
  orders: OrderRecord[];
  kpis: KpiMetric[];
};

export type InternalAlert = {
  id: string;
  merchantName: string;
  title: string;
  severity: "info" | "attention" | "critical";
  detail: string;
  createdAt: string;
};

export type InternalOperationsData = {
  merchants: Array<
    Merchant & {
      connectedChannels: number;
      openManualReviewOrders: number;
      responseRate: number;
    }
  >;
  alerts: InternalAlert[];
  pendingJobs: Array<{
    id: string;
    jobType: string;
    merchantName: string;
    runAt: string;
    attempts: number;
  }>;
  webhookHealth: Array<{
    provider: ConnectionProvider;
    merchantName: string;
    lastProcessedAt: string;
    status: "healthy" | "degraded";
  }>;
};

export type AppSession =
  | {
      mode: "demo";
      userName: string;
      role: "merchant_admin";
    }
  | {
      mode: "live";
      userId: string;
      userName: string;
      email: string;
      role: "merchant_admin" | "internal_staff";
      merchantId?: string;
    };
