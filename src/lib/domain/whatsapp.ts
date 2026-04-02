import type { MessageJourney, WhatsAppOutcome } from "@/lib/domain/types";

type InboundMessageShape = {
  type?: string;
  text?: { body?: string | null } | null;
  button?: { text?: string | null } | null;
  interactive?: {
    type?: string | null;
    button_reply?: { title?: string | null } | null;
    list_reply?: { title?: string | null } | null;
  } | null;
  location?: Record<string, unknown> | null;
};

export function renderTemplate(
  body: string,
  variables: Record<string, string | number | null | undefined>,
) {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = variables[key];
    return value === null || value === undefined ? "" : String(value);
  });
}

function extractText(message: InboundMessageShape) {
  return (
    message.text?.body ||
    message.button?.text ||
    message.interactive?.button_reply?.title ||
    message.interactive?.list_reply?.title ||
    ""
  )
    .trim()
    .toLowerCase();
}

export function classifyWhatsAppReply(
  message: InboundMessageShape,
  journey: MessageJourney,
): WhatsAppOutcome {
  if (message.location) {
    return "location_shared";
  }

  const text = extractText(message);

  if (!text) {
    return "unclear_reply";
  }

  if (/(annule|annuler|cancel|canceler|stop|plus besoin)/.test(text)) {
    return "canceled";
  }

  if (/(oui|ok|confirme|daccord|d'accord|valide|je confirme)/.test(text)) {
    return "confirmed";
  }

  if (
    journey === "address_clarification" &&
    (/(adresse|immeuble|appartement|quartier|avenue|rue|bloc)/.test(text) ||
      /\d/.test(text))
  ) {
    return "address_updated";
  }

  return "unclear_reply";
}
