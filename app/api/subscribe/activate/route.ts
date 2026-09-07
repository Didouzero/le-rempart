import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { applyPlusCookie } from "@/lib/membership";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { absoluteUrl } from "@/lib/seo";

export const runtime = "nodejs";

/** Après Checkout : pose le cookie Rempart+ à partir de la session Stripe. */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id")?.trim();
  if (!sessionId) {
    return NextResponse.redirect(new URL("/s-abonner", req.url));
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const email = (
      session.customer_email ||
      session.metadata?.email ||
      ""
    )
      .trim()
      .toLowerCase();
    if (!email) {
      return NextResponse.redirect(new URL("/s-abonner?success=1", req.url));
    }

    const paid =
      session.payment_status === "paid" ||
      session.status === "complete";
    if (paid) {
      const subId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      await prisma.membership.upsert({
        where: { email },
        create: {
          email,
          status: "active",
          stripeSubscriptionId: subId || undefined,
        },
        update: {
          status: "active",
          stripeSubscriptionId: subId || undefined,
        },
      });
    }

    const enquetes = absoluteUrl("/rubriques/enquetes");
    const login = absoluteUrl("/connexion");
    await sendEmail({
      to: email,
      subject: "Bienvenue dans Rempart+",
      text: `Votre accès Rempart+ est ouvert.\nEnquêtes : ${enquetes}\nPour vous reconnecter plus tard : ${login}\n`,
      html: `<p>Bienvenue. Votre accès Rempart+ est ouvert.</p><p><a href="${enquetes}">Ouvrir les enquêtes</a></p><p>Plus tard, sur un autre appareil : <a href="${login}">${login}</a></p>`,
    }).catch(() => ({ ok: false }));

    const res = NextResponse.redirect(
      new URL("/rubriques/enquetes?welcome=1", req.url),
    );
    applyPlusCookie(res, email);
    return res;
  } catch (err) {
    console.error("subscribe activate", err);
    return NextResponse.redirect(new URL("/s-abonner?success=1", req.url));
  }
}
