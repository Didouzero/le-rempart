import { NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/email";
import { isActiveMembership, signPlusCancelToken } from "@/lib/membership";
import { absoluteUrl } from "@/lib/seo";

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
    return NextResponse.json({ error: "E-mail invalide" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const active = await isActiveMembership(email);

  // Même réponse pour ne pas révéler qui est abonné.
  if (active) {
    const token = signPlusCancelToken(email);
    const url = `${absoluteUrl("/resilier")}?token=${encodeURIComponent(token)}`;
    const sent = await sendEmail({
      to: email,
      subject: "Résilier votre abonnement Rempart+",
      text: `Pour résilier votre abonnement Rempart+, ouvrez ce lien puis confirmez (valable 24 h) :\n${url}\n`,
      html: `<p>Pour résilier votre abonnement Rempart+, ouvrez ce lien puis confirmez.</p><p><a href="${url}">Résilier mon abonnement</a></p><p>Lien valable 24 heures.</p>`,
    });
    if (!sent.ok) {
      return NextResponse.json(
        {
          error:
            "Impossible d’envoyer l’e-mail pour le moment. Réessayez ou contactez-nous.",
        },
        { status: 503 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
