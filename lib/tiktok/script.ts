import { getKimiTextModel } from "@/lib/kimi-legacy";
import { moonshotChat } from "@/lib/moonshot";
import {
  TIKTOK_SCRIPT_MAX_WORDS,
  TIKTOK_SCRIPT_MIN_WORDS,
  TIKTOK_SCRIPT_TARGET_WORDS,
  countWords,
  type TiktokScene,
  type TiktokScript,
} from "@/lib/tiktok/types";

const SYSTEM = `Tu es journaliste voix off pour Droitocratie, média français ancré à droite (même ligne que Le Rempart : factuel + lecture politique, pas de vulgarité, pas de complot, pas de sarcasme lourd).

Tu écris un SCRIPT ORAL pour TikTok, pas un article web.
- Français parlé, phrases nettes, rythme journal TV / flash radio.
- INFORMER et LIRE politiquement en même temps. Les faits d'abord, puis une phrase d'angle, plusieurs fois, pas un slam à la fin.
- Ne pas inventer dates, chiffres, citations, institutions absents des sources.
- Pas d'emojis dans la voix off. Pas de hashtags dans le script. Pas de tiret long.
- Pas de « il convient de noter », « dans un contexte où », « en conclusion ».
- Accroche en 1 phrase (ce qui se passe). Puis déroulé. Puis lecture. Clos court signé Droitocratie (sans dire « abonne-toi »).
- MIXAGE : la voix off passe SUR des images (fond). Quand un intervenant parle à l'image (Hollande, ministre…), la voix off se TAIT. Donc : ne récite pas les longues citations, amorce (« Hollande assume : ») puis le plateau fera entendre l'extrait.

LONGUEUR : vise ${TIKTOK_SCRIPT_TARGET_WORDS} mots (entre ${TIKTOK_SCRIPT_MIN_WORDS} et ${TIKTOK_SCRIPT_MAX_WORDS}). C'est non négociable : la vidéo doit durer entre 1 min 02 et 1 min 20.

SCÈNES : 10 à 14. Ce sont des extraits d'un JT, pas une banque d'images. Chaque scène = une photo/vidéo d'actu réelle, 3 à 5 secondes.
- "person" : prénom + nom dès qu'un politique, ministre, juge, préfet, journaliste connu est à l'écran (ex. "François Hollande"). Obligatoire si le beat parle de quelqu'un.
- "visualQuery" : requête Google Images en FRANÇAIS, nom propre ou lieu réel (Assemblée nationale hémicycle, François Hollande 2024, palais de justice Paris). INTERDIT : anglais stock (politician, businessman, crowd, news studio), "illustration", cartoon, banque libre, Pexels, Pixabay.

CAPTION TikTok : 1 à 3 phrases + hashtags (dont #Droitocratie). Emojis OK ici seulement. Max 400 caractères.

Réponds UNIQUEMENT avec un JSON valide :
{"title":"...","script":"...","caption":"...","scenes":[{"text":"extrait ou résumé du beat","visualQuery":"François Hollande Assemblée nationale","kind":"photo","person":"François Hollande"}]}
kind = "photo" pour un portrait ou un document ; "video" seulement si tu as un extrait d'actu réel (jamais du stock).`;

function parseJsonScript(raw: string): TiktokScript {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Script TikTok : JSON introuvable");
  }
  const obj = JSON.parse(cleaned.slice(start, end + 1)) as {
    title?: unknown;
    script?: unknown;
    caption?: unknown;
    scenes?: unknown;
  };
  const script = String(obj.script || "")
    .replace(/\u2014|\u2013/g, ",")
    .replace(/\s+/g, " ")
    .trim();
  if (script.length < 400) {
    throw new Error("Script TikTok trop court");
  }
  const scenesRaw = Array.isArray(obj.scenes) ? obj.scenes : [];
  const scenes: TiktokScene[] = [];
  for (const s of scenesRaw) {
    if (!s || typeof s !== "object") continue;
    const rec = s as Record<string, unknown>;
    const visualQuery = String(rec.visualQuery || rec.query || "").trim();
    if (!visualQuery) continue;
    const person = String(rec.person || "").trim();
    scenes.push({
      text: String(rec.text || "").trim(),
      visualQuery,
      kind: rec.kind === "video" ? "video" : "photo",
      person: person || undefined,
    });
    if (scenes.length >= 14) break;
  }
  if (scenes.length < 6) {
    throw new Error("Script TikTok : pas assez de scènes visuelles");
  }
  const caption = String(obj.caption || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2200);
  return {
    title: String(obj.title || "Droitocratie").trim().slice(0, 180),
    script,
    caption: caption || `${String(obj.title || "Actu").trim()} #Droitocratie`,
    scenes,
  };
}

export async function writeDroitocratieScript(input: {
  sourceUrl: string;
  sourceText: string;
  adjust?: "lengthen" | "shorten";
  previousScript?: string;
  previousDurationMs?: number;
}): Promise<TiktokScript> {
  const sourceSlice = input.sourceText.slice(0, 9000);
  const adjustBlock =
    input.adjust === "lengthen"
      ? `\nCONSIGNE D'AJUSTEMENT : la voix off précédente durait ${Math.round((input.previousDurationMs || 0) / 1000)} s (trop courte). ALLONGE : ajoute un beat de contexte + un clos plus développé. Vise ~${TIKTOK_SCRIPT_TARGET_WORDS + 15} mots. Ne répète pas les mêmes phrases.\nScript précédent :\n${(input.previousScript || "").slice(0, 2500)}`
      : input.adjust === "shorten"
        ? `\nCONSIGNE D'AJUSTEMENT : la voix off précédente durait ${Math.round((input.previousDurationMs || 0) / 1000)} s (trop longue). SERRE : coupe les répétitions, garde les faits et l'angle. Vise ~${TIKTOK_SCRIPT_TARGET_WORDS - 10} mots.\nScript précédent :\n${(input.previousScript || "").slice(0, 2500)}`
        : "";

  const raw = await moonshotChat({
    model: getKimiTextModel(),
    maxTokens: 2200,
    timeoutMs: 45_000,
    reasoningEffort: "low",
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          `URL source : ${input.sourceUrl}`,
          "",
          "TEXTE SOURCE :",
          sourceSlice,
          adjustBlock,
        ].join("\n"),
      },
    ],
  });

  const parsed = parseJsonScript(raw);
  const words = countWords(parsed.script);
  if (words < 120) {
    throw new Error(`Script trop court (${words} mots)`);
  }
  return parsed;
}
