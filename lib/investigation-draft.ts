import { prisma } from "@/lib/prisma";

const KEY = "investigation:draft";
export const INVESTIGATION_DRAFT_TTL_MS = 90 * 60 * 1000;

export type InvestigationSession = {
  chatId: number;
  subject: string;
  urls: string[];
  startedAt: number;
};

function parse(raw: string | null): InvestigationSession | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as InvestigationSession;
    if (!v?.subject || !v.chatId) return null;
    if (Date.now() - (v.startedAt || 0) > INVESTIGATION_DRAFT_TTL_MS) {
      return null;
    }
    return v;
  } catch {
    return null;
  }
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
  subject: string,
): Promise<InvestigationSession> {
  const session: InvestigationSession = {
    chatId,
    subject: subject.trim().slice(0, 280),
    urls: [],
    startedAt: Date.now(),
  };
  await prisma.appSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(session) },
    update: { value: JSON.stringify(session) },
  });
  return session;
}

export async function addInvestigationUrls(
  chatId: number,
  urls: string[],
): Promise<InvestigationSession | null> {
  const session = await getInvestigationSession(chatId);
  if (!session) return null;
  const merged = [...session.urls];
  for (const u of urls) {
    if (!merged.includes(u)) merged.push(u);
  }
  session.urls = merged.slice(0, 12);
  await prisma.appSetting.update({
    where: { key: KEY },
    data: { value: JSON.stringify(session) },
  });
  return session;
}

export async function clearInvestigationSession(): Promise<void> {
  await prisma.appSetting.delete({ where: { key: KEY } }).catch(() => {});
}

export function extractAllHttpUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"')\]]+/gi) || [];
  return [
    ...new Set(
      matches.map((u) => u.replace(/[.,;:!?)]+$/, "")),
    ),
  ];
}
