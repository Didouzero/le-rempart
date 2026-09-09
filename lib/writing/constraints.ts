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
 * Règles absolues — le Writing Agent ne comble jamais les trous.
 */
export const WRITING_HARD_RULES = [
  "Travailler exclusivement à partir du ResearchDossier fourni.",
  "Ne jamais inventer dates, chiffres, citations, institutions ou motivations.",
  "Ne jamais inventer un média, un titre d'article ou une URL : seules les sources listées dans le dossier peuvent être citées.",
  "Ne jamais inventer un nom de personne ni une étiquette politique absente du dossier.",
  "Nommer systématiquement ce que le dossier nomme : personnes (nom + fonction), organisations, lieux, montants exacts, dates.",
  "Attribuer les révélations au média qui les a publiées quand le dossier l'indique.",
  "Ne jamais reformuler une hypothèse comme un fait établi.",
  "Si une information manque : le dire explicitement, et ne pas la remplacer par une généralité.",
  "Respecter confirmed / probable / contested / unverifiable dans le vocabulaire.",
  "Ne jamais lancer de recherche ni consulter d'autres sources que le dossier.",
  "Les faits restent le socle ; la lecture politique de droite est tissée tout au long de l'article (phrase d'analyse après un bloc de faits), jamais réservée au dernier paragraphe.",
  "Commentaire de droite : pertinent, habile, argumenté, percutant. INTERDIT l'invective bête, le réac gratuit, le plaisir de taper sur la gauche ou le gouvernement sans argument.",
  "Les citations verbatim du dossier s'écrivent en italique Markdown : *« … »*.",
  "Chaque paragraphe doit apporter une information nouvelle ou un argument nouveau.",
  "Dossier vide ou trop faible : écrire une brève courte et prudente, jamais un article d'opinion sans faits.",
] as const;

export const CONFIDENCE_VOCAB = {
  confirmed: ["Selon…", "Il est établi que…", "Les documents indiquent que…"],
  probable: [
    "Selon plusieurs sources…",
    "Il semblerait que…",
    "D'après des éléments convergents…",
  ],
  contested: [
    "Cette version est contestée…",
    "Les récits divergent…",
    "Point contesté :…",
  ],
  unverifiable: [
    "Cette information n'a pas pu être vérifiée…",
    "À cette heure, rien ne permet de confirmer…",
  ],
} as const;
