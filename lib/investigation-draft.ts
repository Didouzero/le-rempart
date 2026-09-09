import { prisma } from "@/lib/prisma";

const KEY = "investigation:draft";
export const INVESTIGATION_DRAFT_TTL_MS = 3 * 60 * 60 * 1000;

export type InvestigationStep = "awaiting_creative" | "awaiting_prompt";

export type InvestigationSession = {
  chatId: number;
  step: InvestigationStep;
  urls: string[];
  fileId?: string;
  imageMime?: string;
  headline?: string;
  prompt?: string;
  /** Si défini : réécriture de cette enquête (même URL, pas de post Facebook). */
  replaceDossierId?: string;
  startedAt: number;
};

function parse(raw: string | null): InvestigationSession | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as InvestigationSession;
    if (!v?.chatId) return null;
    if (v.step !== "awaiting_creative" && v.step !== "awaiting_prompt") {
      return null;
    }
    if (Date.now() - (v.startedAt || 0) > INVESTIGATION_DRAFT_TTL_MS) {
      return null;
    }
    return v;
  } catch {
    return null;
  }
}

async function save(session: InvestigationSession): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(session) },
    update: { value: JSON.stringify(session) },
  });
}

export async function getInvestigationSession(
  chatId: number,
): Promise<InvestigationSession | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
  const session = parse(row?.value || null);
  if (!session || session.chatId !== chatId) return null;
  return session;
}

export async function startInvestigationSession(
  chatId: number,
): Promise<InvestigationSession> {
  const session: InvestigationSession = {
    chatId,
    step: "awaiting_creative",
    urls: [],
    startedAt: Date.now(),
  };
  await save(session);
  return session;
}

export async function startInvestigationRewriteSession(
  chatId: number,
  dossierId: string,
  headline?: string,
): Promise<InvestigationSession> {
  const session: InvestigationSession = {
    chatId,
    step: "awaiting_prompt",
    urls: [],
    replaceDossierId: dossierId,
    headline,
    startedAt: Date.now(),
  };
  await save(session);
  return session;
}

function briefKey(dossierId: string): string {
  return `dossier:brief:${dossierId}`;
}

export async function saveDossierBrief(
  dossierId: string,
  prompt: string,
): Promise<void> {
  const key = briefKey(dossierId);
  const value = prompt.trim().slice(0, 60000);
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function getDossierBrief(
  dossierId: string,
): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({
    where: { key: briefKey(dossierId) },
  });
  const value = row?.value?.trim() || "";
  return value.length >= 40 ? value : null;
}

export async function setInvestigationCreative(
  chatId: number,
  input: { fileId: string; imageMime?: string; headline?: string },
): Promise<InvestigationSession | null> {
  const session = await getInvestigationSession(chatId);
  if (!session) return null;
  session.fileId = input.fileId;
  session.imageMime = input.imageMime;
  session.headline = input.headline?.trim().slice(0, 280) || session.headline;
  session.step = "awaiting_prompt";
  await save(session);
  return session;
}

export async function clearInvestigationSession(): Promise<void> {
  await prisma.appSetting.delete({ where: { key: KEY } }).catch(() => {});
}

export function extractAllHttpUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"')\]]+/gi) || [];
  return [
    ...new Set(matches.map((u) => u.replace(/[.,;:!?)]+$/, ""))),
  ];
}

const BRIEF_BOILERPLATE =
  /^(tu es|vous [eê]tes|je veux|je ne veux|j['’]aimerais|objectif\b|mission\b|consignes?\b|contexte\b|important\b|r[eè]gles?\b|attention\b|note\b|n\.b\.|#+\s)/i;

function isBoilerplateLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 8) return true;
  if (/^https?:\/\//i.test(t)) return true;
  return BRIEF_BOILERPLATE.test(t);
}

function quotedSpans(prompt: string): string[] {
  const out: string[] = [];
  const re = /[«"]([^»"]{16,220})[»"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt))) {
    const q = m[1].replace(/\s+/g, " ").trim();
    if (q.length >= 16) out.push(q);
  }
  return out;
}

/**
 * Sujet de recherche + requêtes, extraits d'un brief long
 * (« Tu es un journaliste… », question centrale, affaire X, rôle de Y).
 */
export function extractInvestigationFocus(
  prompt: string,
  headline?: string,
): { subject: string; queries: string[] } {
  const quotes = quotedSpans(prompt);
  const centralQ = quotes.find(
    (q) =>
      /[?]/.test(q) ||
      /que savait|pourquoi|comment|quel\b|r[oô]le|affaire/i.test(q),
  );

  const affaire = prompt
    .match(/l['’]affaire\s+(?:de\s+|du\s+|des\s+)?([^.,\n«"]{3,60})/i)?.[1]
    ?.replace(/\s+/g, " ")
    .trim();
  const roleDe = prompt
    .match(/r[oô]le de\s+([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^.,\n]{3,55})/i)?.[1]
    ?.replace(/\s+/g, " ")
    .trim();
  const enqueteSur = prompt
    .match(
      /enqu[eê]te[^\n]{0,90}?\ssur\s+(?:l['’]affaire\s+(?:de\s+)?)?([^.,\n]{6,90})/i,
    )?.[1]
    ?.replace(/\s+/g, " ")
    .trim();

  let subject = "";
  if (centralQ) subject = centralQ.replace(/[?]+$/, "").trim();
  else if (roleDe && affaire) subject = `${roleDe} — affaire ${affaire}`;
  else if (enqueteSur) subject = enqueteSur;
  else if (affaire) subject = `affaire ${affaire}`;
  else if (roleDe) subject = roleDe;

  const head = headline?.replace(/\s+/g, " ").trim() || "";
  if (!subject && head.length > 12 && !/^enqu[eê]te le rempart$/i.test(head)) {
    subject = head;
  }
  if (!subject) {
    const first = prompt
      .split(/\n/)
      .map((l) => l.trim())
      .find((l) => !isBoilerplateLine(l) && l.length > 12);
    subject = (first || prompt).replace(/\s+/g, " ");
  }
  subject = subject.slice(0, 180).trim() || "Enquête Le Rempart";

  const directiveLines = prompt
    .split(/\n/)
    .map((l) => l.trim())
    .filter(
      (l) =>
        !isBoilerplateLine(l) &&
        l.length > 24 &&
        /(cherche|fouille|v[eé]rifie|chronologie|documents?|t[eé]moignages?|hatvp|assembl[eé]e|question centrale|angle)/i.test(
          l,
        ),
    )
    .map((l) => l.slice(0, 140));

  const core = (affaire || roleDe || subject).slice(0, 60);
  const auditions = [
    ...prompt.matchAll(/[Aa]udition d[e'’]\s+([^.\n,]{4,55})/g),
  ].map((m) => `${m[1]!.trim()} ${core}`.slice(0, 140));
  const docs = [
    /IFJD/i.test(prompt) ? `${core} rapport IFJD` : "",
    /assembl[eé]e nationale|commission d['’]enqu[eê]te/i.test(prompt)
      ? `${core} commission enquête Assemblée nationale`
      : "",
    /Chancellerie|DACG|Le Mesle/i.test(prompt)
      ? `${core} Laurent Le Mesle 26 mai 1998`
      : "",
  ];

  const queries = [
    ...new Set(
      [
        subject,
        affaire && roleDe ? `${roleDe} ${affaire}` : "",
        affaire ? `${affaire} enquête` : "",
        centralQ?.slice(0, 140) || "",
        `${subject} enquête`,
        `${core} chronologie`,
        `${core} documents officiels`,
        ...docs,
        ...auditions.slice(0, 6),
        ...directiveLines.slice(0, 8),
      ]
        .map((q) => q.replace(/\s+/g, " ").trim())
        .filter((q) => q.length >= 8),
    ),
  ].slice(0, 16);

  return { subject, queries };
}

export function subjectFromInvestigationPrompt(
  prompt: string,
  headline?: string,
): string {
  return extractInvestigationFocus(prompt, headline).subject;
}

export function extraQueriesFromPrompt(prompt: string, subject: string): string[] {
  const { queries } = extractInvestigationFocus(prompt);
  if (queries[0] === subject) return queries;
  return [...new Set([subject, ...queries])].slice(0, 16);
}
