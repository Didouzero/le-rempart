import { moonshotChat } from "@/lib/moonshot";
import { fetchNewsContextBriefing } from "@/lib/news-context";
import { withTimeout } from "@/lib/with-timeout";

/** Modèles dispo sur le compte Moonshot ; surcharge possible via env. */
export function getKimiTextModel(): string {
  // k3 + reasoning low : rédaction fiable ~15–25s (k2.6 timeout souvent sur articles longs)
  return process.env.KIMI_MODEL || "kimi-k3";
}

export function getKimiVisionModels(): string[] {
  const primary =
    process.env.KIMI_VISION_MODEL || process.env.KIMI_MODEL || "kimi-k2.6";
  return [...new Set([primary, "kimi-k2.6"])];
}

export type GeneratedArticle = {
  title: string;
  excerpt: string;
  content: string;
};

const SYSTEM_PROMPT = `Tu es journaliste pour Le Rempart, média d'actualité français clairement ancré à droite.

Ligne éditoriale :
- Ton provocateur, sarcastique, parfois aigri. Tu dénonces l'incompétence, le gaspillage, l'absurde administratif et le deux poids deux mesures.
- Orienté droite politiquement : défense du contribuable, méfiance envers la bureaucratie, l'État central, les élites technocratiques et le progressisme de façade.
- Factuel sur le fond (pas de fake news inventées), angle et vocabulaire tranchants, ironiques, jamais "neutres AFP".
- Tu peux souligner le ridicule sans devenir vulgaire ni complotiste.

Forme (écrire comme un humain de presse, PAS comme une IA) :
- Vrai article de presse français, rythme irrégulier : phrases courtes et phrases plus longues mélangées.
- Titre clair et percutant (pas tout en majuscules sauf acronymes).
- Article de longueur moyenne : 4 à 6 paragraphes substantiels (vise ~300 à 400 mots). Ni flash de 3 phrases, ni pavé de 800 mots.
- Structure OBLIGATOIRE du content Markdown : exactement 2 ou 3 sous-titres ## (courts, sans numérotation).
- Gras (**comme ceci**) sur 8 à 15 mots ou expressions impactants. Jamais une phrase entière en gras.
- INTERDIT le tiret long (—) et le tiret demi-cadratin (–). Utilise plutôt une virgule, un point, deux-points, ou des parenthèses.
- INTERDIT le style ChatGPT : pas de "Il convient de noter", "Dans un contexte où", "Il est important de souligner", "En conclusion", "Cela dit", listes de trois adjectifs en série, formules toutes faites, symétrie parfaite des paragraphes.
- Pas d'emojis. N'inclus JAMAIS de consignes internes / brief Telegram / créative Canva.
- L'article DOIT porter UNIQUEMENT sur le titre fourni.
- Tu peux recevoir un "Briefing presse récente". Utilise-le pour ancrer le contexte d'actualité (ex. si le briefing parle d'incendies / feux de forêt, "la France brûle" = incendies, PAS des émeutes). INTERDIT d'inventer une autre crise nationale non mentionnée dans le titre ni dans le briefing.
- Réponds UNIQUEMENT avec un JSON valide :
{"title":"...","excerpt":"...","content":"..."}
- excerpt = 1 ou 2 phrases d'accroche (ton sarcastique possible).`;

/** Nettoie les tics typographiques / formulations trop "IA". */
function humanizeCopy(text: string): string {
  return text
    .replace(/\u2014/g, ",") // —
    .replace(/\u2013/g, ",") // –
    .replace(/\s+—\s+/g, ", ")
    .replace(/\s+–\s+/g, ", ")
    .replace(/\s*,\s*,+/g, ", ")
    .replace(
      /\b(Il convient de noter que|Il est important de (noter|souligner) que|Dans un contexte où|En conclusion,?|Cela étant dit,?|Il va sans dire que)\s*/gi,
      "",
    )
    .replace(/ {2,}/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "le",
  "la",
  "les",
  "un",
  "une",
  "des",
  "de",
  "du",
  "au",
  "aux",
  "et",
  "ou",
  "en",
  "dans",
  "sur",
  "pour",
  "par",
  "avec",
  "sans",
  "mais",
  "pas",
  "plus",
  "que",
  "qui",
  "dont",
  "est",
  "sont",
  "a",
  "ont",
  "se",
  "ce",
  "ces",
  "son",
  "sa",
  "ses",
  "leur",
  "leurs",
  "selon",
  "contre",
  "entre",
  "vers",
  "chez",
  "après",
  "avant",
  "désormais",
  "aussi",
  "comme",
  "tout",
  "tous",
  "toute",
  "toutes",
]);

function titleCaseNews(title: string): string {
  const t = title.trim().replace(/\s+/g, " ");
  if (t !== t.toUpperCase()) return t;
  // Évite les titres SCREAMING issus de l'OCR Canva
  const lower = t.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Mots significatifs du titre (noms propres, montants, etc.). */
function significantTokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9€\s.-]/gi, " ")
    .split(/[\s./-]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

function articleMatchesHeadline(headline: string, content: string): boolean {
  const tokens = significantTokens(headline);
  if (tokens.length === 0) return true;
  const body = content
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const hits = tokens.filter((t) => body.includes(t)).length;
  // Au moins 2 ancres du titre, ou 1 si le titre est très court
  return hits >= Math.min(2, tokens.length);
}

function fallbackArticle(title: string): GeneratedArticle {
  const clean = titleCaseNews(title).slice(0, 160) || "Actualité";
  return {
    title: clean,
    excerpt: `${clean} : un dossier qui mérite d'être regardé de près.`,
    content: [
      `**${clean}**. L'information, telle qu'elle circule, soulève des questions de fond sur la responsabilité publique et le sentiment de deux poids deux mesures.`,
      `## Ce que l'on retient`,
      `Le titre pose un fait précis. Sans enjoliver ni inventer d'autres affaires, c'est déjà suffisant pour comprendre pourquoi le sujet crispe : argent public, privilèges perçus, et une opinion qui n'en peut plus des arrangements.`,
      `## Pourquoi ça fâche`,
      `Quand une partie du pays peine à tenir son budget, ce type d'annonce cristallise la colère. Le Rempart y voit surtout un révélateur : la distance entre ceux qui décident et ceux qui paient.`,
      `## La suite`,
      `Nous reviendrons sur ce dossier dès que des précisions, confirmations ou démentis officiels permettront d'aller plus loin. Toujours sur **ce** sujet, pas un autre.`,
    ].join("\n\n"),
  };
}

function parseArticleJson(raw: string, headline: string): GeneratedArticle {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Réponse Kimi non JSON");
  const parsed = JSON.parse(jsonMatch[0]) as Partial<GeneratedArticle>;
  if (!parsed.title || !parsed.content || !parsed.excerpt) {
    throw new Error("JSON Kimi incomplet");
  }

  const content = humanizeCopy(String(parsed.content).trim());
  // Garde-fou : si le modèle a quand même collé le brief interne
  if (
    /créative visuelle|brief Telegram|Contexte :|Rédige un article/i.test(
      content,
    )
  ) {
    throw new Error("Article contaminé par le prompt");
  }

  if (!articleMatchesHeadline(headline, content)) {
    throw new Error("Article hors-sujet par rapport au titre");
  }

  return {
    title: humanizeCopy(titleCaseNews(String(parsed.title))),
    excerpt: humanizeCopy(String(parsed.excerpt).trim()),
    content,
  };
}

export async function generateArticleFromSource(input: {
  title: string;
  sourceText?: string;
  sourceUrl?: string;
}): Promise<GeneratedArticle> {
  const headline = titleCaseNews(input.title);

  if (!process.env.MOONSHOT_API_KEY) {
    return fallbackArticle(headline);
  }

  let newsBriefing = "";
  try {
    newsBriefing = await withTimeout(
      fetchNewsContextBriefing(headline),
      10_000,
      "Timeout veille actu",
    );
  } catch (err) {
    console.error("news briefing skipped", err);
  }

  const userContent = [
    `Titre / accroche à développer en article :`,
    headline,
    input.sourceUrl ? `Lien utile : ${input.sourceUrl}` : null,
    newsBriefing || null,
    input.sourceText &&
    !/créative visuelle|brief Telegram|Rédige un article/i.test(
      input.sourceText,
    )
      ? `Notes factuelles complémentaires :\n${input.sourceText.slice(0, 3000)}`
      : null,
    `Produis un article complet (~300–400 mots, 4–6 paragraphes) UNIQUEMENT sur ce titre. Si un briefing presse est fourni, ancre le contexte d'actu dessus (sans inventer une autre crise). Inclus 2 ou 3 sous-titres ## dans le content.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const attempts: Array<{ timeoutMs: number; maxTokens: number }> = [
    { timeoutMs: 40_000, maxTokens: 1400 },
    { timeoutMs: 45_000, maxTokens: 1500 },
  ];

  let lastErr: unknown;
  for (const attempt of attempts) {
    try {
      const raw = await moonshotChat({
        model: getKimiTextModel(),
        maxTokens: attempt.maxTokens,
        timeoutMs: attempt.timeoutMs,
        reasoningEffort: "low",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      });
      return parseArticleJson(raw, headline);
    } catch (err) {
      lastErr = err;
      console.error("Kimi generate attempt failed", err);
    }
  }

  // Dernier essai : k2.6 sans thinking (parfois plus réactif)
  try {
    const raw = await moonshotChat({
      model: "kimi-k2.6",
      maxTokens: 1400,
      timeoutMs: 35_000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    });
    return parseArticleJson(raw, headline);
  } catch (err) {
    lastErr = err;
    console.error("Kimi k2.6 fallback failed", err);
  }

  console.error("Kimi unavailable after retries, using improved fallback", lastErr);
  return fallbackArticle(headline);
}
