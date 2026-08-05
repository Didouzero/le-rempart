/**
 * Variantes de structure pour casser l'effet template.
 * L'ordre logique reste : faits → contexte → explications → réactions → précédents → conséquences → analyse.
 * Mais les titres, le rythme et le placement de certains blocs varient.
 */

export type StructureVariant = {
  id: string;
  label: string;
  /** Suggestion de plan (titres indicatifs, non figés). */
  suggestedPlan: string[];
  openingHint: string;
  closingHint: string;
};

const VARIANTS: StructureVariant[] = [
  {
    id: "classic_brief",
    label: "Déroulé classique",
    suggestedPlan: [
      "Chapô factuel",
      "Les faits",
      "Ce que l'on sait",
      "Pourquoi c'est important",
      "Le contexte",
      "Les réactions",
      "Précédents",
      "Conséquences",
      "Analyse du Rempart",
      "Conclusion",
    ],
    openingHint: "Ouvre sur le fait le plus concret (qui / quoi / quand).",
    closingHint: "Termine sur l'enjeu qui reste ouvert, sans slogan.",
  },
  {
    id: "chrono_first",
    label: "Chronologie d'abord",
    suggestedPlan: [
      "Chapô",
      "Comment on en est arrivé là",
      "Les faits établis",
      "Le cadre (politique / juridique)",
      "Réactions",
      "Ce qui change",
      "Analyse du Rempart",
    ],
    openingHint: "Ouvre par un jalon de chronologie précis, puis élargis.",
    closingHint: "Referme sur la conséquence concrète pour le lecteur / le contribuable.",
  },
  {
    id: "question_driven",
    label: "Piloté par les questions naïves",
    suggestedPlan: [
      "Chapô",
      "De quoi parle-t-on ?",
      "Pourquoi maintenant ?",
      "Que dit le cadre ?",
      "Qui dit quoi ?",
      "Quels précédents ?",
      "Analyse du Rempart",
    ],
    openingHint: "Ouvre en posant la question naïve la plus utile du dossier, puis réponds avec les faits.",
    closingHint: "Termine en listant ce qui reste inconnu (missingInformation).",
  },
  {
    id: "stakes_bridge",
    label: "Enjeux puis faits",
    suggestedPlan: [
      "Chapô",
      "Pourquoi cette affaire compte",
      "Les faits",
      "Acteurs et responsabilités",
      "Contexte et droit",
      "Réactions et divergences",
      "Analyse du Rempart",
    ],
    openingHint: "Après un chapô factuel court, enchaîne sur l'importance (dossier.importance) AVANT l'analyse.",
    closingHint: "Conclusion courte : enjeu + ce qui manque encore.",
  },
  {
    id: "actors_map",
    label: "Carte des acteurs",
    suggestedPlan: [
      "Chapô",
      "Qui fait quoi",
      "La séquence des faits",
      "Le contexte",
      "Réactions",
      "Précédents",
      "Analyse du Rempart",
    ],
    openingHint: "Ouvre en cartographiant 2–4 acteurs clés et leur rôle précis.",
    closingHint: "Referme sur qui assume (ou non) les conséquences.",
  },
];

/** Choisit une variante de façon déterministe mais variée selon le sujet. */
export function pickStructureVariant(subject: string): StructureVariant {
  let hash = 0;
  for (let i = 0; i < subject.length; i += 1) {
    hash = (hash * 31 + subject.charCodeAt(i)) >>> 0;
  }
  // Léger bruit temporel pour que deux sujets proches ne tombent pas toujours pareil.
  const salt = Math.floor(Date.now() / (1000 * 60 * 30)); // change ~toutes les 30 min
  const idx = (hash + salt) % VARIANTS.length;
  return VARIANTS[idx]!;
}

export function listStructureVariants(): StructureVariant[] {
  return VARIANTS;
}
