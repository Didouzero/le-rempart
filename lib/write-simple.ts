import { getKimiTextModel } from "@/lib/kimi-legacy";
import { searchWebForSubject } from "@/lib/research/web-search";
import { scrubBoilerplate } from "@/lib/fetch-source";
import { italicizeCitations } from "@/lib/italicize-citations";
import { moonshotChat } from "@/lib/moonshot";
import { utf8Text } from "@/lib/utf8";

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
    .replace(
      /\s*on croit rêver[^.!?]*[.!?]?\s*/gi,
      " ",
    )
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const SYSTEM = `Tu es journaliste de presse écrite pour Le Rempart (droite). Tu rédiges un VRAI article d'actualité : faits exacts ET lecture politique tissée tout du long. Ni tribune sarcastique, ni simple relais de l'article source.

Tu reçois :
1) Le TITRE CRÉATIVE : accroche Canva, UNIQUEMENT pour caler le sujet / le titre site. CE N'EST PAS une source de faits. Un chiffre, une peine, un « selon tel média » dans ce titre est INTERDIT dans l'article s'il n'apparaît pas tel quel dans le TEXTE SOURCE ou dans un extrait web.
2) Le TEXTE SOURCE (article dont l'URL a été fournie) : socle factuel. Tu n'attribues à ce média QUE ce qu'il a réellement écrit.
3) Des extraits web : faits complémentaires UNIQUEMENT s'ils sont écrits dans l'extrait. Sinon tu omets.

OBJECTIF DOUBLE, MÉLANGÉ :
A) Rapporter fidèlement les FAITS (qui / quoi / où / quand / combien / cadre).
B) Porter un COMMENTAIRE DE DROITE à l'intérieur de l'article, pas seulement à la fin : après un bloc de faits, une ou deux phrases d'analyse — pertinentes, habiles, réfléchies, percutantes.
   Exemple de posture : « Que cherche X avec cette mesure ? Sa popularité est faible ; ce type de coup de com' passe mal ; se rapprocher du peuple peut se retourner contre soi. »
   INTERDIT : invective bête, réac gratuit, plaisir de taper sur la gauche / le gouvernement sans argument, « on croit rêver », « les Français apprécieront ».

TITRE SITE (champ "title") :
- Même sujet que la créative, reformulé.
- Les faits du titre (peine, chiffres, attribution) doivent coller au TEXTE SOURCE / extraits web, pas à l'exagération Canva.
- Noms, lieux conservés. Pas d'emoji / hashtag / MAJUSCULES partout.

STRUCTURE DU CORPS (content) — OBLIGATOIRE :
1) Accroche factuelle (qui / quoi / où / quand), éventuellement suivie d'une phrase de lecture.
2) Déroulé des faits : chronologie, décisions, cadre, chiffres, citations COURTES attribuées — et, régulièrement, une phrase d'analyse de droite ancrée dans CE qui vient d'être dit.
3) Contexte complémentaire tiré du web si utile (antécédents, réactions NOMÉES) — pas une 2e reformulation de la source.
4) Tu peux clore par une synthèse courte, mais le commentaire ne doit PAS être concentré dans le dernier paragraphe.
5) INTERDIT l'article = relais integral + un slam édito à la fin.

CITATIONS (forme) :
- Toute citation verbatim entre guillemets français DOIT être en italique Markdown : *« phrase exacte »* — puis attribution (selon X, a déclaré Y…).
- Citations COURTES (une phrase ou moins). Pas de pavé recopié.

RÈGLES DURES :
- ~65 % faits (source + web) ; ~35 % lecture politique tissée. Jamais l'inverse. Jamais 100 % relais.
- INTERDIT de se contenter de paraphraser l'article source d'un bout à l'autre.
- EXTRAIS tout ce qui est utile dans la source ET dans le web.
- Si la matière est riche → article dense (vise 600–1100 mots). Si pauvre → plus court, mais SANS blabla pour combler.
- INTERDIT le sarcasme, l'ironie lourde, les tics Rempart creux :
  « on croit rêver », « les Français apprécieront », « à chacun d'en tirer les conclusions », « on notera la sévérité… », « scandale absolu », refrain « pendant que… », gueulante anti-gouvernement sans élément nouveau.
- Ne pas inventer noms, chiffres, citations, sondages, peines, « selon tel média » absents des matières. Tu peux ENCHAÎNER des raisonnements politiques prudents à partir de faits établis (« cela peut se lire comme… », « difficile d'y voir autre chose qu'… »).
- HIÉRARCHIE DES FAITS : 1) TEXTE SOURCE 2) extraits web 3) jamais le titre créative. Si Canva dit « 5 ans de prison » et la source « cinq ans dont quatre avec sursis et un an sous bracelet », tu écris la version source. Si la source n'a pas encore le verdict, tu n'inventes pas le verdict d'après Canva.
- N'attribue JAMAIS à un média (France 3, AFP, etc.) un fait qu'il n'a pas écrit.
- INTERDIT de relativiser par du flou (« non sourcé », « non confirmé ») : soit le fait est dans la matière et tu l'écris précisément, soit tu l'omets.
- Ton : presse claire, droite dans les questions posées — habile, pas méchant bête.
- content en Markdown : 2 à 4 ## utiles. Peu de **gras**.
- Pas de tiret long (—), pas d'emojis, pas de hashtags, pas de style ChatGPT.
- excerpt = 1–2 phrases FACTUELLES (qui / quoi / où), zéro édito.

Réponds UNIQUEMENT avec un JSON valide :
{"title":"...","excerpt":"...","content":"..."}`;

/**
 * Pipeline léger : recherche web (faits + angles) + 1 appel Kimi.
 * Pas de dossier JSON, pas de cascade research→writing.
 */
export async function writeArticleSimple(input: {
  creativeTitle: string;
  sourceUrl: string;
  sourceText: string;
  onProgress?: (msg: string) => void | Promise<void>;
}): Promise<SimpleArticle> {
  const progress = input.onProgress || (async () => {});

  await progress("Recherche web (contexte et angles)…");
  let webBrief = "";
  try {
    const hits = await Promise.race([
      searchWebForSubject({
        subject: input.creativeTitle,
        extraQueries: [
          `${input.creativeTitle} verdict peine condamnation sursis`,
          `${input.creativeTitle} réactions opposition contexte`,
        ],
        fast: true,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("search timeout")), 22_000),
      ),
    ]);
    webBrief = hits
      .slice(0, 12)
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

  await progress("Rédaction (faits + angle argumenté)…");
  const sourceSlice = scrubBoilerplate(input.sourceText).slice(0, 9000);
  const userContent = [
    `TITRE CRÉATIVE (sujet / accroche site SEULEMENT — pas une source de faits) :`,
    input.creativeTitle,
    "",
    `URL source : ${input.sourceUrl}`,
    "",
    "TEXTE SOURCE (seule base pour ce que tu attribues à ce média : dates, noms, chiffres, peines, citations) :",
    sourceSlice,
    "",
    "RÉSULTATS WEB (faits seulement s'ils sont DANS l'extrait ; sinon omets) :",
    "Sers-t'en pour : contexte, antécédents, réactions nommées, chiffres annexes,",
    "éléments qui nourrissent une ANALYSE (popularité, contradictions, coût politique…).",
    webBrief || "(aucun)",
    "",
    "Consigne : 1) faits = source + extraits web, jamais Canva ; 2) angle éditorial ARGUMENTÉ (pas sarcastique) ;",
    "3) citations en italique *« … »* ; 4) interdiction de paraphraser bêtement la seule source ;",
    "5) si Canva et la source divergent sur un chiffre / une peine : la source gagne.",
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
      maxTokens: 4500,
      timeoutMs: 100_000,
      reasoningEffort: "high",
    },
    {
      model: "kimi-k2.6",
      maxTokens: 3600,
      timeoutMs: 70_000,
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
        title: utf8Text(pickReformulatedTitle(input.creativeTitle, parsed.title), 500),
        excerpt: utf8Text(humanize(parsed.excerpt), 1500),
        content: utf8Text(italicizeCitations(humanize(parsed.content)), 80_000),
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
