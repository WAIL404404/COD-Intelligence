import { NextResponse } from "next/server";

import { getAppRepository } from "@/lib/data/repository";
import { classifyWhatsAppReply } from "@/lib/domain/whatsapp";
import {
  extractInboundMessages,
  verifyWhatsAppChallenge,
} from "@/lib/integrations/whatsapp";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const challenge = verifyWhatsAppChallenge(url.searchParams);

  if (!challenge) {
    return NextResponse.json({ error: "Invalid verification request." }, { status: 403 });
  }

  return new NextResponse(challenge, { status: 200 });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const repository = getAppRepository();
  const messages = extractInboundMessages(payload);

  const results = await Promise.all(
    messages.map(async ({ message }) => {
      const outcome = classifyWhatsAppReply(message, "address_clarification");
      return repository.persistWhatsAppInbound({
        referencedProviderMessageId: message.context?.id ?? null,
        providerMessageId: message.id ?? null,
        body:
          message.text?.body ||
          message.button?.text ||
          message.interactive?.button_reply?.title ||
          "",
        outcome,
        payload: message,
      });
    }),
  );

  return NextResponse.json({ ok: true, results });
}
