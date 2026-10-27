/**
 * Remplace les illustrations cassées ou minuscules (miniatures Google Images)
 * par une image libre de droits trouvée sur Wikimedia Commons, hébergée sur le site,
 * avec le crédit de l'auteur ajouté sous l'article.
 *
 *   npx tsx scripts/replace-broken-covers.ts           # essai à blanc
 *   npx tsx scripts/replace-broken-covers.ts --apply   # écrit en base (sauvegarde avant)
 */
import { readFileSync, writeFileSync } from "fs";

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2];
}

const APPLY = process.argv.includes("--apply");
const SITE = "https://www.le-rempart.org";
const CREDIT_MARK = "*Illustration :";
const FREE_LICENSE = /^(CC0|Public domain|PD|CC BY(-SA)? \d)/i;

type FreeImage = {
  title: string;
  /** Version 1600 px servie par Commons. */
  url: string;
  width: number;
  creator: string;
  license: string;
  page: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Noms complets du titre : deux ou trois mots à majuscule qui se suivent (« Gabriel Attal »). */
function fullNames(title: string): string[] {
  const words = title.replace(/[«»"“”:;,.!?()]/g, " ").split(/\s+/).filter(Boolean);
  const names: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    const cap = (w?: string) => Boolean(w && /^\p{Lu}[\p{Ll}'’-]+$/u.test(w));
    if (!cap(words[i]) || !cap(words[i + 1])) continue;
    const three = cap(words[i + 2]) ? `${words[i]} ${words[i + 1]} ${words[i + 2]}` : null;
    if (three) names.push(three);
    names.push(`${words[i]} ${words[i + 1]}`);
  }
  return [...new Set(names)];
}

const stripHtml = (html: string) =>
  html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const UA = { "User-Agent": "LeRempartBot/1.0 (contact@le-rempart.org)" };

/**
 * Photo principale de la page Wikipédia d'une personne nommée en toutes lettres.
 * La page doit porter exactement ce nom (pas d'homonyme approximatif) et décrire une personne.
 */
async function personPhoto(name: string): Promise<(FreeImage & { name: string }) | null> {
  const res = await fetch(
    `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g, "_"))}?redirect=true`,
    { headers: UA },
  );
  if (!res.ok) return null;
  const page = (await res.json()) as {
    type?: string;
    title?: string;
    description?: string;
    originalimage?: { source: string; width: number };
  };
  if (page.type !== "standard" || !page.originalimage) return null;
  if ((page.title || "").toLowerCase() !== name.toLowerCase()) return null;
  if (!/(homme|femme|personnalité) politique|(homme|femme) d'État|ministre|député|sénat|maire|président|journaliste|militant|syndicaliste|chanteu|rappeu|humoriste|animat|chroniqueu|essayiste|avocat|magistrat|footballeu|acteur|actrice|influenceu|entrepreneu|écrivain|policier|préfet|général|économiste|polémiste|personnalité/i.test(page.description || "")) {
    return null;
  }
  const file = decodeURIComponent(page.originalimage.source.split("?")[0]!.split("/").pop() || "");
  const info = await fetch(
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(`File:${file}`)}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1600&iiextmetadatafilter=LicenseShortName|Artist`,
    { headers: UA },
  ).then((r) => r.json() as Promise<{ query?: { pages?: Record<string, { imageinfo?: Array<{ width: number; mime: string; thumburl?: string; descriptionurl: string; extmetadata?: Record<string, { value?: string }> }> }> } }>);
  const ii = Object.values(info.query?.pages || {})[0]?.imageinfo?.[0];
  const license = ii?.extmetadata?.LicenseShortName?.value || "";
  if (!ii?.thumburl || ii.width < 1200 || !/jpeg|png/.test(ii.mime) || !FREE_LICENSE.test(license)) return null;
  return {
    name,
    title: page.title!,
    url: ii.thumburl,
    width: ii.width,
    creator: stripHtml(ii.extmetadata?.Artist?.value || ""),
    license,
    page: ii.descriptionurl,
  };
}

async function imageWidth(url: string, sharp: typeof import("sharp")): Promise<number> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return 0;
    return (await sharp(Buffer.from(await res.arrayBuffer())).metadata()).width ?? 0;
  } catch {
    return 0;
  }
}

function credit(img: FreeImage): string {
  const clean = (t: string) => t.replace(/[*[\]]/g, "").slice(0, 120);
  const by = img.creator ? ` par ${clean(img.creator)}` : "";
  return `${CREDIT_MARK} ${clean(img.title)}${by}, licence ${img.license}, [Wikimedia Commons](${img.page}).*`;
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const sharp = (await import("sharp")).default;
  const { prepareSiteIllustration } = await import("../lib/illustration");
  const prisma = new PrismaClient();

  const rows = await prisma.article.findMany({
    where: { status: "published", illustrationData: null },
    select: { id: true, publicId: true, title: true, content: true, coverImageUrl: true },
    orderBy: { publicId: "desc" },
  });

  const targets: Array<(typeof rows)[number] & { broken: boolean }> = [];
  for (const r of rows) {
    const url = r.coverImageUrl || "";
    const broken = !url || (await imageWidth(url, sharp)) === 0;
    if (broken || /gstatic\.com/.test(url)) targets.push({ ...r, broken });
  }
  console.log(`${targets.length} illustrations cassées, absentes ou minuscules.\n`);

  const backup: Array<{ id: string; coverImageUrl: string | null; content: string }> = [];
  let replaced = 0;
  let cleared = 0;
  for (const a of targets) {
    let img: Awaited<ReturnType<typeof personPhoto>> = null;
    for (const name of fullNames(a.title)) {
      img = await personPhoto(name);
      await sleep(300);
      if (img) break;
    }
    console.log(`#${a.publicId} ${a.title.slice(0, 80)}\n   → ${img ? `photo de ${img.title} (${img.width} px, ${img.license})` : a.broken ? "aucune personne identifiée : image cassée retirée" : "aucune personne identifiée : miniature conservée"}`);
    if (!APPLY || (!img && !a.broken)) continue;

    backup.push({ id: a.id, coverImageUrl: a.coverImageUrl, content: a.content });
    if (img) {
      try {
        const res = await fetch(img.url, { signal: AbortSignal.timeout(30_000), headers: { "User-Agent": "Mozilla/5.0" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const prepared = await prepareSiteIllustration({ buffer: Buffer.from(await res.arrayBuffer()) });
        const content = a.content.includes(CREDIT_MARK) ? a.content : `${a.content.trimEnd()}\n\n${credit(img)}`;
        await prisma.$executeRaw`UPDATE "Article" SET "illustrationData" = ${prepared.buffer}, "illustrationMime" = ${prepared.mime}, "coverImageUrl" = ${`${SITE}/api/media/${a.id}/illustration`}, content = ${content} WHERE id = ${a.id}`;
        replaced += 1;
        continue;
      } catch (err) {
        console.log(`   téléchargement impossible (${err instanceof Error ? err.message : err})`);
      }
    }
    // Sans image libre : on retire l'image cassée plutôt que d'afficher un cadre vide.
    await prisma.$executeRaw`UPDATE "Article" SET "coverImageUrl" = NULL WHERE id = ${a.id}`;
    cleared += 1;
  }

  if (APPLY) {
    const file = `tmp/backup-covers-${Date.now()}.json`;
    writeFileSync(file, JSON.stringify(backup));
    console.log(`\nSauvegarde : ${file}\n${replaced} images remplacées, ${cleared} images cassées retirées.`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
