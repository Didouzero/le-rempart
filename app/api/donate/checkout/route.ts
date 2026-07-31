import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { siteUrlBase } from "@/lib/article-url";
import {
  getStripe,
  isDonationAmount,
  isDonationMethod,
  isStripeConfigured,
  type DonationMethod,
} from "@/lib/stripe";

export const runtime = "nodejs";

function paymentMethodTypes(
  method: DonationMethod,
): Stripe.Checkout.SessionCreateParams.PaymentMethodType[] {
  if (method === "paypal") return ["paypal"];
  // Apple Pay apparaît automatiquement avec "card" si le domaine est vérifié
  return ["card"];
}

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Paiements non configurés (STRIPE_SECRET_KEY)." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const amountRaw =
    typeof body === "object" && body && "amount" in body
      ? Number((body as { amount: unknown }).amount)
      : NaN;
  const methodRaw =
    typeof body === "object" && body && "method" in body
      ? (body as { method: unknown }).method
      : null;

  if (!isDonationAmount(amountRaw)) {
    return NextResponse.json(
      { error: "Montant invalide. Choisis 1, 2, 5, 10 ou 50 €." },
      { status: 400 },
    );
  }
  if (!isDonationMethod(methodRaw)) {
    return NextResponse.json(
      { error: "Moyen de paiement invalide." },
      { status: 400 },
    );
  }

  const base = siteUrlBase().replace(/\/$/, "");
  const stripe = getStripe();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "fr",
      submit_type: "donate",
      payment_method_types: paymentMethodTypes(methodRaw),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: amountRaw * 100,
            product_data: {
              name: "Don — Le Rempart",
              description: "Soutien ponctuel au média Le Rempart",
            },
          },
        },
      ],
      success_url: `${base}/nous-soutenir?success=1`,
      cancel_url: `${base}/nous-soutenir?canceled=1`,
      metadata: {
        type: "donation",
        amount_eur: String(amountRaw),
        method: methodRaw,
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Session Stripe sans URL." },
        { status: 502 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("donate checkout failed", err);
    const message =
      err instanceof Error ? err.message : "Échec création session Stripe";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
