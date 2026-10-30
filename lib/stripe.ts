import Stripe from "stripe";

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY manquant");
  }
  if (!stripe) {
    stripe = new Stripe(key);
  }
  return stripe;
}

/** Fin de période : portée par l'abonnement ou, sur les API récentes, par ses lignes. */
export function subscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  const unix =
    sub.items?.data[0]?.current_period_end ??
    (sub as Stripe.Subscription & { current_period_end?: number })
      .current_period_end ??
    null;
  return unix ? new Date(unix * 1000) : null;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripePublishableKey(): string | null {
  const key =
    process.env.STRIPE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  return key || null;
}
