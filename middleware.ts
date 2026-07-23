import { NextRequest, NextResponse } from "next/server";
import { authCookie, verifySessionToken } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  const needsAuth =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (!needsAuth) {
    return NextResponse.next();
  }

  const token = request.cookies.get(authCookie.name)?.value;
  let valid = false;
  try {
    valid = await verifySessionToken(token);
  } catch {
    valid = false;
  }

  if (!valid) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
