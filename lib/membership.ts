import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const REMPART_PLUS_COOKIE = "rempart_plus";
export const REMPART_PLUS_PRICE_CENTS = 490;

export function rempartPlusPriceLabel(): string {
  return "4,90 € / mois";
}

export async function hasActiveRempartPlus(): Promise<boolean> {
  const jar = await cookies();
  const email = jar.get(REMPART_PLUS_COOKIE)?.value?.trim().toLowerCase();
  if (!email || !email.includes("@")) return false;
  try {
    const row = await prisma.membership.findUnique({
      where: { email },
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
