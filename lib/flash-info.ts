import { moonshotChat, isKimiContentFilter } from "@/lib/moonshot";
import { scrubBoilerplate, scrubFlashOutput } from "@/lib/fetch-source";

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
      "liberation.fr": "Libération",
      "mediacites.fr": "Mediacités",
      "ladepeche.fr": "La Dépêche",
      "leparisien.fr": "Le Parisien",
      "marianne.net": "Marianne",
      "cnews.fr": "CNews",
      "jdd.fr": "JDD",
      "lci.fr": "LCI",
      "rtl.fr": "RTL",
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

const SYSTEM_PROMPT = `Tu rédiges le FLASH INFO Facebook pour Le Rempart — média de droite, argumenté.

PRIORITÉ : faits exacts ET lecture politique tissés ensemble, dans chaque paragraphe.
- Chaque paragraphe mêle information concrète (qui, quoi, quand, où, citation courte, réactions NOMÉES) et une lecture de droite courte, lisse, réfléchie, percutante.
- INTERDIT de relayer platement puis de coller un dernier paragraphe « réac » / invective.
- INTERDIT le plaisir de taper sur la gauche ou le gouvernement sans argument. INTERDIT « on croit rêver », « les Français apprécieront », « scandale », gueulante.
- INTERDIT d'inventer des noms, réactions ou citations absents de la matière.

LIGNE ÉDITORIALE :
- Public patriote, souverainiste. Tu écris POUR eux, sans les prendre pour des crétins.
- Le commentaire vise les faits : deux poids deux mesures, coups de com', coût pour le contribuable, incohérences — avec un raisonnement, pas une insulte.
- JAMAIS ridiculiser une position patriotique / RN / droite dure comme si elle était en tort.

STRUCTURE (3 paragraphes, ligne vide entre eux) :
1) Faits d'accroche + déjà une phrase de lecture.
2) Suite factuelle (réactions nommées si dans la matière) + lecture.
3) Fait ou conséquence + lecture — PAS un slam isolé.

RÈGLES FORME :
- 110 à 160 mots. Vise ~130–140.
- EXACTEMENT 3 paragraphes (4 max si beaucoup de faits), séparés par UNE LIGNE VIDE (\\n\\n).
- Une ou deux citations courtes max, toujours fermées (« … »).
- Termine par une phrase COMPLÈTE. Pas de … ni guillemet ouvert.
- SANS préfixe ‼️🇫🇷 FLASH INFO (ajouté après). Pas d'emojis, hashtags, URL, markdown.
- N'invente rien. N'écris jamais « non sourcé ».
- INTERDIT : cookies, inventaire, hypothèses (« imaginez si c'était LFI… ») en paragraphe entier.

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

  const corpus = scrubBoilerplate(
    [input.excerpt, (input.sourceText || "").slice(0, 2200)]
      .filter(Boolean)
      .join("\n\n"),
  ).slice(0, 2500);
  const outlet = outletFromUrl(input.sourceUrl);
  const userContent = [
    `Titre : ${input.title}`,
    outlet ? `Source presse : ${outlet}` : null,
    "",
    "Matière (EXTRAIS les faits : noms, citations, réactions — n'invente rien) :",
    corpus,
    "",
    "Écris le flash : 3 paragraphes, ligne vide entre eux.",
    "Chaque paragraphe = faits exacts + une lecture politique courte, lisse, argumentée.",
    "Pas de dernier paragraphe invective / réac isolé.",
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
      const words = wordCount(body);
      if (body.length < MIN_CHARS || words < MIN_WORDS) {
        throw new Error(
          `flash trop court (${body.length} car., ~${words} mots)`,
        );
      }

      body = ensureParagraphs(trimToCompleteSentences(body, 180));
      body = ensureParagraphs(scrubFlashOutput(body));
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
      await input.onRetry?.(attempt + 1, reason);
      await sleep(Math.min(4_000, 1000 * attempt));
    }
  }
}
