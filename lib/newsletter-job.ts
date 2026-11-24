/**
 * Tâche quotidienne de la newsletter, gardée dans AppSetting (`newsletter-job:AAAA-MM-JJ`).
 *
 * 1. Le cron du matin prépare les candidats et dépose la tâche dans la file du canal :
 *    Claude, sur le VPS, choisit et rédige avec la méthode rediger-newsletter.
 * 2. Claude lance scripts/submit-newsletter.ts, qui appelle /api/newsletter/submit :
 *    le texte est contrôlé, mis en page et envoyé.
 * 3. Si Claude n'a rien rendu à l'heure du cron suivant, ou si le VPS ne répond pas,
 *    la newsletter part avec les chapôs du site, et l'éditeur est prévenu.
 * Une tâche n'est envoyée qu'une fois : l'état passe à « sending » avant le premier e-mail.
 */

import { isHeartbeatFresh, sendToClaude } from "@/lib/claude-job";
import { sendEmail } from "@/lib/email";
import {
  briefFromClaude,
  buildNewsletterCandidates,
  fallbackBrief,
  renderBriefHtml,
  renderBriefText,
  type BriefCandidate,
  type BriefItem,
  type ClaudeBriefPoint,
} from "@/lib/newsletter-brief";
import { prisma } from "@/lib/prisma";
import { getAdminTelegramChatId, telegramSendMessage } from "@/lib/telegram";

const JOB_PREFIX = "newsletter-job:";
const HEARTBEAT_KEY = "claude-channel-heartbeat";
/** Délai laissé à Claude avant que la newsletter parte sans lui. */
const LATE_AFTER_MS = 30 * 60 * 1000;

export type NewsletterJobState = "writing" | "sending" | "sent";

export type NewsletterJob = {
  date: string;
  dateLabel: string;
  state: NewsletterJobState;
  candidates: BriefCandidate[];
  createdAt: string;
  mode?: "claude" | "fallback";
  sentAt?: string;
  result?: { sent: number; sentPlus: number; failed: number };
  /** Essai : aucun e-mail, la version gratuite part à l'éditeur sur Telegram. */
  testOnly?: boolean;
};

/** Date du jour à Paris, AAAA-MM-JJ. */
export function parisDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now);
}

export function parisDateLabel(now = new Date()): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(now);
}

export async function getNewsletterJob(date: string): Promise<NewsletterJob | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: JOB_PREFIX + date } });
  return row ? (JSON.parse(row.value) as NewsletterJob) : null;
}

export async function saveJob(job: NewsletterJob): Promise<void> {
  const value = JSON.stringify(job);
  await prisma.appSetting.upsert({
    where: { key: JOB_PREFIX + job.date },
    create: { key: JOB_PREFIX + job.date, value },
    update: { value },
  });
}

/** Passe la tâche à « sending » si elle ne l'est pas déjà : un seul envoi possible. */
async function claimJob(date: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ key: string }>>`
    UPDATE "AppSetting"
    SET value = jsonb_set(value::jsonb, '{state}', '"sending"')::text, "updatedAt" = NOW()
    WHERE key = ${JOB_PREFIX + date} AND value::jsonb->>'state' = 'writing'
    RETURNING key`;
  return rows.length > 0;
}

async function notifyEditor(text: string): Promise<void> {
  const chat = getAdminTelegramChatId();
  if (!chat) return;
  try {
    await telegramSendMessage(chat, text);
  } catch (err) {
    console.error("newsletter: Telegram", err);
  }
}

/** Essai de bout en bout : les deux versions arrivent à l'éditeur en fichiers HTML. */
async function sendTestToEditor(job: NewsletterJob, htmlFree: string, htmlPlus: string) {
  const chat = getAdminTelegramChatId();
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!chat || !token) throw new Error("Telegram non configuré pour l'essai.");
  for (const [name, html] of [
    [`newsletter-${job.date}-gratuite.html`, htmlFree],
    [`newsletter-${job.date}-rempart-plus.html`, htmlPlus],
  ] as const) {
    const form = new FormData();
    form.append("chat_id", String(chat));
    form.append("caption", `🧪 Essai de la newsletter (${name.includes("plus") ? "Rempart+" : "gratuite"}) : rien n'est envoyé aux abonnés.`);
    form.append("document", new Blob([html], { type: "text/html" }), name);
    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`Telegram ${res.status}`);
  }
}

/** Ce que Claude reçoit dans la session du VPS. */
export function newsletterMessage(job: NewsletterJob): string {
  const lines = job.candidates.map((c) =>
    c.kind === "site"
      ? `${c.id} [site · ${c.section}] ${c.title}\n   Chapô : ${c.excerpt}`
      : `${c.id} [veille · ${c.section}${c.source ? ` · ${c.source}` : ""}] ${c.title}\n   ${c.href}`,
  );
  return [
    `[REMPART newsletter ${job.date}]`,
    `Brief du ${job.dateLabel}.`,
    `Candidats (${job.candidates.length}) :`,
    ...lines,
    "",
    "Applique la méthode rediger-newsletter.",
  ].join("\n");
}

/** Cron du matin : prépare la tâche et la confie à Claude, ou envoie le repli si le VPS est muet. */
export async function startNewsletterJob(): Promise<Record<string, unknown>> {
  const date = parisDate();
  const existing = await getNewsletterJob(date);
  // Un essai (scripts/newsletter-test.ts) ne bloque jamais la vraie newsletter du jour.
  if (existing && !existing.testOnly) {
    return { ok: true, date, state: existing.state, reason: "déjà lancée" };
  }

  const candidates = await buildNewsletterCandidates();
  if (candidates.length === 0) return { ok: true, date, reason: "aucun candidat" };

  const job: NewsletterJob = {
    date,
    dateLabel: parisDateLabel(),
    state: "writing",
    candidates,
    createdAt: new Date().toISOString(),
  };
  await saveJob(job);

  const beat = await prisma.appSetting.findUnique({ where: { key: HEARTBEAT_KEY } });
  if (isHeartbeatFresh(beat?.value)) {
    await sendToClaude(newsletterMessage(job));
    return { ok: true, date, state: "writing", candidates: candidates.length };
  }
  const result = await sendNewsletterJob(date, "fallback");
  await notifyEditor(
    "📰 Newsletter : la session Claude du VPS ne répondait pas, elle est partie avec les chapôs des articles du site, sans la veille.",
  );
  return { ok: true, date, fallback: true, ...result };
}

/** Cron suivant : si Claude n'a rien rendu, la newsletter part quand même. */
export async function sendLateNewsletter(): Promise<Record<string, unknown> | null> {
  const date = parisDate();
  const job = await getNewsletterJob(date);
  if (!job || job.state !== "writing") return null;
  if (Date.now() - Date.parse(job.createdAt) < LATE_AFTER_MS) return null;
  const result = await sendNewsletterJob(date, "fallback");
  await notifyEditor(
    "📰 Newsletter : Claude n'a pas rendu le brief à temps. Elle est partie avec les chapôs des articles du site, sans la veille.",
  );
  return { date, fallback: true, ...result };
}

/** Rend le brief prêt à envoyer, depuis le texte de Claude ou les chapôs du site. */
export function renderNewsletter(
  job: NewsletterJob,
  brief: { free: BriefItem[]; plus: BriefItem[] },
) {
  return {
    htmlFree: renderBriefHtml({ dateLabel: job.dateLabel, items: brief.free, premium: false }),
    htmlPlus: renderBriefHtml({ dateLabel: job.dateLabel, items: brief.plus, premium: true }),
    textFree: renderBriefText(brief.free),
    textPlus: renderBriefText(brief.plus),
  };
}

/** Contrôle le texte de Claude sans rien envoyer : lève une erreur lisible s'il ne passe pas. */
export async function checkClaudeNewsletter(date: string, points: ClaudeBriefPoint[]) {
  const job = await getNewsletterJob(date);
  if (!job) throw new Error(`Aucune newsletter préparée pour le ${date}.`);
  return { job, brief: briefFromClaude(job.candidates, points) };
}

export async function sendNewsletterJob(
  date: string,
  mode: "claude" | "fallback",
  points?: ClaudeBriefPoint[],
): Promise<{ sent: number; sentPlus: number; failed: number; skipped?: string }> {
  const job = await getNewsletterJob(date);
  if (!job) throw new Error(`Aucune newsletter préparée pour le ${date}.`);
  // Contrôlé avant de réserver l'envoi : un texte refusé laisse la tâche ouverte.
  const brief = mode === "claude" ? briefFromClaude(job.candidates, points || []) : fallbackBrief(job.candidates);
  if (brief.free.length === 0) {
    return { sent: 0, sentPlus: 0, failed: 0, skipped: "aucun point à envoyer" };
  }
  if (!(await claimJob(date))) {
    return { sent: 0, sentPlus: 0, failed: 0, skipped: "déjà envoyée" };
  }

  const { htmlFree, htmlPlus, textFree, textPlus } = renderNewsletter(job, brief);

  if (job.testOnly) {
    await sendTestToEditor(job, htmlFree, htmlPlus);
    const result = { sent: 0, sentPlus: 0, failed: 0 };
    await saveJob({ ...job, state: "sent", mode, sentAt: new Date().toISOString(), result });
    return { ...result, skipped: "essai : envoyé à l'éditeur sur Telegram seulement" };
  }
  const subjectFree = `Le Rempart — L'actu en 10 points (${job.dateLabel})`;
  const subjectPlus = `Le Rempart+ — L'actu en 10 points (${job.dateLabel})`;

  const plusMembers = await prisma.membership.findMany({
    where: {
      status: { in: ["active", "past_due"] },
      OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }],
    },
    select: { email: true },
    take: 2000,
  });
  const plusSet = new Set(plusMembers.map((m) => m.email.toLowerCase()));
  const subscribers = await prisma.newsletterSubscriber.findMany({
    where: { unsubscribedAt: null },
    select: { email: true },
    take: 2000,
  });
  const subscriberSet = new Set(subscribers.map((s) => s.email.toLowerCase()));
  const recipients = [
    ...subscribers.map((s) => ({ email: s.email, plus: plusSet.has(s.email.toLowerCase()) })),
    ...plusMembers
      .filter((m) => !subscriberSet.has(m.email.toLowerCase()))
      .map((m) => ({ email: m.email, plus: true })),
  ];

  let sent = 0;
  let sentPlus = 0;
  let failed = 0;
  for (const r of recipients) {
    const result = await sendEmail({
      to: r.email,
      subject: r.plus ? subjectPlus : subjectFree,
      html: r.plus ? htmlPlus : htmlFree,
      text: r.plus ? textPlus : textFree,
    });
    if (result.ok) {
      sent += 1;
      if (r.plus) sentPlus += 1;
    } else failed += 1;
  }

  const result = { sent, sentPlus, failed };
  await saveJob({ ...job, state: "sent", mode, sentAt: new Date().toISOString(), result });
  return result;
}
