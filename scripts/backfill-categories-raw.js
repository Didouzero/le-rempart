require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

function fold(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function classify(input) {
  const blob = fold(
    [input.title, input.excerpt || "", (input.content || "").slice(0, 1200)].join(
      " ",
    ),
  );
  if (
    /\b(migrant|migrants|immigr|clandestin|sans[- ]papier|etranger|etrangere|etrangers|asile|refugie|refugies|expulsion|reconduite|frontiere|calais|mayotte|tunisien|tunisienne|marocain|marocaine|algerien|algerienne|afghan|afghane|syrien|syrienne|soudanais|erythreen|guineen|malien|senegalais|ivoirien|pakistanais|bangladais|turc\b|turque|kosovar|albanais|rom\b|roma\b|maghrebin|subsaharien|comorien)\b/.test(
      blob,
    )
  ) {
    return "immigration";
  }
  if (
    /\b(justice|tribunal|procureur|procureure|juge|audience|condamne|condamnation|requis|requisitoire|prison|incarcer|garde a vue|interpell|arrestation|mis en examen|cour d.assises|comparution|peine|mois de prison|ans de prison|relaxe|acquitte|instruction|parquet|homicide|meurtre|assassinat|viol\b|agression|agresse|poignard|coupable)\b/.test(
      blob,
    )
  ) {
    return "justice";
  }
  if (
    /\b(economie|economique|escroquerie|escroc|fraude|frauduleux|detourne|detournement|corruption|pot[- ]de[- ]vin|blanchiment|impot|impots|fiscal|contribuable|budget|deficit|subvention|allocs?\b|caf\b|rsa\b|argent public|gabegie|maire.{0,60}(vole|volait|detourn|escroq)|milliards? d.euros|millions? d.euros)\b/.test(
      blob,
    )
  ) {
    return "economie";
  }
  if (
    /\b(patrimoine|identite|identitaire|culture francaise|tradition|traditions|cathedrale|eglise|statue|monument|heritage|notre[- ]dame|chateau|village francais|francite|souche|racines|histoire de france|langue francaise)\b/.test(
      blob,
    )
  ) {
    return "patrimoine";
  }
  return "insolite";
}

const p = new PrismaClient();

async function main() {
  const articles = await p.$queryRawUnsafe(
    `SELECT id, "publicId", title, excerpt, content, category::text as category FROM "Article"`,
  );
  let updated = 0;
  for (const a of articles) {
    const next = classify(a);
    if (next === a.category) continue;
    await p.$executeRawUnsafe(
      `UPDATE "Article" SET category = $1::"ArticleCategory" WHERE id = $2`,
      next,
      a.id,
    );
    updated += 1;
    console.log(`#${a.publicId} → ${next} | ${String(a.title).slice(0, 70)}`);
  }
  console.log(`Done. ${updated}/${articles.length} updated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => p.$disconnect());
