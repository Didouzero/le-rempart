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

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripePublishableKey(): string | null {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  return key || null;
}

export const DONATION_AMOUNTS = [1, 2, 5, 10, 20, 50] as const;
export type DonationAmount = (typeof DONATION_AMOUNTS)[number];

export const DONATION_METHODS = ["apple_pay", "card", "paypal"] as const;
export type DonationMethod = (typeof DONATION_METHODS)[number];

export function isDonationAmount(value: unknown): value is DonationAmount {
  return (
    typeof value === "number" &&
    (DONATION_AMOUNTS as readonly number[]).includes(value)
  );
}

export function isDonationMethod(value: unknown): value is DonationMethod {
  return (
    typeof value === "string" &&
    (DONATION_METHODS as readonly string[]).includes(value)
  );
}
