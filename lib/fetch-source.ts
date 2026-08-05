export async function fetchSourceText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      // UA navigateur : beaucoup de sites (Vie publique, presse) bloquent les bots explicites.
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      "Cache-Control": "no-cache",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Impossible de récupérer l'URL (${response.status})`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();

  // Challenge JS / cookie wall → quasi vide
  if (
    body.length < 800 &&
    (/requires JS enabled|window\.location\.href\s*=\s*['"]\/redirect_/i.test(
      body,
    ) ||
      /captcha|cf-browser-verification|incapsula/i.test(body))
  ) {
    throw new Error("Page protégée anti-bot (JS/cookie wall)");
  }

  if (contentType.includes("text/plain")) {
    return body.slice(0, 12000);
  }

  const text = htmlToPlainText(body).slice(0, 12000);
  if (text.trim().length < 40) {
    throw new Error("Page HTML sans contenu texte exploitable");
  }
  return text;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|h[1-6]|li|br|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
