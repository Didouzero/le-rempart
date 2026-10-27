/**
 * Supprime de la base les créatives Canva des articles publiés depuis plus de 24 h
 * (elles ne servent qu'à la publication Facebook), après les avoir sauvegardées
 * en fichiers, puis compacte la table pour rendre la place à Neon.
 *
 *   npx tsx scripts/purge-creatives.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs";

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2];
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const size = async () =>
    (await prisma.$queryRawUnsafe<Array<{ s: string }>>(
      `SELECT pg_size_pretty(pg_database_size(current_database())) AS s`,
    ))[0]!.s;
  console.log(`Taille de la base avant : ${await size()}`);

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const ids = await prisma.article.findMany({
    where: { coverImageData: { not: null }, createdAt: { lt: cutoff } },
    select: { id: true },
  });

  // Sauvegarde fichier par fichier : jamais tout en mémoire.
  const dir = `tmp/backup-creatives-${new Date().toISOString().slice(0, 10)}`;
  mkdirSync(dir, { recursive: true });
  for (const { id } of ids) {
    const a = await prisma.article.findUnique({
      where: { id },
      select: { publicId: true, coverImageData: true, coverImageMime: true },
    });
    if (!a?.coverImageData) continue;
    const ext = a.coverImageMime === "image/png" ? "png" : a.coverImageMime === "image/webp" ? "webp" : "jpg";
    writeFileSync(`${dir}/article-${a.publicId}.${ext}`, Buffer.from(a.coverImageData));
  }
  console.log(`${ids.length} créatives sauvegardées dans ${dir}`);

  const res = await prisma.article.updateMany({
    where: { id: { in: ids.map((x) => x.id) } },
    data: { coverImageData: null, coverImageMime: null },
  });
  console.log(`${res.count} créatives supprimées de la base.`);

  // Sans compactage, Postgres garde la place réservée et Neon ne voit aucune baisse.
  // VACUUM refuse la connexion « pooler » de Neon : on passe par l'hôte direct.
  const direct = new URL(process.env.DATABASE_URL!);
  direct.hostname = direct.hostname.replace("-pooler", "");
  direct.searchParams.delete("pgbouncer");
  const admin = new PrismaClient({ datasources: { db: { url: direct.toString() } } });
  await admin.$executeRawUnsafe(`VACUUM FULL "Article"`);
  await admin.$disconnect();
  console.log(`Taille de la base après compactage : ${await size()}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
