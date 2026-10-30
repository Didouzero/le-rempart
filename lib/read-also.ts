/**
 * Choix de l'encadré « À lire aussi » : le filtre par noms propres présélectionne,
 * Opus lit les sujets et tranche. Mieux vaut pas d'encadré qu'un encadré hors sujet.
 */

import { claudeText, isClaudeConfigured } from "@/lib/claude-fallback";

const MAX_PICKS = 2;

const SYSTEM = `Tu choisis les articles à proposer à un lecteur sous un article du Rempart. Un article n'est retenu que si son sujet prolonge vraiment celui-ci : même affaire, même événement, ou même personne dans un rôle comparable. Partager un nom cité en passant, une date ou un thème général ne suffit pas. Si aucun ne convient, n'en retiens aucun : c'est la réponse la plus fréquente.

Réponds UNIQUEMENT avec un JSON : {"ids":[...]}, deux numéros au plus, du plus pertinent au moins pertinent.`;

export function parseReadAlsoChoice(raw: string, allowed: number[]): number[] {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return [];
  const { ids } = JSON.parse(m[0]) as { ids?: unknown };
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map(Number))]
    .filter((id) => allowed.includes(id))
    .slice(0, MAX_PICKS);
}

export async function chooseReadAlso<T extends { publicId: number; title: string; excerpt: string }>(
  article: { title: string; excerpt: string },
  candidates: T[],
): Promise<T[]> {
  if (!candidates.length || !isClaudeConfigured()) return [];
  const raw = await claudeText({
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `ARTICLE :\n${article.title}\n${article.excerpt}\n\nCANDIDATS :\n${candidates
          .map((c) => `${c.publicId}. ${c.title}\n${c.excerpt}`)
          .join("\n\n")}`,
      },
    ],
    maxTokens: 300,
    timeoutMs: 60_000,
  });
  const ids = parseReadAlsoChoice(raw, candidates.map((c) => c.publicId));
  return ids.map((id) => candidates.find((c) => c.publicId === id)!);
}
