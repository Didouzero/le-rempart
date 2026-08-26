import { getKimiTextModel } from "@/lib/kimi-legacy";
import { searchWebForSubject } from "@/lib/research/web-search";
import { scrubBoilerplate } from "@/lib/fetch-source";
import { moonshotChat } from "@/lib/moonshot";

export type SimpleArticle = {
  title: string;
  excerpt: string;
  content: string;
};

/**
 * Titre site = titre créative (lisibilité), jamais une réécriture Kimi.
 * Majuscules Canva → casse phrase ; on conserve le sens mot pour mot.
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

function parseJsonArticle(raw: string): { excerpt: string; content: string } {
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
  const excerpt = String(obj.excerpt || "").trim();
  const content = String(obj.content || "").trim();
  if (excerpt.length < 20 || content.length < 200) {
    throw new Error("Réponse rédaction trop courte");
  }
  return {
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
1) Le TITRE CRÉATIVE (fait établi par la rédaction — à prendre comme VRAI)
2) Le texte scrapé de l'article source (matière principale)
3) Quelques résultats web complémentaires (contexte)

Tu rédiges UNIQUEMENT le chapô (excerpt) et le corps (content). Le titre est imposé ailleurs : ne le réécris pas.

RÈGLES :
- Le titre créative EST la ligne éditoriale des faits. N'écris JAMAIS « non sourcé », « non vérifié », « selon des informations non confirmées », « impossible de confirmer », « à cette heure rien ne prouve » pour relativiser ce que dit le titre. Si le titre l'affirme, tu l'affirmes.
- Base-toi surtout sur l'article source. Les résultats web = contexte utile seulement.
- Ne pas inventer de citations, chiffres ou noms absents des matières fournies. Enrichir avec le web OK si c'est dans les snippets.
- Longueur content : vise 400 à 800 mots. Moins si peu de matière, un peu plus si beaucoup. INTERDIT de broder dans le vide pour faire du volume.
- Ton Rempart : faits denses d'abord, ironie / jugement ensuite (pas une gueulante sans faits).
- content en Markdown : 2 ou 3 sous-titres ##, paragraphes humains, un peu de **gras** (pas des phrases entières).
- Pas de tiret long (—), pas d'emojis, pas de hashtags, pas de style ChatGPT (« Il convient de noter… »).
- excerpt = 1–2 phrases d'accroche factuelles (qui / quoi / où), pas un édito.

Réponds UNIQUEMENT avec un JSON valide :
{"excerpt":"...","content":"..."}`;

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
  const title = titleFromCreative(input.creativeTitle);
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
  const userContent = [
    `TITRE CRÉATIVE (faits établis — titre du site = version lisible de celui-ci) :`,
    input.creativeTitle,
    "",
    `Titre publié (ne pas modifier) : ${title}`,
    "",
    `URL source : ${input.sourceUrl}`,
    "",
    "TEXTE SOURCE (matière principale) :",
    scrubBoilerplate(input.sourceText).slice(0, 10000),
    "",
    "RÉSULTATS WEB COMPLÉMENTAIRES :",
    webBrief || "(aucun)",
    "",
    "Rédige excerpt + content maintenant.",
  ].join("\n");

  const raw = await moonshotChat({
    model: getKimiTextModel(),
    maxTokens: 3500,
    timeoutMs: 45_000,
    reasoningEffort: "low",
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userContent },
    ],
  });

  const parsed = parseJsonArticle(raw);
  return {
    title,
    excerpt: humanize(parsed.excerpt),
    content: humanize(parsed.content),
  };
}
