import type { Prisma } from "@prisma/client";
import { tiktokModels, type TiktokDraftRow } from "@/lib/tiktok/db";
import {
  TIKTOK_DRAFT_TTL_MS,
  type TiktokDraftStep,
  type TiktokExtraMedia,
} from "@/lib/tiktok/types";

export type TiktokDraftRecord = {
  id: string;
  chatId: bigint;
  userId: bigint;
  step: TiktokDraftStep;
  sourceUrl: string | null;
  extraMedia: TiktokExtraMedia[];
  createdAt: Date;
};

function parseMedia(raw: unknown): TiktokExtraMedia[] {
  if (!Array.isArray(raw)) return [];
  const out: TiktokExtraMedia[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const kind = rec.kind;
    if (kind !== "url" && kind !== "photo" && kind !== "video") continue;
    out.push({
      kind,
      url: typeof rec.url === "string" ? rec.url : undefined,
      fileId: typeof rec.fileId === "string" ? rec.fileId : undefined,
      mime: typeof rec.mime === "string" ? rec.mime : undefined,
    });
  }
  return out;
}

function toRecord(row: TiktokDraftRow): TiktokDraftRecord {
  return {
    id: row.id,
    chatId: row.chatId,
    userId: row.userId,
    step: row.step === "awaiting_media" ? "awaiting_media" : "awaiting_url",
    sourceUrl: row.sourceUrl,
    extraMedia: parseMedia(row.extraMedia),
    createdAt: row.createdAt,
  };
}

function isExpired(createdAt: Date, now = Date.now()): boolean {
  return now - createdAt.getTime() > TIKTOK_DRAFT_TTL_MS;
}

export async function startTiktokDraft(input: {
  chatId: number;
  userId: number;
  sourceUrl?: string;
}): Promise<TiktokDraftRecord> {
  const sourceUrl = input.sourceUrl?.trim() || null;
  const row = await tiktokModels().draft.upsert({
    where: { chatId: BigInt(input.chatId) },
    create: {
      chatId: BigInt(input.chatId),
      userId: BigInt(input.userId),
      step: sourceUrl ? "awaiting_media" : "awaiting_url",
      sourceUrl,
      extraMedia: [],
    },
    update: {
      userId: BigInt(input.userId),
      step: sourceUrl ? "awaiting_media" : "awaiting_url",
      sourceUrl,
      extraMedia: [],
    },
  });
  return toRecord(row);
}

export async function getActiveTiktokDraft(
  chatId: number,
): Promise<TiktokDraftRecord | null> {
  const row = await tiktokModels().draft.findUnique({
    where: { chatId: BigInt(chatId) },
  });
  if (!row) return null;
  if (isExpired(row.createdAt)) {
    await tiktokModels().draft.delete({ where: { id: row.id } }).catch(() => {});
    return null;
  }
  return toRecord(row);
}

export async function setTiktokDraftSourceUrl(
  chatId: number,
  sourceUrl: string,
): Promise<TiktokDraftRecord | null> {
  try {
    const row = await tiktokModels().draft.update({
      where: { chatId: BigInt(chatId) },
      data: {
        sourceUrl: sourceUrl.slice(0, 2000),
        step: "awaiting_media",
      },
    });
    return toRecord(row);
  } catch {
    return null;
  }
}

export async function addTiktokDraftMedia(
  chatId: number,
  media: TiktokExtraMedia,
): Promise<TiktokDraftRecord | null> {
  const draft = await getActiveTiktokDraft(chatId);
  if (!draft) return null;
  const extraMedia = [...draft.extraMedia, media].slice(0, 12);
  const row = await tiktokModels().draft.update({
    where: { id: draft.id },
    data: { extraMedia: extraMedia as Prisma.InputJsonValue },
  });
  return toRecord(row);
}

export async function deleteTiktokDraft(chatId: number): Promise<boolean> {
  try {
    await tiktokModels().draft.delete({
      where: { chatId: BigInt(chatId) },
    });
    return true;
  } catch {
    return false;
  }
}
