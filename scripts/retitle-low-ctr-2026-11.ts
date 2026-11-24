/**
 * Deuxième série de titres réécrits (Search Console, 28 jours au 23/11/2026),
 * validée par l'éditeur le 24/11/2026. Le chapô suit, sauf quand excerpt est null.
 *
 *   npx tsx scripts/retitle-low-ctr-2026-11.ts           # aperçu
 *   npx tsx scripts/retitle-low-ctr-2026-11.ts --apply   # écrit en base (sauvegarde avant) + IndexNow
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2];
}

const REWRITES: Array<{ publicId: number; title: string; excerpt: string | null }> = [
  {
    // « oasis gelatine de porc », « y a t il de la gélatine de porc dans l'oasis » : 2 776 impressions, 0,8 %
    publicId: 332,
    title: "Y a-t-il de la gélatine de porc dans Oasis ? La marque répond",
    excerpt:
      "Non, assure Oasis : ses jus ne contiennent ni gélatine de porc ni aucune autre gélatine. La rumeur est partie d'une réponse erronée de son service client, démentie le 2 octobre.",
  },
  {
    // « taxe viande », « taxe sur la viande » : 1 589 impressions, 1,3 %
    publicId: 411,
    title: "Taxe sur la viande : 1 € le kilo, l'amendement Rousseau rejeté",
    excerpt:
      "Sandrine Rousseau voulait taxer de 10 centimes chaque tranche de 100 g de viande dans les produits transformés. L'Assemblée a rejeté son amendement par 84 voix contre 14, le 21 octobre.",
  },
  {
    // « lfi trompé de bouton », « coquerel trompé de bouton » : 1 405 impressions, 3,3 %
    publicId: 431,
    title: "Taxe au gigaoctet : Éric Coquerel dit s'être « trompé de bouton »",
    excerpt:
      "Le président insoumis de la commission des finances a voté la taxe Lhardit de 5,5 centimes par gigaoctet, puis a plaidé l'erreur. Deux voix LFI ont pourtant suffi à la faire adopter.",
  },
  {
    // « sylvain durif dieudonné », « lalanne durif dieudonné » : 912 impressions, 2,7 %
    publicId: 506,
    title: "Dieudonné, Durif et Lalanne privés de salle : le meeting se tient dans un bar",
    excerpt: null,
  },
  {
    // « louise montangon parents », « louise montangon famille » : 1 248 impressions, 4,1 %
    publicId: 463,
    title: "Louise Montangon menacée de mort, ses parents et son frère visés",
    excerpt:
      "Responsable de l'UNI à Bordeaux, l'étudiante de 22 ans reçoit depuis trois semaines des menaces de mort qui visent aussi sa famille. « J'ai peur dans la rue », dit-elle. Deux suspects ont été interpellés.",
  },
];

const INDEXNOW_KEY = "2752bb9e41ddf746190358170bfcc7f0";
const BASE = "https://www.le-rempart.org";

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const current = await prisma.article.findMany({
    where: { publicId: { in: REWRITES.map((r) => r.publicId) } },
    select: { id: true, publicId: true, title: true, excerpt: true, status: true },
  });

  for (const r of REWRITES) {
    const before = current.find((c) => c.publicId === r.publicId);
    if (!before) throw new Error(`Article ${r.publicId} introuvable`);
    console.log(`#${r.publicId} [${before.status}] (${r.title.length} car.)\n  avant : ${before.title}\n  après : ${r.title}`);
    if (r.excerpt) console.log(`  chapô : ${r.excerpt.length} car.`);
  }

  if (process.argv.includes("--apply")) {
    mkdirSync("tmp", { recursive: true });
    const backup = `tmp/backup-titles-${Date.now()}.json`;
    writeFileSync(backup, JSON.stringify(current, null, 2));
    for (const r of REWRITES) {
      await prisma.article.update({
        where: { publicId: r.publicId },
        data: r.excerpt ? { title: r.title, excerpt: r.excerpt } : { title: r.title },
      });
    }
    console.log(`\nSauvegarde : ${backup}\n${REWRITES.length} articles mis à jour.`);
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: "www.le-rempart.org",
        key: INDEXNOW_KEY,
        keyLocation: `${BASE}/${INDEXNOW_KEY}.txt`,
        urlList: REWRITES.map((r) => `${BASE}/articles/${r.publicId}`),
      }),
    });
    console.log(`IndexNow : ${res.status}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
