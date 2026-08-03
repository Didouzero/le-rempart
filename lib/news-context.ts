/**
 * Briefing d'actualité via Google News RSS (FR) — sans clé API.
 * Sert à ancrer Kimi dans l'actu réelle plutôt que d'inventer un contexte (émeutes vs incendies, etc.).
 */

export type NewsHit = {
  title: string;
  source?: string;
  published?: string;
};

function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripPublisherSuffix(title: string): string {
  // Google News : "Titre - Le Figaro"
  return title.replace(/\s+[-–—]\s+[^-–—]+$/, "").trim();
}

function foldAccents(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Requêtes de veille dérivées du titre (dont expansions de métaphores). */
export function buildNewsSearchQueries(headline: string): string[] {
  const h = headline.replace(/\s+/g, " ").trim();
  const folded = foldAccents(h);
  const queries: string[] = [];

  // Requête principale : titre allégé
  const core = h
    .replace(
      /^(ALORS QUE|PENDANT QUE|TANDIS QUE|ALORS QU'|PENDANT QU')\s+/i,
      "",
    )
    .slice(0, 120);
  if (core.length >= 12) queries.push(core);

  // Expansions contextuelles (métaphores / sous-entendus d'actu)
  if (/brul|incendie|feu(x)?\b|flamme|megafeu|mégafeu/.test(folded)) {
    queries.push("incendies France", "feux de forêt France");
  }
  if (/canicule|vague de chaleur|record de chaleur/.test(folded)) {
    queries.push("canicule France");
  }
  if (/inondation|crue|intemperie/.test(folded)) {
    queries.push("inondations France");
  }
  if (/tour de france/.test(folded)) {
    queries.push("Tour de France");
  }
  if (/braun[- ]?pivet/.test(folded)) {
    queries.push("Yaël Braun-Pivet");
  }
  if (/assemblee nationale/.test(folded) && /braun|presidente/.test(folded)) {
    queries.push("présidente Assemblée nationale");
  }
  if (
    /mineur|detention|détention|vide juridique|liber[eé]|prison|viol|meurtre|sequestration|séquestration/.test(
      folded,
    )
  ) {
    queries.push(
      "mineurs détention provisoire vide juridique",
      "Conseil constitutionnel justice pénale mineurs",
    );
  }
  if (/conseil constitutionnel|censure|code de la justice penale/.test(folded)) {
    queries.push("Conseil constitutionnel Code justice pénale mineurs");
  }

  // Noms propres approximatifs (mots capitalisés / séquences)
  const proper = h.match(
    /\b(?:[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ][a-zàâäéèêëïîôùûüç'’-]+)(?:\s+[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ][a-zàâäéèêëïîôùûüç'’-]+){0,2}\b/g,
  );
  if (proper) {
    for (const name of proper.slice(0, 3)) {
      if (name.length >= 5 && !/^(Alors|France|Pendant|Assemblée|Nationale)$/i.test(name)) {
        queries.push(name);
      }
    }
  }

  return [...new Set(queries.map((q) => q.trim()).filter((q) => q.length >= 4))].slice(
    0,
    5,
  );
}

async function fetchGoogleNewsRss(query: string): Promise<NewsHit[]> {
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "fr");
  url.searchParams.set("gl", "FR");
  url.searchParams.set("ceid", "FR:fr");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "LeRempartBot/1.0 (+https://le-rempart.org; news briefing)",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) return [];
  const xml = await res.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 5);
  const hits: NewsHit[] = [];

  for (const match of items) {
    const block = match[1];
    const titleRaw = block.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
    if (!titleRaw) continue;
    const title = stripPublisherSuffix(decodeXml(titleRaw));
    if (title.length < 12) continue;
    const source = decodeXml(
      block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] || "",
    );
    const published = decodeXml(
      block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || "",
    );
    hits.push({
      title,
      source: source || undefined,
      published: published || undefined,
    });
  }

  return hits;
}

/**
 * Récupère un briefing presse FR lié au titre (titres d'articles récents).
 */
export async function fetchNewsContextBriefing(
  headline: string,
): Promise<string> {
  const queries = buildNewsSearchQueries(headline);
  if (queries.length === 0) return "";

  const batches = await Promise.all(
    queries.map(async (q) => {
      try {
        return await fetchGoogleNewsRss(q);
      } catch (err) {
        console.error("news rss failed", q, err);
        return [] as NewsHit[];
      }
    }),
  );

  const seen = new Set<string>();
  const lines: string[] = [];
  for (const hits of batches) {
    for (const hit of hits) {
      const key = hit.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const meta = [hit.source, hit.published].filter(Boolean).join(" · ");
      lines.push(meta ? `- ${hit.title} (${meta})` : `- ${hit.title}`);
      if (lines.length >= 12) break;
    }
    if (lines.length >= 12) break;
  }

  if (lines.length === 0) return "";

  return [
    "Briefing presse récente (Google News FR). Ancre le contexte national sur CES faits, pas sur une autre crise inventée.",
    "IMPORTANT : les titres ci-dessous contiennent déjà des précisions (durées, actes, institutions). Extrais-les et intègre-les dans l'article :",
    ...lines,
  ].join("\n");
}
