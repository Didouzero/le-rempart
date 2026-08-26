import { moonshotChat } from "@/lib/moonshot";
import { getKimiTextModel } from "@/lib/kimi";

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
  if (lines.length >= 3) return lines.join("\n\n");
  return cleaned.replace(/\s+/g, " ");
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function fallbackRempartFlash(input: {
  title: string;
  excerpt: string;
  sourceUrl?: string;
  articleBody?: string;
}): string {
  const parts: string[] = [];
  if (input.excerpt?.trim()) parts.push(input.excerpt.trim());
  else parts.push(input.title.trim());

  const body = (input.articleBody || "")
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (body.length > 80) {
    const cut = body.slice(0, 700);
    const last = cut.lastIndexOf(".");
    parts.push(last > 120 ? cut.slice(0, last + 1) : `${cut}…`);
  }

  parts.push(
    "Les faits sont là. À chacun d'en tirer les conclusions que les médias mainstream préfèrent souvent esquiver.",
  );

  const outlet = outletFromUrl(input.sourceUrl);
  if (outlet) parts.push(`(Source : ${outlet})`);

  return `${PREFIX} ${parts.join("\n\n")}`;
}

const SYSTEM_PROMPT = `Tu rédiges le FLASH INFO Facebook pour Le Rempart.

MISSION : un flash dense, informatif, avec la touche Rempart (ironie / jugement en fin), qui reprend les éléments concrets de l'article du site.

CONTRAINTES :
- 150 à 200 mots MAXIMUM (vise ~170). Compte tes mots.
- 3 à 5 courts paragraphes séparés par une ligne vide
- Beaucoup de matière : noms, lieux, chiffres, citations, enchaînement des faits — pas un résumé creux
- Premier paragraphe = accroche factuelle
- Dernier = punch Rempart (sans vulgarité)
- Optionnel : (Source : Média) en toute fin
- SANS le préfixe ‼️🇫🇷 FLASH INFO (ajouté après)
- Pas d'emojis, hashtags, URL, markdown
- N'invente rien hors de l'article fourni
- N'écris JAMAIS que quelque chose « n'est pas sourcé / pas vérifié »

Réponds UNIQUEMENT avec le corps du flash.`;

/**
 * Flash Facebook Rempart : 150–200 mots, densés depuis l'article.
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
      articleBody: input.sourceText,
    });

  if (!process.env.MOONSHOT_API_KEY) return fallback();

  const corpus = [input.excerpt, input.sourceText]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 7000);
  const outlet = outletFromUrl(input.sourceUrl);

  try {
    const text = await Promise.race([
      moonshotChat({
        model: getKimiTextModel(),
        maxTokens: 550,
        timeoutMs: 18_000,
        reasoningEffort: "low",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              `Titre article : ${input.title}`,
              outlet ? `Média source probable : ${outlet}` : null,
              "",
              "Article Rempart (matière à condenser en flash 150–200 mots) :",
              corpus,
              "",
              "Rédige le flash maintenant.",
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

    let body = ensureParagraphs(stripFlashPrefix(text || ""));
    if (body.length < 100) return fallback();

    // Coupe si le modèle dépasse ~220 mots
    const words = body.split(/\s+/);
    if (words.length > 220) {
      body = ensureParagraphs(words.slice(0, 200).join(" ") + "…");
    }

    if (outlet && !/\(Source\s*:/i.test(body)) {
      body = `${body}\n\n(Source : ${outlet})`;
    }

    console.log("flash word count ~", wordCount(body));
    return `${PREFIX} ${body}`;
  } catch (err) {
    console.error("flash info kimi skipped", err);
    return fallback();
  }
}
