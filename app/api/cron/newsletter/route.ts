import { NextRequest, NextResponse } from "next/server";
import { newsletterShell, sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { moonshotChat } from "@/lib/moonshot";
import { getKimiTextModel } from "@/lib/kimi-legacy";
import { absoluteUrl } from "@/lib/seo";
import { articlePublicPath } from "@/lib/article-url";
import { categoryLabel } from "@/lib/categories";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

type BriefItem = { title: string; blurb: string; href: string; section: string };

async function buildBriefItems(): Promise<BriefItem[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const articles = await prisma.article.findMany({
    where: {
      status: "published",
      publishedAt: { gte: since },
    },
    orderBy: [{ publishedAt: "desc" }],
    take: 14,
    select: {
      publicId: true,
      title: true,
      excerpt: true,
      category: true,
    },
  });

  if (articles.length === 0) return [];

  const picked = articles.slice(0, 10);
  if (!process.env.MOONSHOT_API_KEY) {
    return picked.map((a) => ({
      title: a.title,
      blurb: a.excerpt.slice(0, 220),
      href: absoluteUrl(articlePublicPath(a.publicId)),
      section: categoryLabel(a.category),
    }));
  }

  try {
    const raw = await moonshotChat({
      model: getKimiTextModel(),
      maxTokens: 1600,
      timeoutMs: 55_000,
      reasoningEffort: "low",
      messages: [
        {
          role: "system",
          content: `Tu prépares le BRIEF MATIN gratuit Le Rempart (droite dure, FACTUEL).
Pour chaque article fourni, écris 1–2 phrases denses (faits, noms, chiffres). Pas d'édito.
Réponds UNIQUEMENT JSON : {"items":[{"publicId":123,"blurb":"..."}]}`,
        },
        {
          role: "user",
          content: picked
            .map(
              (a) =>
                `#${a.publicId} [${a.category}] ${a.title}\n${a.excerpt.slice(0, 400)}`,
            )
            .join("\n\n"),
        },
      ],
    });
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      items?: Array<{ publicId?: number; blurb?: string }>;
    };
    const byId = new Map(
      (parsed.items || []).map((i) => [Number(i.publicId), String(i.blurb || "")]),
    );
    return picked.map((a) => ({
      title: a.title,
      blurb: (byId.get(a.publicId) || a.excerpt).slice(0, 320),
      href: absoluteUrl(articlePublicPath(a.publicId)),
      section: categoryLabel(a.category),
    }));
  } catch (err) {
    console.error("newsletter brief kimi", err);
    return picked.map((a) => ({
      title: a.title,
      blurb: a.excerpt.slice(0, 220),
      href: absoluteUrl(articlePublicPath(a.publicId)),
      section: categoryLabel(a.category),
    }));
  }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const items = await buildBriefItems();
  if (items.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no_articles" });
  }

  const dateLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(new Date());

  const bodyHtml = items
    .map(
      (it, i) => `
      <div style="margin:0 0 18px;">
        <p style="margin:0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#5c574f;">${i + 1}. ${it.section}</p>
        <p style="margin:4px 0 0;font-size:16px;font-weight:700;"><a href="${it.href}" style="color:#0a0a0a;text-decoration:none;">${it.title}</a></p>
        <p style="margin:6px 0 0;font-size:14px;line-height:1.45;color:#2a2a2a;">${it.blurb}</p>
      </div>`,
    )
    .join("");

  const html = newsletterShell({
    title: `Brief du matin — ${dateLabel}`,
    bodyHtml,
  });

  const subscribers = await prisma.newsletterSubscriber.findMany({
    where: { unsubscribedAt: null },
    select: { email: true },
    take: 2000,
  });

  let sent = 0;
  let failed = 0;
  for (const sub of subscribers) {
    const result = await sendEmail({
      to: sub.email,
      subject: `Le Rempart — Brief du matin (${items.length} infos)`,
      html,
      text: items.map((it, i) => `${i + 1}. ${it.title}\n${it.blurb}\n${it.href}`).join("\n\n"),
    });
    if (result.ok) sent += 1;
    else failed += 1;
  }

  return NextResponse.json({
    ok: true,
    articles: items.length,
    subscribers: subscribers.length,
    sent,
    failed,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
