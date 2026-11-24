import { articlePublicPath } from "@/lib/article-url";
import { categoryLabel, classifyArticleCategory } from "@/lib/categories";
import { EMAIL_COLORS, EMAIL_FONTS, newsletterShell } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { absoluteUrl, SITE_NAME } from "@/lib/seo";
import {
  fetchSpittinVeille,
  sameStory,
  type SpittinVeilleArticle,
} from "@/lib/spittin-veille";

/**
 * « L'actu en 10 points » : le site prépare les candidats, Claude les choisit et les rédige
 * sur le VPS (méthode rediger-newsletter), le site met en page et envoie. Aucun autre
 * modèle n'intervient : sans Claude, la newsletter part avec les chapôs du site.
 */

export type BriefItem = {
  title: string;
  blurb: string;
  href: string;
  section: string;
  kind: "site" | "veille";
  /** Média d'origine d'un point de veille, affiché pour que le lecteur sache où il va. */
  source?: string;
};

/** Sujet proposé à Claude : il choisit parmi eux, il n'invente ni sujet ni lien. */
export type BriefCandidate = {
  /** « s1 », « s2 »… pour le site, « v1 », « v2 »… pour la veille. */
  id: string;
  kind: "site" | "veille";
  title: string;
  /** Chapô de l'article du site ; vide pour la veille, dont Claude lit la page. */
  excerpt: string;
  href: string;
  section: string;
  source?: string;
};

/** Ce que Claude rend pour un point : le titre et les deux versions du texte. */
export type ClaudeBriefPoint = {
  id: string;
  title: string;
  free: string;
  plus: string;
};

export const BRIEF_MAX_POINTS = 10;
export const FREE_MAX_CHARS = 420;
export const PLUS_MAX_CHARS = 1400;

/**
 * Raccourcit un texte sans jamais couper une phrase : on garde les phrases entières
 * qui tiennent dans la limite. Si la première phrase dépasse déjà, le texte reste entier.
 */
export function fitSentences(text: string, maxChars: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= maxChars) return t;
  const sentences = t.match(/[^.!?…]+[.!?…]+["»”)]?(\s+|$)/g);
  if (!sentences) return t;
  let out = "";
  for (const sentence of sentences) {
    if ((out + sentence).trim().length > maxChars) break;
    out += sentence;
  }
  return out.trim() || t;
}

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

/** Articles du site des dernières 24 h, puis les titres de la veille, sans doublon. */
export async function buildNewsletterCandidates(): Promise<BriefCandidate[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const articles = await prisma.article.findMany({
    where: { status: "published", publishedAt: { gte: since } },
    orderBy: [{ publishedAt: "desc" }],
    take: BRIEF_MAX_POINTS,
    select: { publicId: true, title: true, excerpt: true, category: true },
  });
  const site: BriefCandidate[] = articles.map((a, i) => ({
    id: `s${i + 1}`,
    kind: "site",
    title: a.title,
    excerpt: a.excerpt.trim(),
    href: absoluteUrl(articlePublicPath(a.publicId)),
    section: categoryLabel(a.category),
  }));

  let veille: BriefCandidate[] = [];
  if (site.length < BRIEF_MAX_POINTS) {
    try {
      const feed = await fetchSpittinVeille(30);
      veille = heuristicDedupe(feed, site.map((s) => s.title))
        .slice(0, 40)
        .map((h, i) => ({
          id: `v${i + 1}`,
          kind: "veille" as const,
          title: h.title,
          excerpt: "",
          href: h.url,
          section: categoryLabel(
            classifyArticleCategory({ title: h.title, excerpt: (h.keywords || []).join(" ") }),
          ),
          source: h.source_name || undefined,
        }));
    } catch (err) {
      console.error("newsletter: veille indisponible", err);
    }
  }
  return [...site, ...veille];
}

/**
 * Sans Claude : seuls les articles du site, avec leur chapô entier. La veille n'est pas
 * reprise, car personne n'a vérifié qu'elle est française et dans la ligne.
 */
export function fallbackBrief(candidates: BriefCandidate[]): {
  free: BriefItem[];
  plus: BriefItem[];
} {
  const items: BriefItem[] = candidates
    .filter((c) => c.kind === "site")
    .slice(0, BRIEF_MAX_POINTS)
    .map((c) => ({
      title: c.title,
      blurb: c.excerpt,
      href: c.href,
      section: c.section,
      kind: "site",
    }));
  return { free: items, plus: items };
}

/**
 * Contrôle ce que Claude rend avant tout envoi. Les liens et les rubriques viennent
 * toujours des candidats : Claude choisit et rédige, il ne fournit aucune adresse.
 */
export function briefFromClaude(
  candidates: BriefCandidate[],
  points: ClaudeBriefPoint[],
): { free: BriefItem[]; plus: BriefItem[] } {
  const errors: string[] = [];
  if (!Array.isArray(points) || points.length === 0) errors.push("Aucun point.");
  if (points.length > BRIEF_MAX_POINTS) errors.push(`${points.length} points : ${BRIEF_MAX_POINTS} au plus.`);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const free: BriefItem[] = [];
  const plus: BriefItem[] = [];
  for (const [i, p] of (points || []).entries()) {
    const label = `Point ${i + 1} (${p?.id ?? "?"})`;
    const c = byId.get(String(p?.id ?? ""));
    if (!c) {
      errors.push(`${label} : identifiant inconnu.`);
      continue;
    }
    if (seen.has(c.id)) errors.push(`${label} : déjà utilisé.`);
    seen.add(c.id);
    const title = String(p.title ?? "").trim();
    const f = String(p.free ?? "").replace(/\s+/g, " ").trim();
    const pl = String(p.plus ?? "").replace(/\s+/g, " ").trim();
    if (!title) errors.push(`${label} : titre vide.`);
    if (title.length > 140) errors.push(`${label} : titre de ${title.length} caractères, 140 au plus.`);
    if (f.length < 40) errors.push(`${label} : texte gratuit trop court.`);
    if (f.length > FREE_MAX_CHARS) errors.push(`${label} : texte gratuit de ${f.length} caractères, ${FREE_MAX_CHARS} au plus.`);
    if (pl.length < f.length) errors.push(`${label} : la version Rempart+ doit être plus étayée que la gratuite.`);
    if (pl.length > PLUS_MAX_CHARS) errors.push(`${label} : texte Rempart+ de ${pl.length} caractères, ${PLUS_MAX_CHARS} au plus.`);
    if (/https?:\/\/|www\./i.test(`${f} ${pl}`)) errors.push(`${label} : pas de lien dans le texte.`);
    if (!/[.!?…»"]$/.test(f) || !/[.!?…»"]$/.test(pl)) errors.push(`${label} : chaque texte finit par une phrase complète.`);
    // Le titre d'un article du site reste le sien : la newsletter mène au même texte.
    const shownTitle = c.kind === "site" ? c.title : title;
    const base = { href: c.href, section: c.section, kind: c.kind, source: c.source };
    free.push({ ...base, title: shownTitle, blurb: f });
    plus.push({ ...base, title: shownTitle, blurb: pl });
  }
  const missingSite = candidates.filter((c) => c.kind === "site" && !seen.has(c.id));
  if (missingSite.length > 0) {
    errors.push(`Articles du site absents : ${missingSite.map((c) => c.id).join(", ")}. Ils figurent tous dans la newsletter.`);
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return { free, plus };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Mise en page du brief, à la charte du site (voir newsletterShell). */
export function renderBriefHtml(opts: {
  dateLabel: string;
  items: BriefItem[];
  premium: boolean;
}): string {
  const { dateLabel, items, premium } = opts;
  const C = EMAIL_COLORS;
  const F = EMAIL_FONTS;
  const kicker = premium ? "L'actu en 10 points · Rempart+" : "L'actu en 10 points";
  const dateText = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);

  const head = `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 8px;">
    <tr>
      <td style="font-family:${F.label};font-size:13px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:${C.gold};">
        <span style="display:inline-block;width:10px;height:10px;background:${C.accent};border-radius:2px;margin-right:8px;vertical-align:middle;"></span>${escapeHtml(kicker)}
      </td>
    </tr>
    <tr>
      <td style="padding-top:8px;font-family:${F.serif};font-size:26px;line-height:1.2;font-weight:700;color:${C.ink};">${escapeHtml(dateText)}</td>
    </tr>
    <tr>
      <td style="padding-top:8px;font-family:${F.sans};font-size:15px;line-height:1.5;color:${C.muted};">${
        premium
          ? "Les faits des dernières 24 heures, chaque point étayé pour les abonnés Rempart+."
          : "Les faits des dernières 24 heures, en deux minutes de lecture."
      }</td>
    </tr>
    <tr><td style="padding-top:18px;border-bottom:3px solid ${C.ink};font-size:0;line-height:0;">&nbsp;</td></tr>
  </table>`;

  const rows = items
    .map((it, i) => {
      const meta = it.kind === "veille" && it.source
        ? `${escapeHtml(it.section)}<span style="color:${C.muted};"> · ${escapeHtml(it.source)}</span>`
        : escapeHtml(it.section);
      return `
    <tr>
      <td style="padding:20px 0;${i < items.length - 1 ? `border-bottom:1px solid ${C.rule};` : ""}">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tr>
            <td style="width:44px;vertical-align:top;">
              <div style="width:30px;height:30px;background:${C.ink};border-radius:6px;color:${C.accent};font-family:${F.label};font-size:16px;font-weight:600;line-height:30px;text-align:center;">${i + 1}</div>
            </td>
            <td style="vertical-align:top;">
              <p style="margin:0;font-family:${F.label};font-size:12px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:${C.gold};">${meta}</p>
              <p style="margin:6px 0 0;font-family:${F.serif};font-size:${premium ? "20px" : "19px"};font-weight:700;line-height:1.25;">
                <a href="${escapeHtml(it.href)}" style="color:${C.ink};text-decoration:none;">${escapeHtml(it.title)}</a>
              </p>
              <p style="margin:8px 0 0;font-family:${F.sans};font-size:${premium ? "16px" : "15px"};line-height:1.55;color:${C.text};">${escapeHtml(it.blurb)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
    })
    .join("");

  const cta = premium
    ? ""
    : `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:8px 0 24px;">
    <tr>
      <td style="background:${C.paper};border:1px solid ${C.rule};border-left:3px solid ${C.accent};border-radius:8px;padding:18px 20px;">
        <p style="margin:0;font-family:${F.serif};font-size:18px;font-weight:700;line-height:1.3;color:${C.ink};">Allez plus loin avec Rempart+</p>
        <p style="margin:6px 0 14px;font-family:${F.sans};font-size:14px;line-height:1.5;color:${C.muted};">Chaque point de ce brief plus détaillé, et nos enquêtes exclusives chaque mercredi et samedi.</p>
        <a href="${absoluteUrl("/s-abonner")}" style="display:inline-block;background:${C.accent};color:${C.ink};border-radius:8px;padding:11px 18px;font-family:${F.label};font-size:14px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;">S'abonner</a>
      </td>
    </tr>
  </table>`;

  return newsletterShell({
    title: `${kicker} — ${dateText}`,
    hideTitle: true,
    plusCancelLink: premium,
    preheader: items.slice(0, 2).map((it) => it.title).join(" · "),
    bodyHtml: `${head}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">${rows}</table>${cta}`,
    footerNote: premium
      ? "Vous recevez la version étayée car vous êtes abonné Rempart+."
      : `Vous recevez ce brief car vous êtes abonné à ${SITE_NAME}.`,
  });
}

export function renderBriefText(items: BriefItem[]): string {
  return items
    .map((it, i) => `${i + 1}. ${it.title}\n${it.blurb}\n${it.href}`)
    .join("\n\n");
}
