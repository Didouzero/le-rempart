import { createHash, timingSafeEqual } from "crypto";

/**
 * Le canal Claude du VPS prouve qu'il détient le jeton du bot sans l'envoyer : même calcul
 * dans tools/claude-channel/server.mjs, le webhook Telegram et scripts/submit-newsletter.ts.
 */
export function channelTokenFor(botToken: string): string {
  return createHash("sha256").update(`rempart-channel:${botToken.trim()}`).digest("hex");
}

export function isChannelRequest(headers: Headers): boolean {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) return false;
  const a = Buffer.from(headers.get("x-rempart-channel-token") || "");
  const b = Buffer.from(channelTokenFor(botToken));
  return a.length === b.length && timingSafeEqual(a, b);
}
