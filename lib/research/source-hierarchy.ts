import type { SourceDocument, SourceType } from "@/lib/research/types";

/**
 * Hiérarchie source-first (du plus fiable au moins fiable).
 * Influence ranking, confidence des sources et scores du dossier.
 */
export type SourceTier =
  | 1 // Documents officiels
  | 2 // Communiqués
  | 3 // Décisions de justice
  | 4 // Rapports
  | 5 // Déclarations publiques
  | 6 // Vidéos officielles
  | 7 // Agences de presse
  | 8 // Presse généraliste
  | 9 // Réseaux sociaux vérifiés
  | 10; // Réseaux sociaux non vérifiés

export const SOURCE_TIER_LABELS: Record<SourceTier, string> = {
  1: "document officiel",
  2: "communiqué",
  3: "décision de justice",
  4: "rapport",
  5: "déclaration publique",
  6: "vidéo officielle",
  7: "agence de presse",
  8: "presse généraliste",
  9: "réseau social vérifié",
  10: "réseau social non vérifié",
};

const OFFICIAL_HOST_RE =
  /\.(gouv\.fr|legifrance\.gouv\.fr|vie-publique\.fr|assemblee-nationale\.fr|senat\.fr|conseil-constitutionnel\.fr|insee\.fr|service-public\.fr|elysee\.fr|europa\.eu|courdecassation\.fr|conseil-etat\.fr)(?:\/|$)/i;

const AGENCY_RE =
  /reuters|afp\.com|apnews|associated press|bloomberg|dpa\.com/i;

const PRESS_RE =
  /lemonde|lefigaro|liberation|lesechos|franceinfo|francetvinfo|leparisien|mediapart|publicsenat|lopinion|lepoint|lexpress|20minutes|ouest-france|la-croix/i;

const SOCIAL_RE = /twitter\.com|x\.com|facebook\.com|instagram\.com|tiktok\.com|youtube\.com|t\.me\//i;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function haystack(url: string, publisher?: string, title?: string): string {
  return `${hostOf(url)} ${publisher || ""} ${title || ""}`.toLowerCase();
}

/**
 * Estime le tier d'une source. Plus le chiffre est bas, plus la source est prioritaire.
 */
export function estimateSourceTier(input: {
  url: string;
  publisher?: string;
  title?: string;
  type?: SourceType;
}): SourceTier {
  const h = haystack(input.url, input.publisher, input.title);
  const host = hostOf(input.url);

  if (
    OFFICIAL_HOST_RE.test(host) ||
    /\.gouv\.fr$/i.test(host) ||
    /legifrance|vie-publique|service-public/.test(h)
  ) {
    if (/communiqu[eé]|press release/.test(h)) return 2;
    if (/arr[eê]t|d[eé]cision|jugement|ordonnance|cassation/.test(h)) return 3;
    if (/rapport|report/.test(h)) return 4;
    return 1;
  }

  if (/courdecassation|conseil-etat|tribunal|justice\.gouv/.test(h)) return 3;
  if (/rapport|insee|cour des comptes/.test(h)) return 4;
  if (/youtube\.com.*(elysee|gouvernement|assemblee|senat)/.test(h)) return 6;
  if (AGENCY_RE.test(h)) return 7;
  if (PRESS_RE.test(h) || input.type === "secondary") {
    if (SOCIAL_RE.test(host)) return 9;
    return 8;
  }
  if (SOCIAL_RE.test(host)) {
    if (/v[eé]rifi[eé]|verified|compte officiel/.test(h)) return 9;
    return 10;
  }
  if (input.type === "official" || input.type === "primary") return 2;
  if (input.type === "social") return 10;
  return 8;
}

/** Confidence 0–1 dérivée du tier (source-first). */
export function confidenceFromTier(tier: SourceTier): number {
  const map: Record<SourceTier, number> = {
    1: 0.97,
    2: 0.94,
    3: 0.96,
    4: 0.92,
    5: 0.85,
    6: 0.84,
    7: 0.88,
    8: 0.72,
    9: 0.55,
    10: 0.35,
  };
  return map[tier];
}

/** Score de ranking pour la sélection (plus haut = mieux). */
export function rankingScoreFromTier(tier: SourceTier): number {
  return (11 - tier) * 10;
}

/** Source jugée assez fiable pour une passe d'enrichissement. */
export function isReliableSource(doc: SourceDocument): boolean {
  const tier = estimateSourceTier(doc);
  const excerptLen = doc.excerpt?.length || 0;
  // Scrape complet OU snippet de recherche suffisamment long.
  const usable =
    (doc.scraped && excerptLen > 280) || (!doc.scraped && excerptLen > 120);
  return tier <= 8 && usable;
}

export function enrichSourceWithTier(doc: SourceDocument): SourceDocument {
  const tier = estimateSourceTier(doc);
  return {
    ...doc,
    tier,
    type:
      tier <= 4
        ? tier === 2
          ? "primary"
          : "official"
        : tier >= 9
          ? "social"
          : doc.type === "primary" || doc.type === "official"
            ? doc.type
            : "secondary",
    confidence: Math.max(doc.confidence || 0, confidenceFromTier(tier)),
    notes: [doc.notes, `tier=${tier}:${SOURCE_TIER_LABELS[tier]}`]
      .filter(Boolean)
      .join("; "),
  };
}
