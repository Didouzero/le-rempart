import { moonshotChat, isKimiContentFilter } from "@/lib/moonshot";
import { scrubBoilerplate, scrubFlashOutput } from "@/lib/fetch-source";
import { assertNoUnsourcedHeadlinePenalties } from "@/lib/source-first";

const PREFIX = "‼️🇫🇷 𝗙𝗟𝗔𝗦𝗛 𝗜𝗡𝗙𝗢 —";
const MIN_CHARS = 80;
const MIN_WORDS = 90;

function outletFromUrl(url?: string): string | null {
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
    };
    if (map[host]) return map[host];
    const base = host.split(".")[0] || host;
    return base.charAt(0).toUpperCase() + base.slice(1);
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
  if (words.length <= maxWords) {
    return text.replace(/\s*…+\s*$/u, "").trim();
  }

  let cut = words.slice(0, maxWords).join(" ");
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

/** Retire URLs et domaines nus (ex. jeanmarcmorandini.com) du corps du flash. */
function stripUrlsAndBareHosts(text: string): string {
  return text
    .replace(/https?:\/\/[^\s<>"')\]]+/gi, "")
    .replace(
      /\b(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z]{2,}){1,3}\b/gi,
      (host) => {
        // Garde les acronymes / mots courants, pas les domaines
        if (!/\.[a-z]{2,}$/i.test(host)) return host;
        if (/^(fr|com|org|net|info|eu)$/i.test(host)) return host;
        return "";
      },
    )
    .replace(/\(\s*Source\s*:[^)]*\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
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
    /\d|janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|selon|a déclaré|a annoncé|a condamné|tribunal|cour|procureur|ministre|député|maire|police|gendarme|«|"/i;

  const opinionHeavy =
    /\b(c'est|voilà|encore une fois|deux poids|symbole|révèle|montre que|difficile de|on voit|on croit|scandale|hypocrisie|à chacun|les français)\b/i;

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

  // §1 factuel OK mais §2 et §3 sans ancre factuelle = le schéma hais
  const later = paras.slice(1);
  const laterWithoutFact = later.filter((p) => !facty.test(p)).length;
  if (laterWithoutFact >= 2) {
    throw new Error(
      "flash : suite sans faits (interdit : §1 faits / §2–3 édito)",
    );
  }
}

const SYSTEM_PROMPT = `Tu rédiges le FLASH INFO Facebook pour Le Rempart — média de droite, argumenté.

RÈGLE D'OR — ENTREMÊLER, NE JAMAIS SÉPARER :
- CHAQUE paragraphe = faits concrets (qui / quoi / où / quand / citation / réaction NOMÉÉE) + UNE courte lecture de droite tissée DANS le même paragraphe.
- INTERDIT le schéma « §1 = faits seuls, §2 et §3 = critique / édito ». Si tu fais ça, le flash est refusé.
- INTERDIT un dernier paragraphe qui n'est que du commentaire sans fait nouveau.
- INTERDIT de relayer platement puis de coller un slam réac à la fin.

FAITS :
- INTERDIT d'inventer noms, réactions, citations, peines, chiffres absents de la matière.
- Le « Titre » / accroche n'est PAS une source : peines et chiffres viennent UNIQUEMENT de la matière.
- N'attribue un fait à un média que s'il est dans la matière de cet article.

LIGNE ÉDITORIALE :
- Public patriote, souverainiste. Tu écris POUR eux, sans les prendre pour des crétins.
- Lecture : deux poids deux mesures, coups de com', coût pour le contribuable, incohérences — argumentée, pas une insulte.
- JAMAIS ridiculiser une position patriotique / RN / droite dure comme si elle était en tort.
- INTERDIT « on croit rêver », « les Français apprécieront », « scandale », gueulante gratuite.

STRUCTURE (3 paragraphes, ligne vide entre eux) — CHAQUE § = fait(s) + lecture :
1) Accroche factuelle + déjà une phrase de lecture.
2) Suite factuelle (réactions nommées si dans la matière) + lecture.
3) Fait ou conséquence + lecture — PAS un slam isolé.

FORME :
- 110 à 160 mots. Vise ~130–140.
- EXACTEMENT 3 paragraphes (4 max si beaucoup de faits), séparés par UNE LIGNE VIDE (\\n\\n).
- Une ou deux citations courtes max, toujours fermées (« … »).
- Termine par une phrase COMPLÈTE. Pas de … ni guillemet ouvert.
- SANS préfixe ‼️🇫🇷 FLASH INFO (ajouté après).
- INTERDIT : emojis, hashtags, markdown, URL, nom de domaine (ex. site.com), lien, « Source : » dans le corps (la source est ajoutée après, hors de ton texte).
- N'invente rien. N'écris jamais « non sourcé ».

Réponds UNIQUEMENT avec les 3–4 paragraphes du flash.`;

/**
 * Flash Facebook Rempart. Réessaie Kimi jusqu'à un vrai flash — jamais de texte de secours.
 */
export async function buildFlashInfoText(input: {
  title: string;
  excerpt: string;
  sourceText?: string;
  sourceUrl?: string;
  articleUrl?: string;
  onRetry?: (attempt: number, reason: string) => void | Promise<void>;
}): Promise<string> {
  if (!process.env.MOONSHOT_API_KEY) {
    throw new Error("MOONSHOT_API_KEY manquante — flash Facebook impossible");
  }

  const scraped = scrubBoilerplate((input.sourceText || "").slice(0, 4000));
  const corpus = scrubBoilerplate(
    [scraped, input.excerpt].filter(Boolean).join("\n\n"),
  ).slice(0, 4500);
  const outlet = outletFromUrl(input.sourceUrl);
  const userContent = [
    `Accroche (PAS une source de faits) : ${input.title}`,
    outlet
      ? `Média de l'URL fournie (faits uniquement s'ils sont dans la matière) : ${outlet}`
      : null,
    "",
    "Matière (EXTRAIS les faits : noms, peines exactes, citations, réactions — n'invente rien) :",
    corpus,
    "",
    "Écris le flash : 3 paragraphes, ligne vide entre eux.",
    "OBLIGATOIRE : dans CHAQUE paragraphe, faits + courte lecture de droite — jamais §1 faits puis §2–3 édito.",
    "Pas d'URL, pas de nom de domaine, pas de « Source : » dans ton texte.",
    "Ligne droite dure : jamais un patriote / le RN « en tort ».",
  ]
    .filter(Boolean)
    .join("\n");

  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      // k2.6 + thinking off : un flash de 130 mots. k3 « réfléchit » et
      // dépasse 18 s, d’où la boucle de timeouts.
      const text = await moonshotChat({
        model: "kimi-k2.6",
        maxTokens: 450,
        timeoutMs: 45_000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      });

      let body = scrubFlashOutput(ensureParagraphs(stripFlashPrefix(text || "")));
      body = ensureParagraphs(stripUrlsAndBareHosts(body));
      const words = wordCount(body);
      if (body.length < MIN_CHARS || words < MIN_WORDS) {
        throw new Error(
          `flash trop court (${body.length} car., ~${words} mots)`,
        );
      }

      body = ensureParagraphs(trimToCompleteSentences(body, 180));
      body = ensureParagraphs(scrubFlashOutput(stripUrlsAndBareHosts(body)));
      assertFlashNotSegregated(body);
      assertNoUnsourcedHeadlinePenalties({
        headline: input.title,
        matter: scraped || corpus,
        output: body,
        label: "Flash Facebook",
      });
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
