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

const SYSTEM_PROMPT = `Tu rédiges le FLASH INFO Facebook pour Le Rempart — média de DROITE DURE.

PRIORITÉ ABSOLUE : INFORMATION D'ABORD, OPINION ENSUITE (et courte).
- 70–80 % du flash = faits concrets tirés de la matière : qui, quoi, quand, où, citation courte, réactions NOMÉES (personnes, partis, institutions).
- 20–30 % max = un punch Rempart en FIN (1 paragraphe court). Pas un éditorial du début à la fin.
- INTERDIT les paragraphes d'opinion pure du type « Imaginez un instant… », « Difficile de donner tort… », « Scandale national, indignation en chaîne… » sans fait nouveau.
- INTERDIT d'inventer des noms, réactions ou citations absents de la matière. Si Chenu / Bardella / un ministre a réagi et que c'est dans la matière : tu le cites. Sinon : tu ne l'inventes pas.

LIGNE ÉDITORIALE :
- Public patriote, souverainiste. Tu écris POUR eux.
- Le punch final vise : gauche, macronisme, service public biaisé, gouvernement, deux poids deux mesures, immigration, insécurité.
- JAMAIS ridiculiser une position patriotique / RN / droite dure comme si elle était en tort.
- Jamais le ton Libération / France Info.

STRUCTURE TYPE (à suivre) :
1) Accroche FACTUELLE : qui a fait / dit quoi, à qui, où, quand (+ citation courte si utile).
2) Réactions(s) concrète(s) : parti, élu nommé, saisine Arcom, etc. — uniquement si dans la matière.
3) Punch court Rempart (deux poids deux mesures, impôts, hypocrisie) — UNE idée, pas un sermon.

EXEMPLE DE BON ÉQUILIBRE (faits + punch court) :

L'humoriste Ameziane est au cœur du scandale après avoir comparé Jean-Philippe Tanguy, député Rassemblement national, à « une tête de rat » dans son billet d'humour en direct sur France Inter. L'homosexualité du député a aussi été la cible de railleries, en pleine antenne du service public.

Le Rassemblement national a immédiatement réagi, exigeant des excuses publiques et envisageant de saisir l'Arcom. Sébastien Chenu, vice-président de l'Assemblée nationale, a qualifié ce trait d'humour d'inadmissible sur une antenne financée par les Français.

Le deux poids deux mesures est devenu la règle du service public audiovisuel : une radio payée par tous, qui crache sur des millions d'électeurs.

RÈGLES FORME :
- 110 à 160 mots. Vise ~130–140.
- EXACTEMENT 3 paragraphes (4 max si beaucoup de faits), séparés par UNE LIGNE VIDE (\\n\\n).
- Une ou deux citations courtes max, toujours fermées (« … »).
- Termine par une phrase COMPLÈTE. Pas de … ni guillemet ouvert.
- SANS préfixe ‼️🇫🇷 FLASH INFO (ajouté après). Pas d'emojis, hashtags, URL, markdown.
- N'invente rien. N'écris jamais « non sourcé ».
- INTERDIT : cookies, inventaire, édito long, hypothèses (« imaginez si c'était LFI… ») en paragraphe entier.

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
              "Matière (EXTRAIS les faits : noms, citations, réactions — n'invente rien) :",
              corpus,
              "",
              "Écris le flash : 3 paragraphes, ligne vide entre eux.",
              "Paragraphes 1–2 = FAITS (qui/quoi/quand + réactions nommées si présentes).",
              "Paragraphe 3 = punch Rempart COURT (pas un édito, pas « imaginez si… »).",
              "Ligne droite dure : jamais un patriote / le RN « en tort ».",
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
    body = ensureParagraphs(scrubFlashOutput(body));

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
