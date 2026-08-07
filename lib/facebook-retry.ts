import { createHash } from "crypto";
import { articlePublicUrl, siteUrlBase } from "@/lib/article-url";
import { isFacebookConfigured } from "@/lib/facebook";
import { prisma } from "@/lib/prisma";
import {
  publishFacebookForArticle,
  type PipelineNotify,
} from "@/lib/publish-pipeline";

export type FacebookRetryResult = {
  postId?: string;
  storyId?: string | null;
  commentOk?: boolean;
  error?: string;
  article: {
    id: string;
    publicId: number;
    title: string;
    url: string;
  };
};

/**
 * Republie sur Facebook un article déjà en base (créative = coverImageData).
 * Usage Telegram : /fb_retry  ou  /fb_retry 69
 */
export async function republishArticleToFacebook(input: {
  publicId?: number;
  notify?: PipelineNotify;
}): Promise<FacebookRetryResult> {
  const notify = input.notify || (async () => {});

  if (!isFacebookConfigured()) {
    throw new Error(
      "Facebook non configuré (FACEBOOK_PAGE_ID + FACEBOOK_PAGE_ACCESS_TOKEN).",
    );
  }

  const article = input.publicId
    ? await prisma.article.findFirst({
        where: { publicId: input.publicId, status: "published" },
        select: {
          id: true,
          publicId: true,
          title: true,
          excerpt: true,
          coverImageData: true,
          coverImageMime: true,
        },
      })
    : await prisma.article.findFirst({
        where: {
          status: "published",
          coverImageData: { not: null },
        },
        orderBy: { publishedAt: "desc" },
        select: {
          id: true,
          publicId: true,
          title: true,
          excerpt: true,
          coverImageData: true,
          coverImageMime: true,
        },
      });

  if (!article) {
    throw new Error(
      input.publicId
        ? `Aucun article publié #${input.publicId}.`
        : "Aucun article récent avec créative stockée.",
    );
  }

  if (!article.coverImageData || article.coverImageData.length === 0) {
    throw new Error(
      `Article #${article.publicId} : pas de créative en base. Impossible de republier sur FB.`,
    );
  }

  const lockKey = `fb:retry:${createHash("sha1")
    .update(String(article.publicId))
    .digest("hex")
    .slice(0, 12)}`;
  const lock = await prisma.appSetting.findUnique({ where: { key: lockKey } });
  if (lock) {
    const started = Number(lock.value) || 0;
    if (Date.now() - started < 3 * 60 * 1000) {
      throw new Error(
        "Retry Facebook déjà en cours pour cet article (attends 3 min).",
      );
    }
  }
  await prisma.appSetting.upsert({
    where: { key: lockKey },
    create: { key: lockKey, value: String(Date.now()) },
    update: { value: String(Date.now()) },
  });

  const url = articlePublicUrl(article.publicId, siteUrlBase());

  try {
    await notify(
      [
        `Facebook retry — article #${article.publicId}`,
        article.title,
        url.replace("://le-rempart.org", "://www.le-rempart.org"),
      ].join("\n"),
    );

    const facebook = await publishFacebookForArticle({
      articleId: article.id,
      title: article.title,
      excerpt: article.excerpt,
      articleUrl: url,
      creative: {
        buffer: Buffer.from(article.coverImageData),
        mime: article.coverImageMime || "image/jpeg",
      },
      notify,
    });

    if (facebook.error) {
      throw new Error(facebook.error);
    }

    return {
      ...facebook,
      article: {
        id: article.id,
        publicId: article.publicId,
        title: article.title,
        url,
      },
    };
  } finally {
    await prisma.appSetting.delete({ where: { key: lockKey } }).catch(() => {});
  }
}
