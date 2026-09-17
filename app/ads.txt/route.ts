/**
 * ads.txt — AdSense (publi Le Rempart) + vendeurs MGID (dashboard).
 * Les lignes MGID sont versionnées ici : l’env MGID_ADS_TXT reste un complément.
 */
const ADSENSE_LINE =
  "google.com, pub-4084740211919633, DIRECT, f08c47fec0942fa0";

const MGID_ADS_TXT_LINES = [
  "mgid.com, 992496, DIRECT, d4c29acad76ce94f",
  "google.com, pub-2441454515104767, RESELLER, f08c47fec0942fa0",
  "google.com, pub-2441454515104767, DIRECT, f08c47fec0942fa0",
  "rubiconproject.com, 9655, RESELLER, 0bfd66d529a55807",
  "appnexus.com, 15825, RESELLER, f5ab79cb980f11d1",
  "smartadserver.com, 4577, RESELLER, 060d053dcf45cbf3",
  "sharethrough.com, 4577, RESELLER, d53b998a7bd4ecd2",
  "media.net, 8CUTQ396X, DIRECT, 818f58666cabc936",
  "rubiconproject.com, 19396, RESELLER, 0bfd66d529a55807",
  "smaato.com, 1100059563, RESELLER, 07bcf65f187117b4",
  "pubmatic.com, 161673, RESELLER, 5d62403b186f2ace",
  "lijit.com, 349013, DIRECT, fafdf38b16bf6b2b",
  "amxrtb.com, 105199704, DIRECT",
  "sharethrough.com, a6a34444, RESELLER, d53b998a7bd4ecd2",
  "onetag.com, 7cd9d7c7c13ff36, RESELLER",
  "inmobi.com, c2391dc8a51e420480044992fe6dc4d7, RESELLER, 83e75a7ae333ca9d",
  "gamoshi.io, 267-b6491, DIRECT, 20e30b2ae1f670f2",
  "themediagrid.com, YZ2I83, DIRECT, 9fac4a4a87c2a44f",
] as const;

function adsTxtLinesFromEnv(): string[] {
  return (process.env.MGID_ADS_TXT || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

function uniqueAdsTxtLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = line.replace(/\s+/g, " ").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

export function GET() {
  const body =
    uniqueAdsTxtLines([
      ADSENSE_LINE,
      ...MGID_ADS_TXT_LINES,
      ...adsTxtLinesFromEnv(),
    ]).join("\n") + "\n";

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
