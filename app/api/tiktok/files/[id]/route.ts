import { NextRequest, NextResponse } from "next/server";
import { tiktokModels } from "@/lib/tiktok/db";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const token = request.nextUrl.searchParams.get("t") || "";
  const kind = request.nextUrl.searchParams.get("kind") || "asset";
  if (!id || !token) {
    return NextResponse.json({ error: "missing" }, { status: 400 });
  }

  if (kind === "render") {
    const job = await tiktokModels().job.findUnique({
      where: { id },
      select: { fileToken: true, renderUrl: true },
    });
    if (!job || job.fileToken !== token || !job.renderUrl) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const upstream = await fetch(job.renderUrl, {
      signal: AbortSignal.timeout(60_000),
    });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "upstream" }, { status: 502 });
    }
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") || "video/mp4",
        "Cache-Control": "private, max-age=300",
      },
    });
  }

  const asset = await tiktokModels().asset.findUnique({
    where: { id },
    select: {
      data: true,
      mime: true,
      job: { select: { fileToken: true } },
    },
  });
  if (!asset || !asset.job || asset.job.fileToken !== token) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return new NextResponse(Buffer.from(asset.data), {
    status: 200,
    headers: {
      "Content-Type": asset.mime || "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
