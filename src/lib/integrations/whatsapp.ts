/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderTemplate } from "@/lib/domain/whatsapp";
import { env, hasWhatsappConfig } from "@/lib/env";

type TemplateParameter = string | number;

type TemplateSendParams = {
  to: string;
  templateName: string;
  languageCode: string;
  parameters: TemplateParameter[];
};

export function verifyWhatsAppChallenge(params: URLSearchParams) {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token &&
    env.whatsappVerifyToken &&
    token === env.whatsappVerifyToken &&
    challenge
  ) {
    return challenge;
  }

  return null;
}

export function extractInboundMessages(payload: Record<string, any>) {
  const entries = payload.entry ?? [];
  const messages: Array<{
    message: Record<string, any>;
    metadata: Record<string, any>;
  }> = [];

  entries.forEach((entry: Record<string, any>) => {
    (entry.changes ?? []).forEach((change: Record<string, any>) => {
      const value = change.value ?? {};
      const metadata = value.metadata ?? {};
      (value.messages ?? []).forEach((message: Record<string, any>) => {
        messages.push({ message, metadata });
      });
    });
  });

  return messages;
}

function buildGraphApiHeaders() {
  return {
    Authorization: `Bearer ${env.whatsappAccessToken}`,
    "Content-Type": "application/json",
  };
}

export function toWhatsAppLanguageCode(locale: string) {
  const normalized = locale.toLowerCase();

  if (normalized.startsWith("fr")) {
    return "fr";
  }

  if (normalized.startsWith("ar")) {
    return "ar";
  }

  if (normalized.startsWith("en")) {
    return "en_US";
  }

  return "fr";
}

export function buildWhatsAppTemplatePayload(params: TemplateSendParams) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to,
    type: "template",
    template: {
      name: params.templateName,
      language: {
        code: params.languageCode,
      },
      components: params.parameters.length
        ? [
            {
              type: "body",
              parameters: params.parameters.map((parameter) => ({
                type: "text",
                text: String(parameter),
              })),
            },
          ]
        : [],
    },
  };
}

export async function sendWhatsAppTemplateMessage(params: TemplateSendParams) {
  if (!hasWhatsappConfig) {
    return {
      ok: false,
      providerMessageId: null,
      error: "WhatsApp Cloud API env vars are missing.",
    };
  }

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${env.whatsappPhoneNumberId}/messages`,
    {
      method: "POST",
      headers: buildGraphApiHeaders(),
      body: JSON.stringify(buildWhatsAppTemplatePayload(params)),
    },
  );

  const payload = await response.json();

  return {
    ok: response.ok,
    providerMessageId: payload.messages?.[0]?.id ?? null,
    error: response.ok ? null : payload.error?.message ?? "Unknown WhatsApp error",
  };
}

export function renderPilotTemplate(
  template: string,
  variables: Record<string, string | number | null | undefined>,
) {
  return renderTemplate(template, variables);
}
