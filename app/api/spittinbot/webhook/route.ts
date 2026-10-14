import { after, NextRequest, NextResponse } from "next/server";
import { handleUpdate, type TgUpdate } from "@/lib/spittinbot/bot";

export const runtime = "nodejs";
// téléchargement + envoi + suivi de la publication (Pro : jusqu'à 800 s)
export const maxDuration = 800;

export async function POST(req: NextRequest) {
  const secret = process.env.SPITTIN_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const update = (await req.json()) as TgUpdate;
  after(() =>
    handleUpdate(update).catch((e) => console.error("spittinbot update error", e)),
  );
  return NextResponse.json({ ok: true });
}
