import { prisma } from "@/lib/prisma";

/** Brouillon créative → lien : expire après 30 min. */
export const PUBLISH_DRAFT_TTL_MS = 30 * 60 * 1000;

export type PublishDraftRecord = {
  id: string;
  chatId: bigint;
  userId: bigint;
  headline: string;
  imageMime: string;
  imageData: Buffer;
  createdAt: Date;
};

function toRecord(row: {
  id: string;
  chatId: bigint;
  userId: bigint;
  headline: string;
  imageMime: string;
  imageData: Uint8Array | Buffer;
  createdAt: Date;
}): PublishDraftRecord {
  return {
    id: row.id,
    chatId: row.chatId,
    userId: row.userId,
    headline: row.headline,
    imageMime: row.imageMime,
    imageData: Buffer.from(row.imageData),
    createdAt: row.createdAt,
  };
}

export function isDraftExpired(createdAt: Date, now = Date.now()): boolean {
  return now - createdAt.getTime() > PUBLISH_DRAFT_TTL_MS;
}

/** Upsert brouillon pour ce chat (une créative en attente à la fois). */
export async function upsertPublishDraft(input: {
  chatId: number;
  userId: number;
  headline: string;
  image: { buffer: Buffer; mime: string };
}): Promise<PublishDraftRecord> {
  const row = await prisma.publishDraft.upsert({
    where: { chatId: BigInt(input.chatId) },
    create: {
      chatId: BigInt(input.chatId),
      userId: BigInt(input.userId),
      headline: input.headline.slice(0, 500),
      imageMime: input.image.mime,
      imageData: new Uint8Array(input.image.buffer),
    },
    update: {
      userId: BigInt(input.userId),
      headline: input.headline.slice(0, 500),
      imageMime: input.image.mime,
      imageData: new Uint8Array(input.image.buffer),
    },
  });
  return toRecord(row);
}

/** Draft valide non expiré, ou null (et purge si expiré). */
export async function getActivePublishDraft(
  chatId: number,
): Promise<PublishDraftRecord | null> {
  const row = await prisma.publishDraft.findUnique({
    where: { chatId: BigInt(chatId) },
  });
  if (!row) return null;
  if (isDraftExpired(row.createdAt)) {
    await prisma.publishDraft.delete({ where: { id: row.id } }).catch(() => {});
    return null;
  }
  return toRecord(row);
}

export async function deletePublishDraft(chatId: number): Promise<boolean> {
  try {
    await prisma.publishDraft.delete({
      where: { chatId: BigInt(chatId) },
    });
    return true;
  } catch {
    return false;
  }
}

/** Extraire la première URL http(s) d'un message Telegram. */
export function extractHttpUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"')\]]+/i);
  if (!match) return null;
  return match[0]!.replace(/[.,;:!?)]+$/, "");
}
