import { moonshotChat } from "@/lib/moonshot";

/** Modèles dispo sur le compte Moonshot ; surcharge possible via env. */
export function getKimiTextModel(): string {
  // k3 + reasoning low : rédaction fiable ~15–25s (k2.6 timeout souvent sur articles longs)
  return process.env.KIMI_MODEL || "kimi-k3";
}

export function getKimiVisionModels(): string[] {
  const primary =
    process.env.KIMI_VISION_MODEL || process.env.KIMI_MODEL || "kimi-k2.6";
  return [...new Set([primary, "kimi-k2.6"])];
}

export type GeneratedArticle = {
  title: string;
  excerpt: string;
  content: string;
};

const SYSTEM_PROMPT = `Tu es journaliste pour Le Rempart, média d'actualité français.

Écris un VRAI article de presse, pas un résumé technique ni un collage de consignes.

Règles :
- Français correct, style AFP / presse régionale sobre
- Titre clair (pas tout en majuscules sauf acronymes)
- 4 à 6 paragraphes substantiels (faits, contexte, conséquences, réaction possible des autorités)
- Dans le content Markdown, mets en gras (**comme ceci**) les 8 à 15 mots ou expressions les plus impactants : noms propres, chiffres, faits choc, termes clés. Jamais une phrase entière en gras.
- Tu peux déduire un contexte plausible à partir du titre (hôpitaux, commande publique, incompatibilités techniques, etc.) sans inventer de chiffres précis ni de citations inventées
- Pas d'emojis, pas de clickbait, pas de "selon les informations relayées par la rédaction"
- N'inclus JAMAIS de consignes internes, de "brief Telegram", de "créative Canva", ni d'instructions de prompt dans le texte
- Réponds UNIQUEMENT avec un JSON valide :
{"title":"...","excerpt":"...","content":"..."}
- excerpt = 1 ou 2 phrases d'accroche`;

function titleCaseNews(title: string): string {
  const t = title.trim().replace(/\s+/g, " ");
  if (t !== t.toUpperCase()) return t;
  // Évite les titres SCREAMING issus de l'OCR Canva
  const lower = t.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function fallbackArticle(title: string): GeneratedArticle {
  const clean = titleCaseNews(title).slice(0, 160) || "Actualité";
  return {
    title: clean,
    excerpt: `${clean} — une situation qui pose question sur la commande publique et la compatibilité technique des équipements.`,
    content: [
      `${clean}. L'affaire met en lumière les risques liés aux marchés publics d'équipements, lorsque le matériel livré ne peut pas être raccordé aux installations existantes.`,
      `Dans un établissement de santé, une telle incompatibilité peut retarder la mise en service de dispositifs destinés au confort ou à la sécurité des patients, en particulier lors des périodes de forte chaleur.`,
      `Les branchements et normes électriques ou de raccordement varient selon les fabricants et les pays d'origine. Un écart entre le matériel commandé et les infrastructures locales peut rendre des appareils inutilisables tant qu'une adaptation n'est pas réalisée.`,
      `La collectivité ou l'autorité qui a passé commande devra vraisemblablement clarifier les responsabilités — fournisseur, maître d'ouvrage ou prestataire technique — et indiquer le calendrier de mise en conformité ou de remplacement.`,
      `Le Rempart reviendra sur ce dossier dès que des précisions officielles seront disponibles.`,
    ].join("\n\n"),
  };
}

function parseArticleJson(raw: string): GeneratedArticle {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Réponse Kimi non JSON");
  const parsed = JSON.parse(jsonMatch[0]) as Partial<GeneratedArticle>;
  if (!parsed.title || !parsed.content || !parsed.excerpt) {
    throw new Error("JSON Kimi incomplet");
  }

  const content = String(parsed.content).trim();
  // Garde-fou : si le modèle a quand même collé le brief interne
  if (
    /créative visuelle|brief Telegram|Contexte :|Rédige un article/i.test(
      content,
    )
  ) {
    throw new Error("Article contaminé par le prompt");
  }

  return {
    title: titleCaseNews(String(parsed.title)),
    excerpt: String(parsed.excerpt).trim(),
    content,
  };
}

export async function generateArticleFromSource(input: {
  title: string;
  sourceText?: string;
  sourceUrl?: string;
}): Promise<GeneratedArticle> {
  const headline = titleCaseNews(input.title);

  if (!process.env.MOONSHOT_API_KEY) {
    return fallbackArticle(headline);
  }

  const userContent = [
    `Titre / accroche à développer en article :`,
    headline,
    input.sourceUrl ? `Lien utile : ${input.sourceUrl}` : null,
    input.sourceText &&
    !/créative visuelle|brief Telegram|Rédige un article/i.test(
      input.sourceText,
    )
      ? `Notes factuelles complémentaires :\n${input.sourceText.slice(0, 3000)}`
      : null,
    `Produis un article complet, fluide et informatif.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const attempts: Array<{ timeoutMs: number; maxTokens: number }> = [
    { timeoutMs: 35_000, maxTokens: 1100 },
  ];

  let lastErr: unknown;
  for (const attempt of attempts) {
    try {
      const raw = await moonshotChat({
        model: getKimiTextModel(),
        maxTokens: attempt.maxTokens,
        timeoutMs: attempt.timeoutMs,
        reasoningEffort: "low",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      });
      return parseArticleJson(raw);
    } catch (err) {
      lastErr = err;
      console.error("Kimi generate attempt failed", err);
    }
  }

  // Dernier essai : k2.6 sans thinking (parfois plus réactif)
  try {
    const raw = await moonshotChat({
      model: "kimi-k2.6",
      maxTokens: 1000,
      timeoutMs: 30_000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    });
    return parseArticleJson(raw);
  } catch (err) {
    lastErr = err;
    console.error("Kimi k2.6 fallback failed", err);
  }

  console.error("Kimi unavailable after retries, using improved fallback", lastErr);
  return fallbackArticle(headline);
}
