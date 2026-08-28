const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
};

/** Domaines souvent 403 / paywall depuis IPs datacenter (Vercel). */
const PREFER_JINA_HOSTS = [
  "leparisien.fr",
  "lemonde.fr",
  "lefigaro.fr",
  "liberation.fr",
  "lesechos.fr",
  "latribune.fr",
  "lopinion.fr",
  "mediapart.fr",
  "lexpress.fr",
  "lepoint.fr",
  "nouvelobs.com",
  "bfmtv.com",
];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function preferJina(url: string): boolean {
  const host = hostOf(url);
  return PREFER_JINA_HOSTS.some(
    (h) => host === h || host.endsWith(`.${h}`),
  );
}

function looksBlocked(body: string): boolean {
  if (body.length < 800) {
    return /requires JS enabled|captcha|cf-browser-verification|incapsula|access denied|forbidden/i.test(
      body,
    );
  }
  return /cf-browser-verification|attention required|just a moment/i.test(
    body.slice(0, 2000),
  );
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'");
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<\/(p|div|h[1-6]|li|br|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  );
}

function cleanText(text: string): string {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * Purge bandeaux cookies / abonnement / CMP qui polluent scrapes & flash FB.
 * Patterns volontairement bornés pour ne pas manger le corps de l'article.
 */
export function scrubBoilerplate(text: string): string {
  let t = text.replace(/\r\n/g, "\n");

  const blockPatterns: RegExp[] = [
    /s[’']abonner et refuser les cookies[^\n]*(?:\n[^\n]+){0,12}/gi,
    /accepter les cookies\s*:\s*oui\s*non[^\n]*/gi,
    /accepter les cookies[^\n]{0,200}/gi,
    /un petit geste nous aiderait[^\n]{0,200}/gi,
    /nos\s+\d+\s+journalistes proposent[^\n]*(?:\n[^\n]+){0,8}/gi,
    /pour soutenir le travail de notre rédaction[^\n]*(?:\n[^\n]+){0,8}/gi,
    /nous et nos\s+\d+\s+partenaires[^\n]*(?:\n[^\n]+){0,6}/gi,
    /gérer mes cookies[^\n]{0,120}/gi,
    /continuer sans accepter[^\n]{0,120}/gi,
    /accéder au contenu gratuit[^\n]{0,200}/gi,
    /this site uses cookies[^\n]{0,200}/gi,
  ];
  for (const re of blockPatterns) {
    t = t.replace(re, "\n");
  }

  t = t
    .split(/\n+/)
    .filter((line) => {
      const s = line.trim();
      if (!s) return false;
      if (
        /^(oui|non|accepter|refuser|s[’']abonner|se connecter|gérer mes cookies|paramètres des cookies)\.?$/i.test(
          s,
        )
      ) {
        return false;
      }
      // Ligne quasi entièrement CMP / cookies
      if (
        /^(accepter les cookies|s[’']abonner et refuser|un petit geste|accéder au contenu gratuit)/i.test(
          s,
        )
      ) {
        return false;
      }
      if (
        /cookie|didomi|cmp|consentement|données personnelles|mesure d.audience/i.test(
          s,
        ) &&
        !/\d\s*%|sondage|président|élu|tribunal|condamné|euros?/i.test(s) &&
        s.length < 220
      ) {
        return false;
      }
      return true;
    })
    .join("\n");

  return cleanText(t);
}

/** Retire d'un flash FB les paragraphes cookies / abonnement qui auraient fuité. */
export function scrubFlashOutput(text: string): string {
  const parts = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => {
      if (/cookie|s[’']abonner|didomi|petit geste nous aiderait|accepter\s*:\s*oui|données personnelles|partenaires\)/i.test(p)) {
        return false;
      }
      return true;
    });
  return scrubBoilerplate(parts.join("\n\n"));
}

function extractMeta(html: string, prop: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
    "i",
  );
  return decodeEntities(re.exec(html)?.[1] || re2.exec(html)?.[1] || "");
}

/** Extrait le corps article plutôt que le chrome du site. */
function htmlToPlainText(html: string): string {
  const chunks: string[] = [];
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  if (title) chunks.push(cleanText(stripTags(title)));

  const ogTitle = extractMeta(html, "og:title");
  const ogDesc = extractMeta(html, "og:description");
  if (ogDesc) chunks.push(ogDesc);

  const articleMatch =
    /<article[\s\S]*?<\/article>/i.exec(html)?.[0] ||
    /itemprop=["']articleBody["'][^>]*>([\s\S]*?)<\//i.exec(html)?.[1] ||
    /class=["'][^"']*(?:article__content|article-body|content--article|post-content)[^"']*["'][^>]*>([\s\S]*?)$/i.exec(
      html,
    )?.[0];

  if (articleMatch) {
    chunks.push(cleanText(stripTags(articleMatch)));
  } else {
    chunks.push(cleanText(stripTags(html)));
  }

  if (ogTitle && !chunks[0]?.includes(ogTitle.slice(0, 40))) {
    chunks.unshift(ogTitle);
  }

  return scrubBoilerplate(
    cleanText(chunks.filter(Boolean).join("\n\n")),
  ).slice(0, 12000);
}

/** Heuristique : scrape quasi vide / paywall / menu. */
function isLowQualityScrape(text: string): boolean {
  const t = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words < 120) return true;

  const navHits = (
    t.match(
      /s.abonner|se connecter|newsletter|cookies|mentions légales|accès rapides|guide d.achat/gi,
    ) || []
  ).length;
  const hasFacts =
    /\d{4}|sondage|%|pourcent|président|élu|tribunal|condamné|euros?/i.test(
      text,
    );

  if (navHits >= 4 && words < 400) return true;
  if (navHits >= 6 && !hasFacts) return true;
  if (/réservé aux abonnés|article réservé|pour lire la suite/i.test(t) && words < 250)
    return true;
  return false;
}

function jinaMarkdownToText(md: string): string {
  let body = md;
  const marker = /Markdown Content:\s*/i;
  if (marker.test(body)) {
    body = body.split(marker).slice(1).join("Markdown Content:");
  }
  const title = /^Title:\s*(.+)$/im.exec(md)?.[1]?.trim();
  const cleaned = body
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const out = [title, cleaned].filter(Boolean).join("\n\n");
  return scrubBoilerplate(cleanText(out)).slice(0, 12000);
}

async function fetchDirect(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      ...BROWSER_HEADERS,
      Referer: "https://www.google.fr/",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  }).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    if (/aborted due to timeout|AbortError|TimeoutError/i.test(msg)) {
      throw new Error("Timeout lecture page (15s)");
    }
    throw err instanceof Error ? err : new Error(msg);
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();

  if (looksBlocked(body)) {
    throw new Error("anti-bot");
  }

  if (contentType.includes("text/plain")) {
    const text = body.slice(0, 12000).trim();
    if (text.length < 40) throw new Error("texte trop court");
    return text;
  }

  const text = htmlToPlainText(body);
  if (text.trim().length < 40) {
    throw new Error("HTML sans texte");
  }
  if (isLowQualityScrape(text)) {
    throw new Error("contenu paywall / trop pauvre");
  }
  return text;
}

/**
 * Fallback quand l'IP Vercel est bloquée (403) ou paywall.
 * https://r.jina.ai/
 */
async function fetchViaJina(url: string): Promise<string> {
  const endpoint = `https://r.jina.ai/${url}`;
  const headers: Record<string, string> = {
    Accept: "text/plain",
  };
  const key = process.env.JINA_API_KEY?.trim();
  if (key) headers.Authorization = `Bearer ${key}`;

  const response = await fetch(endpoint, {
    headers,
    signal: AbortSignal.timeout(28000),
  }).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    if (/aborted due to timeout|AbortError|TimeoutError/i.test(msg)) {
      throw new Error("Timeout lecture via proxy (28s)");
    }
    throw err instanceof Error ? err : new Error(msg);
  });

  if (!response.ok) {
    throw new Error(`Jina HTTP ${response.status}`);
  }

  const md = await response.text();
  const text = jinaMarkdownToText(md);
  if (text.length < 80) {
    throw new Error("Jina : contenu trop court");
  }
  return text;
}

/**
 * Récupère le texte d'une URL source.
 * Direct navigateur, sinon (ou d'emblée pour certains titres presse) Jina Reader.
 */
export async function fetchSourceText(url: string): Promise<string> {
  const finish = (text: string) => scrubBoilerplate(text).slice(0, 12000);

  if (preferJina(url)) {
    try {
      const viaJina = finish(await fetchViaJina(url));
      console.log("fetchSourceText prefer-jina OK", hostOf(url), viaJina.length);
      return viaJina;
    } catch (jinaFirstErr) {
      console.error("fetchSourceText prefer-jina failed, try direct", jinaFirstErr);
    }
  }

  try {
    return finish(await fetchDirect(url));
  } catch (directErr) {
    console.error("fetchSourceText direct failed", url, directErr);
    try {
      const viaJina = finish(await fetchViaJina(url));
      console.log("fetchSourceText via Jina OK", url, viaJina.length);
      return viaJina;
    } catch (jinaErr) {
      console.error("fetchSourceText jina failed", url, jinaErr);
      const directMsg =
        directErr instanceof Error ? directErr.message : "échec";
      throw new Error(
        `Impossible de récupérer l'URL (${directMsg}). Fallback lecture aussi en échec.`,
      );
    }
  }
}
