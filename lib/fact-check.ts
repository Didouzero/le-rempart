/**
 * Contrôles anti-invention : une citation entre guillemets doit figurer mot pour mot
 * dans ce que l'agent a réellement lu, et le relecteur signale les faits non étayés.
 */

/**
 * En deçà, les guillemets désignent souvent un titre (« Face à l'info ») plutôt qu'une
 * déclaration : ces fragments courts restent à la charge du relecteur.
 */
const QUOTE_MIN_WORDS = 5;

/** Comptes rendus officiels : le « n° 40 » y ressort souvent en « n o 40 ». */
export function fixOcrNumero(text: string): string {
  return text.replace(/\bn\s+o\s+(?=\d)/gi, "n° ");
}

/** Réduit un texte à ses mots : casse, accents et ponctuation ne comptent pas. */
function wordsOf(text: string): string {
  return fixOcrNumero(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Citations « … », coupées à chaque ellipse : chaque morceau doit exister. */
function quotedFragments(text: string): string[] {
  const fragments: string[] = [];
  for (const m of text.matchAll(/«([^»]+)»/g)) {
    for (const part of m[1]!.split(/\[…\]|\[\.\.\.\]|…|\.\.\./)) {
      const clean = part.replace(/\s+/g, " ").trim();
      if (wordsOf(clean).split(" ").length >= QUOTE_MIN_WORDS) fragments.push(clean);
    }
  }
  return fragments;
}

/** Citations absentes de la matière lue par l'agent. */
export function unverifiedQuotes(text: string, matter: string): string[] {
  const corpus = ` ${wordsOf(matter)} `;
  return [
    ...new Set(
      quotedFragments(text).filter((q) => !corpus.includes(` ${wordsOf(q)} `)),
    ),
  ];
}

export type AuditProblem = { passage: string; raison: string };

export const AUDIT_SYSTEM = `Tu es secrétaire de rédaction, chargé de la vérification. Tu n'as pas écrit cet article et tu ne le défends pas. Tu le compares aux sources fournies et tu cherches ce qui n'y figure pas.

SIGNALE
- Tout fait, nom, date, lieu, chiffre, durée ou fonction absent des sources ou déformé.
- Toute précision plus forte que les sources : un détail ajouté pour faire vrai (« une plaisanterie de quelques secondes »), un mot qui change la nature des faits (« parodie » pour une chronique), une cause ou une intention prêtée sans source.
- Toute affirmation absolue non sourcée (« jamais », « toujours », « aucun »), et toute absence présentée comme un fait (« n'a pas réagi ») sans source qui l'établisse.
- Toute citation qui ne figure pas dans les sources.

NE SIGNALE PAS
- Les opinions et les jugements : ils sont permis. Mais si une phrase de jugement contient un fait, une intention prêtée ou une description générale absente des sources (« le paysage radiophonique compte très peu de présentatrices noires »), signale-la.
- Les faits de notoriété publique incontestables (une institution, une fonction bien connue).
- Le style, la ligne éditoriale, la longueur.

Sois exigeant et précis : un passage signalé doit pouvoir être retrouvé mot pour mot dans l'article. S'il n'y a rien à signaler, renvoie une liste vide.

Réponds UNIQUEMENT avec un JSON valide : {"problemes":[{"passage":"extrait exact de l'article","raison":"ce qui manque dans les sources"}]}`;

export function parseAudit(raw: string): AuditProblem[] {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("audit : la réponse n'est pas un JSON");
  const obj = JSON.parse(cleaned.slice(start, end + 1)) as { problemes?: unknown };
  if (!Array.isArray(obj.problemes)) throw new Error("audit : liste absente");
  return (obj.problemes as Array<Partial<AuditProblem>>)
    .filter((p) => p && typeof p.passage === "string" && p.passage.trim())
    .map((p) => ({ passage: p.passage!.trim(), raison: String(p.raison || "").trim() }));
}
