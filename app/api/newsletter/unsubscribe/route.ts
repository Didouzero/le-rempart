import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email().max(200),
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

  try {
    await prisma.newsletterSubscriber.updateMany({
      where: { email },
      data: { unsubscribedAt: new Date() },
    });
  } catch (err) {
    console.error("newsletter unsubscribe", err);
    return NextResponse.json(
      { error: "Désabonnement temporairement indisponible." },
      { status: 503 },
    );
  }

  // Même réponse si l'e-mail n'existait pas (pas de fuite d'info).
  return NextResponse.json({ ok: true });
}
