import { promises as dns } from "node:dns";
import { headers } from "next/headers";

/**
 * Googlebot (et l'outil d'inspection de la Search Console) reçoit le texte complet
 * des enquêtes Rempart+, balisé comme payant (hasPart / isAccessibleForFree: false).
 * Le user-agent seul se falsifie : on vérifie l'adresse IP par DNS inversé puis
 * direct, comme Google le recommande. Un visiteur ordinaire n'est jamais vérifié.
 */
const GOOGLE_UA = /\b(Googlebot|Google-InspectionTool)\b/i;
const GOOGLE_HOST = /\.(googlebot|google)\.com\.?$/i;
const LOOKUP_TIMEOUT_MS = 1500;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { ok: boolean; at: number }>();

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("dns timeout")), LOOKUP_TIMEOUT_MS),
    ),
  ]);
}

async function ipBelongsToGoogle(ip: string): Promise<boolean> {
  const hit = cache.get(ip);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.ok;

  let ok = false;
  try {
    const hosts = await withTimeout(dns.reverse(ip));
    for (const host of hosts) {
      if (!GOOGLE_HOST.test(host)) continue;
      const addrs = await withTimeout(dns.lookup(host, { all: true }));
      if (addrs.some((a) => a.address === ip)) {
        ok = true;
        break;
      }
    }
  } catch {
    ok = false;
  }
  // Un échec DNS passager n'est pas gardé longtemps.
  cache.set(ip, { ok, at: ok ? Date.now() : Date.now() - CACHE_TTL_MS + 10 * 60 * 1000 });
  return ok;
}

export async function isVerifiedGooglebot(): Promise<boolean> {
  const h = await headers();
  if (!GOOGLE_UA.test(h.get("user-agent") ?? "")) return false;
  // Sur Vercel, x-real-ip est posé par la plateforme ; x-forwarded-for en secours.
  const ip =
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "";
  if (!ip) return false;
  return ipBelongsToGoogle(ip);
}
