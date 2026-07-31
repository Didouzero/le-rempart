import { NextResponse } from "next/server";
import {
  getStripe,
  isDonationAmount,
  isStripeConfigured,
} from "@/lib/stripe";

export const runtime = "nodejs";

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

  if (!isDonationAmount(amountRaw)) {
    return NextResponse.json(
      { error: "Montant invalide. Choisis 1, 2, 5, 10, 20 ou 50 €." },
      { status: 400 },
    );
  }

  try {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountRaw * 100,
      currency: "eur",
      payment_method_types: ["card"],
      description: "Don — Le Rempart",
      metadata: {
        type: "donation",
        amount_eur: String(amountRaw),
        method: "apple_pay",
      },
    });

    if (!paymentIntent.client_secret) {
      return NextResponse.json(
        { error: "PaymentIntent sans client_secret." },
        { status: 502 },
      );
    }

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error("donate payment-intent failed", err);
    const message =
      err instanceof Error ? err.message : "Échec création PaymentIntent";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
