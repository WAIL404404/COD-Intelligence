import type { AppRepository } from "@/lib/data/repository";
import {
  sendWhatsAppTemplateMessage,
  toWhatsAppLanguageCode,
} from "@/lib/integrations/whatsapp";

export async function runWorkerBatch(repository: AppRepository, limit = 10) {
  const jobs = await repository.leaseDueJobs(limit);

  const results = await Promise.all(
    jobs.map(async (job) => {
      try {
        if (job.jobType === "send_whatsapp_message") {
          const to = String(job.payload.to ?? "");
          const templateName = String(job.payload.templateName ?? "");
          const templateLocale = String(job.payload.templateLocale ?? "fr-MA");
          const templateParameters = Array.isArray(job.payload.templateParameters)
            ? job.payload.templateParameters.map((value) => String(value))
            : [];

          if (!to || !templateName) {
            throw new Error("Missing WhatsApp template job payload.");
          }

          const sendResult = await sendWhatsAppTemplateMessage({
            to,
            templateName,
            languageCode: toWhatsAppLanguageCode(templateLocale),
            parameters: templateParameters,
          });

          if (!sendResult.ok) {
            throw new Error(sendResult.error ?? "Unable to send WhatsApp message");
          }

          await repository.recordOutgoingMessageResult({
            threadId: String(job.payload.threadId ?? ""),
            orderId: String(job.payload.orderId ?? ""),
            providerMessageId: sendResult.providerMessageId ?? "",
          });
          await repository.completeJob(job.id, sendResult.providerMessageId ?? undefined);
          return { jobId: job.id, status: "completed" as const };
        }

        if (job.jobType === "check_message_timeout") {
          const orderId = String(job.payload.orderId ?? "");
          const expectedStatus = String(job.payload.expectedStatus ?? "awaiting_confirmation");

          if (!orderId) {
            throw new Error("Missing order id for timeout job.");
          }

          const timeoutResult = await repository.markOrderNoResponse({
            orderId,
            expectedStatus: expectedStatus as never,
          });

          await repository.completeJob(
            job.id,
            timeoutResult.escalated
              ? "No-response escalation completed."
              : "Timeout check skipped because order already moved.",
          );
          return {
            jobId: job.id,
            status: "completed" as const,
            escalated: timeoutResult.escalated,
          };
        }

        await repository.completeJob(job.id, "No-op worker pass.");
        return { jobId: job.id, status: "completed" as const };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown worker error";
        await repository.failJob(job.id, message);
        return { jobId: job.id, status: "failed" as const, error: message };
      }
    }),
  );

  return results;
}
