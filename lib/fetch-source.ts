export async function fetchSourceText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "LeRempartBot/1.0 (+https://le-rempart.org)",
      Accept: "text/html,application/xhtml+xml,text/plain",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Impossible de récupérer l'URL (${response.status})`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();

  if (contentType.includes("text/plain")) {
    return body.slice(0, 12000);
  }

  return htmlToPlainText(body).slice(0, 12000);
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
