import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { getAppRepository } from "@/lib/data/repository";
import { getAppSession } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";

export default async function OutcomesPage() {
  const session = await getAppSession({ allowDemo: true });
  const repository = getAppRepository(session);
  const data = await repository.getMerchantDashboard(
    session.mode === "live" ? session.merchantId : undefined,
  );
  const completedOrders = data.orders.filter((order) => order.outcome);

  return (
    <AppShell
      session={session}
      merchant={data.merchant}
      title="Operational outcomes and feedback loops"
      description="Pilot value depends on learning from delivered, refused, canceled, and unreachable outcomes quickly, even when they are entered manually."
      activePath="/dashboard/outcomes"
    >
      <SectionCard
        eyebrow="Outcome Capture"
        title="Recorded shipment outcomes"
        description="Outcome logging stays lightweight in v1 but still preserves enough traceability to refine rules during the pilot."
      >
        <div className="grid gap-4">
          {completedOrders.map((order) => (
            <article
              key={order.id}
              className="rounded-[1.5rem] border border-border bg-white/80 p-5"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{order.orderNumber}</h2>
                  <p className="mt-1 text-sm text-muted">
                    Recorded {formatDateTime(order.outcome?.recordedAt)}
                  </p>
                </div>
                <StatusBadge value={order.outcome?.finalOutcome} />
              </div>
              <p className="mt-4 text-sm leading-6 text-ink-soft">
                {order.outcome?.note || "No extra note captured."}
              </p>
            </article>
          ))}
        </div>
      </SectionCard>
    </AppShell>
  );
}
