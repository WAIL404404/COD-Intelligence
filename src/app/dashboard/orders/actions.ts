"use server";

import { redirect } from "next/navigation";

import { getAppRepository } from "@/lib/data/repository";
import { getAppSession } from "@/lib/session";

export async function overrideDecisionAction(formData: FormData) {
  const session = await getAppSession();
  const repository = getAppRepository(session);
  const orderId = String(formData.get("orderId"));
  const newDecision = String(formData.get("newDecision"));
  const newStatus = String(formData.get("newStatus"));
  const overrideReason = String(formData.get("overrideReason"));
  const classificationFeedback = String(formData.get("classificationFeedback") ?? "");

  if (session.mode === "demo") {
    redirect(`/dashboard/orders/${orderId}?notice=demo-only`);
  }

  await repository.updateDecision({
    orderId,
    merchantId: session.merchantId,
    actorName: session.userName,
    actorId: session.userId,
    newDecision: newDecision as never,
    newStatus: newStatus as never,
    overrideReason,
    classificationFeedback,
  });

  redirect(`/dashboard/orders/${orderId}?notice=decision-updated`);
}

export async function recordOutcomeAction(formData: FormData) {
  const session = await getAppSession();
  const repository = getAppRepository(session);
  const orderId = String(formData.get("orderId"));
  const finalOutcome = String(formData.get("finalOutcome"));
  const note = String(formData.get("note") ?? "");

  if (session.mode === "demo") {
    redirect(`/dashboard/orders/${orderId}?notice=demo-only`);
  }

  await repository.recordOutcome({
    orderId,
    merchantId: session.merchantId,
    actorName: session.userName,
    actorId: session.userId,
    finalOutcome: finalOutcome as never,
    note,
  });

  redirect(`/dashboard/orders/${orderId}?notice=outcome-recorded`);
}
