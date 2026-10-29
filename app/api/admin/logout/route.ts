import { NextRequest, NextResponse } from "next/server";
import { authCookie } from "@/lib/auth";
import { PLUS_HINT_COOKIE, plusHintCookieOptions } from "@/lib/plus-hint";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/admin/login", request.url), 303);
  response.cookies.set(authCookie.name, "", {
    ...authCookie.options,
    maxAge: 0,
  });
  response.cookies.set(PLUS_HINT_COOKIE, "", plusHintCookieOptions(0));
  return response;
}
