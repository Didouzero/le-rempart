import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { telegramNotifier } from "@/lib/publish-pipeline";
import { telegramSendMessage } from "@/lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function parisWeekday(): number {
  const wd = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "Europe/Paris",
  }).format(new Date());
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[wd] ?? -1;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const day = parisWeekday();
  if (day !== 3 && day !== 6) {
    return NextResponse.json({ ok: true, skipped: true, reason: "not_wed_sat" });
  }

  const since = new Date(Date.now() - 20 * 60 * 60 * 1000);
  const already = await prisma.specialDossier.findFirst({
    where: { publishedAt: { gte: since } },
    select: { id: true, slug: true },
  });
  if (already) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "already_published",
      slug: already.slug,
    });
  }

  const chatRaw = process.env.TELEGRAM_NOTIFY_CHAT_ID?.trim();
  const chatId = chatRaw && Number.isFinite(Number(chatRaw)) ? Number(chatRaw) : null;
  const notify = chatId
    ? telegramNotifier(chatId)
    : async (t: string) => console.log("[cron-enquete]", t);

  await notify(
    "Rappel enquête (mercredi/samedi) : aucune enquête auto n’a été publiée aujourd’hui.\nEnvoie /enquete + le sujet, puis tes liens, puis /enquete_ok.",
  );

  if (chatId) {
    await telegramSendMessage(
      chatId,
      "Exemple :\n/enquete Sébastien Delogu fins de mois\npuis colle 4–8 liens (HATVP, articles, Assemblée)\npuis /enquete_ok",
    );
  }

  return NextResponse.json({ ok: true, reminded: true });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
