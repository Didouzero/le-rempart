import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlusEmail, verifyPlusCancelToken } from "@/lib/membership";
import { cancelEndLabel, cancelPlusSubscription } from "@/lib/plus-cancel";

export const runtime = "nodejs";

const bodySchema = z.object({
  token: z.string().max(1000).optional(),
});

/** Résiliation : par le lien reçu par e-mail, ou par la session de l'abonné. */
export async function POST(req: Request) {
  const json: unknown = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const email = parsed.data.token
    ? verifyPlusCancelToken(parsed.data.token)
    : await getPlusEmail();
  if (!email) {
    return NextResponse.json(
      { error: "Lien expiré. Demandez-en un nouveau." },
      { status: 401 },
    );
  }

  try {
    const result = await cancelPlusSubscription(email);
    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            "Aucun abonnement à résilier sur cette adresse. Écrivez-nous à contact@le-rempart.org.",
        },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, message: cancelEndLabel(result.endsAt) });
  } catch (err) {
    console.error("plus cancel", err);
    return NextResponse.json(
      {
        error:
          "Résiliation temporairement indisponible. Réessayez ou écrivez-nous à contact@le-rempart.org.",
      },
      { status: 503 },
    );
  }
}
