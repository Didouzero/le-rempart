import { loadClaudeJob } from "@/lib/claude-job";
import { prisma } from "@/lib/prisma";
import { prepareSiteIllustration } from "@/lib/illustration";
import { isArticleCategory, type ArticleCategory } from "@/lib/categories";
import { utf8Text } from "@/lib/utf8";

/** Brouillon créative → image → lien : expire après 30 min. */
export const PUBLISH_DRAFT_TTL_MS = 30 * 60 * 1000;

export type PublishDraftRecord = {
  id: string;
  chatId: bigint;
  userId: bigint;
  headline: string;
  imageMime: string;
  imageData: Buffer;
  coverImageUrl: string | null;
  coverImageMime: string | null;
  coverImageData: Buffer | null;
  coverCaption: string | null;
  category: ArticleCategory | null;
  createdAt: Date;
};

function toRecord(row: {
  id: string;
  chatId: bigint;
  userId: bigint;
  headline: string;
  imageMime: string;
  imageData: Uint8Array | Buffer;
  coverImageUrl: string | null;
  coverImageMime?: string | null;
  coverImageData?: Uint8Array | Buffer | null;
  coverCaption?: string | null;
  category?: string | null;
  createdAt: Date;
}): PublishDraftRecord {
  return {
    id: row.id,
    chatId: row.chatId,
    userId: row.userId,
    headline: row.headline,
    imageMime: row.imageMime,
    imageData: Buffer.from(row.imageData),
    coverImageUrl: row.coverImageUrl,
    coverImageMime: row.coverImageMime ?? null,
    coverImageData: row.coverImageData
      ? Buffer.from(row.coverImageData)
      : null,
    coverCaption: row.coverCaption ?? null,
    category:
      row.category && isArticleCategory(row.category) ? row.category : null,
    createdAt: row.createdAt,
  };
}

/** Article pour le site seul (/site) : pas de créative, donc rien sur Facebook. */
const SITE_ONLY_HEADLINE = "Article pour le site seul";
/** Le titre de la créative n'est plus lu : le sujet le remplace à l'envoi. */
export const NO_HEADLINE = "Sujet à venir";

/** Post Facebook seul (/facebook) : repère stocké à la place de l'illustration du site. */
const FACEBOOK_ONLY_MARK = "facebook-only";
const FACEBOOK_ONLY_HEADLINE = "Post pour Facebook seul";

export function isFacebookOnlyDraft(draft: PublishDraftRecord): boolean {
  return draft.coverImageUrl === FACEBOOK_ONLY_MARK;
}

export function isSiteOnlyDraft(draft: PublishDraftRecord): boolean {
  return draft.imageData.length === 0 && !isFacebookOnlyDraft(draft);
}

export function createSiteOnlyDraft(chatId: number, userId: number) {
  return upsertPublishDraft({
    chatId,
    userId,
    headline: SITE_ONLY_HEADLINE,
    image: { buffer: Buffer.alloc(0), mime: "" },
  });
}

export function createFacebookOnlyDraft(chatId: number, userId: number) {
  return upsertPublishDraft({
    chatId,
    userId,
    headline: FACEBOOK_ONLY_HEADLINE,
    image: { buffer: Buffer.alloc(0), mime: "" },
    coverImageUrl: FACEBOOK_ONLY_MARK,
  });
}

export function draftHasCover(draft: PublishDraftRecord): boolean {
  return Boolean(
    draft.coverImageUrl?.trim() ||
      (draft.coverImageData && draft.coverImageData.length > 0),
  );
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
  coverImageUrl?: string;
}): Promise<PublishDraftRecord> {
  const coverImageUrl = input.coverImageUrl ?? null;
  const row = await prisma.publishDraft.upsert({
    where: { chatId: BigInt(input.chatId) },
    create: {
      chatId: BigInt(input.chatId),
      userId: BigInt(input.userId),
      headline: utf8Text(input.headline, 500),
      imageMime: input.image.mime,
      imageData: Buffer.from(input.image.buffer),
      coverImageUrl,
      coverImageMime: null,
      coverImageData: null,
      coverCaption: null,
      category: null,
    },
    update: {
      userId: BigInt(input.userId),
      headline: utf8Text(input.headline, 500),
      imageMime: input.image.mime,
      imageData: Buffer.from(input.image.buffer),
      coverImageUrl,
      coverImageMime: null,
      coverImageData: null,
      coverCaption: null,
      category: null,
    },
  });
  return toRecord(row);
}

/** Créative reçue après /facebook. */
export async function setPublishDraftCreative(
  chatId: number,
  image: { buffer: Buffer; mime: string },
  headline?: string,
): Promise<void> {
  await prisma.publishDraft.update({
    where: { chatId: BigInt(chatId) },
    data: {
      imageMime: image.mime,
      imageData: Buffer.from(image.buffer),
      ...(headline ? { headline: utf8Text(headline, 500) } : {}),
    },
  });
}

export async function setPublishDraftHeadline(
  chatId: number,
  headline: string,
): Promise<PublishDraftRecord | null> {
  const trimmed = utf8Text(headline.replace(/\s+/g, " ").trim(), 500);
  if (trimmed.length < 6) return null;
  try {
    const row = await prisma.publishDraft.update({
      where: { chatId: BigInt(chatId) },
      data: { headline: trimmed },
    });
    return toRecord(row);
  } catch {
    return null;
  }
}

export async function setPublishDraftCoverFile(
  chatId: number,
  image: { buffer: Buffer; mime: string },
  caption?: string | null,
): Promise<PublishDraftRecord | null> {
  const prepared = await prepareSiteIllustration(image);
  try {
    const row = await prisma.publishDraft.update({
      where: { chatId: BigInt(chatId) },
      data: {
        coverImageUrl: null,
        coverImageMime: prepared.mime,
        coverImageData: Buffer.from(prepared.buffer),
        coverCaption: caption?.trim() ? utf8Text(caption.trim(), 400) : null,
      },
    });
    return toRecord(row);
  } catch {
    return null;
  }
}

/** Légende tapée en message, quand elle n'était pas dans le fichier. */
export async function setPublishDraftCaption(
  chatId: number,
  caption: string,
): Promise<PublishDraftRecord | null> {
  try {
    const row = await prisma.publishDraft.update({
      where: { chatId: BigInt(chatId) },
      data: { coverCaption: utf8Text(caption.trim(), 400) },
    });
    return toRecord(row);
  } catch {
    return null;
  }
}

/** Rubrique choisie avec les boutons du bot. */
export async function setPublishDraftCategory(
  chatId: number,
  category: ArticleCategory,
): Promise<PublishDraftRecord | null> {
  try {
    const row = await prisma.publishDraft.update({
      where: { chatId: BigInt(chatId) },
      data: { category },
    });
    return toRecord(row);
  } catch {
    return null;
  }
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
    // Un article confié à Claude garde son brouillon jusqu'au « ok » ou à /cancel.
    if (await loadClaudeJob(chatId)) return toRecord(row);
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

/** Recrée un brouillon retiré avant une publication qui a échoué. */
export async function restorePublishDraft(
  draft: PublishDraftRecord,
): Promise<void> {
  await prisma.publishDraft
    .create({
      data: {
        chatId: draft.chatId,
        userId: draft.userId,
        headline: draft.headline,
        imageMime: draft.imageMime,
        imageData: Buffer.from(draft.imageData),
        coverImageUrl: draft.coverImageUrl,
        coverImageMime: draft.coverImageMime,
        coverImageData: draft.coverImageData
          ? Buffer.from(draft.coverImageData)
          : null,
        coverCaption: draft.coverCaption,
        category: draft.category,
      },
    })
    .catch((err) => console.error("restorePublishDraft", err));
}

/** Extraire la première URL http(s) d'un message Telegram. */
export function extractHttpUrl(text: string): string | null {
  // Les parenthèses équilibrées font partie de l'adresse (ex. « filters:format(jpg) ») :
  // les couper donnait un lien tronqué, donc une image introuvable.
  const match = text.match(/https?:\/\/(?:[^\s<>"'()\]]|\([^\s()]*\))+/i);
  if (!match) return null;
  return match[0]!.replace(/[.,;:!?]+$/, "");
}

/** Texte hors URL dans le même message (directives de recherche pour Kimi). */
export function extractResearchNotes(text: string): string | null {
  const url = extractHttpUrl(text);
  let notes = text.trim();
  if (url) {
    notes = notes.replace(url, " ").replace(/\s+/g, " ").trim();
  }
  notes = notes
    .replace(/^(notes?\s*(de\s*recherche)?\s*[:：\-–—]\s*)/i, "")
    .replace(/^(consigne|angle|brief)\s*[:：\-–—]\s*/i, "")
    .trim();
  if (notes.length < 12) return null;
  return notes.slice(0, 1200);
}
