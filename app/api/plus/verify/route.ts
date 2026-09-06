import { NextRequest, NextResponse } from "next/server";
import {
  applyPlusCookie,
  isActiveMembership,
  verifyPlusLoginToken,
} from "@/lib/membership";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim() || "";
  const email = verifyPlusLoginToken(token);
  if (!email) {
    return NextResponse.redirect(
      new URL("/connexion?expired=1", req.url),
    );
  }

  if (!(await isActiveMembership(email))) {
    return NextResponse.redirect(new URL("/s-abonner", req.url));
  }

  const res = NextResponse.redirect(new URL("/dossiers", req.url));
  applyPlusCookie(res, email);
  return res;
}
