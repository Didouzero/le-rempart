require("dotenv").config();
const { Client } = require("pg");

function fold(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function classify(input) {
  const blob = fold(
    [input.title, input.excerpt || "", String(input.content || "").slice(0, 1200)].join(
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
    /\b(politique|politicien|parti\b|election|sondage|candidat|candidature|investiture|assemblee nationale|elysee|gouvernement|rassemblement national|\brn\b|la france insoumise|\blfi\b|les republicains|\blr\b|renaissance|attal|bardella|melenchon)\b/.test(
      blob,
    )
  ) {
    return "politique";
  }
  return "insolite";
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const { rows } = await client.query(
    `SELECT id, "publicId", title, excerpt, content, category::text as category FROM "Article"`,
  );
  let updated = 0;
  for (const a of rows) {
    const next = classify(a);
    if (next === a.category) continue;
    await client.query(
      `UPDATE "Article" SET category = $1::"ArticleCategory" WHERE id = $2`,
      [next, a.id],
    );
    updated += 1;
    console.log(`#${a.publicId} → ${next} | ${String(a.title).slice(0, 70)}`);
  }
  console.log(`Done. ${updated}/${rows.length} updated.`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
