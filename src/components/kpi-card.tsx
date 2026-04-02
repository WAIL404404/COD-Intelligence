import type { KpiMetric } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const trendTone = {
  positive: "text-success",
  neutral: "text-foreground",
  attention: "text-warm-strong",
} as const;

export function KpiCard({ metric }: { metric: KpiMetric }) {
  return (
    <article className="rounded-[1.5rem] border border-border bg-white/78 p-5 subtle-ring">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        {metric.label}
      </p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <p className={cn("text-3xl font-semibold tracking-tight", trendTone[metric.trend])}>
          {metric.value}
        </p>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">{metric.hint}</p>
    </article>
  );
}
