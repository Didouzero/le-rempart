/**
 * Recherche web réelle à partir d'un titre / caption.
 *
 * Priorité :
 * 1. Moonshot `$web_search` (kimi-k2.6) — fiable, utilise MOONSHOT_API_KEY
 * 2. SERPER_API_KEY / BRAVE_API_KEY si présents
 * 3. Fallbacks gratuits : Bing HTML, Google News RSS, DuckDuckGo
 */

export type WebSearchHit = {
  title: string;
  url: string;
  snippet: string;
  publisher?: string;
  publicationDate?: string;
  discoveredVia: string;
};

const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

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

function decodeHtml(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;/g, "'")
    .trim();
}

function stripPublisherSuffix(title: string): string {
  return title.replace(/\s+[-–—|]\s+[^-–—|]+$/, "").trim();
}

/** Requêtes dérivées d'une caption Telegram / titre Rempart. */
export function buildWebSearchQueries(
  subject: string,
  extra: string[] = [],
): string[] {
  const raw = subject.replace(/\s+/g, " ").trim();
  const queries: string[] = [];

  if (raw.length >= 12) queries.push(raw.slice(0, 160));

  const soft = raw
    .replace(
      /\b(UNE CHAÎNE BELGE DE GAUCHE|POUR FAIRE PLEURER DANS LES CHAUMIÈRES)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  if (soft.length >= 12 && soft.toLowerCase() !== raw.toLowerCase()) {
    queries.push(soft.slice(0, 140));
  }

  const tokens = raw
    .split(/[^A-Za-zÀ-ÿ0-9]+/)
    .filter((t) => t.length >= 3)
    .filter(
      (t) =>
        !/^(UNE|DES|LES|POUR|DANS|AVEC|ÉTÉ|PRISE|TRAIN|DEMANDE|DEMANDE|CHAÎNE|BELGE|GAUCHE)$/i.test(
          t,
        ),
    );
  const entityQuery = tokens.slice(0, 8).join(" ");
  if (entityQuery.length >= 10) queries.push(entityQuery);

  if (/vrt/i.test(raw)) {
    queries.push("VRT news migrant mineur scène triste");
    queries.push("VRT NWS Ceuta migranten");
    queries.push("VRT migrant minor staging crying");
  }
  if (/migrant|asile|oqtf|mineur/i.test(raw)) {
    queries.push(`${tokens.slice(0, 5).join(" ")} actualité`);
  }

  for (const q of extra) {
    if (q.trim().length >= 8) queries.push(q.trim().slice(0, 140));
  }

  return [...new Set(queries.map((q) => q.trim()).filter((q) => q.length >= 8))].slice(
    0,
    6,
  );
}

function extractJsonObject(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = (fenced || text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    /* continue */
  }
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

function parseHitsPayload(
  payload: unknown,
  via: string,
): WebSearchHit[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as { hits?: unknown[] };
  const rows = Array.isArray(root.hits) ? root.hits : [];
  const out: WebSearchHit[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const title = String(r.title || "").trim();
    const url = String(r.url || "").trim();
    const snippet = String(r.snippet || r.description || "").trim();
    const publisher = String(r.publisher || r.source || "").trim();
    if (title.length < 8 || !/^https?:\/\//i.test(url)) continue;
    if (/example\.com|localhost/i.test(url)) continue;
    out.push({
      title: title.slice(0, 240),
      url,
      snippet: snippet.slice(0, 600),
      publisher: publisher || undefined,
      discoveredVia: via,
    });
  }
  return out;
}

type MoonshotMsg = Record<string, unknown>;

/**
 * Recherche via Moonshot `$web_search` (builtin).
 * kimi-k3 a un bug tokenization au round 2 → on force kimi-k2.6.
 */
async function searchMoonshotWeb(subject: string): Promise<WebSearchHit[]> {
  const apiKey = process.env.MOONSHOT_API_KEY?.trim();
  if (!apiKey) return [];

  const model =
    process.env.KIMI_SEARCH_MODEL?.trim() ||
    process.env.KIMI_WEB_SEARCH_MODEL?.trim() ||
    "kimi-k2.6";

  const queries = buildWebSearchQueries(subject).slice(0, 4);
  const messages: MoonshotMsg[] = [
    {
      role: "system",
      content:
        "Tu es un assistant de recherche journalistique. Utilise TOUJOURS l'outil $web_search. " +
        "Après la recherche, réponds UNIQUEMENT avec un JSON valide (pas de markdown, pas de prose) : " +
        '{"hits":[{"title":"...","url":"https://...","snippet":"...","publisher":"..."}]} ' +
        "Maximum 10 hits. Inclus les sources pertinentes OU les articles voisins vérifiables. " +
        "N'invente aucune URL. Si rien de précis, renvoie quand même les meilleurs résultats voisins trouvés.",
    },
    {
      role: "user",
      content:
        `Sujet / caption Telegram à documenter :\n${subject.slice(0, 400)}\n\n` +
        `Requêtes suggérées (utilise-en 1 à 3 via $web_search) :\n` +
        queries.map((q, i) => `${i + 1}. ${q}`).join("\n") +
        `\n\nRenvoie ensuite uniquement le JSON hits.`,
    },
  ];

  let finishReason: string | undefined;
  let rounds = 0;
  let lastContent = "";

  while (rounds < 4) {
    rounds++;
    const body: Record<string, unknown> = {
      model,
      max_tokens: 2500,
      messages,
      tools: [
        {
          type: "builtin_function",
          function: { name: "$web_search" },
        },
      ],
    };
    if (model.includes("k2.6") || model.includes("k2.5")) {
      body.thinking = { type: "disabled" };
    } else if (model.includes("k3")) {
      body.reasoning_effort = "low";
    }

    const res = await fetch("https://api.moonshot.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(75_000),
    });

    const data = (await res.json()) as {
      choices?: Array<{
        finish_reason?: string;
        message?: {
          role?: string;
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            type?: string;
            function: { name: string; arguments: string };
          }>;
          reasoning_content?: string;
        };
      }>;
      error?: { message?: string };
    };

    if (!res.ok) {
      throw new Error(
        data.error?.message || `Moonshot search HTTP ${res.status}`,
      );
    }

    const choice = data.choices?.[0];
    if (!choice?.message) break;
    finishReason = choice.finish_reason;
    lastContent = choice.message.content?.trim() || "";

    if (finishReason === "tool_calls" && choice.message.tool_calls?.length) {
      messages.push(choice.message as MoonshotMsg);
      for (const tc of choice.message.tool_calls) {
        let args: unknown = {};
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          args = {};
        }
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          name: tc.function.name,
          content: JSON.stringify(args),
        });
      }
      continue;
    }

    // stop / length : tenter parse ; sinon 1 relance JSON only
    const parsed = parseHitsPayload(
      extractJsonObject(lastContent),
      `moonshot_web:${model}`,
    );
    if (parsed.length > 0) return parsed;

    if (rounds < 4 && finishReason !== "tool_calls") {
      messages.push({
        role: "assistant",
        content: lastContent || "",
      });
      messages.push({
        role: "user",
        content:
          'Réponds maintenant UNIQUEMENT avec le JSON {"hits":[...]} à partir des résultats de recherche. Aucune prose.',
      });
      continue;
    }
    break;
  }

  return parseHitsPayload(
    extractJsonObject(lastContent),
    `moonshot_web:${model}`,
  );
}

async function fetchRssItems(
  feedUrl: string,
  via: string,
): Promise<WebSearchHit[]> {
  const res = await fetch(feedUrl, {
    headers: {
      "User-Agent": CHROME_UA,
      Accept: "application/rss+xml, application/xml, text/xml, */*",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  const xml = await res.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 8);
  const out: WebSearchHit[] = [];

  for (const match of items) {
    const block = match[1]!;
    const titleRaw = block.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
    const linkRaw =
      block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ||
      block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1];
    if (!titleRaw || !linkRaw) continue;
    const title = stripPublisherSuffix(decodeXml(titleRaw));
    const link = decodeXml(linkRaw).trim();
    if (title.length < 8 || !/^https?:\/\//i.test(link)) continue;
    const desc = decodeXml(
      block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || "",
    );
    const source = decodeXml(
      block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] || "",
    );
    const published = decodeXml(
      block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || "",
    );
    out.push({
      title,
      url: link,
      snippet: desc.slice(0, 600),
      publisher: source || undefined,
      publicationDate: published || undefined,
      discoveredVia: via,
    });
  }
  return out;
}

async function searchGoogleNews(query: string): Promise<WebSearchHit[]> {
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "fr");
  url.searchParams.set("gl", "FR");
  url.searchParams.set("ceid", "FR:fr");
  return fetchRssItems(url.toString(), `google_news:${query.slice(0, 50)}`);
}

async function searchBingNews(query: string): Promise<WebSearchHit[]> {
  const url = new URL("https://www.bing.com/news/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "RSS");
  url.searchParams.set("mkt", "fr-FR");
  return fetchRssItems(url.toString(), `bing_news:${query.slice(0, 50)}`);
}

function decodeBingRedirect(href: string): string {
  const raw = href.replace(/&amp;/g, "&").trim();
  try {
    const u = new URL(raw, "https://www.bing.com");
    const encoded = u.searchParams.get("u");
    if (encoded) {
      const b64 = encoded
        .replace(/^a1/, "")
        .replace(/-/g, "+")
        .replace(/_/g, "/");
      const decoded = Buffer.from(b64, "base64").toString("utf8");
      if (/^https?:\/\//i.test(decoded)) return decoded;
    }
  } catch {
    /* keep */
  }
  if (/^https?:\/\//i.test(raw) && !/bing\.com\/ck\//i.test(raw)) return raw;
  return "";
}

/** Bing HTML organique — plus stable que le RSS Bing News. */
async function searchBingHtml(query: string): Promise<WebSearchHit[]> {
  const url = new URL("https://www.bing.com/search");
  url.searchParams.set("q", query);
  url.searchParams.set("setlang", "fr-FR");
  url.searchParams.set("cc", "FR");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": CHROME_UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return [];
  const html = await res.text();
  const blocks = html.split(/class="b_algo"/i).slice(1, 10);
  const out: WebSearchHit[] = [];

  for (const block of blocks) {
    const a = block.match(
      /<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i,
    );
    if (!a) continue;
    const href = decodeBingRedirect(a[1]!);
    const title = decodeHtml(a[2] || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const snippetRaw =
      block.match(/class="b_caption"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ||
      block.match(/<p class="b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ||
      "";
    const snippet = decodeHtml(snippetRaw)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!href || title.length < 8) continue;
    out.push({
      title,
      url: href,
      snippet: snippet.slice(0, 600),
      discoveredVia: `bing_html:${query.slice(0, 50)}`,
    });
  }
  return out;
}

async function searchDuckDuckGo(query: string): Promise<WebSearchHit[]> {
  const url = new URL("https://html.duckduckgo.com/html/");
  url.searchParams.set("q", query);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "User-Agent": CHROME_UA,
      Accept: "text/html",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ q: query }).toString(),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return [];
  const html = await res.text();
  const out: WebSearchHit[] = [];

  const blocks = html.split(/class="result__body"|class='result__body'/i);
  for (const block of blocks.slice(1, 10)) {
    const hrefMatch =
      block.match(
        /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i,
      ) ||
      block.match(/uddg=([^&"]+).*?class="result__a"[^>]*>([\s\S]*?)<\/a>/i);
    const snippetMatch = block.match(
      /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i,
    );

    let href = "";
    let title = "";
    if (hrefMatch) {
      href = decodeHtml(hrefMatch[1] || "");
      title = decodeHtml(hrefMatch[2] || "")
        .replace(/<[^>]+>/g, "")
        .trim();
      const uddg = href.match(/[?&]uddg=([^&]+)/);
      if (uddg) {
        try {
          href = decodeURIComponent(uddg[1]!);
        } catch {
          /* keep */
        }
      }
      if (href.startsWith("//")) href = `https:${href}`;
    }
    const snippet = decodeHtml(snippetMatch?.[1] || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!/^https?:\/\//i.test(href) || title.length < 8) continue;
    if (/duckduckgo\.com\//i.test(href) && !href.includes("uddg=")) continue;

    out.push({
      title,
      url: href,
      snippet: snippet.slice(0, 600),
      discoveredVia: `duckduckgo:${query.slice(0, 50)}`,
    });
  }

  return out;
}

async function searchBrave(query: string): Promise<WebSearchHit[]> {
  const key = process.env.BRAVE_API_KEY?.trim();
  if (!key) return [];
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", "8");
  url.searchParams.set("search_lang", "fr");
  url.searchParams.set("country", "FR");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": key,
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    web?: {
      results?: Array<{ title?: string; url?: string; description?: string }>;
    };
  };
  return (data.web?.results || [])
    .filter((r) => r.url && r.title)
    .map((r) => ({
      title: r.title!,
      url: r.url!,
      snippet: (r.description || "").slice(0, 600),
      discoveredVia: `brave:${query.slice(0, 50)}`,
    }));
}

async function searchSerper(query: string): Promise<WebSearchHit[]> {
  const key = process.env.SERPER_API_KEY?.trim();
  if (!key) return [];
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, gl: "fr", hl: "fr", num: 8 }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
    news?: Array<{
      title?: string;
      link?: string;
      snippet?: string;
      source?: string;
    }>;
  };
  const hits: WebSearchHit[] = [];
  for (const n of data.news || []) {
    if (!n.link || !n.title) continue;
    hits.push({
      title: n.title,
      url: n.link,
      snippet: (n.snippet || "").slice(0, 600),
      publisher: n.source,
      discoveredVia: `serper_news:${query.slice(0, 50)}`,
    });
  }
  for (const o of data.organic || []) {
    if (!o.link || !o.title) continue;
    hits.push({
      title: o.title,
      url: o.link,
      snippet: (o.snippet || "").slice(0, 600),
      discoveredVia: `serper:${query.slice(0, 50)}`,
    });
  }
  return hits;
}

function dedupeHits(hits: WebSearchHit[]): WebSearchHit[] {
  const seen = new Set<string>();
  const out: WebSearchHit[] = [];
  for (const h of hits) {
    const key = h.url.split("?")[0]!.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

function isHomepageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    return path === "" || /^\/(fr|en|nl|vrtnws\/(fr|en|nl))?$/i.test(path);
  } catch {
    return false;
  }
}

function relevanceScore(hit: WebSearchHit, subject: string): number {
  const hay = `${hit.title} ${hit.snippet} ${hit.publisher || ""}`.toLowerCase();
  const tokens = subject
    .toLowerCase()
    .split(/[^a-zà-ÿ0-9]+/i)
    .filter((t) => t.length >= 4)
    .filter(
      (t) =>
        !/^(une|des|les|pour|dans|avec|été|prise|train|chaine|belge|gauche|faire|pleurer|chaumieres)$/i.test(
          t,
        ),
    );
  let s = Math.min(hit.snippet.length, 400);
  for (const t of tokens.slice(0, 12)) {
    if (hay.includes(t)) s += 40;
  }
  // Accusation / mise en scène : boost fort (souvent sur X / réseaux)
  if (
    /mise en sc[eè]ne|staging|film[eé]s? en train|toneel|rejouer|sur commande|fake cry|jouer une sc[eè]ne/i.test(
      hay,
    )
  ) {
    s += 280;
  }
  if (/x\.com\/|twitter\.com\//i.test(hit.url)) s += 160;
  if (/vrt\.be\/vrtnws\/.+\/\d{4}\//i.test(hit.url)) s += 140;
  else if (/vrt\.be|rtbf|lesoir|lalibre|lefigaro|lemonde|bbc|reuters|afp/i.test(hit.url))
    s += 80;
  if (isHomepageUrl(hit.url)) s -= 200;
  if (/news\.google|bing\.com\/news|bing\.com\/ck|vrtmax|tvgids/i.test(hit.url))
    s -= 120;
  if (/moonshot_web/i.test(hit.discoveredVia)) s += 60;
  return s;
}

/**
 * Recherche multi-sources. Retourne titres + URLs + snippets exploitables
 * même si le scrape HTML des pages est ensuite bloqué.
 */
export async function searchWebForSubject(input: {
  subject: string;
  extraQueries?: string[];
}): Promise<WebSearchHit[]> {
  const queries = buildWebSearchQueries(input.subject, input.extraQueries);
  if (queries.length === 0) return [];

  const primary = queries[0]!;
  const secondary = queries.slice(1, 4);

  // 1) Moonshot d'abord (chemin principal)
  let moonshotHits: WebSearchHit[] = [];
  try {
    moonshotHits = await searchMoonshotWeb(input.subject);
  } catch (e) {
    console.error("moonshot web search failed", e);
  }

  // 2) Fallbacks en parallèle (toujours, pour diversifier)
  const batches = await Promise.all([
    searchSerper(primary).catch(() => [] as WebSearchHit[]),
    searchBrave(primary).catch(() => [] as WebSearchHit[]),
    searchBingHtml(secondary[0] || primary).catch(() => [] as WebSearchHit[]),
    searchGoogleNews(secondary[0] || primary).catch(() => [] as WebSearchHit[]),
    searchBingNews(secondary[0] || primary).catch(() => [] as WebSearchHit[]),
    searchDuckDuckGo(secondary[0] || primary).catch(() => [] as WebSearchHit[]),
    ...secondary.slice(0, 2).map((q) =>
      searchGoogleNews(q).catch(() => [] as WebSearchHit[]),
    ),
    ...secondary.slice(0, 2).map((q) =>
      searchBingHtml(q).catch(() => [] as WebSearchHit[]),
    ),
  ]);

  const merged = dedupeHits([...moonshotHits, ...batches.flat()]);
  merged.sort(
    (a, b) =>
      relevanceScore(b, input.subject) - relevanceScore(a, input.subject),
  );

  return merged.slice(0, 12);
}
