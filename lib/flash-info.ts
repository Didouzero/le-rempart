import { moonshotChat } from "@/lib/moonshot";
import { getKimiTextModel } from "@/lib/kimi";
import { scrubBoilerplate, scrubFlashOutput } from "@/lib/fetch-source";

const PREFIX = "‼️🇫🇷 𝗙𝗟𝗔𝗦𝗛 𝗜𝗡𝗙𝗢 —";

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

  // Une phrase par ligne
  const lines = cleaned
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length >= 3) {
    return lines.join("\n\n");
  }

  // Pavé unique → découpe en phrases, regroupées en ~3 paragraphes
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

/** Coupe à une fin de phrase complète, sans guillemet ouvert ni « … » orphelin. */
function trimToCompleteSentences(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return text.replace(/\s*…+\s*$/u, "").trim();
  }

  let cut = words.slice(0, maxWords).join(" ");
  // Remonter jusqu'à une fin de phrase claire
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
  // Guillemet ouvert sans fermeture → enlever la citation tronquée
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

function fallbackRempartFlash(input: {
  title: string;
  excerpt: string;
  sourceUrl?: string;
}): string {
  const parts: string[] = [];
  if (input.excerpt?.trim()) parts.push(input.excerpt.trim());
  else parts.push(input.title.trim());

  parts.push(
    "Les faits sont là. À chacun d'en tirer les conclusions que certains préfèrent esquiver.",
  );

  const outlet = outletFromUrl(input.sourceUrl);
  if (outlet) parts.push(`(Source : ${outlet})`);

  return `${PREFIX} ${parts.join("\n\n")}`;
}

const SYSTEM_PROMPT = `Tu rédiges le FLASH INFO Facebook pour Le Rempart.

STYLE (modèle à imiter — densité + respiration, PAS un inventaire) :

Bruno Le Maire publie son manifeste de 50 pages, quelques mois avant l'élection présidentielle. 2 ans après avoir quitté Bercy, l'ancien ministre de l'Économie et des Finances vient chercher à nouveau la lumière des projecteurs.

Au programme : comment sauver la France, clé en main. Après près de 9 ans aux manettes, faut-il dire qu'il n'a sans doute pas eu l'occasion de la sauver lui-même. Mais Bruno a un plan chiffré : pour lui, tout semble clair.

Le passage le plus savoureux concerne la dette. Selon lui, « nous payons aujourd'hui les choix faits sur les retraites en 1981 ». Rappelons tout de même qu'il a lui-même contribué à cet accroissement colossal de la dette.

RÈGLES :
- 120 à 180 mots. Vise ~150. Moins = mieux qu'un pavé.
- EXACTEMENT 3 ou 4 paragraphes, séparés par UNE LIGNE VIDE (\\n\\n). Jamais un seul bloc.
- Va à l'ESSENTIEL : qui / quoi / quand + 1 angle Rempart fort. PAS la liste de toutes les mesures.
- Une seule citation courte max, toujours fermée (« … »). Jamais de citation coupée.
- Termine par une phrase COMPLÈTE. INTERDIT de finir par … ou un guillemet ouvert.
- Premier paragraphe = accroche claire. Milieu = contexte / ironie. Fin = punch (hypocrisie, chiffre absurde, retour de bâton).
- SANS préfixe ‼️🇫🇷 FLASH INFO (ajouté après). Pas d'emojis, hashtags, URL, markdown.
- N'invente rien. N'écris jamais « non sourcé ».
- INTERDIT : cookies, s'abonner, inventaire type « au menu : A, B, C, D, E… »

Réponds UNIQUEMENT avec les 3–4 paragraphes du flash.`;

/**
 * Flash Facebook Rempart : essentiel + punch, paragraphes aérés, fin propre.
 */
export async function buildFlashInfoText(input: {
  title: string;
  excerpt: string;
  sourceText?: string;
  sourceUrl?: string;
  articleUrl?: string;
}): Promise<string> {
  const fallback = () =>
    fallbackRempartFlash({
      title: input.title,
      excerpt: input.excerpt,
      sourceUrl: input.sourceUrl,
    });

  if (!process.env.MOONSHOT_API_KEY) return fallback();

  // Moins de matière = moins de tentation d'inventaire
  const corpus = scrubBoilerplate(
    [input.excerpt, (input.sourceText || "").slice(0, 3500)]
      .filter(Boolean)
      .join("\n\n"),
  ).slice(0, 4000);
  const outlet = outletFromUrl(input.sourceUrl);

  try {
    const text = await Promise.race([
      moonshotChat({
        model: getKimiTextModel(),
        maxTokens: 450,
        timeoutMs: 18_000,
        reasoningEffort: "low",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              `Titre : ${input.title}`,
              outlet ? `Source presse : ${outlet}` : null,
              "",
              "Matière (ne pas tout lister — choisis l'essentiel + un angle) :",
              corpus,
              "",
              "Écris le flash : 3 ou 4 paragraphes, ligne vide entre eux, fin complète.",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      }),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("flash kimi timeout")), 20_000),
      ),
    ]);

    let body = scrubFlashOutput(ensureParagraphs(stripFlashPrefix(text || "")));
    if (body.length < 80) return fallback();

    body = ensureParagraphs(trimToCompleteSentences(body, 180));
    body = scrubFlashOutput(body);

    if (outlet && !/\(Source\s*:/i.test(body)) {
      body = `${body}\n\n(Source : ${outlet})`;
    }

    console.log("flash word count ~", wordCount(body));
    return `${PREFIX} ${body}`;
  } catch (err) {
    console.error("flash info kimi skipped", err);
    return scrubFlashOutput(fallback());
  }
}
