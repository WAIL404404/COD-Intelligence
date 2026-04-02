import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { getAppRepository } from "@/lib/data/repository";
import { demoDashboardData } from "@/lib/data/demo-data";
import { getAppSession } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";

export default async function InternalPage() {
  const session = await getAppSession({ allowDemo: true });
  const repository = getAppRepository(session);
  const data = await repository.getInternalOperations();
  const merchantFallback = demoDashboardData.merchant;

  return (
    <AppShell
      session={session}
      merchant={merchantFallback}
      title="Internal pilot support console"
      description="A minimal cross-merchant view for troubleshooting, webhook confidence, and support visibility during the pilot."
      activePath="/internal"
    >
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          eyebrow="Merchants"
          title="Pilot merchant posture"
          description="Use this view to keep lightweight watch over queue pressure, response quality, and channel readiness."
        >
          <div className="grid gap-4">
            {data.merchants.map((merchant) => (
              <article
                key={merchant.id}
                className="rounded-[1.5rem] border border-border bg-white/80 p-5"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">{merchant.name}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted">{merchant.pilotNote}</p>
                  </div>
                  <div className="grid gap-1 text-right text-sm text-ink-soft">
                    <p>{merchant.connectedChannels} live channels</p>
                    <p>{merchant.openManualReviewOrders} orders in manual review</p>
                    <p>{merchant.responseRate}% response rate</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>

        <div className="grid gap-4">
          <SectionCard
            eyebrow="Alerts"
            title="Support alerts"
            description="This is intentionally lightweight: enough signal to support the pilot without building a full back-office tool."
          >
            <div className="space-y-4">
              {data.alerts.map((alert) => (
                <article
                  key={alert.id}
                  className="rounded-[1.25rem] border border-border bg-white/80 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-foreground">{alert.title}</p>
                    <StatusBadge value={alert.severity} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-ink-soft">{alert.detail}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted">
                    {alert.merchantName} • {formatDateTime(alert.createdAt)}
                  </p>
                </article>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Background Jobs"
            title="Pending worker queue"
            description="Retries, timeout checks, and messaging sends all flow through the same DB-backed worker contract."
          >
            <div className="space-y-3">
              {data.pendingJobs.map((job) => (
                <article
                  key={job.id}
                  className="rounded-[1.25rem] border border-border bg-white/80 p-4"
                >
                  <p className="font-semibold text-foreground">{job.jobType}</p>
                  <p className="mt-1 text-sm text-ink-soft">{job.merchantName}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted">
                    Due {formatDateTime(job.runAt)} • attempt {job.attempts + 1}
                  </p>
                </article>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
