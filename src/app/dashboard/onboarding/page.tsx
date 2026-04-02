import { CheckCircle2, CircleDashed } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { getAppRepository } from "@/lib/data/repository";
import { getAppSession } from "@/lib/session";

export default async function OnboardingPage() {
  const session = await getAppSession({ allowDemo: true });
  const repository = getAppRepository(session);
  const data = await repository.getMerchantDashboard(
    session.mode === "live" ? session.merchantId : undefined,
  );

  return (
    <AppShell
      session={session}
      merchant={data.merchant}
      title="Readiness before live COD processing"
      description="The pilot only switches on when Shopify, WhatsApp, templates, and conservative defaults are all confirmed."
      activePath="/dashboard/onboarding"
    >
      <SectionCard
        eyebrow="Pilot Checklist"
        title="Merchant go-live readiness"
        description="These checks reflect the pilot contract: no merchant should process live orders before setup is complete."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {data.readiness.map((item) => (
            <article
              key={item.id}
              className="rounded-[1.5rem] border border-border bg-white/80 p-5"
            >
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  {item.status === "complete" ? (
                    <CheckCircle2 className="size-5 text-success" />
                  ) : (
                    <CircleDashed className="size-5 text-warm-strong" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{item.label}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">{item.description}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </AppShell>
  );
}
