import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { REMPART_PLUS_COOKIE } from "@/lib/membership";

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
      return NextResponse.redirect(
        new URL("/s-abonner?success=1", req.url),
      );
    }

    const res = NextResponse.redirect(
      new URL("/s-abonner?success=1", req.url),
    );
    res.cookies.set(REMPART_PLUS_COOKIE, email, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 45,
    });
    return res;
  } catch (err) {
    console.error("subscribe activate", err);
    return NextResponse.redirect(new URL("/s-abonner?success=1", req.url));
  }
}
