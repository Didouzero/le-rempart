import { prisma } from "@/lib/prisma";

/** Une créative Canva ne sert qu'à publier sur Facebook (et à /fb_retry) : 24 h suffisent. */
export const CREATIVE_RETENTION_MS = 24 * 60 * 60 * 1000;

/** Retire de la base les créatives des articles publiés depuis plus de 24 h. */
export async function purgeOldCreatives(): Promise<number> {
  // En SQL direct : une purge technique ne doit pas toucher « updatedAt », qui affiche
  // « Mis à jour le… » sous l'article et sert de dateModified à Google.
  const cutoff = new Date(Date.now() - CREATIVE_RETENTION_MS);
  return prisma.$executeRaw`
    UPDATE "Article"
    SET "coverImageData" = NULL, "coverImageMime" = NULL
    WHERE "coverImageData" IS NOT NULL AND "createdAt" < ${cutoff}`;
}
