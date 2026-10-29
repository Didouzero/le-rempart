import { moonshotChat, isKimiContentFilter } from "@/lib/moonshot";
import { scrubBoilerplate, scrubFlashOutput } from "@/lib/fetch-source";
import {
  assertFlashDoesNotNegateThesis,
  assertFlashOnSubject,
  polishFrenchCopy,
  subjectTokens,
} from "@/lib/french-copy";
import { searchWebForSubject } from "@/lib/research/web-search";

const PREFIX = "‼️🇫🇷 𝗙𝗟𝗔𝗦𝗛 𝗜𝗡𝗙𝗢 —";
const MIN_CHARS = 80;
const MIN_WORDS = 90;

export function outletFromUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const map: Record<string, string> = {
      "europe1.fr": "Europe 1",
      "lefigaro.fr": "Le Figaro",
      "lemonde.fr": "Le Monde",
      "lepoint.fr": "Le Point",
      "valeursactuelles.com": "Valeurs Actuelles",
      "bfmtv.com": "BFMTV",
      "francetvinfo.fr": "franceinfo",
      "france3-regions.franceinfo.fr": "France 3",
      "liberation.fr": "Libération",
      "mediacites.fr": "Mediacités",
      "ladepeche.fr": "La Dépêche",
      "leparisien.fr": "Le Parisien",
      "marianne.net": "Marianne",
      "cnews.fr": "CNews",
      "jdd.fr": "JDD",
      "lci.fr": "LCI",
      "rtl.fr": "RTL",
      "jeanmarcmorandini.com": "Jean-Marc Morandini",
      "lamontagne.fr": "La Montagne",
      "lecanardenchaine.fr": "Le Canard enchaîné",
      "canardenchaine.fr": "Le Canard enchaîné",
      "lecanard.fr": "Le Canard enchaîné",
      "ouest-france.fr": "Ouest-France",
      "sudouest.fr": "Sud Ouest",
      "20minutes.fr": "20 Minutes",
      "huffingtonpost.fr": "HuffPost",
      "nouvelobs.com": "L'Obs",
      "lexpress.fr": "L'Express",
      "lesechos.fr": "Les Echos",
      "mediapart.fr": "Mediapart",
      "la-croix.com": "La Croix",
      "rfi.fr": "RFI",
      "ledauphine.com": "Le Dauphiné libéré",
      "laprovence.com": "La Provence",
      "i24news.tv": "i24NEWS",
      "lejdd.fr": "JDD",
      "europe1.fr": "Europe 1",
      "publicsenat.fr": "Public Sénat",
      "tf1info.fr": "TF1 Info",
      "francebleu.fr": "France Bleu",
      "ici.fr": "ici",
      "actu.fr": "Actu.fr",
      "leprogres.fr": "Le Progrès",
      "letelegramme.fr": "Le Télégramme",
      "nicematin.com": "Nice-Matin",
      "lavoixdunord.fr": "La Voix du Nord",
      "lalsace.fr": "L'Alsace",
      "dna.fr": "DNA",
      "midilibre.fr": "Midi Libre",
      "lindependant.fr": "L'Indépendant",
      "ledauphine.fr": "Le Dauphiné libéré",
      "lefigaro.fr": "Le Figaro",
      "boulevard-voltaire.fr": "Boulevard Voltaire",
      "frontieresmedia.fr": "Frontières",
      "causeur.fr": "Causeur",
      "lopinion.fr": "L'Opinion",
      "challenges.fr": "Challenges",
      "capital.fr": "Capital",
      "humanite.fr": "L'Humanité",
      "afp.com": "AFP",
      "reuters.com": "Reuters",
    };
    if (map[host]) return map[host];
    // sous-domaine type region.lamontagne.fr
    for (const [key, label] of Object.entries(map)) {
      if (host.endsWith(`.${key}`) || host === key) return label;
    }
    // Repli : « la-croix.com » → « La Croix ».
    const base = host.split(".").slice(-2, -1)[0] || host;
    return base
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  } catch {
    return null;
  }
}

function stripFlashPrefix(text: string): string {
  return text
    .replace(/^["']|["']$/g, "")
    .replace(/^(‼️\s*)?(🇫🇷\s*)?(𝗙𝗟𝗔𝗦𝗛\s*𝗜𝗡𝗙𝗢|FLASH INFO)\s*[—–:-]?\s*/iu, "")
    .trim();
}

/** Force 3–5 paragraphes lisibles (Facebook). */
function ensureParagraphs(text: string): string {
  const cleaned = text.replace(/\r\n/g, "\n").trim();

  if (/\n\n/.test(cleaned)) {
    return cleaned
      .split(/\n{2,}/)
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n\n");
  }

  const lines = cleaned
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length >= 3) {
    return lines.join("\n\n");
  }

  const sentences = cleaned
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…»])\s+(?=[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ«"])/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length <= 2) return cleaned;

  const targetParas = Math.min(4, Math.max(3, Math.ceil(sentences.length / 2)));
  const perPara = Math.ceil(sentences.length / targetParas);
  const paras: string[] = [];
  for (let i = 0; i < sentences.length; i += perPara) {
    paras.push(sentences.slice(i, i + perPara).join(" "));
  }
  return paras.join("\n\n");
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Coupe à une fin de phrase complète, sans guillemet ouvert ni « … » orphelin. */
function trimToCompleteSentences(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  let cut =
    words.length <= maxWords
      ? text.replace(/\s*…+\s*$/u, "").trim()
      : words.slice(0, maxWords).join(" ");

  if (words.length > maxWords) {
    const endMatch = cut.match(/^([\s\S]*[.!?…])(?:\s+[^.!?…]+)?$/u);
    if (endMatch?.[1] && wordCount(endMatch[1]) >= 80) {
      cut = endMatch[1];
    } else {
      const lastStop = Math.max(
        cut.lastIndexOf(". "),
        cut.lastIndexOf("! "),
        cut.lastIndexOf("? "),
        cut.lastIndexOf("»."),
      );
      if (lastStop > 80) {
        cut = cut.slice(0, lastStop + 1);
      }
    }
  }

  cut = cut.replace(/\s*…+\s*$/u, "").trim();
  const opens = (cut.match(/[«"]/g) || []).length;
  const closes = (cut.match(/[»"]/g) || []).length;
  if (opens > closes) {
    const lastOpen = Math.max(cut.lastIndexOf("«"), cut.lastIndexOf('"'));
    if (lastOpen > 40) {
      cut = cut.slice(0, lastOpen).replace(/[,:]\s*$/, "").trim();
      if (!/[.!?]$/.test(cut)) cut += ".";
    }
  }
  return cut;
}

/** Refuse un flash coupé au milieu d'une phrase (ex. « face à la jeunes »). */
function assertFlashEndsComplete(body: string): void {
  const core = body
    .replace(/\n*\(?\s*Source\s*:[^)]*\)?\s*$/i, "")
    .trim();
  if (!/[.!?…»"']\s*$/u.test(core)) {
    throw new Error(
      `flash coupé en plein milieu (« …${core.slice(-40)} »)`,
    );
  }
  // Mot orphelin / adjectif tronqué typique d'un max_tokens
  if (/\b(la|le|les|des|du|un|une|aux|face|selon|contre|pour)\s*$/i.test(core)) {
    throw new Error("flash tronqué (finit sur un mot-outil)");
  }
}

/** Retire URLs et domaines nus (ex. jeanmarcmorandini.com) du corps du flash. */
function stripUrlsAndBareHosts(text: string): string {
  return text
    .replace(/https?:\/\/[^\s<>"')\]]+/gi, "")
    .replace(
      /\b(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z]{2,}){1,3}\b/gi,
      (host) => {
        if (!/\.[a-z]{2,}$/i.test(host)) return host;
        if (/^(fr|com|org|net|info|eu)$/i.test(host)) return host;
        return "";
      },
    )
    .replace(/\(\s*Source\s*:[^)]*\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .trim();
}

/**
 * Rejette le schéma toxique : §1 faits seuls, §2–3 pur commentaire.
 * Chaque paragraphe doit porter au moins une ancre factuelle.
 */
function assertFlashNotSegregated(body: string): void {
  const paras = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !/^\(?\s*Source\s*:/i.test(p));

  if (paras.length < 3) {
    throw new Error("flash : moins de 3 paragraphes");
  }

  const facty =
    /\d|janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|selon|a déclaré|a annoncé|a condamné|a révélé|révél|fuite|portable|téléphone|tribunal|cour|procureur|ministre|Premier ministre|député|maire|police|gendarme|«|"/i;

  const opinionHeavy =
    /\b(c'est|voilà|encore une fois|deux poids|symbole|révèle une|montre que|difficile de|on voit|on croit|scandale|hypocrisie|à chacun|les français|le contribuable|timing|ironie|prétendent|se comportent)\b/i;

  const editorialOpen =
    /^(l['']affaire ne se limite|cette proportion|cette révélation|le timing|voilà|encore une fois|c['']est (?:donc |là )?l['']|ceux qui légifèrent)/i;

  if (editorialOpen.test(paras[0]!)) {
    throw new Error(
      "flash : 1er paragraphe en édito (doit ouvrir sur le fait concret)",
    );
  }

  let pureOpinionTail = 0;
  for (let i = 0; i < paras.length; i++) {
    const p = paras[i]!;
    const hasFact = facty.test(p);
    const opinion = opinionHeavy.test(p);
    if (!hasFact && opinion) {
      if (i === 0) {
        throw new Error("flash : 1er paragraphe sans fait (interdit)");
      }
      pureOpinionTail += 1;
    }
  }

  if (pureOpinionTail >= 2) {
    throw new Error(
      "flash : paragraphes 2–3 en pur commentaire (faits et angle doivent s'entremêler)",
    );
  }

  const later = paras.slice(1);
  const laterWithoutFact = later.filter((p) => !facty.test(p)).length;
  if (laterWithoutFact >= 2) {
    throw new Error(
      "flash : suite sans faits (interdit : §1 faits / §2–3 édito)",
    );
  }
}

/** §1 doit reprendre au moins un ancrage du titre (nom propre / fait clé). */
function assertFlashLeadAnchored(title: string, body: string): void {
  const tokens = subjectTokens(title);
  if (tokens.length === 0) return;
  const first =
    body
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)[0] || "";
  const folded = first
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const hit = tokens.some((t) => folded.includes(t));
  if (!hit) {
    throw new Error(
      `flash : 1er § hors accroche (attendu : ${tokens.slice(0, 3).join(", ")})`,
    );
  }
}

const SYSTEM_PROMPT = `Tu rédiges le FLASH INFO Facebook pour Le Rempart — média de droite, argumenté.

THÈSE — PRIORITÉ ABSOLUE (plus important que n'importe quelle source) :
- L'ACCROCHE CANVA est la THÈSE du flash : ce que Le Rempart affirme / met en avant.
- Tu DOIS écrire DANS LE SENS de cette accroche. INTERDIT de la contredire, de la « corriger », de dire « en réalité ce n'est pas… », « contrairement à ce qu'on croit… », « ce n'est pas un accident… » si l'accroche dit le contraire.
- Si un article de référence (Telegraph, Yahoo, etc.) dit L'INVERSE de l'accroche : IGNORE ce passage. Cherche dans la matière web / notes ce qui CORROBORE l'accroche. Ne relaie JAMAIS la négation.
- Les NOTES DE RECHERCHE (si fournies) sont des directives éditoriales : suis-les pour trouver / formuler l'angle.

OUVERTURE — FAIT D'ABORD :
- La PREMIÈRE phrase doit dire QUI / QUOI / QUAND dans le sens de l'accroche.
- INTERDIT d'ouvrir sur du commentaire (« L'affaire ne se limite pas… », « Cette proportion… », « Le contribuable… », « Le timing… »).

RÈGLE D'OR — ENTREMÊLER, NE JAMAIS SÉPARER :
- CHAQUE paragraphe = faits concrets (qui / quoi / où / quand / citation / réaction NOMÉÉE) + UNE courte lecture de droite tissée DANS le même paragraphe.
- INTERDIT le schéma « §1 = faits seuls, §2 et §3 = critique / édito ».
- INTERDIT un dernier paragraphe qui n'est que du commentaire sans fait nouveau.

FAITS :
- Priorité : NOTES + résultats WEB qui vont DANS LE SENS de l'accroche.
- L'article de référence est SECONDAIRE : utile pour dates/noms/chiffres neutres, JAMAIS pour inverser la thèse.
- INTERDIT d'inventer noms, réactions, citations, chiffres absents de la matière.
- N'attribue un fait à un média que s'il est dans la matière ET que ce média en est l'origine (exclusivité, interview qu'il a menée, propos tenus sur son antenne). Les faits publics (Parlement, déclarations publiques, chiffres officiels, faits connus) s'écrivent sans « rapporte X » ni « selon Y ».

LANGAGE — VARIÉ, PAS DE TICS :
- INTERDIT absolu : « on notera », « on observe », « on remarque », « la méthode est classique », « force est de constater », « il convient de noter ».
- Varie les formulations. Écris comme un journaliste humain, pas un template.

TYPO FRANÇAISE :
- Espace avant les deux-points : « exemple : » (JAMAIS « exemple: »). Idem ; ! ?

LIGNE ÉDITORIALE :
- Public patriote, souverainiste. Tu écris POUR eux.
- Lecture : deux poids deux mesures, coups de com', coût pour le contribuable — argumentée.
- JAMAIS ridiculiser une position patriotique / RN / droite dure.
- INTERDIT « on croit rêver », « les Français apprécieront », « scandale », gueulante gratuite.

STRUCTURE (3 paragraphes, ligne vide entre eux) — CHAQUE § = fait(s) + lecture :
1) Accroche factuelle (qui/quoi) dans le sens de la thèse + lecture.
2) Suite factuelle + lecture.
3) Fait ou conséquence + lecture — PAS un slam isolé.

FORME :
- 110 à 160 mots. Vise ~130–140.
- EXACTEMENT 3 paragraphes (4 max), séparés par UNE LIGNE VIDE (\\n\\n).
- Une ou deux citations courtes max, toujours fermées (« … »).
- Termine par une phrase COMPLÈTE (. ! ? ou »).
- SANS préfixe ‼️🇫🇷 FLASH INFO (ajouté après).
- INTERDIT : emojis, hashtags, markdown, URL, nom de domaine, « Source : » dans le corps.
- N'invente rien. N'écris jamais « non sourcé ».

Réponds UNIQUEMENT avec les 3–4 paragraphes du flash.`;

async function gatherFlashWebBrief(
  title: string,
  researchNotes?: string,
): Promise<string> {
  try {
    const extra = [
      researchNotes?.trim() || "",
      title,
      `${title} révélations OR affaire OR scandale`,
    ].filter(Boolean);
    const hits = await Promise.race([
      searchWebForSubject({
        subject: researchNotes?.trim()
          ? `${title} — ${researchNotes.trim().slice(0, 200)}`
          : title,
        extraQueries: extra.slice(0, 3),
        fast: true,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("flash search timeout")), 18_000),
      ),
    ]);
    if (!hits.length) return "";
    return hits
      .slice(0, 10)
      .map(
        (h, i) =>
          `${i + 1}. ${h.title}\n   ${h.url}\n   ${(h.snippet || "").slice(0, 420)}`,
      )
      .join("\n\n");
  } catch (err) {
    console.error("flash web search skipped", err);
    return "";
  }
}

/**
 * Flash Facebook Rempart. Réessaie Kimi jusqu'à un vrai flash — jamais de texte de secours.
 */
export async function buildFlashInfoText(input: {
  /** Accroche Canva = thèse (pas le titre site reformulé). */
  title: string;
  excerpt: string;
  sourceText?: string;
  sourceUrl?: string;
  articleUrl?: string;
  /** Directives éditoriales Telegram (« trouve des sources qui disent que… »). */
  researchNotes?: string;
  onRetry?: (attempt: number, reason: string) => void | Promise<void>;
}): Promise<string> {
  if (!process.env.MOONSHOT_API_KEY) {
    throw new Error("MOONSHOT_API_KEY manquante — flash Facebook impossible");
  }

  const accroche = (input.title || "").trim();
  const notes = (input.researchNotes || "").trim();
  const webBrief = await gatherFlashWebBrief(accroche, notes || undefined);

  // Web + notes d'abord. Scrape / article = secondaire (souvent angle inverse).
  const excerpt = scrubBoilerplate((input.excerpt || "").trim()).slice(0, 900);
  const scraped = scrubBoilerplate((input.sourceText || "").slice(0, 2200));
  const corpus = scrubBoilerplate(
    [
      notes ? `NOTES ÉDITORIALES (suis-les) :\n${notes}` : "",
      webBrief
        ? `RÉSULTATS WEB (privilégie ce qui CORROBORE l'accroche) :\n${webBrief}`
        : "",
      excerpt
        ? `Extrait site (secondaire — ignore s'il contredit l'accroche) :\n${excerpt}`
        : "",
      scraped
        ? `Article référence (secondaire — IGNORE les passages qui nient / inversent l'accroche) :\n${scraped}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  ).slice(0, 5500);

  const outlet = outletFromUrl(input.sourceUrl);
  const userContent = [
    `ACCROCHE CANVA = THÈSE DU FLASH (écris DANS CE SENS, ne la contredis JAMAIS) :`,
    accroche,
    notes ? `\nNOTES DE RECHERCHE / ANGLE (directives) :\n${notes}` : null,
    outlet
      ? `\nURL de référence fournie (${outlet}) : ne sers-t'en QUE pour faits neutres ; si elle dit l'inverse de l'accroche, ignore cet angle.`
      : null,
    "",
    "Matière :",
    corpus ||
      "(matière web vide — reste dans le sens de l'accroche ; n'invente pas de citations)",
    "",
    "Écris le flash : 3 paragraphes — THÈSE = accroche. INTERDIT de dire que « ce n'est pas » ce que l'accroche affirme.",
    "OBLIGATOIRE : 1re phrase = fait concret (qui/quoi) dans le sens de l'accroche.",
    "INTERDIT : on notera / on observe / la méthode est classique. Typo : espace avant « : ».",
    "Pas d'URL, pas de nom de domaine, pas de « Source : » dans ton texte.",
    "Termine par une phrase COMPLÈTE.",
  ]
    .filter(Boolean)
    .join("\n");

  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      const text = await moonshotChat({
        model: "kimi-k2.6",
        maxTokens: 700,
        timeoutMs: 45_000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      });

      let body = scrubFlashOutput(ensureParagraphs(stripFlashPrefix(text || "")));
      body = ensureParagraphs(stripUrlsAndBareHosts(body));
      body = ensureParagraphs(polishFrenchCopy(body));
      const words = wordCount(body);
      if (body.length < MIN_CHARS || words < MIN_WORDS) {
        throw new Error(
          `flash trop court (${body.length} car., ~${words} mots)`,
        );
      }

      body = ensureParagraphs(trimToCompleteSentences(body, 180));
      body = ensureParagraphs(
        polishFrenchCopy(scrubFlashOutput(stripUrlsAndBareHosts(body))),
      );
      assertFlashEndsComplete(body);
      assertFlashNotSegregated(body);
      assertFlashLeadAnchored(accroche, body);
      assertFlashOnSubject(accroche, body);
      assertFlashDoesNotNegateThesis(accroche, body);
      if (wordCount(body) < MIN_WORDS) {
        throw new Error("flash trop court après coupe");
      }

      if (outlet && !/\(Source\s*:/i.test(body)) {
        body = `${body}\n\n(Source : ${outlet})`;
      }

      console.log("flash word count ~", wordCount(body), "attempt", attempt);
      return `${PREFIX} ${body}`;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error("flash kimi retry", attempt, reason);
      if (isKimiContentFilter(err) && attempt >= 2) throw err;
      if (attempt >= 5) throw err instanceof Error ? err : new Error(reason);
      await input.onRetry?.(attempt + 1, reason);
      await sleep(Math.min(4_000, 1000 * attempt));
    }
  }
}
