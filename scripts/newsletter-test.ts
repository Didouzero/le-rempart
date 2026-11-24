/**
 * Essai de bout en bout de la newsletter, sans e-mail : prépare une tâche d'essai et la
 * confie à Claude sur le VPS ; le résultat arrive à l'éditeur sur Telegram en fichiers HTML.
 *
 *   npx tsx scripts/newsletter-test.ts
 */
import { readFileSync } from "fs";

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2];
}

async function main() {
  const { buildNewsletterCandidates } = await import("../lib/newsletter-brief");
  const { getNewsletterJob, newsletterMessage, parisDate, parisDateLabel, saveJob } = await import("../lib/newsletter-job");
  const { sendToClaude } = await import("../lib/claude-job");
  const date = parisDate();
  const existing = await getNewsletterJob(date);
  if (existing && !existing.testOnly) throw new Error(`La vraie newsletter du ${date} existe déjà : essai refusé.`);
  const candidates = await buildNewsletterCandidates();
  const job = {
    date,
    dateLabel: parisDateLabel(),
    state: "writing" as const,
    candidates,
    createdAt: new Date().toISOString(),
    testOnly: true,
  };
  await saveJob(job);
  await sendToClaude(newsletterMessage(job));
  console.log(`Essai du ${date} confié à Claude : ${candidates.length} candidats.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
