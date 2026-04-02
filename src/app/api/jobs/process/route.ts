import { NextResponse } from "next/server";

import { getAppRepository } from "@/lib/data/repository";
import { env } from "@/lib/env";
import { runWorkerBatch } from "@/lib/jobs/worker";

export async function POST(request: Request) {
  const secret = request.headers.get("x-worker-secret");

  if (env.workerSharedSecret && secret !== env.workerSharedSecret) {
    return NextResponse.json({ error: "Unauthorized worker request." }, { status: 401 });
  }

  const repository = getAppRepository();
  const results = await runWorkerBatch(repository);

  return NextResponse.json({ ok: true, results });
}
