import { articlePublicPath } from "@/lib/article-url";
import { categoryLabel } from "@/lib/categories";
import { newsletterShell } from "@/lib/email";
import { getKimiTextModel } from "@/lib/kimi-legacy";
import { moonshotChat } from "@/lib/moonshot";
import { prisma } from "@/lib/prisma";
import { searchWebForSubject, type WebSearchHit } from "@/lib/research/web-search";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/seo";

export type BriefItem = {
  title: string;
  blurb: string;
  href: string;
  section: string;
  kind: "site" | "veille";
};

const VEILLE_QUERIES = [
  "actualité droite France aujourd'hui",
  "scandale gouvernement France",
  "polémique gauche France Assemblée",
  "immigration France actualité",
  "dépenses publiques gabegie France",
];

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tooSimilar(a: string, b: string): boolean {
  const ta = new Set(fold(a).split(" ").filter((w) => w.length > 4));
  const tb = fold(b).split(" ").filter((w) => w.length > 4);
  if (ta.size === 0) return false;
  const hits = tb.filter((w) => ta.has(w)).length;
  return hits >= 3;
}

async function fetchVeilleHits(): Promise<WebSearchHit[]> {
  const batches = await Promise.all(
    VEILLE_QUERIES.map((q) =>
      searchWebForSubject({ subject: q, fast: true }).catch(
        () => [] as WebSearchHit[],
      ),
    ),
  );
  const seen = new Set<string>();
  const out: WebSearchHit[] = [];
  for (const hits of batches) {
    for (const h of hits) {
      const key = (h.url.split("?")[0] || h.title).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(h);
    }
  }
  return out;
}

async function blurbsForItems(
  items: BriefItem[],
  depth: "free" | "plus",
): Promise<BriefItem[]> {
  if (!process.env.MOONSHOT_API_KEY) return items;
  const maxChars = depth === "plus" ? 720 : 280;
  const instruction =
    depth === "plus"
      ? `Tu rédiges le BRIEF PREMIUM Rempart+ : pour chaque point, 4 à 6 phrases ARGUMENTÉES (faits, noms, chiffres, puis une lecture politique courte, sans sarcasme).`
      : `Tu rédiges le BRIEF GRATUIT : pour chaque point, 1 à 2 phrases denses (faits, noms, chiffres). Pas d'édito.`;

  try {
    const raw = await moonshotChat({
      model: getKimiTextModel(),
      maxTokens: depth === "plus" ? 4200 : 2200,
      timeoutMs: depth === "plus" ? 80_000 : 55_000,
      reasoningEffort: depth === "plus" ? "high" : "low",
      messages: [
        {
          role: "system",
          content: `${instruction}
Réponds UNIQUEMENT JSON : {"items":[{"i":0,"blurb":"..."}]}`,
        },
        {
          role: "user",
          content: items
            .map(
              (it, i) =>
                `#${i} [${it.kind}/${it.section}] ${it.title}\n${it.blurb}\n${it.href}`,
            )
            .join("\n\n"),
        },
      ],
    });
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      items?: Array<{ i?: number; blurb?: string }>;
    };
    const byI = new Map(
      (parsed.items || []).map((row) => [
        Number(row.i),
        String(row.blurb || "").trim(),
      ]),
    );
    return items.map((it, i) => ({
      ...it,
      blurb: (byI.get(i) || it.blurb).slice(0, maxChars),
    }));
  } catch (err) {
    console.error("newsletter blurbs", depth, err);
    return items.map((it) => ({ ...it, blurb: it.blurb.slice(0, maxChars) }));
  }
}

export async function buildTenPointBrief(): Promise<BriefItem[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const articles = await prisma.article.findMany({
    where: { status: "published", publishedAt: { gte: since } },
    orderBy: [{ publishedAt: "desc" }],
    take: 8,
    select: {
      publicId: true,
      title: true,
      excerpt: true,
      category: true,
    },
  });

  const siteItems: BriefItem[] = articles.slice(0, 5).map((a) => ({
    title: a.title,
    blurb: a.excerpt.slice(0, 280),
    href: absoluteUrl(articlePublicPath(a.publicId)),
    section: categoryLabel(a.category),
    kind: "site",
  }));

  const siteTitles = siteItems.map((s) => s.title);
  let veille: BriefItem[] = [];
  try {
    const hits = await fetchVeilleHits();
    for (const h of hits) {
      if (veille.length >= 8) break;
      if (siteTitles.some((t) => tooSimilar(t, h.title))) continue;
      if (veille.some((v) => tooSimilar(v.title, h.title))) continue;
      veille.push({
        title: h.title.slice(0, 180),
        blurb: (h.snippet || h.title).slice(0, 280),
        href: h.url,
        section: h.publisher || "Veille",
        kind: "veille",
      });
    }
  } catch (err) {
    console.error("newsletter veille search", err);
  }

  const needVeille = Math.max(0, 10 - siteItems.length);
  const pickedVeille = veille.slice(0, Math.max(needVeille, 5)).slice(0, 10);
  const combined = [...siteItems, ...pickedVeille].slice(0, 10);

  if (combined.length === 0) return [];
  while (combined.length < 10 && veille.length > combined.length - siteItems.length) {
    const next = veille[combined.length - siteItems.length];
    if (next) combined.push(next);
    else break;
  }

  return combined.slice(0, 10);
}

export async function renderBriefVariants(base: BriefItem[]): Promise<{
  free: BriefItem[];
  plus: BriefItem[];
}> {
  const [free, plus] = await Promise.all([
    blurbsForItems(base, "free"),
    blurbsForItems(base, "plus"),
  ]);
  return { free, plus };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderBriefHtml(opts: {
  dateLabel: string;
  items: BriefItem[];
  premium: boolean;
}): string {
  const { dateLabel, items, premium } = opts;
  const site = (absoluteUrl("/") || SITE_URL).replace(/^https?:\/\//, "");
  const kicker = premium
    ? "Brief premium — l'actu en 10 points, version étayée"
    : "L'actu en 10 points";

  const itemsHtml = items
    .map((it, i) => {
      const tag = it.kind === "site" ? "Le Rempart" : escapeHtml(it.section);
      return `
      <tr>
        <td style="padding:0 0 22px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            <tr>
              <td style="width:36px;vertical-align:top;padding-top:2px;">
                <div style="width:28px;height:28px;border-radius:999px;background:#ffbd59;color:#0a0a0a;font-family:Georgia,serif;font-size:13px;font-weight:700;line-height:28px;text-align:center;">${i + 1}</div>
              </td>
              <td style="vertical-align:top;padding-left:8px;">
                <p style="margin:0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8478;">${tag}</p>
                <p style="margin:6px 0 0;font-size:${premium ? "18px" : "16px"};font-weight:700;line-height:1.25;">
                  <a href="${escapeHtml(it.href)}" style="color:#0a0a0a;text-decoration:none;">${escapeHtml(it.title)}</a>
                </p>
                <p style="margin:8px 0 0;font-size:${premium ? "15px" : "14px"};line-height:1.55;color:#2a2a2a;">${escapeHtml(it.blurb)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join("");

  const header = `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 28px;">
    <tr>
      <td style="background:#0a0a0a;color:#f4f2ed;padding:28px 24px;border-radius:12px;">
        <p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#ffbd59;">${SITE_NAME}</p>
        <h1 style="margin:10px 0 0;font-size:26px;line-height:1.15;font-weight:700;">${escapeHtml(kicker)}</h1>
        <p style="margin:10px 0 0;font-size:14px;color:#cfc8bc;">${escapeHtml(dateLabel)}${premium ? " · Rempart+" : ""}</p>
      </td>
    </tr>
  </table>`;

  const cta = premium
    ? ""
    : `<p style="margin:8px 0 24px;font-size:13px;color:#5c574f;">Les abonnés Rempart+ reçoivent la même sélection, chaque point plus détaillé. <a href="${absoluteUrl("/s-abonner")}" style="color:#0a0a0a;">S'abonner</a></p>`;

  return newsletterShell({
    title: `${kicker} — ${dateLabel}`,
    hideTitle: true,
    bodyHtml: `${header}${cta}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">${itemsHtml}</table>`,
    footerNote: premium
      ? `Vous recevez la version étayée car vous êtes abonné Rempart+.`
      : `Vous recevez ce brief car vous êtes abonné à ${SITE_NAME}.`,
  });
}

export function renderBriefText(items: BriefItem[]): string {
  return items
    .map((it, i) => `${i + 1}. ${it.title}\n${it.blurb}\n${it.href}`)
    .join("\n\n");
}
