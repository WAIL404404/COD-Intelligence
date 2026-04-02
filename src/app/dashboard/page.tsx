import { AlertTriangle, Clock3, MessageSquareMore } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { KpiCard } from "@/components/kpi-card";
import { OrderQueue } from "@/components/order-queue";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { getAppRepository } from "@/lib/data/repository";
import { getAppSession } from "@/lib/session";
import { currency, formatDateTime } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await getAppSession({ allowDemo: true });
  const repository = getAppRepository(session);
  const data = await repository.getMerchantDashboard(
    session.mode === "live" ? session.merchantId : undefined,
  );
  const urgentReview = data.orders.filter((order) => order.status === "manual_review");
  const confirmationQueue = data.orders.filter(
    (order) => order.status === "awaiting_confirmation" || order.status === "awaiting_address",
  );

  return (
    <AppShell
      session={session}
      merchant={data.merchant}
      title="Operational queue for pilot COD decisions"
      description="Review incoming Shopify COD orders, understand the score, and intervene before the shipment leaves the warehouse."
      activePath="/dashboard"
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.kpis.map((metric) => (
          <KpiCard key={metric.label} metric={metric} />
        ))}
      </section>

      <div className="section-grid">
        <SectionCard
          eyebrow="Action Queue"
          title="Orders requiring attention"
          description="The queue is ordered for human action first: review, clarification, then approvals already safe to ship."
        >
          <OrderQueue orders={data.orders} />
        </SectionCard>

        <div className="grid gap-4">
          <SectionCard
            eyebrow="Review SLA"
            title="Escalation watch"
            description="Manual review is a normal workflow, but the dashboard keeps the merchant honest during business hours."
          >
            <div className="space-y-4">
              <div className="rounded-[1.25rem] border border-border bg-white/74 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-warm/12 p-3 text-warm-strong">
                    <Clock3 className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {data.merchant.reviewSlaMinutes} minute review target
                    </p>
                    <p className="text-sm text-muted">
                      {data.merchant.urgentReviewSlaMinutes} minutes near same-day cutoff
                    </p>
                  </div>
                </div>
              </div>
              {urgentReview.slice(0, 3).map((order) => (
                <div
                  key={order.id}
                  className="rounded-[1.25rem] border border-border bg-white/74 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-foreground">{order.orderNumber}</p>
                    <StatusBadge value={order.status} />
                  </div>
                  <p className="mt-2 text-sm text-ink-soft">
                    {currency(order.totalAmount, order.currency)} • {order.city}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {order.decision.explanationSummary}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="WhatsApp"
            title="Open customer conversations"
            description="Silent or unclear replies are intentionally surfaced for people, not auto-closed."
          >
            <div className="space-y-4">
              {confirmationQueue.slice(0, 3).map((order) => (
                <div
                  key={order.id}
                  className="rounded-[1.25rem] border border-border bg-white/74 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <MessageSquareMore className="size-4 text-teal" />
                      <p className="font-semibold text-foreground">{order.orderNumber}</p>
                    </div>
                    <StatusBadge value={order.status} />
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    Last change: {formatDateTime(order.updatedAt)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-ink-soft">
                    {order.messageThread?.events.at(-1)?.body || "Outbound message queued"}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Connections"
            title="Go-live posture"
            description="Pilot merchants stay conservative by default until confidence is earned."
          >
            <div className="space-y-3">
              {data.connections.map((connection) => (
                <div
                  key={connection.id}
                  className="rounded-[1.25rem] border border-border bg-white/74 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-foreground">{connection.label}</p>
                    <StatusBadge value={connection.status} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {connection.configSummary}
                  </p>
                </div>
              ))}
              <div className="rounded-[1.25rem] border border-border bg-[#122229] px-4 py-4 text-white">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="size-4 text-warning" />
                  <p className="text-sm font-medium">
                    Only new Shopify orders created after go-live enter live processing.
                  </p>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
