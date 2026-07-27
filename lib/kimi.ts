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
- Article de longueur moyenne : 5 à 7 paragraphes substantiels (vise ~300 à 400 mots). Ni flash de 3 phrases, ni pavé de 800 mots.
- Structure OBLIGATOIRE du content Markdown : exactement 2 ou 3 sous-titres ## (courts, sans numérotation).
- Gras (**comme ceci**) sur 8 à 15 mots ou expressions impactants. Jamais une phrase entière en gras.
- INTERDIT les articles génériques / templates : pas de "Le titre pose un fait précis", pas de "Nous reviendrons sur ce dossier dès que des précisions". Chaque phrase doit parler DU sujet nommé dans le titre.
- INTERDIT le tiret long (—) et le tiret demi-cadratin (–). Utilise plutôt une virgule, un point, deux-points, ou des parenthèses.
- INTERDIT le style ChatGPT : pas de "Il convient de noter", "Dans un contexte où", "Il est important de souligner", "En conclusion", "Cela dit", listes de trois adjectifs en série, formules toutes faites, symétrie parfaite des paragraphes.
- Pas d'emojis. N'inclus JAMAIS de consignes internes / brief Telegram / créative Canva.
- L'article DOIT porter UNIQUEMENT sur le titre fourni.
- Tu peux recevoir un "Briefing presse récente". Utilise-le pour ancrer le contexte d'actualité (ex. si le briefing parle d'incendies / feux de forêt, "la France brûle" = incendies, PAS des émeutes). INTERDIT d'inventer une autre crise nationale non mentionnée dans le titre ni dans le briefing.
- Réponds UNIQUEMENT avec un JSON valide :
{"title":"...","excerpt":"...","content":"..."}
- excerpt = 1 ou 2 phrases d'accroche FACTUELLES (qui / quoi / où). Pas de sarcasme anti-médias, pas de "pendant que…", pas de couplet éditorial. L'angle critique va dans le corps de l'article, pas dans le chapô.`;

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

function countWords(text: string): number {
  return text
    .replace(/##\s+/g, " ")
    .replace(/\*\*/g, "")
    .split(/\s+/)
    .filter(Boolean).length;
}

function fallbackArticle(
  title: string,
  briefing?: string,
): GeneratedArticle {
  const clean = titleCaseNews(title).slice(0, 160) || "Actualité";
  const facts = (briefing || "")
    .replace(/Briefing presse récente\s*:?/i, "")
    .trim()
    .slice(0, 900);

  const lead = facts
    ? `**${clean}**. D'après les éléments qui circulent côté presse : ${facts.split(/\n+/).filter(Boolean).slice(0, 2).join(" ")}`
    : `**${clean}**. Le dossier s'impose dans l'actualité, et le décalage entre l'urgence du terrain et la communication officielle saute aux yeux.`;

  return {
    title: clean,
    excerpt: `${clean} : les faits connus à cette heure.`,
    content: [
      lead,
      `## Ce qui se passe`,
      facts
        ? `Les faits rapportés ne laissent guère de place au storytelling. ${facts.split(/\n+/).filter(Boolean).slice(2, 5).join(" ") || "La séquence met en lumière une gestion à chaud, entre communication de crise et réalité du terrain."}`
        : `Sur le fond, le titre dit l'essentiel : une situation qui déborde, des responsables qui s'en défendent mal, et une opinion qui n'a plus la patience des éléments de langage.`,
      `## Le décalage qui crispe`,
      `Quand le pays regarde une crise en direct, chaque phrase de ministre est passée au crible. Dire être "dépassé" n'est pas un détail de style : c'est un aveu politique, immédiatement lu comme un signe de faiblesse ou d'impréparation.`,
      `## Ce que ça révèle`,
      `Le Rempart y voit surtout un révélateur : la distance entre ceux qui commentent depuis Paris et ceux qui subissent sur le terrain. Tant que l'État répond par la posture plutôt que par des moyens et une ligne claire, la défiance ne fera que monter.`,
      `## La suite`,
      `Le dossier reste ouvert. Chaque nouvelle information, chaque bilan, chaque annonce budgétaire viendra confirmer ou contredire cette impression d'un exécutif à la traîne, toujours sur **ce** sujet, pas un autre.`,
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

  const words = countWords(content);
  if (words < 220) {
    throw new Error(`Article trop court (${words} mots)`);
  }

  // Interdit le vieux template générique
  if (
    /Le titre pose un fait précis\. Sans enjoliver/i.test(content) ||
    /Nous reviendrons sur ce dossier dès que des précisions, confirmations ou démentis/i.test(
      content,
    )
  ) {
    throw new Error("Article générique détecté");
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
    `Produis un article de presse COMPLET (~300–400 mots, 5 à 7 paragraphes) UNIQUEMENT sur ce titre.
OBLIGATOIRE : faits, contexte, angle critique Rempart, 2 ou 3 sous-titres ##.
INTERDIT : article générique, phrases creuses, filler type "le titre pose un fait précis".
Ancre-toi sur le briefing presse s'il est fourni.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const attempts: Array<{
    timeoutMs: number;
    maxTokens: number;
    model?: string;
  }> = [
    { timeoutMs: 45_000, maxTokens: 1600 },
    { timeoutMs: 50_000, maxTokens: 1800 },
    { timeoutMs: 40_000, maxTokens: 1600, model: "kimi-k2.6" },
  ];

  let lastErr: unknown;
  for (const attempt of attempts) {
    try {
      const raw = await moonshotChat({
        model: attempt.model || getKimiTextModel(),
        maxTokens: attempt.maxTokens,
        timeoutMs: attempt.timeoutMs,
        reasoningEffort: attempt.model ? undefined : "low",
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

  console.error("Kimi unavailable after retries, using briefing fallback", lastErr);
  return fallbackArticle(headline, newsBriefing);
}
