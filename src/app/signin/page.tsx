import Link from "next/link";

import { SignInForm } from "@/components/sign-in-form";
import { isDemoMode } from "@/lib/env";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center py-10">
      <div className="page-shell grid gap-8 lg:grid-cols-[1.1fr_420px]">
        <section className="glass-panel rounded-[2rem] px-8 py-10">
          <span className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            COD Intelligence
          </span>
          <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Merchant access for pilot operations.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-soft">
            Sign in with Supabase magic links to access onboarding, queues, overrides,
            and final outcome capture. Demo mode stays open even before Supabase is configured.
          </p>
          <div className="mt-8">
            <Link
              href="/dashboard"
              className="inline-flex rounded-full border border-foreground px-5 py-3 text-sm font-semibold text-foreground"
            >
              Continue to dashboard
            </Link>
          </div>
        </section>
        <aside className="glass-panel rounded-[2rem] px-6 py-8">
          {isDemoMode ? (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">Demo mode active</h2>
              <p className="text-sm leading-7 text-muted">
                Add Supabase env vars to enable real auth. Until then, the dashboard runs
                against seeded pilot data so the workflow can still be reviewed.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold text-foreground">
                Send your magic link
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                Use the merchant admin email invited to the pilot workspace.
              </p>
              <div className="mt-6">
                <SignInForm />
              </div>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
