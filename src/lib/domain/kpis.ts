import type { KpiMetric, OrderRecord } from "@/lib/domain/types";

export function buildDashboardKpis(orders: OrderRecord[]): KpiMetric[] {
  const total = orders.length || 1;
  const approved = orders.filter(
    (order) => order.decision.systemDecision === "approved_for_shipping",
  ).length;
  const manualReview = orders.filter(
    (order) => order.status === "manual_review",
  ).length;
  const blocked = orders.filter((order) => order.status === "blocked").length;
  const whatsappConfirmed = orders.filter(
    (order) => order.decision.lastMessageOutcome === "confirmed",
  ).length;
  const responseRate = orders.filter((order) =>
    order.decision.lastMessageOutcome &&
    order.decision.lastMessageOutcome !== "no_response",
  ).length;

  return [
    {
      label: "Processed orders",
      value: `${orders.length}`,
      hint: "Current pilot processing window",
      trend: "neutral",
    },
    {
      label: "Auto-approved share",
      value: `${Math.round((approved / total) * 100)}%`,
      hint: "Conservative low-risk approvals",
      trend: approved / total >= 0.25 ? "positive" : "neutral",
    },
    {
      label: "WhatsApp confirmed",
      value: `${Math.round((whatsappConfirmed / total) * 100)}%`,
      hint: "Customer confirmations captured in thread",
      trend: whatsappConfirmed / total >= 0.2 ? "positive" : "neutral",
    },
    {
      label: "Manual review share",
      value: `${Math.round((manualReview / total) * 100)}%`,
      hint: "Orders still needing merchant action",
      trend: manualReview / total <= 0.4 ? "positive" : "attention",
    },
    {
      label: "Blocked share",
      value: `${Math.round((blocked / total) * 100)}%`,
      hint: "Hard-stop or very high risk orders",
      trend: blocked > 0 ? "attention" : "neutral",
    },
    {
      label: "Response rate",
      value: `${Math.round((responseRate / total) * 100)}%`,
      hint: "Orders with any WhatsApp reply logged",
      trend: responseRate / total >= 0.5 ? "positive" : "attention",
    },
  ];
}
