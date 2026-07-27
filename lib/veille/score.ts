import { sanitizeCreativeTitle } from "@/lib/creative/title-fix";
import { moonshotChat } from "@/lib/moonshot";
import { getKimiTextModel } from "@/lib/kimi";
import type { VeilleHit } from "@/lib/veille/scrape";
import {
  fallbackVisualQueries,
  isVisualQueryCredible,
} from "@/lib/visual-queries";

export type ScoredStory = {
  sourceTitle: string;
  sourceUrl?: string;
  score: number;
  canvaTitle: string;
  highlightWords: string[];
  visualQuery: string;
  reason: string;
};

/**
 * Kimi choisit LA meilleure news FRAÎCHE et rédige un titre Canva
 * pensé pour 4–5 lignes Impact équilibrées + requête visuelle.
 */
export async function scoreAndPickStory(
  hits: VeilleHit[],
  opts?: { excludeTitles?: string[] },
): Promise<ScoredStory | null> {
  const excludeTitles = new Set(
    (opts?.excludeTitles || []).map((t) => t.toLowerCase().trim()),
  );

  const filtered = hits.filter((h) => {
    const title = h.title.toLowerCase().trim();
    if (excludeTitles.has(title)) return false;
    for (const ex of excludeTitles) {
      if (ex.length >= 20 && (title.includes(ex.slice(0, 40)) || ex.includes(title.slice(0, 40)))) {
        return false;
      }
    }
    return true;
  });

  if (filtered.length === 0) return null;

  const list = filtered
    .slice(0, 18)
    .map((h, i) => {
      const age = h.publishedAt
        ? `${Math.round((Date.now() - h.publishedAt.getTime()) / 36e5)}h`
        : "?";
      return `${i + 1}. [${age}] ${h.title}${h.source ? ` (${h.source})` : ""}${h.link ? ` | ${h.link}` : ""}`;
    })
    .join("\n");

  if (!process.env.MOONSHOT_API_KEY) {
    const h = filtered[0];
    return {
      sourceTitle: h.title,
      sourceUrl: h.link,
      score: 60,
      canvaTitle: h.title.toUpperCase().slice(0, 160),
      highlightWords: h.title
        .split(/\s+/)
        .filter((w) => w.length >= 6)
        .slice(0, 5),
      visualQuery: "french police night street arrest",
      reason: "fallback sans Kimi",
    };
  }

  try {
    const raw = await moonshotChat({
      model: getKimiTextModel(),
      maxTokens: 650,
      timeoutMs: 28_000,
      reasoningEffort: "low",
      messages: [
        {
          role: "system",
          content: `Tu es éditeur du média Le Rempart (droite radicale, putaclic politique français).
Parmi des brèves DÉJÀ FILTRÉES (<36h), choisis LA plus engageante (actu chaude du jour, pas un vieux fait divers sportif recyclé).
INTERDIT : recycler une polémique de coupe du monde / match ancien / sujet daté de plus d'une semaine.

Réponds UNIQUEMENT en JSON :
{"index":1,"score":0-100,"canvaTitle":"...","highlightWords":["..."],"visualQuery":"english photo keywords","reason":"court"}

Règles canvaTitle (OBLIGATOIRE) :
- MAJUSCULES, sans emoji, 18 à 28 mots (assez de matière pour remplir 4–5 lignes)
- Orthographe FR correcte : apostrophes (L'AGRESSEUR, D'UN, QU'IL), accents (INTERPELLÉ, BLESSÉS, ARRÊTÉ, ÉMEUTE, ÉVÉNEMENTS)
- pensé pour EXACTEMENT 4 ou 5 lignes Impact : chaque ligne ~26–38 caractères, largeurs VISUELLES quasi égales
- INTERDIT une ligne courte isolée ("SEULEMENT 10", "AU MAROC", un seul chiffre, un seul mot court)
- INTERDIT "L AGRESSEUR" (mettre L'AGRESSEUR) ; INTERDIT "INTERPELLE" participe sans accent (INTERPELLÉ)
- regroupe les idées en blocs denses du type "À PEINE DIX INTERPELLATIONS" plutôt que "SEULEMENT 10" / "INTERPELLATIONS"
- style choc Rempart

highlightWords : 4 à 7 mots forts du titre (or #ffbd59).
visualQuery : 4–8 mots ANGLAIS pour photo réaliste choc du MÊME sujet.
  Faits divers / arme / terreur / interpellation → OBLIGATOIREMENT police/arrest (ex. "french riot police night arrest street").
  Incendies → wildfire/flames. INTERDIT : book, texture, abstract, map, logo, cartoon.`,
        },
        {
          role: "user",
          content: `Date du jour (Paris) : ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}\nBrèves :\n${list}\n\nChoisis la meilleure ACTU DU MOMENT.`,
        },
      ],
    });

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as {
      index?: number;
      score?: number;
      canvaTitle?: string;
      highlightWords?: string[];
      visualQuery?: string;
      reason?: string;
    };

    const idx = (parsed.index || 1) - 1;
    const hit = filtered[Math.max(0, Math.min(filtered.length - 1, idx))];
    const score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
    if (score < 60) return null;

    const canvaTitle = sanitizeCreativeTitle(
      (parsed.canvaTitle || hit.title).slice(0, 220),
    );

    const rawVisual = (parsed.visualQuery || "").trim().slice(0, 120);
    const visualQuery = isVisualQueryCredible(rawVisual, canvaTitle)
      ? rawVisual
      : fallbackVisualQueries(canvaTitle)[0] ||
        "french riot police night arrest street";

    return {
      sourceTitle: hit.title,
      sourceUrl: hit.link,
      score,
      canvaTitle,
      highlightWords: (parsed.highlightWords || []).slice(0, 8),
      visualQuery,
      reason: parsed.reason || "",
    };
  } catch (err) {
    console.error("scoreAndPickStory failed", err);
    return null;
  }
}
