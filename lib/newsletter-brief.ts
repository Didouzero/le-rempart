import { articlePublicPath } from "@/lib/article-url";
import { categoryLabel, classifyArticleCategory } from "@/lib/categories";
import { newsletterShell } from "@/lib/email";
import { getKimiTextModel } from "@/lib/kimi-legacy";
import { moonshotChat } from "@/lib/moonshot";
import { prisma } from "@/lib/prisma";
import { absoluteUrl, SITE_NAME } from "@/lib/seo";
import {
  fetchSpittinVeille,
  sameStory,
  type SpittinVeilleArticle,
} from "@/lib/spittin-veille";

export type BriefItem = {
  title: string;
  blurb: string;
  href: string;
  section: string;
  kind: "site" | "veille";
};

function heuristicDedupe(
  rows: SpittinVeilleArticle[],
  blocked: string[],
): SpittinVeilleArticle[] {
  const out: SpittinVeilleArticle[] = [];
  for (const row of rows) {
    if (blocked.some((t) => sameStory(t, row.title))) continue;
    if (out.some((x) => sameStory(x.title, row.title))) continue;
    out.push(row);
  }
  return out;
}

async function pickDistinctVeille(
  rows: SpittinVeilleArticle[],
  blockedTitles: string[],
  want: number,
): Promise<SpittinVeilleArticle[]> {
  const unique = heuristicDedupe(rows, blockedTitles);
  if (unique.length <= want || !process.env.MOONSHOT_API_KEY) {
    return unique.slice(0, want);
  }

  try {
    const payload = unique
      .slice(0, 40)
      .map((r, i) => `#${i} [${r.source_name}] ${r.title}`);
    const raw = await moonshotChat({
      model: getKimiTextModel(),
      maxTokens: 800,
      timeoutMs: 25_000,
      reasoningEffort: "low",
      messages: [
        {
          role: "system",
          content: `Tu sélectionnes des SUJETS DISTINCTS pour un brief d'actualité.
Si plusieurs titres parlent de la MÊME affaire (même personne + même événement, sources différentes), n'en garde QU'UN (le plus informatif).
Écarte tout ce qui est trop proche des titres déjà retenus (liste « déjà »).
Réponds UNIQUEMENT JSON : {"keep":[0,3,5]} indices parmi la liste numérotée, au plus ${want} indices.`,
        },
        {
          role: "user",
          content: `Déjà retenus (ne pas répéter) :\n${blockedTitles.map((t) => `- ${t}`).join("\n") || "(aucun)"}\n\nCandidats :\n${payload.join("\n")}`,
        },
      ],
    });
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { keep?: number[] };
    const keep = [...new Set((parsed.keep || []).map((n) => Number(n)))].filter(
      (n) => Number.isFinite(n) && n >= 0 && n < unique.length,
    );
    const picked: SpittinVeilleArticle[] = [];
    for (const i of keep) {
      const row = unique[i];
      if (!row) continue;
      if (picked.some((p) => sameStory(p.title, row.title))) continue;
      picked.push(row);
      if (picked.length >= want) break;
    }
    if (picked.length > 0) return picked.slice(0, want);
  } catch (err) {
    console.error("newsletter veille cluster", err);
  }
  return unique.slice(0, want);
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
  const needVeille = Math.max(0, 10 - siteItems.length);
  let veille: BriefItem[] = [];
  try {
    const feed = await fetchSpittinVeille(30);
    const picked = await pickDistinctVeille(
      feed,
      siteTitles,
      Math.max(needVeille, 5),
    );
    veille = picked.map((h) => ({
      title: h.title.slice(0, 180),
      blurb: h.title.slice(0, 280),
      href: h.url,
      section: categoryLabel(
        classifyArticleCategory({
          title: h.title,
          excerpt: (h.keywords || []).join(" "),
        }),
      ),
      kind: "veille" as const,
    }));
  } catch (err) {
    console.error("newsletter spittin veille", err);
  }

  const combined: BriefItem[] = [];
  for (const it of [...siteItems, ...veille]) {
    if (combined.some((c) => sameStory(c.title, it.title))) continue;
    combined.push(it);
    if (combined.length >= 10) break;
  }
  return combined;
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
  const kicker = premium
    ? "Brief premium — l'actu en 10 points, version étayée"
    : "L'actu en 10 points";

  const itemsHtml = items
    .map((it, i) => {
      const tag = escapeHtml(it.section);
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
