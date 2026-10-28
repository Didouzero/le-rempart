import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Diagnostic temporaire (admin) : quel compte Stripe la clé du site ouvre,
 * et ce qui manque pour activer les paiements réels.
 */
export async function GET() {
  try {
    const account = await getStripe().accounts.retrieve();
    return NextResponse.json({
      id: account.id,
      email: account.email,
      businessName: account.business_profile?.name ?? null,
      country: account.country,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      currentlyDue: account.requirements?.currently_due ?? [],
      pastDue: account.requirements?.past_due ?? [],
      disabledReason: account.requirements?.disabled_reason ?? null,
    });
  } catch (err) {
    console.error("stripe account diagnostic", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur Stripe" },
      { status: 500 },
    );
  }
}
