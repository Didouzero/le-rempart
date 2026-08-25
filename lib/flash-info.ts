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
  // Une phrase par ligne → regrouper en paragraphes courts
  const lines = cleaned
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length >= 3) {
    return lines.join("\n\n");
  }
  return cleaned.replace(/\s+/g, " ");
}

/**
 * Fallback Rempart sans Kimi : titre + chapô + punch léger.
 */
function fallbackRempartFlash(input: {
  title: string;
  excerpt: string;
  sourceUrl?: string;
}): string {
  const title = input.title.replace(/\s+/g, " ").trim();
  const excerpt = input.excerpt.replace(/\s+/g, " ").trim();
  const parts: string[] = [];

  if (excerpt.length >= 60) {
    parts.push(excerpt);
  } else if (title) {
    parts.push(
      title.endsWith(".") || title.endsWith("…") ? title : `${title}.`,
    );
  }

  parts.push(
    "Les faits sont là. Reste à voir combien de temps les médias mainstream mettront à les digérer — ou à les édulcorer.",
  );

  const outlet = outletFromUrl(input.sourceUrl);
  if (outlet) parts.push(`(Source : ${outlet})`);

  return `${PREFIX} ${parts.join("\n\n")}`;
}

const SYSTEM_PROMPT = `Tu rédiges le texte Facebook (FLASH INFO) pour Le Rempart, média d'actualité français engagé, droit-conservateur, franc et ironique.

MISSION : informer AVEC DU CARACTÈRE. Pas une dépêche AFP plate. Pas un édito creux non plus. Faits denses + jugement Rempart.

FORMAT OBLIGATOIRE :
- Commence DIRECTEMENT par le corps du flash (SANS le préfixe ‼️🇫🇷 FLASH INFO — : on l'ajoute après)
- 3 à 5 courts paragraphes séparés par une ligne vide
- Premier paragraphe : accroche factuelle (qui / quoi / où), ton vivant
- Puis détails concrets, citations entre guillemets si elles sont dans la source
- « Pour rappel… » ou mise en perspective quand c'est pertinent
- Dernier paragraphe : punch / ironie / jugement Rempart (sans vulgarité gratuite)
- Optionnel en toute fin : (Source : NomDuMédia) si identifiable
- Français correct, pas d'emojis hors préfixe, pas d'hashtags, pas d'URL

INTERDIT :
- Flash AFP de 2 phrases plates (« X a dit Y. Cela a provoqué un tollé. »)
- Formules vides : « tollé transpartisan », « l'ensemble de la classe politique », « suscite de nombreuses réactions »
- Inventer des faits, chiffres, citations absents de la source / du dossier
- Hashtags, liens, markdown

EXEMPLES DE BON TON (inspire-toi de la densité et de l'ironie, PAS du sujet) :

Exemple 1 :
Officiellement candidat à la présidentielle qui arrive, Raphaël Glucksmann a décidé d'entamer sa campagne sur les chapeaux de roue.
Le candidat socialiste n'a rien trouvé de mieux, comme premier déplacement de campagne, d'aller visiter... un parc éolien, en compagnie de son nouveau grand coéquipier de campagne anciennement écologiste, Yannick Jadot, qui avait réalisé le merveilleux score de 4,63% à l'élection présidentielle de 2022.
Pour rappel, une large majorité de français s'oppose aux éoliennes et préfère favoriser l'énergie nucléaire. Tout porte à croire que notre ami Raphaël Glucksmann enchaîne les mauvais choix jour après jour, comme s'il s'agissait d'une passion.

Exemple 2 :
Sur les réseaux sociaux, des influenceuses musulmanes appellent à délaisser la littérature française, jugée « pas compatible » avec leurs valeurs religieuses, au profit d'une littérature « halal ».
« Ça normalise absolument tout ce qui est contraire à mes valeurs. Ce n'est pas du tout ce que j'ai envie de lire en tant que musulmane », explique l'une d'elles. Boule de Suif de Guy de Maupassant fait notamment partie des œuvres visées.
En parallèle, la « halal romance » gagne en visibilité : des romans dans lesquels les relations amoureuses respectent un cadre islamique, sans relation charnelle ou romantique avant le mariage.
Une plateforme d'écriture et de lecture « Muslim-Friendly » a également été lancée.
Pour Florence Bergeaud-Blackler, ce phénomène illustre une logique de « désintégration et de désassimilation ».
(Source : Europe 1)

Réponds UNIQUEMENT avec le corps du flash.`;

/**
 * Caption Facebook Rempart : faits + ironie + punch (style éditorial maison).
 */
export async function buildFlashInfoText(input: {
  title: string;
  excerpt: string;
  /** Texte source scrapé et/ou contenu article pour la chair du flash. */
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

  if (!process.env.MOONSHOT_API_KEY) {
    return fallback();
  }

  const corpus = (input.sourceText || input.excerpt || "").slice(0, 6000);
  const outlet = outletFromUrl(input.sourceUrl);

  try {
    const text = await Promise.race([
      moonshotChat({
        model: getKimiTextModel(),
        maxTokens: 900,
        timeoutMs: 14_000,
        reasoningEffort: "low",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              `Titre créative / angle : ${input.title}`,
              `Chapô / extrait article Rempart : ${input.excerpt}`,
              outlet ? `Média source probable : ${outlet}` : null,
              input.sourceUrl ? `URL source : ${input.sourceUrl}` : null,
              "",
              "Matière factuelle (source / article) :",
              corpus || "(matière limitée — reste prudent, ne rien inventer)",
              "",
              "Rédige le flash Facebook Rempart maintenant.",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      }),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("flash kimi timeout")), 15_000),
      ),
    ]);

    const body = ensureParagraphs(stripFlashPrefix(text || ""));
    if (body.length < 120) {
      return fallback();
    }

    // Si Kimi a oublié la source et qu'on la connaît, on l'ajoute
    let out = body;
    if (outlet && !/\(Source\s*:/i.test(out)) {
      out = `${out}\n\n(Source : ${outlet})`;
    }

    return `${PREFIX} ${out}`;
  } catch (err) {
    console.error("flash info kimi skipped", err);
    return fallback();
  }
}
