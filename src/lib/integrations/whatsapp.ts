/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderTemplate } from "@/lib/domain/whatsapp";
import { env, hasWhatsappConfig } from "@/lib/env";

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

export async function sendWhatsAppTextMessage(params: {
  to: string;
  body: string;
}) {
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
      headers: {
        Authorization: `Bearer ${env.whatsappAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.to,
        type: "text",
        text: {
          preview_url: false,
          body: params.body,
        },
      }),
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
