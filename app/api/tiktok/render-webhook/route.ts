import { NextRequest, NextResponse } from "next/server";
import { completeTiktokRender } from "@/lib/tiktok/job";
import { parseCreatomateMetadata } from "@/lib/tiktok/render";
import { tiktokModels } from "@/lib/tiktok/db";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const expected =
    process.env.CREATOMATE_WEBHOOK_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim();
  if (!expected) return true;
  const secret = request.nextUrl.searchParams.get("secret");
  return secret === expected;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    const raw = await request.json();
    if (Array.isArray(raw)) {
      payload = (raw[0] || {}) as Record<string, unknown>;
    } else if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      const nested = obj.renders;
      payload = Array.isArray(nested)
        ? ((nested[0] || {}) as Record<string, unknown>)
        : obj;
    } else {
      payload = {};
    }
  } catch {
    return NextResponse.json({ ok: true });
  }

  const status = String(payload.status || "").toLowerCase();
  const creatomateId = typeof payload.id === "string" ? payload.id : undefined;
  const renderUrl =
    typeof payload.url === "string"
      ? payload.url
      : typeof payload.output_url === "string"
        ? payload.output_url
        : "";
  const jobId = parseCreatomateMetadata(payload.metadata) || undefined;
  const error =
    status === "failed" || status === "error"
      ? String(
          payload.error_message ||
            payload.error ||
            payload.message ||
            "rendu Creatomate échoué",
        )
      : undefined;

  let durationMs: number | undefined;
  if (typeof payload.duration === "number") {
    durationMs =
      payload.duration > 1000
        ? Math.round(payload.duration)
        : Math.round(payload.duration * 1000);
  }

  if (status && status !== "succeeded" && status !== "success" && !error) {
    return NextResponse.json({ ok: true, ignored: status });
  }

  if (!jobId && creatomateId) {
    const job = await tiktokModels().job.findFirst({
      where: { creatomateId },
      select: { id: true },
    });
    await completeTiktokRender({
      jobId: job?.id,
      creatomateId,
      renderUrl,
      durationMs,
      error,
    });
    return NextResponse.json({ ok: true });
  }

  await completeTiktokRender({
    jobId,
    creatomateId,
    renderUrl,
    durationMs,
    error,
  });
  return NextResponse.json({ ok: true });
}
