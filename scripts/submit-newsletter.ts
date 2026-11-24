/**
 * Rendu de la newsletter par Claude sur le VPS (méthode rediger-newsletter).
 *
 *   npx tsx scripts/submit-newsletter.ts "../A. veille/newsletter/AAAA-MM-JJ.json"            # contrôle puis envoi
 *   npx tsx scripts/submit-newsletter.ts "../A. veille/newsletter/AAAA-MM-JJ.json" --preview  # mise en page seule
 *
 * Le fichier : {"date":"AAAA-MM-JJ","points":[{"id":"s1","title":"…","free":"…","plus":"…"}]}
 * Le site contrôle tout avant d'envoyer ; une erreur s'affiche ligne par ligne et rien ne part.
 */
import { createHash } from "crypto";
import { readFileSync, writeFileSync } from "fs";

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2];
}

const SITE = process.env.NEWSLETTER_SUBMIT_URL || "https://www.le-rempart.org/api/newsletter/submit";

async function main() {
  const file = process.argv[2];
  const preview = process.argv.includes("--preview");
  if (!file) throw new Error("Chemin du fichier JSON attendu.");
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN absent de .env");
  const payload = JSON.parse(readFileSync(file, "utf8"));
  const token = createHash("sha256").update(`rempart-channel:${botToken}`).digest("hex");
  const res = await fetch(SITE, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Rempart-Channel-Token": token },
    body: JSON.stringify({ ...payload, preview }),
  });
  const out = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !out.ok) {
    console.error(`REFUSÉ (${res.status})\n${String(out.error || JSON.stringify(out))}`);
    process.exit(1);
  }
  if (preview) {
    const base = file.replace(/\.json$/, "");
    writeFileSync(`${base}-gratuite.html`, String(out.htmlFree));
    writeFileSync(`${base}-plus.html`, String(out.htmlPlus));
    console.log(`Aperçu accepté, rien n'est envoyé :\n${base}-gratuite.html\n${base}-plus.html`);
    return;
  }
  if (out.skipped) {
    console.log(`Rien n'est parti : ${String(out.skipped)}.`);
    return;
  }
  console.log(`Envoyée : ${out.sent} lecteurs, dont ${out.sentPlus} Rempart+, ${out.failed} échecs.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
