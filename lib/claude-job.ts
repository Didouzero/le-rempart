/**
 * Article confié à la session Claude Code du Mac : le bot dépose le sujet dans une file,
 * le canal (tools/claude-channel/server.mjs) le pousse dans la session et y dépose le texte.
 * Tout passe par AppSetting, sans route publique ni clé API.
 */

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

// Clés partagées avec le canal.
const INBOX_KEY = "claude-channel-inbox";
const HEARTBEAT_KEY = "claude-channel-heartbeat";
const JOB_KEY = "claude-article-job";

export const HEARTBEAT_MAX_AGE_MS = 2 * 60 * 1000;

/** Le canal écrit à ce seul compte : les autres passent par Kimi. */
const CLAUDE_EDITOR_CHAT = 788499709;

export type ClaudeJobState = "kimi-offer" | "writing" | "ready";

export type ClaudeJob = {
  id: string;
  chatId: number;
  state: ClaudeJobState;
  headline: string;
  subject: string;
  category: string | null;
  /** Dernier texte soumis par Claude : c'est lui que publie le « ok ». */
  text?: string;
  /** Fichier sur le Mac, repris pour les retouches. */
  file?: string;
};

export type ClaudeJobAction =
  | "publish"
  | "retouch"
  | "complement"
  | "kimi"
  | "new-subject"
  | "not-ready"
  | "mac-down"
  | "status";

/** Seul « ok » tout court vaut accord : « ok mais change le titre » est une retouche. */
export function isApproval(text: string): boolean {
  return /^ok[\s.!]*$/i.test(text.trim());
}

function asksKimi(text: string): boolean {
  return /^kimi[\s.!]*$/i.test(text.trim());
}

/** Que faire d'un message de l'éditeur pendant qu'un article est en cours. */
export function claudeJobAction(
  state: ClaudeJobState,
  text: string,
  macOnline: boolean,
): ClaudeJobAction {
  if (!text.trim() || text.trim().startsWith("/")) return "status";
  // Accepté même Mac allumé : le battement ne dit pas si la session répond encore.
  if (asksKimi(text)) return "kimi";
  if (state === "kimi-offer") return "new-subject";
  if (state === "ready" && isApproval(text)) return "publish";
  if (isApproval(text)) return "not-ready";
  if (!macOnline) return "mac-down";
  return state === "ready" ? "retouch" : "complement";
}

export function isHeartbeatFresh(value: string | undefined, now = Date.now()): boolean {
  const beat = Date.parse(value || "");
  return Number.isFinite(beat) && now - beat < HEARTBEAT_MAX_AGE_MS;
}

export async function isMacOnline(chatId: number): Promise<boolean> {
  if (chatId !== CLAUDE_EDITOR_CHAT) return false;
  const row = await prisma.appSetting.findUnique({ where: { key: HEARTBEAT_KEY } });
  return isHeartbeatFresh(row?.value);
}

export function newArticleMessage(job: ClaudeJob, categoryLabel: string): string {
  return [
    `[REMPART article ${job.id}]`,
    `Titre de la créative : ${job.headline}`,
    `Rubrique : ${categoryLabel}`,
    "Sujet donné par l'éditeur :",
    job.subject,
    "",
    "Applique le mode Telegram de la méthode rediger-article.",
  ].join("\n");
}

export function retouchMessage(job: ClaudeJob, request: string): string {
  return [
    `[REMPART retouche ${job.id}]`,
    `Fichier : ${job.file || "inconnu"}`,
    `Sujet d'origine : ${job.subject}`,
    "Demande de l'éditeur :",
    request,
    "",
    "Applique le mode Telegram de la méthode rediger-article.",
  ].join("\n");
}

export function complementMessage(job: ClaudeJob, note: string): string {
  return [
    `[REMPART complément ${job.id}]`,
    `Sujet : ${job.subject}`,
    "Précision de l'éditeur, à prendre en compte :",
    note,
  ].join("\n");
}

function abandonMessage(job: ClaudeJob): string {
  return `[REMPART abandon ${job.id}]\nL'éditeur a abandonné cet article : arrête le travail en cours, sans répondre.`;
}

function inboxRow(value: string) {
  return prisma.appSetting.create({
    data: { key: `${INBOX_KEY}:${Date.now()}:${randomUUID().slice(0, 8)}`, value },
  });
}

export async function sendToClaude(message: string): Promise<void> {
  await inboxRow(message);
}

export type StoredClaudeJob = { job: ClaudeJob; raw: string };

export async function loadClaudeJob(chatId: number): Promise<StoredClaudeJob | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: JOB_KEY } });
  if (!row) return null;
  try {
    const job = JSON.parse(row.value) as ClaudeJob;
    return job.chatId === chatId ? { job, raw: row.value } : null;
  } catch {
    return null;
  }
}

export function newClaudeJob(input: {
  chatId: number;
  state: ClaudeJobState;
  headline: string;
  subject: string;
  category: string | null;
}): ClaudeJob {
  return { ...input, id: randomUUID().slice(0, 8) };
}

export async function saveClaudeJob(job: ClaudeJob): Promise<void> {
  const value = JSON.stringify(job);
  await prisma.appSetting.upsert({
    where: { key: JOB_KEY },
    create: { key: JOB_KEY, value },
    update: { value },
  });
}

/** Le suivi et le message partent ensemble : pas de sujet sans suivi, ni l'inverse. */
export async function startClaudeJob(job: ClaudeJob, message: string): Promise<void> {
  const value = JSON.stringify(job);
  await prisma.$transaction([
    prisma.appSetting.upsert({
      where: { key: JOB_KEY },
      create: { key: JOB_KEY, value },
      update: { value },
    }),
    inboxRow(message),
  ]);
}

/**
 * Passe à l'état suivant seulement si le suivi n'a pas bougé entre-temps :
 * une nouvelle version arrivée à l'instant ne doit pas être écrasée.
 */
export async function replaceClaudeJob(
  stored: StoredClaudeJob,
  next: ClaudeJob,
): Promise<boolean> {
  const { count } = await prisma.appSetting.updateMany({
    where: { key: JOB_KEY, value: stored.raw },
    data: { value: JSON.stringify(next) },
  });
  return count === 1;
}

/** Une seule suppression peut réussir : deux « ok » rapprochés ne publient qu'une fois. */
export async function claimClaudeJob(stored: StoredClaudeJob): Promise<boolean> {
  const { count } = await prisma.appSetting.deleteMany({
    where: { key: JOB_KEY, value: stored.raw },
  });
  return count === 1;
}

/** Retire le suivi et, si Claude travaille encore, lui évite de dépenser pour rien. */
export async function abandonClaudeJob(stored: StoredClaudeJob): Promise<void> {
  await prisma.appSetting.deleteMany({ where: { key: JOB_KEY } });
  if (stored.job.state === "writing") await sendToClaude(abandonMessage(stored.job));
}
