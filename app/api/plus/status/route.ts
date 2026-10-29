import { NextResponse } from "next/server";
import { hasActiveRempartPlus } from "@/lib/membership";
import { PLUS_HINT_COOKIE, plusHintCookieOptions } from "@/lib/plus-hint";

export const dynamic = "force-dynamic";

/** Statut Rempart+ du visiteur, lu côté navigateur par PlusProvider. */
export async function GET() {
  const plus = await hasActiveRempartPlus();
  const res = NextResponse.json(
    { plus },
    { headers: { "Cache-Control": "private, no-store" } },
  );
  // Session expirée : le témoin ne sert plus, on évite l'appel aux prochaines visites.
  if (!plus) res.cookies.set(PLUS_HINT_COOKIE, "", plusHintCookieOptions(0));
  return res;
}
