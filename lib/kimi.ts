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

Mission (priorité absolue) :
- INFORMER d'abord, commenter ensuite. Ce n'est PAS une tribune de râlerie sans faits.
- Chaque article doit transmettre des précisions concrètes : dates ou périodes, institutions (Conseil constitutionnel, Parlement, tribunal, ministère…), cadre juridique (loi, code, censure, vide juridique…), chiffres, lieux, noms, et citations entre guillemets quand elles figurent dans le briefing ou les notes.
- Si le briefing / les notes mentionnent une durée (ex. du 1er au 23 juillet, 23 jours), une décision, un texte de loi, un magistrat ou une citation : tu DOIS les reprendre dans l'article (reformulés, pas en pavé recopié).
- L'indignation Rempart (sarcasme, critique de l'incurie) vient APRÈS ou AUTOUR des faits, jamais à la place. Interdit de n'écrire qu'une "gueulante" générique ("on croit rêver", "trahison", "scandale") sans les éléments qui la justifient.
- Ne pas inventer de dates, citations, chiffres ou institutions absents des sources. Si une précision manque, rester prudent ("selon la presse", "à cette heure").

Ligne éditoriale :
- Ton provocateur, sarcastique, parfois aigri, mais ancré dans le réel.
- Orienté droite : défense du contribuable, méfiance envers la bureaucratie, l'État central, les élites technocratiques et le progressisme de façade.
- Factuel sur le fond (pas de fake news), vocabulaire tranchant, jamais "neutre AFP".
- Pas vulgaire, pas complotiste.

Forme (écrire comme un humain de presse, PAS comme une IA) :
- Vrai article de presse français, rythme irrégulier : phrases courtes et phrases plus longues mélangées.
- Titre clair et percutant (pas tout en majuscules sauf acronymes).
- Longueur : 5 à 7 paragraphes substantiels (vise ~350 à 450 mots). Ni flash de 3 phrases, ni pavé de 800 mots.
- Structure OBLIGATOIRE du content Markdown : exactement 2 ou 3 sous-titres ## (courts, sans numérotation). Au moins une section doit coller aux faits / au déroulé ; une autre peut porter l'angle critique.
- Gras (**comme ceci**) sur 8 à 15 mots ou expressions impactants. Jamais une phrase entière en gras.
- Au moins 4 ancrages concrets dans le corps (date ou durée, institution, chiffre, citation, nom propre juridique, lieu… selon ce que fournissent les sources).
- INTERDIT de répéter le même paragraphe, la même accroche ou le même bloc de phrases deux fois.
- INTERDIT les articles génériques / templates : pas de "Le titre pose un fait précis", pas de "Nous reviendrons sur ce dossier dès que des précisions". Chaque phrase doit parler DU sujet nommé dans le titre.
- INTERDIT le tiret long (—) et le tiret demi-cadratin (–). Utilise plutôt une virgule, un point, deux-points, ou des parenthèses.
- INTERDIT le style ChatGPT : pas de "Il convient de noter", "Dans un contexte où", "Il est important de souligner", "En conclusion", "Cela dit", listes de trois adjectifs en série, formules toutes faites, symétrie parfaite des paragraphes.
- Pas d'emojis. N'inclus JAMAIS de consignes internes / brief Telegram / créative Canva.
- L'article DOIT porter UNIQUEMENT sur le titre fourni.
- Tu peux recevoir un "Briefing presse récente" (souvent des titres d'articles). Mine-le : les titres contiennent déjà des faits (durée, acte, lieu). Ancre le contexte national sur CES faits. INTERDIT d'inventer une autre crise non mentionnée dans le titre ni dans le briefing.
- Réponds UNIQUEMENT avec un JSON valide :
{"title":"...","excerpt":"...","content":"..."}
- excerpt = 1 ou 2 phrases d'accroche FACTUELLES (qui / quoi / où / quand si connu). Pas de sarcasme anti-médias, pas de "pendant que…", pas de couplet éditorial. L'angle critique va dans le corps, pas dans le chapô.`;

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

function normalizeParaKey(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\*\*/g, "")
    .replace(/^#+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Supprime paragraphes / accroches dupliqués (bug fréquent du modèle). */
function dedupeParagraphs(content: string): string {
  const parts = content.split(/\n\n+/);
  const seen: string[] = [];
  const out: string[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = normalizeParaKey(trimmed);
    if (!key) continue;

    const isHeading = /^##\s/.test(trimmed);
    const duplicate = seen.some((prev) => {
      if (prev === key) return true;
      if (isHeading || prev.startsWith("##")) return false;
      if (prev.length < 60 || key.length < 60) return false;
      const shorter = prev.length <= key.length ? prev : key;
      const longer = prev.length > key.length ? prev : key;
      return longer.includes(shorter) && longer.length - shorter.length < 50;
    });

    if (duplicate) continue;
    seen.push(key);
    out.push(trimmed);
  }

  return out.join("\n\n");
}

/** Repères concrets déjà présents dans briefing / notes, à forcer dans l'article. */
function extractConcreteHints(...chunks: Array<string | undefined>): string {
  const text = chunks.filter(Boolean).join("\n");
  if (!text.trim()) return "";

  const hints = new Set<string>();
  const pushAll = (re: RegExp) => {
    for (const m of text.matchAll(re)) {
      const v = m[0]?.trim();
      if (v && v.length >= 3) hints.add(v);
    }
  };

  pushAll(
    /\b\d{1,2}(?:er)?\s+(?:janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)(?:\s+\d{4})?\b/gi,
  );
  pushAll(/\b(?:du|des?)\s+\d{1,2}(?:er)?\s+au\s+\d{1,2}(?:er)?\s+\w+/gi);
  pushAll(/\b\d+\s+jours?\b/gi);
  pushAll(
    /\b(?:Conseil constitutionnel|Parlement|Assemblée nationale|Sénat|Code de la justice pénale des mineurs|détention provisoire|vide juridique)\b/gi,
  );
  pushAll(/«[^»]{10,140}»/g);
  pushAll(/"[^"]{10,140}"/g);

  if (hints.size === 0) return "";
  return [
    "Précisions déjà présentes dans le briefing / les notes (à intégrer dans l'article si pertinentes, sans en inventer d'autres) :",
    ...[...hints].slice(0, 12).map((h) => `- ${h}`),
  ].join("\n");
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

  const factLines = facts
    .split(/\n+/)
    .map((l) => l.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);

  const lead = factLines[0]
    ? `**${clean}**. Les éléments qui circulent côté presse sont précis : ${factLines[0]}`
    : `**${clean}**. Voici ce que l'on sait à cette heure, avant toute posture.`;

  return {
    title: clean,
    excerpt: `${clean} : les faits connus à cette heure.`,
    content: dedupeParagraphs(
      [
        lead,
        `## Les faits`,
        factLines.length > 1
          ? factLines.slice(1, 5).join(" ")
          : `Sur le fond, le titre dit l'essentiel. Les détails publiés par la presse doivent être lus sans filtre ni élément de langage.`,
        `## Ce que ça révèle`,
        `Derrière la séquence, une question simple : qui assume les trous dans la raquette, et qui en paie le prix sur le terrain ? Le Rempart refuse de s'en tenir à l'indignation creuse : sans dates, sans cadre, sans responsables nommés, la colère ne sert à rien.`,
        `## La suite`,
        `Le dossier reste ouvert. Chaque confirmation, démenti ou décision nouvelle devra être confrontée à **ces** faits, pas à un autre débat inventé.`,
      ].join("\n\n"),
    ),
  };
}

function parseArticleJson(raw: string, headline: string): GeneratedArticle {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Réponse Kimi non JSON");
  const parsed = JSON.parse(jsonMatch[0]) as Partial<GeneratedArticle>;
  if (!parsed.title || !parsed.content || !parsed.excerpt) {
    throw new Error("JSON Kimi incomplet");
  }

  const content = dedupeParagraphs(
    humanizeCopy(String(parsed.content).trim()),
  );
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

  // Interdit le vieux template générique / la pure gueulante sans ancrage
  if (
    /Le titre pose un fait précis\. Sans enjoliver/i.test(content) ||
    /Nous reviendrons sur ce dossier dès que des précisions, confirmations ou démentis/i.test(
      content,
    )
  ) {
    throw new Error("Article générique détecté");
  }

  const rantOnly =
    /on croit rêver|ou plutôt cauchemarder/i.test(content) &&
    !/\d|janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|conseil constitutionnel|parlement|«|"/i.test(
      content,
    );
  if (rantOnly) {
    throw new Error("Article trop rhétorique, pas assez factuel");
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

  const notes =
    input.sourceText &&
    !/créative visuelle|brief Telegram|Rédige un article/i.test(
      input.sourceText,
    )
      ? input.sourceText.slice(0, 4500)
      : "";

  const concreteHints = extractConcreteHints(newsBriefing, notes);

  const userContent = [
    `Titre / accroche à développer en article :`,
    headline,
    input.sourceUrl ? `Lien utile : ${input.sourceUrl}` : null,
    newsBriefing || null,
    notes ? `Notes factuelles complémentaires :\n${notes}` : null,
    concreteHints || null,
    `Produis un article de presse COMPLET (~350–450 mots, 5 à 7 paragraphes) UNIQUEMENT sur ce titre.
PRIORITÉ : rapporter les précisions factuelles du briefing/notes (dates, durées, décisions, cadre juridique, citations, chiffres), PUIS l'angle critique Rempart.
OBLIGATOIRE : au moins 4 ancrages concrets, 2 ou 3 sous-titres ##, dont une section factuelle.
INTERDIT : gueulante sans faits, paragraphes en double, filler creux, faits inventés.
Ancre-toi sur le briefing presse s'il est fourni : mine aussi les titres (ils contiennent souvent la durée, l'acte, l'institution).`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const attempts: Array<{
    timeoutMs: number;
    maxTokens: number;
    model?: string;
  }> = [
    { timeoutMs: 50_000, maxTokens: 2000 },
    { timeoutMs: 55_000, maxTokens: 2200 },
    { timeoutMs: 45_000, maxTokens: 1800, model: "kimi-k2.6" },
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
