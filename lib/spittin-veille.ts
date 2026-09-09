export type SpittinVeilleArticle = {
  id: number;
  url: string;
  title: string;
  source_id: string;
  source_name: string;
  published_at: string | null;
  detected_at: string | null;
  keywords: string[];
  read: boolean;
};

const DEFAULT_FEED = "https://veille.spittinllc.fr/api/articles";

export function foldNewsTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const STOP = new Set([
  "dans",
  "pour",
  "avec",
  "sans",
  "sous",
  "chez",
  "vers",
  "apres",
  "avant",
  "selon",
  "entre",
  "contre",
  "depuis",
  "pendant",
  "alors",
  "aussi",
  "encore",
  "tous",
  "tout",
  "toute",
  "toutes",
  "cette",
  "cet",
  "ces",
  "des",
  "les",
  "une",
  "aux",
  "dont",
  "plus",
  "moins",
  "tres",
  "fait",
  "etre",
  "avoir",
  "sont",
  "etait",
  "comme",
  "mais",
  "donc",
  "quand",
  "quoi",
  "quel",
  "quelle",
  "apres",
  "france",
  "francais",
  "francaises",
]);

export function significantWords(title: string): string[] {
  return foldNewsTitle(title)
    .split(" ")
    .filter((w) => w.length > 3 && !STOP.has(w));
}

/** Même affaire / quasi même titre (sources différentes du fil de veille). */
export function sameStory(a: string, b: string): boolean {
  const wa = significantWords(a);
  const wb = significantWords(b);
  if (wa.length === 0 || wb.length === 0) return false;
  const sa = new Set(wa);
  const sb = new Set(wb);
  let hits = 0;
  for (const w of wb) if (sa.has(w)) hits += 1;
  const shorter = Math.min(sa.size, sb.size);
  if (hits >= 3) return true;
  if (shorter >= 3 && hits / shorter >= 0.55) return true;
  const ja = wa.slice(0, 6).join(" ");
  const jb = wb.slice(0, 6).join(" ");
  return ja.length > 12 && (ja === jb || ja.includes(jb) || jb.includes(ja));
}

export async function fetchSpittinVeille(hours = 30): Promise<SpittinVeilleArticle[]> {
  const url = process.env.SPITTIN_VEILLE_URL?.trim() || DEFAULT_FEED;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Veille Spittin HTTP ${res.status}`);
  }
  const data = (await res.json()) as { articles?: SpittinVeilleArticle[] };
  const rows = Array.isArray(data.articles) ? data.articles : [];
  const since = Date.now() - hours * 60 * 60 * 1000;
  return rows.filter((row) => {
    const stamp = row.published_at || row.detected_at;
    if (!stamp) return true;
    const t = Date.parse(stamp);
    if (!Number.isFinite(t)) return true;
    return t >= since;
  });
}
