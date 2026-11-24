import { NextResponse } from "next/server";
import { recordArticleView } from "@/lib/article-views";

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse/i;

/** Une lecture d'article (envoyée par le navigateur, une fois par session et par article). */
export async function POST(req: Request) {
  if (BOT.test(req.headers.get("user-agent") || "")) {
    return new NextResponse(null, { status: 204 });
  }
  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0 || id > 10_000_000) {
    return NextResponse.json({ error: "id invalide" }, { status: 400 });
  }
  try {
    await recordArticleView(id);
  } catch (err) {
    console.error("views", err);
  }
  return new NextResponse(null, { status: 204 });
}
