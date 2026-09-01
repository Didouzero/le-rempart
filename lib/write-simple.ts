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
      /\b(Il convient de noter que|Il est important de (noter|souligner) que|Dans un contexte où|En conclusion,?|Cela étant dit,?|On notera (que|également)?|Il faut (bien )?le reconnaître,?|Force est de constater que)\s*/gi,
      "",
    )
    .replace(
      /\s*Les Français apprécieront[^.!?]*[.!?]?\s*/gi,
      " ",
    )
    .replace(
      /\s*(À chacun d'en tirer|Chacun en tirera)[^.!?]*[.!?]?\s*/gi,
      " ",
    )
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const SYSTEM = `Tu es journaliste de presse écrite pour Le Rempart (droite dure). Tu rédiges un VRAI article d'actualité : densément FACTUEL, pas un édito, pas un billet d'humeur.

Tu reçois :
1) Le TITRE CRÉATIVE (faits établis — à prendre comme VRAIS)
2) Le texte scrapé de l'article SOURCE (matière principale — à exploiter à fond)
3) Des résultats web complémentaires (autres détails, noms, chiffres, réactions)

OBJECTIF : un développement journalistique. Le lecteur doit apprendre des FAITS à chaque paragraphe.

TITRE SITE (champ "title") :
- Même faits / même angle que la créative, reformulé (pas recopié mot pour mot).
- Noms, lieux, chiffres conservés. Pas d'emoji / hashtag / MAJUSCULES partout.

STRUCTURE DU CORPS (content) — OBLIGATOIRE :
1) Accroche factuelle (qui / quoi / où / quand).
2) Déroulé des faits : chronologie, décisions, cadre (loi, tribunal, ministère…), chiffres, citations COURTES attribuées.
3) Réactions(s) ou élément(s) de contexte NOMÉ(S) si présents dans source ou web.
4) Optionnel : UNE seule phrase d'angle Rempart en toute fin — pas plus. Souvent inutile si les faits parlent.

RÈGLES DURES :
- 85 %+ du texte = FAITS tirés de la source et/ou des résultats web. Dates, montants, âges, peines, lieux, fonctions, institutions, citations.
- EXTRAIS tout ce qui est utile dans la source ET dans le web : ne te contente PAS d'un seul paragraphe de faits puis du remplissage.
- Si la matière est riche → article dense (vise 500–900 mots). Si pauvre → plus court, mais SANS blabla pour combler.
- INTERDIT de gonfler avec des banalités / tics Rempart creux :
  « on notera la sévérité… », « les Français apprécieront », « à chacun d'en tirer les conclusions », « on croit rêver », « scandale absolu » sans fait nouveau, « pendant que… » en refrain, gueulante anti-gouvernement sans élément nouveau.
- INTERDIT l'article = 1 paragraphe de faits + 4 paragraphes d'opinion / ironie / critique générique du pouvoir.
- Ne pas inventer noms, chiffres, citations absents des matières. Si ce n'est pas dans source/web : tu ne l'écris pas.
- Le titre créative fixe les faits centraux : ne les relativise pas (« non sourcé », « non confirmé »…).
- Ton : presse claire, droite dure dans le CHOIX des faits mis en avant — pas dans le volume de râlerie.
- content en Markdown : 2 ou 3 ## factuels (pas « Analyse » / « Ce qu'il faut retenir » creux). Peu de **gras**.
- Pas de tiret long (—), pas d'emojis, pas de hashtags, pas de style ChatGPT.
- excerpt = 1–2 phrases FACTUELLES (qui / quoi / où), zéro édito.

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

  await progress("Recherche web (faits complémentaires)…");
  let webBrief = "";
  try {
    const hits = await Promise.race([
      searchWebForSubject({ subject: input.creativeTitle, fast: true }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("search timeout")), 18_000),
      ),
    ]);
    webBrief = hits
      .slice(0, 10)
      .map(
        (h, i) =>
          `${i + 1}. ${h.title}\n   ${h.url}\n   ${(h.snippet || "").slice(0, 520)}`,
      )
      .join("\n\n");
  } catch (err) {
    console.error("writeArticleSimple search skipped", err);
    webBrief =
      "(recherche web indisponible — exploite la source à fond, sans inventer)";
  }

  await progress("Rédaction factuelle de l'article…");
  const sourceSlice = scrubBoilerplate(input.sourceText).slice(0, 9000);
  const userContent = [
    `TITRE CRÉATIVE (faits établis — reformule pour le titre site, ne recopie pas) :`,
    input.creativeTitle,
    "",
    `URL source : ${input.sourceUrl}`,
    "",
    "TEXTE SOURCE (à EXTRAIRE à fond : dates, noms, chiffres, citations, déroulé) :",
    sourceSlice,
    "",
    "RÉSULTATS WEB (faits complémentaires à INTÉGRER s'ils enrichissent, sans inventer) :",
    webBrief || "(aucun)",
    "",
    "Consigne : article JOURNALISTIQUE dense en faits.",
    "INTERDIT : blabla de remplissage, gueulante générique, « les Français apprécieront », « on notera… ».",
    "Si la matière le permet : plusieurs paragraphes de faits concrets (pas un seul).",
    "Rédige title + excerpt + content maintenant.",
  ].join("\n");

  const attempts: Array<{
    model: string;
    maxTokens: number;
    timeoutMs: number;
    reasoningEffort?: "low" | "high" | "max";
  }> = [
    {
      model: getKimiTextModel(),
      maxTokens: 3600,
      timeoutMs: 80_000,
      reasoningEffort: "low",
    },
    {
      model: "kimi-k2.6",
      maxTokens: 2800,
      timeoutMs: 60_000,
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
