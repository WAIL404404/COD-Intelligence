import type {
  DecisionValue,
  OrderStatus,
  WhatsAppOutcome,
} from "@/lib/domain/types";
import { cn } from "@/lib/utils";

type BadgeValue = OrderStatus | DecisionValue | WhatsAppOutcome | string | null | undefined;

const toneMap: Record<string, string> = {
  approved_for_shipping: "bg-success/12 text-success border-success/15",
  awaiting_confirmation: "bg-teal/12 text-teal border-teal/15",
  awaiting_address: "bg-warning/14 text-[#8a5a07] border-warning/20",
  manual_review: "bg-warm/12 text-warm-strong border-warm/15",
  blocked: "bg-danger/12 text-danger border-danger/15",
  closed: "bg-foreground/8 text-foreground border-foreground/10",
  hold: "bg-warning/14 text-[#8a5a07] border-warning/20",
  awaiting_customer: "bg-teal/12 text-teal border-teal/15",
  confirmed: "bg-success/12 text-success border-success/15",
  canceled: "bg-danger/12 text-danger border-danger/15",
  address_updated: "bg-warning/14 text-[#8a5a07] border-warning/20",
  location_shared: "bg-warning/14 text-[#8a5a07] border-warning/20",
  unclear_reply: "bg-warm/12 text-warm-strong border-warm/15",
  no_response: "bg-warm/12 text-warm-strong border-warm/15",
};

export function StatusBadge({ value }: { value: BadgeValue }) {
  const label = value ? value.replaceAll("_", " ") : "n/a";

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize",
        toneMap[value ?? ""] ?? "bg-foreground/8 text-foreground border-foreground/10",
      )}
    >
      {label}
    </span>
  );
}
