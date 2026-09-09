import { NextRequest, NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";
import {
  authorizeInvestigationJobRequest,
  investigationJobNeedsResume,
  kickInvestigationJob,
  loadInvestigationJob,
  processInvestigationSlice,
  publicInvestigationJobStatus,
  runInvestigationWatchdog,
  scheduleInvestigationContinuation,
} from "@/lib/investigation-job";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("id")?.trim() || "";
  const token = request.nextUrl.searchParams.get("token")?.trim() || "";
  if (!jobId) {
    return NextResponse.json({ error: "id manquant" }, { status: 400 });
  }
  const job = await loadInvestigationJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  const admin = await isAdminLoggedIn();
  if (!admin && token !== job.token) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  if (investigationJobNeedsResume(job)) {
    scheduleInvestigationContinuation(kickInvestigationJob(jobId, "slice"));
  }

  return NextResponse.json(publicInvestigationJobStatus(job));
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    jobId?: string;
    token?: string;
    mode?: "slice" | "watchdog";
  };
  const jobId = body.jobId?.trim() || "";
  if (!jobId) {
    return NextResponse.json({ error: "jobId manquant" }, { status: 400 });
  }
  const job = await loadInvestigationJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  if (!authorizeInvestigationJobRequest(request, job, body.token)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  if (body.mode === "watchdog") {
    scheduleInvestigationContinuation(runInvestigationWatchdog(jobId));
    return NextResponse.json({ accepted: true, mode: "watchdog" }, { status: 202 });
  }

  scheduleInvestigationContinuation(
    (async () => {
      const result = await processInvestigationSlice(jobId);
      if (result.continue && !result.busy) {
        await kickInvestigationJob(jobId, "slice");
      }
    })(),
  );

  return NextResponse.json({ accepted: true, mode: "slice" }, { status: 202 });
}
