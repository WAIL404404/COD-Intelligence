import { clsx, type ClassValue } from "clsx";
import { format, formatDistanceToNowStrict } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function currency(value: number, currencyCode = "MAD") {
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) {
    return "Not available";
  }

  return format(new Date(value), "dd MMM yyyy, HH:mm");
}

export function relativeTime(value: string | Date | null | undefined) {
  if (!value) {
    return "No timestamp";
  }

  return formatDistanceToNowStrict(new Date(value), {
    addSuffix: true,
  });
}

export function toSlug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
