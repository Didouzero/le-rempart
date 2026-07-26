import { moonshotChat } from "@/lib/moonshot";
import { getKimiTextModel } from "@/lib/kimi";
import type { VeilleHit } from "@/lib/veille/scrape";

export type ScoredStory = {
  sourceTitle: string;
  sourceUrl?: string;
  score: number;
  canvaTitle: string;
  highlightWords: string[];
  reason: string;
};

/**
 * Kimi choisit LA meilleure news putaclic / trigger droite et rédige un titre Canva.
 */
export async function scoreAndPickStory(
  hits: VeilleHit[],
): Promise<ScoredStory | null> {
  if (hits.length === 0) return null;

  const list = hits
    .slice(0, 18)
    .map(
      (h, i) =>
        `${i + 1}. ${h.title}${h.source ? ` (${h.source})` : ""}${h.link ? ` | ${h.link}` : ""}`,
    )
    .join("\n");

  if (!process.env.MOONSHOT_API_KEY) {
    const h = hits[0];
    return {
      sourceTitle: h.title,
      sourceUrl: h.link,
      score: 60,
      canvaTitle: h.title.toUpperCase().slice(0, 160),
      highlightWords: h.title
        .split(/\s+/)
        .filter((w) => w.length >= 6)
        .slice(0, 5),
      reason: "fallback sans Kimi",
    };
  }

  try {
    const raw = await moonshotChat({
      model: getKimiTextModel(),
      maxTokens: 500,
      timeoutMs: 25_000,
      reasoningEffort: "low",
      messages: [
        {
          role: "system",
          content: `Tu es éditeur du média Le Rempart (droite radicale, putaclic politique français).
Parmi une liste de brèves, choisis LA plus engageante pour une audience de droite (colère, deux poids deux mesures, immigration, fiscalité, élites, insécurité, wokisme, justice laxiste).
Réponds UNIQUEMENT en JSON :
{"index":1,"score":0-100,"canvaTitle":"TITRE CANVA EN MAJUSCULES PERCUTANT","highlightWords":["MOT1","MOT2"],"reason":"court"}
canvaTitle : style flash info Facebook, 12 à 22 mots, sans emoji, prêt pour une créative Impact.
highlightWords : 3 à 6 mots du titre à mettre en or (noms propres, verbes forts).`,
        },
        {
          role: "user",
          content: `Brèves :\n${list}\n\nChoisis la meilleure.`,
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
      reason?: string;
    };

    const idx = (parsed.index || 1) - 1;
    const hit = hits[Math.max(0, Math.min(hits.length - 1, idx))];
    const score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
    if (score < 55) return null;

    return {
      sourceTitle: hit.title,
      sourceUrl: hit.link,
      score,
      canvaTitle: (parsed.canvaTitle || hit.title).toUpperCase().slice(0, 200),
      highlightWords: (parsed.highlightWords || []).slice(0, 8),
      reason: parsed.reason || "",
    };
  } catch (err) {
    console.error("scoreAndPickStory failed", err);
    return null;
  }
}
