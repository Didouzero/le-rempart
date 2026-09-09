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

export function subjectFromInvestigationPrompt(
  prompt: string,
  headline?: string,
): string {
  const first = prompt
    .split(/\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 8 && !/^https?:\/\//i.test(l));
  const raw = (
    headline && headline.length > 12 ? headline : first || prompt
  ).replace(/\s+/g, " ");
  return raw.slice(0, 280).trim() || "Enquête Le Rempart";
}

export function extraQueriesFromPrompt(prompt: string, subject: string): string[] {
  const lines = prompt
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 18 && !/^https?:\/\//i.test(l))
    .map((l) => l.slice(0, 140));
  return [
    ...new Set(
      [
        subject,
        `${subject} enquête`,
        `${subject} révélations`,
        `${subject} documents officiels`,
        ...lines.slice(0, 6),
      ].filter((q) => q.trim().length >= 8),
    ),
  ].slice(0, 10);
}
