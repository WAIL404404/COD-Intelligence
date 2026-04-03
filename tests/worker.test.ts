import { describe, expect, it, vi } from "vitest";

import { runWorkerBatch } from "@/lib/jobs/worker";

describe("runWorkerBatch", () => {
  it("escalates timeout jobs to manual review via repository", async () => {
    const repository = {
      leaseDueJobs: vi.fn().mockResolvedValue([
        {
          id: "job-timeout-1",
          jobType: "check_message_timeout",
          payload: {
            orderId: "order-1",
            expectedStatus: "awaiting_confirmation",
          },
        },
      ]),
      markOrderNoResponse: vi.fn().mockResolvedValue({ escalated: true }),
      completeJob: vi.fn().mockResolvedValue(undefined),
      failJob: vi.fn().mockResolvedValue(undefined),
    } as unknown as Parameters<typeof runWorkerBatch>[0];

    const results = await runWorkerBatch(repository, 1);

    expect(repository.markOrderNoResponse).toHaveBeenCalledWith({
      orderId: "order-1",
      expectedStatus: "awaiting_confirmation",
    });
    expect(results[0]).toMatchObject({
      jobId: "job-timeout-1",
      status: "completed",
      escalated: true,
    });
  });
});
