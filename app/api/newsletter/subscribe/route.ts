import { NextResponse } from "next/server";
import { z } from "zod";
import { newsletterShell, sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/seo";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email().max(200),
  source: z.string().max(80).optional(),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Adresse e-mail invalide." },
      { status: 400 },
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const source = parsed.data.source?.trim() || "article";

  try {
    await prisma.newsletterSubscriber.upsert({
      where: { email },
      create: {
        email,
        source,
        confirmedAt: new Date(),
      },
      update: {
        unsubscribedAt: null,
        source,
        confirmedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("newsletter subscribe", err);
    return NextResponse.json(
      { error: "Inscription temporairement indisponible." },
      { status: 503 },
    );
  }

  // Accusé de réception (non bloquant si Resend n'est pas encore configuré).
  await sendEmail({
    to: email,
    subject: "Bienvenue — newsletter Le Rempart",
    html: newsletterShell({
      title: "Inscription confirmée",
      bodyHtml: `<p style="font-size:15px;line-height:1.5;">Chaque matin à 7&nbsp;heures, vous recevrez les 10 infos essentielles de droite des dernières 24&nbsp;heures.</p>
        <p style="font-size:15px;line-height:1.5;"><a href="${absoluteUrl("/")}" style="color:#0a0a0a;">Lire Le Rempart</a></p>`,
    }),
    text: `Inscription confirmée. Chaque matin à 7 heures : les 10 infos essentielles. ${absoluteUrl("/")}`,
  }).catch(() => ({ ok: false }));

  return NextResponse.json({ ok: true });
}
