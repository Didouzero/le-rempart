import { NextRequest, NextResponse } from "next/server";
import { isChannelRequest } from "@/lib/channel-auth";
import type { ClaudeBriefPoint } from "@/lib/newsletter-brief";
import {
  checkClaudeNewsletter,
  renderNewsletter,
  sendNewsletterJob,
} from "@/lib/newsletter-job";
import { getAdminTelegramChatId, telegramSendMessage } from "@/lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Brief rédigé par Claude sur le VPS (scripts/submit-newsletter.ts) : contrôle, puis envoi.
 * `preview: true` renvoie seulement la mise en page, sans rien envoyer ni changer.
 */
export async function POST(req: NextRequest) {
  if (!isChannelRequest(req.headers)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  let body: { date?: string; points?: ClaudeBriefPoint[]; preview?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON illisible" }, { status: 400 });
  }
  const date = String(body.date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Date attendue au format AAAA-MM-JJ" }, { status: 400 });
  }
  const points = Array.isArray(body.points) ? body.points : [];

  try {
    const { job, brief } = await checkClaudeNewsletter(date, points);
    if (body.preview) {
      const { htmlFree, htmlPlus } = renderNewsletter(job, brief);
      return NextResponse.json({ ok: true, preview: true, htmlFree, htmlPlus });
    }
    const result = await sendNewsletterJob(date, "claude", points);
    if (!result.skipped && result.sent + result.failed > 0) {
      const chat = getAdminTelegramChatId();
      if (chat) {
        await telegramSendMessage(
          chat,
          `📰 Newsletter envoyée par Claude : ${result.sent} lecteurs, dont ${result.sentPlus} Rempart+${result.failed ? `, ${result.failed} échecs` : ""}.`,
        ).catch((err) => console.error("newsletter: Telegram", err));
      }
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
