import { NextResponse } from "next/server";

import { getAppRepository } from "@/lib/data/repository";
import { env } from "@/lib/env";
import { runWorkerBatch } from "@/lib/jobs/worker";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const workerSecret = request.headers.get("x-worker-secret");
  const authHeader = request.headers.get("authorization");
  const bearerCronSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (env.workerSharedSecret && workerSecret === env.workerSharedSecret) {
    return true;
  }

  if (env.cronSecret && bearerCronSecret === env.cronSecret) {
    return true;
  }

  return false;
}

async function handleWorkerRun(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized worker request." }, { status: 401 });
  }

  const repository = getAppRepository();
  const results = await runWorkerBatch(repository);

  return NextResponse.json({ ok: true, results });
}

export async function GET(request: Request) {
  return handleWorkerRun(request);
}

export async function POST(request: Request) {
  return handleWorkerRun(request);
}
