import { NextResponse } from "next/server";
import { hasActiveRempartPlus, plusCookieOptions } from "@/lib/membership";
import { PLUS_HINT_COOKIE, plusHintCookieOptions } from "@/lib/plus-hint";

export const dynamic = "force-dynamic";

/** Statut Rempart+ du visiteur, lu côté navigateur par PlusProvider. */
export async function GET() {
  const plus = await hasActiveRempartPlus();
  const res = NextResponse.json(
    { plus },
    { headers: { "Cache-Control": "private, no-store" } },
  );
  // Session sans témoin (antérieure à celui-ci) : on le pose. Session expirée : on l'enlève.
  res.cookies.set(
    PLUS_HINT_COOKIE,
    plus ? "1" : "",
    plusHintCookieOptions(plus ? plusCookieOptions().maxAge : 0),
  );
  return res;
}
