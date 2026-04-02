import { notFound } from "next/navigation";

import {
  recordOutcomeAction,
  overrideDecisionAction,
} from "@/app/dashboard/orders/actions";
import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { getAppRepository } from "@/lib/data/repository";
import { getAppSession } from "@/lib/session";
import { currency, formatDateTime } from "@/lib/utils";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getAppSession({ allowDemo: true });
  const repository = getAppRepository(session);
  const dashboard = await repository.getMerchantDashboard(
    session.mode === "live" ? session.merchantId : undefined,
  );
  const order = await repository.getOrder(
    id,
    session.mode === "live" ? session.merchantId : undefined,
  );

  if (!order) {
    notFound();
  }

  return (
    <AppShell
      session={session}
      merchant={dashboard.merchant}
      title={`Order ${order.orderNumber}`}
      description="Review the normalized order, understand every risk reason, and decide whether it should ship, wait, or be blocked."
      activePath="/dashboard"
    >
      <div className="section-grid">
        <div className="grid gap-4">
          <SectionCard
            eyebrow="Decision Summary"
            title="Current operational state"
            description="System recommendations remain visible even after a merchant override so the pilot can learn from disagreement."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.5rem] border border-border bg-white/80 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge value={order.status} />
                  <StatusBadge value={order.decision.systemDecision} />
                  {order.decision.merchantFinalDecision ? (
                    <StatusBadge value={order.decision.merchantFinalDecision} />
                  ) : null}
                </div>
                <p className="mt-4 text-sm leading-6 text-muted">
                  {order.decision.explanationSummary}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-border bg-white/80 p-5">
                <dl className="grid gap-3 text-sm text-ink-soft">
                  <div className="flex justify-between gap-4">
                    <dt>Customer</dt>
                    <dd>{order.customerName}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Phone</dt>
                    <dd>{order.customerPhone}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Total</dt>
                    <dd>{currency(order.totalAmount, order.currency)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Created</dt>
                    <dd>{formatDateTime(order.createdAt)}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Explainability"
            title={`Risk score ${order.assessment.riskScore}`}
            description="Each reason is stored so future pilot feedback can improve scoring without losing the original trace."
          >
            <div className="grid gap-4">
              {order.assessment.reasons.map((reason) => (
                <article
                  key={reason.code}
                  className="rounded-[1.5rem] border border-border bg-white/80 p-5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">{reason.label}</h2>
                      <p className="mt-2 text-sm leading-6 text-muted">{reason.detail}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold text-foreground">+{reason.points}</p>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted">
                        {reason.severity}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="WhatsApp Thread"
            title="Conversation history"
            description="Customer replies stay attached to the order so merchant review can happen in context."
          >
            <div className="space-y-4">
              {order.messageThread?.events.length ? (
                order.messageThread.events.map((event) => (
                  <article
                    key={event.id}
                    className="rounded-[1.25rem] border border-border bg-white/80 p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-semibold text-foreground">{event.direction}</p>
                      <StatusBadge value={event.outcome || event.status} />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-ink-soft">{event.body}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted">
                      {formatDateTime(event.createdAt)}
                    </p>
                  </article>
                ))
              ) : (
                <p className="text-sm text-muted">No message thread recorded yet.</p>
              )}
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Audit Trail"
            title="Action log and overrides"
            description="Changes stay attributable so pilot feedback is useful, not anecdotal."
          >
            <div className="grid gap-4">
              {order.actionLog.map((log) => (
                <article
                  key={log.id}
                  className="rounded-[1.25rem] border border-border bg-white/80 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-semibold text-foreground">{log.actionType}</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">
                      {formatDateTime(log.createdAt)}
                    </p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-ink-soft">{log.summary}</p>
                </article>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-4">
          <SectionCard
            eyebrow="Merchant Action"
            title="Override the system decision"
            description="Use this when the system is directionally wrong and you want that disagreement captured for the pilot."
          >
            <form action={overrideDecisionAction} className="space-y-4">
              <input type="hidden" name="orderId" value={order.id} />
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-foreground">
                  New decision
                </span>
                <select
                  name="newDecision"
                  defaultValue={order.decision.merchantFinalDecision ?? "manual_review"}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3"
                >
                  <option value="approved_for_shipping">Approve for shipping</option>
                  <option value="manual_review">Hold in manual review</option>
                  <option value="blocked">Block order</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-foreground">
                  Queue status
                </span>
                <select
                  name="newStatus"
                  defaultValue={order.status}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3"
                >
                  <option value="approved_for_shipping">approved_for_shipping</option>
                  <option value="manual_review">manual_review</option>
                  <option value="blocked">blocked</option>
                  <option value="closed">closed</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-foreground">
                  Override reason
                </span>
                <textarea
                  name="overrideReason"
                  required
                  rows={4}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3"
                  placeholder="Explain what the system missed or why you are intervening."
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-foreground">
                  Classification feedback
                </span>
                <textarea
                  name="classificationFeedback"
                  rows={3}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3"
                  placeholder="Optional note for scoring improvement."
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background"
              >
                Save override
              </button>
            </form>
          </SectionCard>

          <SectionCard
            eyebrow="Outcome Capture"
            title="Record final shipment outcome"
            description="Outcomes can arrive later in the pilot, but they still need to feed the learning loop."
          >
            <form action={recordOutcomeAction} className="space-y-4">
              <input type="hidden" name="orderId" value={order.id} />
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-foreground">
                  Final outcome
                </span>
                <select
                  name="finalOutcome"
                  defaultValue={order.outcome?.finalOutcome ?? "delivered"}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3"
                >
                  <option value="delivered">delivered</option>
                  <option value="refused">refused</option>
                  <option value="canceled">canceled</option>
                  <option value="unreachable">unreachable</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-foreground">
                  Note
                </span>
                <textarea
                  name="note"
                  rows={4}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3"
                  placeholder="Optional delivery or refusal note."
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-full border border-foreground px-5 py-3 text-sm font-semibold text-foreground"
              >
                Record outcome
              </button>
            </form>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
