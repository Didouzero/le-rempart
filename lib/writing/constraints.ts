/**
 * Contraintes du Writing Agent — rédacteur en chef, pas générateur de texte.
 */

/** Densité informative : pas d'allongement artificiel. */
export const ARTICLE_LENGTH = {
  /** Cible haute si le dossier est suffisamment riche. */
  minWordsRich: 900,
  /** Cible assouplie si coverage faible. */
  minWordsThin: 450,
  /**
   * Plancher dur : en dessous = échec.
   * Entre softAcceptMin et minWords* : accepté avec warning (évite fallback legacy absurde).
   */
  softAcceptMin: 350,
  targetMinWords: 1200,
  targetMaxWords: 1800,
  hardMaxWords: 2200,
} as const;

/**
 * Règles absolues — le Writing Agent ne comble jamais les trous.
 */
export const WRITING_HARD_RULES = [
  "Travailler exclusivement à partir du ResearchDossier fourni.",
  "Ne jamais inventer dates, chiffres, citations, institutions ou motivations.",
  "Ne jamais reformuler une hypothèse comme un fait établi.",
  "Si une information manque : le dire explicitement.",
  "Respecter confirmed / probable / contested / unverifiable dans le vocabulaire.",
  "Ne jamais lancer de recherche ni consulter d'autres sources que le dossier.",
  "Les faits d'abord ; l'angle Rempart ensuite (transitions, mise en perspective, conclusion).",
  "Chaque paragraphe doit apporter une information nouvelle.",
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
