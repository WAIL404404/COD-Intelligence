import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { getAppRepository } from "@/lib/data/repository";
import { getAppSession } from "@/lib/session";

export default async function RulesPage() {
  const session = await getAppSession({ allowDemo: true });
  const repository = getAppRepository(session);
  const data = await repository.getMerchantDashboard(
    session.mode === "live" ? session.merchantId : undefined,
  );

  return (
    <AppShell
      session={session}
      merchant={data.merchant}
      title="Explainable weighted rules"
      description="Every score in the pilot maps back to concrete rule hits, clear point values, and predictable operational outcomes."
      activePath="/dashboard/rules"
    >
      <SectionCard
        eyebrow="Decision Engine"
        title="Rule catalog"
        description="Rules are deliberately conservative for new merchants so operations teams stay in control while trust is forming."
      >
        <div className="grid gap-4">
          {data.rules.map((rule) => (
            <article
              key={rule.id}
              className="rounded-[1.5rem] border border-border bg-white/80 p-5"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-semibold text-foreground">{rule.title}</h2>
                    <StatusBadge value={rule.hardStop ? "blocked" : rule.severity} />
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                    {rule.description}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
                    Score impact
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    +{rule.points}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </AppShell>
  );
}
