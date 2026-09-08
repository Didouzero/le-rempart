import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import {
  buildTenPointBrief,
  renderBriefHtml,
  renderBriefText,
  renderBriefVariants,
} from "@/lib/newsletter-brief";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const items = await buildTenPointBrief();
  if (items.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no_items" });
  }

  const dateLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(new Date());

  const { free, plus } = await renderBriefVariants(items);

  const htmlFree = renderBriefHtml({
    dateLabel,
    items: free,
    premium: false,
  });
  const htmlPlus = renderBriefHtml({
    dateLabel,
    items: plus,
    premium: true,
  });
  const textFree = renderBriefText(free);
  const textPlus = renderBriefText(plus);

  const plusMembers = await prisma.membership.findMany({
    where: {
      status: { in: ["active", "past_due"] },
      OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }],
    },
    select: { email: true },
    take: 2000,
  });
  const plusSet = new Set(plusMembers.map((m) => m.email.toLowerCase()));

  const subscribers = await prisma.newsletterSubscriber.findMany({
    where: { unsubscribedAt: null },
    select: { email: true },
    take: 2000,
  });

  const plusOnly = plusMembers.filter(
    (m) =>
      !subscribers.some((s) => s.email.toLowerCase() === m.email.toLowerCase()),
  );

  let sent = 0;
  let failed = 0;
  let sentPlus = 0;

  for (const sub of subscribers) {
    const isPlus = plusSet.has(sub.email.toLowerCase());
    const result = await sendEmail({
      to: sub.email,
      subject: isPlus
        ? `Le Rempart+ — L'actu en 10 points (${dateLabel})`
        : `Le Rempart — L'actu en 10 points (${dateLabel})`,
      html: isPlus ? htmlPlus : htmlFree,
      text: isPlus ? textPlus : textFree,
    });
    if (result.ok) {
      sent += 1;
      if (isPlus) sentPlus += 1;
    } else failed += 1;
  }

  for (const m of plusOnly) {
    const result = await sendEmail({
      to: m.email,
      subject: `Le Rempart+ — L'actu en 10 points (${dateLabel})`,
      html: htmlPlus,
      text: textPlus,
    });
    if (result.ok) {
      sent += 1;
      sentPlus += 1;
    } else failed += 1;
  }

  return NextResponse.json({
    ok: true,
    points: items.length,
    sitePoints: items.filter((i) => i.kind === "site").length,
    veillePoints: items.filter((i) => i.kind === "veille").length,
    subscribers: subscribers.length,
    plusMembers: plusMembers.length,
    sent,
    sentPlus,
    failed,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
