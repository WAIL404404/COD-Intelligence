import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { getAppRepository } from "@/lib/data/repository";
import { getAppSession } from "@/lib/session";

export default async function TemplatesPage() {
  const session = await getAppSession({ allowDemo: true });
  const repository = getAppRepository(session);
  const data = await repository.getMerchantDashboard(
    session.mode === "live" ? session.merchantId : undefined,
  );

  return (
    <AppShell
      session={session}
      merchant={data.merchant}
      title="WhatsApp journeys for confirmation and clarification"
      description="Templates stay short, human, and easy to adapt to Moroccan merchant tone without over-automating the conversation."
      activePath="/dashboard/templates"
    >
      <SectionCard
        eyebrow="Messaging"
        title="Seeded message templates"
        description="Only two reusable journeys ship in v1: confirmation and address clarification."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {data.templates.map((template) => (
            <article
              key={template.id}
              className="rounded-[1.5rem] border border-border bg-white/80 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{template.name}</h2>
                  <p className="mt-1 text-sm text-muted">{template.locale}</p>
                </div>
                <StatusBadge value={template.journey} />
              </div>
              <p className="mt-4 rounded-[1.25rem] bg-[#13252d] px-4 py-4 text-sm leading-7 text-white">
                {template.body}
              </p>
              <p className="mt-4 text-sm leading-6 text-muted">{template.toneHint}</p>
            </article>
          ))}
        </div>
      </SectionCard>
    </AppShell>
  );
}
