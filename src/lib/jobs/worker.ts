import type { AppRepository } from "@/lib/data/repository";
import { sendWhatsAppTextMessage } from "@/lib/integrations/whatsapp";

export async function runWorkerBatch(repository: AppRepository, limit = 10) {
  const jobs = await repository.leaseDueJobs(limit);

  const results = await Promise.all(
    jobs.map(async (job) => {
      try {
        if (job.jobType === "send_whatsapp_message") {
          const body = String(job.payload.messageBody ?? "");
          const to = String(job.payload.to ?? "");
          const sendResult = await sendWhatsAppTextMessage({ to, body });

          if (!sendResult.ok) {
            throw new Error(sendResult.error ?? "Unable to send WhatsApp message");
          }

          await repository.completeJob(job.id, sendResult.providerMessageId ?? undefined);
          return { jobId: job.id, status: "completed" as const };
        }

        if (job.jobType === "check_message_timeout") {
          await repository.completeJob(job.id, "Timeout check completed.");
          return { jobId: job.id, status: "completed" as const };
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
