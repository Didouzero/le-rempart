import { prisma } from "@/lib/prisma";

/** Une créative Canva ne sert qu'à publier sur Facebook (et à /fb_retry) : 24 h suffisent. */
export const CREATIVE_RETENTION_MS = 24 * 60 * 60 * 1000;

/** Retire de la base les créatives des articles publiés depuis plus de 24 h. */
export async function purgeOldCreatives(): Promise<number> {
  const res = await prisma.article.updateMany({
    where: {
      coverImageData: { not: null },
      createdAt: { lt: new Date(Date.now() - CREATIVE_RETENTION_MS) },
    },
    data: { coverImageData: null, coverImageMime: null },
  });
  return res.count;
}
