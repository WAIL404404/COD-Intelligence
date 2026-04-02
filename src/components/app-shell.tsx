import Link from "next/link";
import type { ReactNode } from "react";

import type { AppSession, Merchant } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Queue" },
  { href: "/dashboard/onboarding", label: "Onboarding" },
  { href: "/dashboard/rules", label: "Rules" },
  { href: "/dashboard/templates", label: "Templates" },
  { href: "/dashboard/outcomes", label: "Outcomes" },
  { href: "/internal", label: "Internal" },
];

export function AppShell({
  session,
  merchant,
  title,
  description,
  activePath,
  children,
}: {
  session: AppSession;
  merchant: Merchant;
  title: string;
  description: string;
  activePath: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col py-6">
      <div className="page-shell space-y-6">
        <header className="glass-panel rounded-[2rem] px-6 py-6 md:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-warm/12 px-3 py-1 font-mono text-xs uppercase tracking-[0.18em] text-warm-strong">
                  {merchant.automationMode} automation
                </span>
                <span className="rounded-full bg-foreground/6 px-3 py-1 text-xs font-semibold text-foreground">
                  {session.mode === "demo" ? "Demo session" : session.userName}
                </span>
              </div>
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
                  {merchant.name}
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                  {title}
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
                  {description}
                </p>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-border bg-white/72 px-5 py-4 text-sm text-ink-soft">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
                Pilot note
              </p>
              <p className="mt-2 max-w-sm leading-6">{merchant.pilotNote}</p>
            </div>
          </div>
          <nav className="mt-6 flex flex-wrap gap-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  activePath === item.href
                    ? "bg-foreground text-background"
                    : "bg-white/76 text-foreground hover:bg-white",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        {children}
      </div>
    </div>
  );
}
