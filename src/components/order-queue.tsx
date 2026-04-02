import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import type { OrderRecord } from "@/lib/domain/types";
import { currency, formatDateTime } from "@/lib/utils";

export function OrderQueue({ orders }: { orders: OrderRecord[] }) {
  return (
    <div className="grid gap-4">
      {orders.map((order) => (
        <Link
          key={order.id}
          href={`/dashboard/orders/${order.id}`}
          className="rounded-[1.5rem] border border-border bg-white/78 p-5 transition-transform hover:-translate-y-0.5"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-xl font-semibold text-foreground">{order.orderNumber}</h3>
                <StatusBadge value={order.status} />
                <StatusBadge value={order.decision.systemDecision} />
              </div>
              <div className="grid gap-2 text-sm text-ink-soft md:grid-cols-2">
                <p>{order.customerName}</p>
                <p>{order.customerPhone}</p>
                <p>{order.city}</p>
                <p>{currency(order.totalAmount, order.currency)}</p>
              </div>
              <p className="max-w-3xl text-sm leading-6 text-muted">
                {order.decision.explanationSummary}
              </p>
            </div>
            <div className="space-y-3 text-right">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
                Created
              </p>
              <p className="text-sm font-medium text-foreground">
                {formatDateTime(order.createdAt)}
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                {order.assessment.reasons.slice(0, 3).map((reason) => (
                  <span
                    key={reason.code}
                    className="rounded-full bg-foreground/6 px-3 py-1 text-xs text-ink-soft"
                  >
                    {reason.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
