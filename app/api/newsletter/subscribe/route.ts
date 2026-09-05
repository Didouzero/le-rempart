import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

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

  return NextResponse.json({ ok: true });
}
