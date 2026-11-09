/**
 * /repost <numéro> : republier un article déjà en ligne sur Facebook et X,
 * avec une nouvelle créative et le flash d'origine (post supprimé, mauvaise image…).
 *
 * 1. /repost 460  → le bot attend la nouvelle créative
 * 2. créative     → elle remplace celle de l'article en base
 * 3. flash        → collé tel quel (post publié ou fichier .txt de l'article)
 *    → post Facebook + lien en commentaire + story + post X
 */

import { articlePublicUrl, siteUrlBase } from "@/lib/article-url";
import { isFacebookConfigured } from "@/lib/facebook";
import { prisma } from "@/lib/prisma";
import {
  publishFacebookForArticle,
  type PipelineNotify,
} from "@/lib/publish-pipeline";
import {
  finishReadyFlash,
  looksLikeReadyArticle,
  parseReadyArticle,
} from "@/lib/ready-article";

const TTL_MS = 2 * 60 * 60 * 1000;

export type RepostSession = {
  publicId: number;
  step: "creative" | "flash";
  at: number;
};

const key = (chatId: number) => `repost:${chatId}`;

export async function getRepostSession(chatId: number): Promise<RepostSession | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: key(chatId) } });
  if (!row) return null;
  try {
    const s = JSON.parse(row.value) as RepostSession;
    if (Date.now() - s.at > TTL_MS) {
      await clearRepostSession(chatId);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

async function saveRepostSession(chatId: number, s: RepostSession): Promise<void> {
  const value = JSON.stringify(s);
  await prisma.appSetting.upsert({
    where: { key: key(chatId) },
    create: { key: key(chatId), value },
    update: { value },
  });
}

export async function clearRepostSession(chatId: number): Promise<boolean> {
  const res = await prisma.appSetting.deleteMany({ where: { key: key(chatId) } });
  return res.count > 0;
}

/** Démarre la republication : renvoie le titre de l'article. */
export async function startRepost(chatId: number, publicId: number): Promise<string> {
  if (!isFacebookConfigured()) {
    throw new Error("Facebook non configuré (FACEBOOK_PAGE_ID + FACEBOOK_PAGE_ACCESS_TOKEN).");
  }
  const article = await prisma.article.findFirst({
    where: { publicId, status: "published" },
    select: { title: true },
  });
  if (!article) throw new Error(`Aucun article publié #${publicId}.`);
  await saveRepostSession(chatId, { publicId, step: "creative", at: Date.now() });
  return article.title;
}

/** La nouvelle créative remplace celle de l'article (l'illustration du site ne change pas). */
export async function setRepostCreative(
  chatId: number,
  session: RepostSession,
  image: { buffer: Buffer; mime: string },
): Promise<void> {
  await prisma.article.update({
    where: { publicId: session.publicId },
    data: { coverImageData: new Uint8Array(image.buffer), coverImageMime: image.mime },
  });
  await saveRepostSession(chatId, { ...session, step: "flash", at: Date.now() });
}

/** Flash collé tel quel, ou fichier .txt complet de l'article (on n'en garde que le flash). */
export function repostFlashText(raw: string): string {
  const text = raw.trim();
  const body = looksLikeReadyArticle(text)
    ? parseReadyArticle(text).flash
    : text.replace(/^\s*FLASH\s*:\s*/i, "");
  return `FLASH :\n${body.trim()}`;
}

export async function publishRepost(
  chatId: number,
  session: RepostSession,
  rawFlash: string,
  notify: PipelineNotify,
): Promise<void> {
  const { flash, issues } = finishReadyFlash(repostFlashText(rawFlash));
  if (issues.length) throw new Error(`Flash à corriger : ${issues.join(" ; ")}`);

  const article = await prisma.article.findFirst({
    where: { publicId: session.publicId, status: "published" },
    select: {
      id: true,
      publicId: true,
      title: true,
      excerpt: true,
      coverImageData: true,
      coverImageMime: true,
    },
  });
  if (!article?.coverImageData?.length) {
    throw new Error(`Article #${session.publicId} : pas de créative en base.`);
  }

  await clearRepostSession(chatId);
  await publishFacebookForArticle({
    articleId: article.id,
    title: article.title,
    excerpt: article.excerpt,
    articleUrl: articlePublicUrl(article.publicId, siteUrlBase()),
    creative: {
      buffer: Buffer.from(article.coverImageData),
      mime: article.coverImageMime || "image/jpeg",
    },
    flash,
    x: true,
    notify,
  });
}
