/**
 * Contraintes du Writing Agent — rédacteur en chef, pas générateur de texte.
 */

/** Densité informative : pas d'allongement artificiel. */
export const ARTICLE_LENGTH = {
  /** Cible si le dossier est suffisamment riche. */
  minWordsRich: 700,
  /** Cible assouplie si coverage faible. */
  minWordsThin: 400,
  /**
   * Plancher dur : en dessous = échec.
   * Entre softAcceptMin et minWords* : accepté avec warning (évite fallback legacy absurde).
   */
  softAcceptMin: 260,
  /** Plancher d'une brève prudente (dossier vide : on ne meuble pas). */
  cautiousMinWords: 200,
  targetMinWords: 700,
  targetMaxWords: 1200,
  hardMaxWords: 2000,
  investigationHardMaxWords: 14000,
  /** Enquête Rempart+ : dossier payant, plancher dur 3000, cible 4000+. */
  investigationMinWords: 3000,
  investigationTargetMin: 4000,
  investigationTargetMax: 9000,
} as const;

/**
 * Règles absolues — on n'invente pas ; on n'écrit pas un inventaire des trous.
 */
export const WRITING_HARD_RULES = [
  "Travailler exclusivement à partir du ResearchDossier fourni.",
  "Ne jamais inventer dates, chiffres, citations, institutions ou motivations.",
  "Ne jamais inventer un média, un titre d'article ou une URL : seules les sources listées dans le dossier peuvent être citées.",
  "Ne jamais inventer un nom de personne ni une étiquette politique absente du dossier.",
  "Nommer systématiquement ce que le dossier nomme : personnes (nom + fonction), organisations, lieux, montants exacts, dates.",
  "Attribuer les révélations au média qui les a publiées quand le dossier l'indique.",
  "Ne jamais transformer une rumeur en fait. Une info hors dossier : on l'omet, on n'écrit pas un paragraphe sur l'absence.",
  "Ne jamais lancer de recherche ni consulter d'autres sources que le dossier.",
  "Les faits restent le socle ; la lecture politique de droite est tissée tout au long de l'article (phrase d'analyse après un bloc de faits), jamais réservée au dernier paragraphe.",
  "Commentaire de droite : pertinent, habile, argumenté, percutant. INTERDIT l'invective bête, le réac gratuit, le plaisir de taper sur la gauche ou le gouvernement sans argument.",
  "Les citations verbatim du dossier s'écrivent en italique Markdown : *« … »*.",
  "Chaque paragraphe doit apporter une information nouvelle ou un argument nouveau.",
  "Dossier vide ou trop faible : écrire une brève courte, jamais un article d'opinion sans faits.",
] as const;

/**
 * Angle enquête = angle flash Facebook : raconter l'affaire, pas grader les preuves.
 */
export const INVESTIGATION_ANGLE_RULES = [
  "Même ligne que le FLASH INFO Facebook : faits nommés + lecture politique tissée dans chaque section. Pas un audit académique.",
  "Une enquête qui sort raconte ce qui tient. INTERDIT de passer le texte à dire que les trois quarts ne sont pas prouvés.",
  "INTERDIT H2 et formules : « ce qui est établi », « ce qui ne l'est pas », « ce qui manque pour trancher », « rien ne permet de l'affirmer », « nous ne savons pas », « aucune donnée n'a été trouvée », « non retrouvé dans les sources ouvertes », « ce que l'on ne sait pas encore », « à cette heure, rien ne permet de confirmer ».",
  "Si une piste du brief n'est pas dans le dossier : on n'écrit PAS ce chapitre. On n'explique PAS l'absence.",
  "INTERDIT d'étiqueter le texte publié (document / hypothèse / inconnu / contradictoire) à chaque phrase.",
  "Même si le brief a un FORMAT FINAL du type « ce qui n'est pas établi » : ignorer ces sections, rédiger l'affaire.",
] as const;

export const CONFIDENCE_VOCAB = {
  confirmed: ["Selon…", "Les documents indiquent que…", "D'après…"],
  probable: [
    "Selon plusieurs sources…",
    "D'après des éléments convergents…",
  ],
  contested: [
    "X affirme… Y conteste…",
    "Les récits divergent…",
  ],
  unverifiable: [
    "NE PAS ÉCRIRE cette information. Pas de paragraphe « on ne sait pas ».",
  ],
} as const;

const DROP_HEADING_RE =
  /ce que l['’]on ne sait|ce qu['’]on ne sait|ce qui manque (pour|encore)|pour trancher|reste inconnu|n['’]est pas (encore )?v[ée]rifi|ce qui ne l['’]est pas|zones? d['’]ombre|limites de (l['’]enqu[êe]te|ce que)|non retrouv/i;

const ESTABLISHED_HEADING_RE = /^ce qui est [ée]tabli\b/i;

export function isInvestigationDropHeading(title: string): boolean {
  return DROP_HEADING_RE.test(title.replace(/^#+\s*/, "").trim());
}

export function isInvestigationHedgeHeading(title: string): boolean {
  const t = title.replace(/^#+\s*/, "").trim();
  return DROP_HEADING_RE.test(t) || ESTABLISHED_HEADING_RE.test(t);
}

export function rewriteInvestigationHeading(title: string): string {
  const t = title.replace(/^#+\s*/, "").trim();
  if (!ESTABLISHED_HEADING_RE.test(t)) return t;
  const rest = t
    .replace(/^ce qui est [ée]tabli\s*[—–:\-]\s*/i, "")
    .trim();
  return rest.length >= 8 ? rest : "Les faits";
}

/** Retire les chapitres « on ne sait pas » ; renomme « ce qui est établi ». */
export function sanitizeInvestigationMarkdown(content: string): string {
  const parts = content.split(/(?=^##\s+)/m);
  const out: string[] = [];
  for (const part of parts) {
    const m = part.match(/^##\s+(.+)$/m);
    if (!m) {
      if (part.trim()) out.push(part);
      continue;
    }
    const heading = m[1]!.trim();
    if (isInvestigationDropHeading(heading)) continue;
    const rewritten = rewriteInvestigationHeading(heading);
    out.push(
      rewritten === heading
        ? part
        : part.replace(/^##\s+.+$/m, `## ${rewritten}`),
    );
  }
  return out.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}
