import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/seo";
import { getStripe, subscriptionPeriodEnd } from "@/lib/stripe";

type CancelResult =
  | { ok: true; endsAt: Date | null }
  | { ok: false; reason: "not_found" };

function formatEndDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(date);
}

export function cancelEndLabel(endsAt: Date | null): string {
  return endsAt
    ? `Votre accès reste ouvert jusqu'au ${formatEndDate(endsAt)}, sans nouveau prélèvement.`
    : "Votre abonnement est terminé et aucun nouveau prélèvement ne sera effectué.";
}

/**
 * Résilie l'abonnement Stripe : fin de la période déjà payée, ou arrêt immédiat
 * si un paiement a échoué, pour que Stripe cesse de le relancer.
 * Rejouable : un second appel ne prélève ni ne prévient rien de plus.
 */
export async function cancelPlusSubscription(
  email: string,
): Promise<CancelResult> {
  const normalized = email.trim().toLowerCase();
  const row = await prisma.membership.findUnique({
    where: { email: normalized },
    select: { stripeSubscriptionId: true },
  });
  if (!row?.stripeSubscriptionId) return { ok: false, reason: "not_found" };

  const stripe = getStripe();
  const id = row.stripeSubscriptionId;
  const current = await stripe.subscriptions.retrieve(id);

  if (current.status === "canceled") {
    await prisma.membership.update({
      where: { email: normalized },
      data: { status: "canceled" },
    });
    return { ok: true, endsAt: null };
  }

  if (current.cancel_at_period_end) {
    return { ok: true, endsAt: subscriptionPeriodEnd(current) };
  }

  let endsAt: Date | null;
  if (current.status === "active") {
    const updated = await stripe.subscriptions.update(id, {
      cancel_at_period_end: true,
    });
    endsAt = subscriptionPeriodEnd(updated);
    await prisma.membership.update({
      where: { email: normalized },
      data: { currentPeriodEnd: endsAt },
    });
  } else {
    await stripe.subscriptions.cancel(id);
    endsAt = null;
    await prisma.membership.update({
      where: { email: normalized },
      data: { status: "canceled" },
    });
  }

  const label = cancelEndLabel(endsAt);
  const resubscribe = absoluteUrl("/s-abonner");
  await sendEmail({
    to: normalized,
    subject: "Résiliation de votre abonnement Rempart+",
    text: `Nous confirmons la résiliation de votre abonnement Rempart+.\n${label}\nPour revenir : ${resubscribe}\n`,
    html: `<p>Nous confirmons la résiliation de votre abonnement Rempart+.</p><p>${label}</p><p><a href="${resubscribe}">Revenir sur Rempart+</a></p>`,
  }).catch(() => ({ ok: false }));

  return { ok: true, endsAt };
}
