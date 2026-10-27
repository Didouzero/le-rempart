/**
 * Titres et chapôs réécrits pour les pages très affichées mais peu cliquées
 * (Search Console, 3 mois au 27/10/2026), calés sur les requêtes réelles.
 *
 *   npx tsx scripts/retitle-low-ctr.ts           # aperçu
 *   npx tsx scripts/retitle-low-ctr.ts --apply   # écrit en base (sauvegarde avant)
 */
import { readFileSync, writeFileSync } from "fs";

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2];
}

const REWRITES: Array<{ publicId: number; title: string; excerpt: string }> = [
  {
    // « macron 2cv », « 2cv electrique macron » : 3 667 impressions, 1,4 % de clics
    publicId: 382,
    title: "Macron découvre la 2CV électrique au Mondial de l'auto",
    excerpt:
      "Emmanuel Macron a découvert la nouvelle Citroën 2CV électrique au Mondial de l'automobile : sortie prévue en 2028, autour de 15 000 €. Le même soir, Elon Musk faisait décoller une Tesla au Texas.",
  },
  {
    // « bally bagayoko salaire », « combien gagne bally bagayoko » : 3 663 impressions, 1,9 %
    publicId: 70,
    title: "Salaire de Bally Bagayoko à la RATP : plus de 6 000 € brut par mois",
    excerpt:
      "Combien gagnait Bally Bagayoko à la RATP ? Plus de 6 000 € brut mensuels selon Le Canard enchaîné. Le maire LFI de Saint-Denis y avait été recruté en 2000 sans concours ni entretien.",
  },
  {
    // « khalid dati », « neveu rachida dati prison » : 2 866 impressions, 1 %
    publicId: 223,
    title: "Khalid Dati, neveu de Rachida Dati, condamné à 3 ans de prison ferme",
    excerpt:
      "Khalid Dati, 28 ans, neveu de Rachida Dati, a été condamné par le tribunal correctionnel de Pontoise à trois ans de prison ferme pour détention et transport d'armes à Goussainville (Val-d'Oise).",
  },
  {
    // « enzo debhi charbonnier », « johan courtel » : 2 734 impressions, 2 %
    publicId: 329,
    title: "Porto-Vecchio : les suspects Enzo Debhi-Charbonnier et Johan Courtel ont quitté la Corse",
    excerpt:
      "Soupçonnés d'avoir détruit une statue de la Vierge à Porto-Vecchio, Enzo Debhi-Charbonnier et Johan Courtel ont quitté la Corse par avion le 4 octobre, après avoir été empêchés d'embarquer à Ajaccio.",
  },
  {
    // « oasis gelatine de porc », « porc dans le jus de pomme » : 2 537 impressions, 2,9 %
    publicId: 332,
    title: "Gélatine de porc dans les jus Oasis : la marque dément",
    excerpt:
      "Y a-t-il de la gélatine de porc dans les jus Oasis ? Non, assure la marque, qui a démenti le 2 octobre après une réponse erronée de son service client. Ce que l'on sait de la fabrication des jus.",
  },
  {
    // « tondelier pompidou », « marine tondelier darius rochebin » : 2 280 impressions, 1,1 %
    publicId: 208,
    title: "Marine Tondelier sèche sur Pompidou face à Darius Rochebin",
    excerpt:
      "Sur LCI, Darius Rochebin a demandé à Marine Tondelier de qualifier Georges Pompidou en un mot. La candidate écologiste à la présidentielle 2027 s'est retrouvée démunie.",
  },
  {
    // « gens du voyage ajaccio », « gens du voyage corse rugby » : 1 279 impressions, 2,3 %
    publicId: 64,
    title: "Gens du voyage à Ajaccio : les rugbymen les délogent en moins d'une heure",
    excerpt:
      "À Ajaccio, des gens du voyage avaient installé leurs caravanes sur un terrain de rugby. Les joueurs du club sont intervenus eux-mêmes : en moins d'une heure, le terrain était libéré.",
  },
  {
    // « bagayoko drapeau soudan », « bally bagayoko alcool » : 1 141 impressions, 2,3 %
    publicId: 380,
    title: "Bally Bagayoko : arrêté anti-alcool à Saint-Denis et polémique du drapeau soudanais",
    excerpt:
      "Le maire LFI de Saint-Denis défend son arrêté interdisant la vente d'alcool à emporter autour de la gare, de 19 h à 6 h. Dans sa vidéo, un drapeau du Soudan accroché au mur a aussi fait réagir.",
  },
];

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const current = await prisma.article.findMany({
    where: { publicId: { in: REWRITES.map((r) => r.publicId) } },
    select: { id: true, publicId: true, title: true, excerpt: true },
  });

  for (const r of REWRITES) {
    const before = current.find((c) => c.publicId === r.publicId);
    console.log(
      `#${r.publicId} (${r.title.length} car.)\n  avant : ${before?.title}\n  après : ${r.title}`,
    );
  }

  if (process.argv.includes("--apply")) {
    const backup = `tmp/backup-titles-${Date.now()}.json`;
    writeFileSync(backup, JSON.stringify(current));
    for (const r of REWRITES) {
      await prisma.article.update({
        where: { publicId: r.publicId },
        data: { title: r.title, excerpt: r.excerpt },
      });
    }
    console.log(`\nSauvegarde : ${backup}\n${REWRITES.length} articles mis à jour.`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
