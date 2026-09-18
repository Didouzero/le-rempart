import { NextRequest, NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";
import {
  consumeTiktokOAuthState,
  createTiktokOAuthState,
  exchangeTiktokCode,
  tiktokAuthorizeUrl,
} from "@/lib/tiktok/oauth";
import { isTiktokAppConfigured, clearTiktokTokens } from "@/lib/tiktok/publish";

export const runtime = "nodejs";

function adminTiktokUrl(query = ""): URL {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://www.le-rempart.org";
  return new URL(`/admin/tiktok${query}`, base.replace(/\/$/, ""));
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const start = request.nextUrl.searchParams.get("start");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      adminTiktokUrl(`?error=${encodeURIComponent(error)}`),
    );
  }

  if (code) {
    const ok = state ? await consumeTiktokOAuthState(state) : false;
    if (!ok) {
      return NextResponse.redirect(adminTiktokUrl("?error=state"));
    }
    try {
      await exchangeTiktokCode(code);
      return NextResponse.redirect(adminTiktokUrl("?ok=1"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "oauth";
      return NextResponse.redirect(
        adminTiktokUrl(`?error=${encodeURIComponent(msg.slice(0, 120))}`),
      );
    }
  }

  if (start === "1") {
    if (!(await isAdminLoggedIn())) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    if (!isTiktokAppConfigured()) {
      return NextResponse.redirect(adminTiktokUrl("?error=config"));
    }
    const oauthState = await createTiktokOAuthState();
    return NextResponse.redirect(tiktokAuthorizeUrl(oauthState));
  }

  return NextResponse.redirect(adminTiktokUrl("?error=ouvre_le_bouton_connecter"));
}

export async function POST(request: NextRequest) {
  if (!(await isAdminLoggedIn())) {
    return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  }
  await clearTiktokTokens();
  return NextResponse.redirect(new URL("/admin/tiktok", request.url), 303);
}
