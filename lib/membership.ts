import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const REMPART_PLUS_COOKIE = "rempart_plus";
export const REMPART_PLUS_PRICE_CENTS = 490;
const TOKEN_TTL_MS = 30 * 60 * 1000;

export function rempartPlusPriceLabel(): string {
  return "4,90 € / mois";
}

function signingSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "rempart-plus-dev-secret"
  );
}

export function plusCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 45,
  };
}

export function applyPlusCookie(res: NextResponse, email: string) {
  res.cookies.set(
    REMPART_PLUS_COOKIE,
    email.trim().toLowerCase(),
    plusCookieOptions(),
  );
}

export async function getPlusEmail(): Promise<string | null> {
  const jar = await cookies();
  const email = jar.get(REMPART_PLUS_COOKIE)?.value?.trim().toLowerCase();
  if (!email || !email.includes("@")) return null;
  return email;
}

export async function isActiveMembership(email: string): Promise<boolean> {
  try {
    const row = await prisma.membership.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { status: true, currentPeriodEnd: true },
    });
    if (!row) return false;
    if (row.status !== "active" && row.status !== "past_due") return false;
    if (row.currentPeriodEnd && row.currentPeriodEnd.getTime() < Date.now()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function hasActiveRempartPlus(): Promise<boolean> {
  const email = await getPlusEmail();
  if (!email) return false;
  return isActiveMembership(email);
}

export function signPlusLoginToken(email: string): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `${email.trim().toLowerCase()}|${exp}`;
  const sig = createHmac("sha256", signingSecret())
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}|${sig}`).toString("base64url");
}

export function verifyPlusLoginToken(token: string): string | null {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const [email, expRaw, sig] = raw.split("|");
    if (!email || !expRaw || !sig) return null;
    const exp = Number(expRaw);
    if (!Number.isFinite(exp) || exp < Date.now()) return null;
    const payload = `${email}|${exp}`;
    const expected = createHmac("sha256", signingSecret())
      .update(payload)
      .digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return email;
  } catch {
    return null;
  }
}
