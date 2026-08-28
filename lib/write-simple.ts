import { getKimiTextModel } from "@/lib/kimi-legacy";
import { searchWebForSubject } from "@/lib/research/web-search";
import { scrubBoilerplate } from "@/lib/fetch-source";
import { moonshotChat } from "@/lib/moonshot";

export type SimpleArticle = {
  title: string;
  excerpt: string;
  content: string;
};

const TITLE_STOPWORDS = new Set([
  "dans",
  "pour",
  "avec",
  "sans",
  "sous",
  "chez",
  "vers",
  "apres",
  "avant",
  "selon",
  "entre",
  "contre",
  "depuis",
  "pendant",
  "alors",
  "aussi",
  "encore",
  "tous",
  "tout",
  "toute",
  "toutes",
  "cette",
  "cet",
  "ces",
  "des",
  "les",
  "une",
  "aux",
  "dont",
  "plus",
  "moins",
  "tres",
  "fait",
  "etre",
  "avoir",
  "sont",
  "etait",
  "comme",
  "mais",
  "donc",
  "quand",
  "quoi",
  "quel",
  "quelle",
]);

/**
 * Normalise la casse d'un titre (Canva SCREAMING → phrase).
 */
export function titleFromCreative(creativeTitle: string): string {
  let t = creativeTitle.replace(/\s+/g, " ").trim();
  if (!t) return "Actualité";

  // Tout en majuscules → phrase normale
  if (t.length > 8 && t === t.toUpperCase() && /[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ]/.test(t)) {
    t = t.toLowerCase();
    t = t.charAt(0).toUpperCase() + t.slice(1);
  } else if (/^[a-zàâäéèêëïîôùûüç]/.test(t)) {
    t = t.charAt(0).toUpperCase() + t.slice(1);
  }

  return t.slice(0, 220);
}

function foldTitle(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9€\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantTitleTokens(text: string): string[] {
  return foldTitle(text)
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !TITLE_STOPWORDS.has(w));
}

/**
 * Accepte une reformulation Kimi si elle reste ancrée sur la créative ;
 * sinon repli = titre créative normalisé.
 */
export function pickReformulatedTitle(
  creativeTitle: string,
  proposed: string | undefined | null,
): string {
  const fallback = titleFromCreative(creativeTitle);
  const candidate = titleFromCreative(String(proposed || ""));
  if (candidate.length < 18 || candidate === "Actualité") return fallback;

  const foldFallback = foldTitle(fallback);
  const foldCandidate = foldTitle(candidate);
  // Identique (casse près) → on garde la créative (pas de faux « changement »)
  if (foldCandidate === foldFallback) return fallback;

  const anchors = significantTitleTokens(fallback);
  if (anchors.length === 0) return candidate;

  const hits = anchors.filter((t) => foldCandidate.includes(t)).length;
  const need = Math.min(2, anchors.length);
  if (hits < need) return fallback;

  // Trop long / hors format titre
  if (candidate.length > 220) return fallback;

  return candidate;
}

function parseJsonArticle(raw: string): {
  title: string;
  excerpt: string;
  content: string;
} {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Réponse rédaction : JSON introuvable");
  }
  const obj = JSON.parse(cleaned.slice(start, end + 1)) as {
    excerpt?: unknown;
    content?: unknown;
    title?: unknown;
  };
  const title = String(obj.title || "").trim();
  const excerpt = String(obj.excerpt || "").trim();
  const content = String(obj.content || "").trim();
  if (excerpt.length < 20 || content.length < 200) {
    throw new Error("Réponse rédaction trop courte");
  }
  return {
    title: title.replace(/\u2014|\u2013/g, ","),
    excerpt: excerpt.replace(/\u2014|\u2013/g, ","),
    content: content.replace(/\u2014|\u2013/g, ","),
  };
}

function humanize(text: string): string {
  return text
    .replace(/\u2014/g, ",")
    .replace(/\u2013/g, ",")
    .replace(
      /\b(Il convient de noter que|Il est important de (noter|souligner) que|Dans un contexte où|En conclusion,?|Cela étant dit,?)\s*/gi,
      "",
    )
    .replace(/ {2,}/g, " ")
    .trim();
}

const SYSTEM = `Tu es journaliste pour Le Rempart, média français ancré à droite, franc, sarcastique quand c'est mérité, mais d'abord INFORMÉ.

Tu reçois :
1) Le TITRE CRÉATIVE (faits établis par la rédaction — à prendre comme VRAIS)
2) Le texte scrapé de l'article source (matière principale)
3) Quelques résultats web complémentaires (contexte)

Tu rédiges : un TITRE DE SITE reformulé, le chapô (excerpt) et le corps (content).

TITRE SITE (champ "title") :
- Même faits, même angle que le titre créative — GROSSO MODO la même chose.
- REFORMULE : autre tournure, synonymes, ordre des mots différent. INTERDIT de recopier le titre créative mot pour mot.
- Garde les noms propres, lieux et chiffres importants s'ils sont dans la créative.
- Une seule phrase d'accroche presse (pas de point final obligatoire), longueur proche de la créative.
- Pas de majuscules partout, pas d'emoji, pas de hashtag.

RÈGLES ARTICLE :
- Le titre créative EST la ligne éditoriale des faits. N'écris JAMAIS « non sourcé », « non vérifié », « selon des informations non confirmées », « impossible de confirmer », « à cette heure rien ne prouve » pour relativiser ce que dit le titre. Si le titre l'affirme, tu l'affirmes.
- Base-toi surtout sur l'article source. Les résultats web = contexte utile seulement.
- Ne pas inventer de citations, chiffres ou noms absents des matières fournies. Enrichir avec le web OK si c'est dans les snippets.
- Longueur content : vise 400 à 800 mots. Moins si peu de matière, un peu plus si beaucoup. INTERDIT de broder dans le vide pour faire du volume.
- Ton Rempart : faits denses d'abord, ironie / jugement ensuite (pas une gueulante sans faits).
- content en Markdown : 2 ou 3 sous-titres ##, paragraphes humains, un peu de **gras** (pas des phrases entières).
- Pas de tiret long (—), pas d'emojis, pas de hashtags, pas de style ChatGPT (« Il convient de noter… »).
- excerpt = 1–2 phrases d'accroche factuelles (qui / quoi / où), pas un édito.

Réponds UNIQUEMENT avec un JSON valide :
{"title":"...","excerpt":"...","content":"..."}`;

/**
 * Pipeline léger : petite recherche web + 1 appel Kimi.
 * Pas de dossier JSON, pas de cascade research→writing.
 */
export async function writeArticleSimple(input: {
  creativeTitle: string;
  sourceUrl: string;
  sourceText: string;
  onProgress?: (msg: string) => void | Promise<void>;
}): Promise<SimpleArticle> {
  const progress = input.onProgress || (async () => {});

  await progress("Petite recherche web (contexte)…");
  let webBrief = "";
  try {
    const hits = await Promise.race([
      searchWebForSubject({ subject: input.creativeTitle, fast: true }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("search timeout")), 12_000),
      ),
    ]);
    webBrief = hits
      .slice(0, 6)
      .map(
        (h, i) =>
          `${i + 1}. ${h.title}\n   ${h.url}\n   ${(h.snippet || "").slice(0, 280)}`,
      )
      .join("\n");
  } catch (err) {
    console.error("writeArticleSimple search skipped", err);
    webBrief = "(recherche web indisponible — rédige à partir de la source seule)";
  }

  await progress("Rédaction de l'article…");
  const sourceSlice = scrubBoilerplate(input.sourceText).slice(0, 6500);
  const userContent = [
    `TITRE CRÉATIVE (faits établis — à reformuler pour le titre site, pas à recopier) :`,
    input.creativeTitle,
    "",
    `URL source : ${input.sourceUrl}`,
    "",
    "TEXTE SOURCE (matière principale) :",
    sourceSlice,
    "",
    "RÉSULTATS WEB COMPLÉMENTAIRES :",
    webBrief || "(aucun)",
    "",
    "Rédige title (reformulé) + excerpt + content maintenant.",
  ].join("\n");

  const attempts: Array<{
    model: string;
    maxTokens: number;
    timeoutMs: number;
    reasoningEffort?: "low" | "high" | "max";
  }> = [
    {
      model: getKimiTextModel(),
      maxTokens: 2800,
      timeoutMs: 70_000,
      reasoningEffort: "low",
    },
    // Secours plus court si le 1er timeout
    {
      model: "kimi-k2.6",
      maxTokens: 2200,
      timeoutMs: 55_000,
    },
  ];

  let lastErr: unknown;
  for (const attempt of attempts) {
    try {
      const raw = await moonshotChat({
        model: attempt.model,
        maxTokens: attempt.maxTokens,
        timeoutMs: attempt.timeoutMs,
        reasoningEffort: attempt.reasoningEffort,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
      });
      const parsed = parseJsonArticle(raw);
      return {
        title: pickReformulatedTitle(input.creativeTitle, parsed.title),
        excerpt: humanize(parsed.excerpt),
        content: humanize(parsed.content),
      };
    } catch (err) {
      lastErr = err;
      console.error("writeArticleSimple attempt failed", attempt.model, err);
      try {
        await progress(`Rédaction lente (${attempt.model}) — nouvel essai…`);
      } catch {
        // ignore
      }
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error("Échec rédaction article");
}
