import Link from "next/link";
import {
  ArrowRight,
  Building2,
  MessagesSquare,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";

export default function Home() {
  return (
    <main className="relative flex flex-1 items-center py-12 md:py-18">
      <div className="page-shell grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_380px]">
        <section className="glass-panel relative overflow-hidden rounded-[2rem] px-6 py-8 md:px-10 md:py-12">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-warm via-warning to-teal" />
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white/80 px-4 py-2 font-mono text-xs font-medium uppercase tracking-[0.24em] text-ink-soft">
            Pilot-ready COD Intelligence
          </span>
          <div className="mt-8 max-w-3xl space-y-6">
            <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl md:leading-[1.05]">
              Reduce bad COD shipments with explainable scoring and operational
              WhatsApp follow-up.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-ink-soft">
              This MVP gives Moroccan merchants one reliable loop:
              Shopify intake, normalized risk analysis, WhatsApp confirmation,
              human review, and a final shipping decision with full traceability.
            </p>
          </div>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5"
            >
              Open Pilot Dashboard
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/internal"
              className="inline-flex items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-white/70"
            >
              Internal Ops Console
            </Link>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: ShoppingBag,
                title: "Shopify Ingestion",
                body: "Webhook-safe intake, normalization, and source snapshots per order.",
              },
              {
                icon: ShieldCheck,
                title: "Weighted Risk Scoring",
                body: "Explainable thresholds with hard stops, reason codes, and manual review.",
              },
              {
                icon: MessagesSquare,
                title: "WhatsApp Workflows",
                body: "Confirmation and address clarification with timeout-based escalation.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <article
                key={title}
                className="rounded-[1.5rem] border border-border bg-white/75 p-5"
              >
                <div className="mb-4 inline-flex rounded-2xl bg-warm/10 p-3 text-warm">
                  <Icon className="size-5" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="glass-panel rounded-[2rem] px-6 py-8">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-teal/12 p-3 text-teal">
              <Building2 className="size-5" />
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
                Pilot Scope
              </p>
              <h2 className="text-xl font-semibold text-foreground">
                3-5 Shopify merchants
              </h2>
            </div>
          </div>
          <dl className="mt-8 space-y-5 text-sm text-ink-soft">
            <div className="border-b border-border pb-4">
              <dt className="font-mono uppercase tracking-[0.18em] text-muted">
                Weekly volume
              </dt>
              <dd className="mt-1 text-lg font-semibold text-foreground">
                100-500 COD orders
              </dd>
            </div>
            <div className="border-b border-border pb-4">
              <dt className="font-mono uppercase tracking-[0.18em] text-muted">
                Review posture
              </dt>
              <dd className="mt-1 text-lg font-semibold text-foreground">
                Conservative automation by default
              </dd>
            </div>
            <div>
              <dt className="font-mono uppercase tracking-[0.18em] text-muted">
                Primary proof
              </dt>
              <dd className="mt-1 text-lg font-semibold text-foreground">
                Better shipment quality and faster pre-shipping decisions
              </dd>
            </div>
          </dl>
          <div className="mt-8 rounded-[1.5rem] border border-border bg-[#112026] px-5 py-5 text-white">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/65">
              Demo mode
            </p>
            <p className="mt-3 text-sm leading-6 text-white/80">
              If Supabase is not configured yet, the dashboard loads seeded pilot
              data so the workflow can still be reviewed end to end.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
