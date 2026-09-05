import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

async function upsertFromSubscription(
  sub: Stripe.Subscription,
  emailHint?: string | null,
) {
  const email =
    emailHint?.trim().toLowerCase() ||
    (typeof sub.metadata?.email === "string"
      ? sub.metadata.email.trim().toLowerCase()
      : "");
  if (!email) return;

  const statusRaw = sub.status;
  const status =
    statusRaw === "active"
      ? "active"
      : statusRaw === "past_due"
        ? "past_due"
        : statusRaw === "canceled"
          ? "canceled"
          : "incomplete";

  const periodEndUnix =
    // stripe types vary by API version
    (sub as Stripe.Subscription & { current_period_end?: number })
      .current_period_end ?? null;

  await prisma.membership.upsert({
    where: { email },
    create: {
      email,
      status,
      stripeCustomerId:
        typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
      stripeSubscriptionId: sub.id,
      currentPeriodEnd: periodEndUnix
        ? new Date(periodEndUnix * 1000)
        : null,
    },
    update: {
      status,
      stripeCustomerId:
        typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
      stripeSubscriptionId: sub.id,
      currentPeriodEnd: periodEndUnix
        ? new Date(periodEndUnix * 1000)
        : null,
    },
  });
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET manquant" },
      { status: 503 },
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "signature manquante" }, { status: 400 });
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, signature, secret);
  } catch (err) {
    console.error("stripe webhook signature", err);
    return NextResponse.json({ error: "signature invalide" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.subscription) {
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
        const sub = await getStripe().subscriptions.retrieve(subId);
        await upsertFromSubscription(
          sub,
          session.customer_email || session.metadata?.email,
        );
      }
    }

    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;
      await upsertFromSubscription(sub, sub.metadata?.email);
    }
  } catch (err) {
    console.error("stripe webhook handler", err);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
