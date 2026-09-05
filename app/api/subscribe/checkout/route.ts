import { NextResponse } from "next/server";
import { z } from "zod";
import { absoluteUrl } from "@/lib/seo";
import { getStripe } from "@/lib/stripe";
import { REMPART_PLUS_PRICE_CENTS } from "@/lib/membership";

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
  const priceId = process.env.STRIPE_REMPART_PLUS_PRICE_ID?.trim();

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      success_url: `${absoluteUrl("/api/subscribe/activate")}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${absoluteUrl("/s-abonner")}?canceled=1`,
      allow_promotion_codes: true,
      line_items: priceId
        ? [{ price: priceId, quantity: 1 }]
        : [
            {
              quantity: 1,
              price_data: {
                currency: "eur",
                unit_amount: REMPART_PLUS_PRICE_CENTS,
                recurring: { interval: "month" },
                product_data: {
                  name: "Rempart+",
                  description:
                    "Brief approfondi, dossiers exclusifs, site sans publicité",
                },
              },
            },
          ],
      metadata: {
        product: "rempart_plus",
        email,
      },
      subscription_data: {
        metadata: { product: "rempart_plus", email },
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Session Stripe sans URL" },
        { status: 500 },
      );
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("subscribe checkout", err);
    return NextResponse.json(
      { error: "Échec création session Stripe" },
      { status: 500 },
    );
  }
}
