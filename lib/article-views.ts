/**
 * Compteur de lectures pour « Les plus lus », sans changer la structure de la base :
 * une ligne AppSetting par article et par jour (clé views:AAAA-MM-JJ:numéro).
 * Aucune donnée personnelle : seul un total par article est gardé, 8 jours au plus.
 */
import { prisma } from "@/lib/prisma";

const PREFIX = "views:";
const KEEP_DAYS = 8;

function parisDay(d: Date): string {
  // AAAA-MM-JJ à l'heure de Paris.
  return d.toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
}

export async function recordArticleView(publicId: number): Promise<void> {
  const key = `${PREFIX}${parisDay(new Date())}:${publicId}`;
  await prisma.$executeRaw`
    INSERT INTO "AppSetting" (key, value, "updatedAt") VALUES (${key}, '1', NOW())
    ON CONFLICT (key) DO UPDATE
    SET value = (COALESCE(NULLIF("AppSetting".value, ''), '0')::int + 1)::text, "updatedAt" = NOW()`;
  // Ménage occasionnel des jours trop anciens.
  if (Math.random() < 0.02) {
    const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000);
    await prisma.$executeRaw`
      DELETE FROM "AppSetting" WHERE key LIKE 'views:%' AND "updatedAt" < ${cutoff}`;
  }
}

/** Numéros d'articles les plus lus sur les derniers jours, du plus lu au moins lu. */
export async function mostReadPublicIds(days = 2, limit = 5): Promise<number[]> {
  const keys: string[] = [];
  for (let i = 0; i < days; i++) {
    keys.push(`${PREFIX}${parisDay(new Date(Date.now() - i * 86_400_000))}:`);
  }
  const rows = await prisma.appSetting.findMany({
    where: { OR: keys.map((k) => ({ key: { startsWith: k } })) },
    select: { key: true, value: true },
  });
  const totals = new Map<number, number>();
  for (const row of rows) {
    const id = Number(row.key.split(":")[2]);
    const n = Number(row.value) || 0;
    if (Number.isInteger(id)) totals.set(id, (totals.get(id) ?? 0) + n);
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}
