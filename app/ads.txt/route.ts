/**
 * ads.txt — AdSense + lignes MGID (env, collées depuis le dashboard MGID).
 */
const ADSENSE_LINE =
  "google.com, pub-4084740211919633, DIRECT, f08c47fec0942fa0";

export function GET() {
  const extra = (process.env.MGID_ADS_TXT || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  const body = [ADSENSE_LINE, ...extra, ""].join("\n");

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
