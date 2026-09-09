import { prisma } from "@/lib/prisma";
import { getAdminTelegramChatId, telegramSendMessage } from "@/lib/telegram";

function parisWeekday(): number {
  const wd = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "Europe/Paris",
  }).format(new Date());
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[wd] ?? -1;
}

function parisDateKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const KEY_PREFIX = "enquete:reminded:";

const REMINDER_TEXT = [
  "Rappel enquête (mercredi / samedi) : aucune enquête publiée aujourd’hui.",
  "",
  "Quand tu veux : /enquete",
  "1) Envoie la créative Facebook",
  "2) Envoie un prompt complet (message, ou fichier .txt si trop long)",
  "Je mène l’enquête, je publie le dossier Rempart+, et je poste la créative sur Facebook avec le lien en commentaire.",
  "",
  "/enquete_cancel pour abandonner un flux en cours.",
].join("\n");

export async function maybeRemindInvestigation(): Promise<{
  sent: boolean;
  reason: string;
  slug?: string;
}> {
  const day = parisWeekday();
  if (day !== 3 && day !== 6) {
    return { sent: false, reason: "not_wed_sat" };
  }

  const settingKey = `${KEY_PREFIX}${parisDateKey()}`;
  const alreadyReminded = await prisma.appSetting.findUnique({
    where: { key: settingKey },
    select: { key: true },
  });
  if (alreadyReminded) {
    return { sent: false, reason: "already_reminded" };
  }

  const since = new Date(Date.now() - 20 * 60 * 60 * 1000);
  const already = await prisma.specialDossier.findFirst({
    where: { publishedAt: { gte: since } },
    select: { slug: true },
  });
  if (already) {
    return { sent: false, reason: "already_published", slug: already.slug };
  }

  const chatId = getAdminTelegramChatId();
  if (chatId) {
    await telegramSendMessage(chatId, REMINDER_TEXT);
  } else {
    console.log("[cron-enquete]", REMINDER_TEXT);
  }

  await prisma.appSetting.upsert({
    where: { key: settingKey },
    create: { key: settingKey, value: new Date().toISOString() },
    update: { value: new Date().toISOString() },
  });

  return { sent: true, reason: "reminded" };
}
