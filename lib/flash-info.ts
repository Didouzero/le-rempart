import { moonshotChat } from "@/lib/moonshot";
import { getKimiTextModel } from "@/lib/kimi";

const PREFIX = "‼️🇫🇷 𝗙𝗟𝗔𝗦𝗛 𝗜𝗡𝗙𝗢 —";

/** Force une phrase par ligne. */
function oneSentencePerLine(text: string): string {
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const parts = cleaned
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length <= 1) return cleaned;
  return parts.join("\n");
}

/** Rejette les accroches éditoriales / sarcastiques (pas un flash info). */
function looksEditorial(text: string): boolean {
  return /pendant que les m[eé]dias|on nous ressortira|couplet du|deux poids|encore une fois|comme d.habitude|surprise|extasie|tour de france|le rempart y (voit|reviendra)|illustre encore|d[eé]calage entre/i.test(
    text,
  );
}

/**
 * Fallback factuel à partir du titre (pas du chapô sarcastique).
 */
function fallbackBody(title: string, excerpt: string): string {
  // Si le chapô est déjà factuel et court, on s'en sert
  if (excerpt && !looksEditorial(excerpt) && excerpt.length >= 40) {
    return oneSentencePerLine(excerpt);
  }

  let t = title
    .replace(/\s+/g, " ")
    .trim();

  // Enlève une citation en tête : "…": faits → faits
  t = t.replace(/^["«“].{0,80}?["»”]\s*:\s*/u, "").trim();
  // Minuscule de départ si besoin
  if (t && t === t.toUpperCase()) {
    t = t.charAt(0) + t.slice(1).toLowerCase();
    t = t.charAt(0).toUpperCase() + t.slice(1);
  } else if (/^[a-zàâäéèêëïîôùûüç]/.test(t)) {
    t = t.charAt(0).toUpperCase() + t.slice(1);
  }

  const main = t.length > 200 ? `${t.slice(0, 197)}…` : t;
  if (!main) {
    return "Faits en cours de vérification.";
  }

  // Deuxième phrase générique seulement si le titre ne parle déjà pas d'interpellation / hôpital
  if (/interpell|arr[eê]t|h[oô]pital|victime/i.test(main)) {
    return oneSentencePerLine(main.endsWith(".") ? main : `${main}.`);
  }
  return oneSentencePerLine(
    `${main.endsWith(".") ? main.slice(0, -1) : main}. Les forces de l'ordre sont intervenues sur place.`,
  );
}

/**
 * Caption Facebook : FLASH INFO factuel (qui / quoi / où / suite immédiate).
 * Pas de sarcasme, pas de couplet anti-médias — on INFORME.
 */
export async function buildFlashInfoText(input: {
  title: string;
  excerpt: string;
  articleUrl?: string;
}): Promise<string> {
  let body = fallbackBody(input.title, input.excerpt);

  if (process.env.MOONSHOT_API_KEY) {
    try {
      const text = await Promise.race([
        moonshotChat({
          model: getKimiTextModel(),
          maxTokens: 320,
          timeoutMs: 8_000,
          reasoningEffort: "low",
          messages: [
            {
              role: "system",
              content: `Tu rédiges un FLASH INFO Facebook pour Le Rempart, média d'actualité.
MISSION : INFORMER. Style dépêche / brève AFP, pas édito.

OBLIGATOIRE :
- Exactement 2 ou 3 phrases courtes, une phrase par ligne
- Faits concrets tirés du titre : qui, quoi, où, combien de victimes, suite immédiate (interpellation, hôpital, etc.) si c'est dans le titre
- Français correct, ton neutre et clair
- Sans emojis, sans hashtags, sans URL, sans tiret long (—)

INTERDIT :
- Sarcasme, ironie, aigreur
- Attaques contre "les médias", le Tour de France, "on nous ressortira le couplet…"
- Commentaire politique, morale, formule Rempart type "deux poids deux mesures"
- Réutiliser un chapô éditorial s'il n'apporte aucun fait

Exemple de bon flash :
Un jeune migrant a poignardé 3 femmes, dont une enceinte, en plein cœur de Paris aujourd'hui.
Il s'est jeté à terre et a été interpellé par les forces de l'ordre.
Les 3 victimes ont été transportées d'urgence à l'hôpital.

Réponds UNIQUEMENT avec les phrases du flash, rien d'autre.`,
            },
            {
              role: "user",
              content: `Titre (source des faits) : ${input.title}\nChapô (ignore-le s'il est sarcastique / éditorial) : ${input.excerpt}\n\nÉcris le flash info factuel, 2 ou 3 phrases, une par ligne.`,
            },
          ],
        }),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("flash kimi timeout")), 8_500),
        ),
      ]);
      if (text) {
        const candidate = oneSentencePerLine(
          text
            .replace(/^["']|["']$/g, "")
            .replace(/\u2014|\u2013/g, ",")
            .replace(/^(‼️|🇫🇷|𝗙𝗟𝗔𝗦𝗛|FLASH INFO)\s*[—–:-]?\s*/i, "")
            .trim(),
        );
        if (candidate && !looksEditorial(candidate)) {
          body = candidate;
        }
      }
    } catch (err) {
      console.error("flash info kimi skipped", err);
    }
  }

  // Si Kimi a quand même sorti de l'édito, on retombe sur le titre
  if (looksEditorial(body)) {
    body = fallbackBody(input.title, "");
  }

  return `${PREFIX} ${body}`;
}
