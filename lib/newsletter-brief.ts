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

/** Repli sans modèle : écarte les titres qui parlent manifestement de l'étranger. */
const FOREIGN_HINT =
  /\b(Trump|Biden|Harris|Poutine|Putin|Zelensky|Netanyahou|Xi Jinping|Erdogan|Milei|Maison-Blanche|Kremlin|Congrès américain|États-Unis|Etats-Unis|USA|Américains?|Washington|Chine|Chinois|Russie|Ukraine|Israël|Gaza|Iran|Inde|Japon|Corée|Malaisie|Indonésie|Brésil|Argentine|Mexique|Canada|Australie|Royaume-Uni|Londres|Allemagne|Berlin|Italie|Rome|Espagne|Madrid|Pologne|Hongrie|Afrique du Sud|Nigeria|Venezuela|Pakistan|Afghanistan|Syrie|Liban|Turquie|Égypte)\b/i;

const VEILLE_SELECTION = `Tu choisis les sujets qui complètent « L'actu en 10 points », la newsletter quotidienne du Rempart, média d'actualité française de droite assumée.

RÈGLES, sans exception :
1. FRANCE UNIQUEMENT. Écarte toute actualité étrangère : un fait survenu hors de France, la politique d'un autre pays (« aux États-Unis, Trump interdit… », « en Malaisie… »), les guerres et élections étrangères. Seule exception : un événement mondial absolument majeur dont toute la France parle (attentat de l'ampleur du 11 Septembre, déclaration de guerre touchant l'Europe). Un sujet étranger n'est admis que s'il concerne directement la France (un Français tué, une décision qui s'applique en France).
2. THÈMES : immigration, économie (impôts, dette, dépenses publiques, entreprises), politique, justice et sécurité, faits insolites.
3. ANGLE : garde les faits qui mettent la gauche ou le gouvernement macroniste en difficulté, ou qui placent la droite en terrain favorable. Exemples retenus : « l'auteur de l'attaque au couteau de 2020 était un Afghan sous OQTF, selon la justice » ; une dépense publique absurde ; un élu de gauche épinglé ; un chiffre de l'immigration ou de la délinquance ; un revers du gouvernement.
   Exemples refusés : un récit qui sert la gauche ou met en cause la police, comme « au procès de l'agression de Michel Zecler, trois policiers, quelques excuses, mais surtout pas de racisme » ; un sujet neutre sans enjeu politique (météo, sport, people, faits divers sans portée) ; un éditorial ou une tribune.
4. SUJETS DISTINCTS : si plusieurs titres parlent de la même affaire, n'en garde qu'un, le plus informatif. Écarte tout ce qui recoupe la liste « déjà ».
5. Classe du plus fort au plus faible. Retiens jusqu'à N sujets ; si moins de N candidats respectent les règles 1 à 3, retiens-en moins : jamais de remplissage avec un sujet étranger ou défavorable.`;

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
  const fallback = () =>
    unique.filter((r) => !FOREIGN_HINT.test(r.title)).slice(0, want);
  if (unique.length === 0) return [];
  if (!process.env.MOONSHOT_API_KEY) return fallback();

  try {
    const payload = unique
      .slice(0, 80)
      .map((r, i) => `#${i} [${r.source_name}] ${r.title}`);
    const raw = await moonshotChat({
      model: getKimiTextModel(),
      maxTokens: 6000,
      timeoutMs: 90_000,
      reasoningEffort: "high",
      messages: [
        {
          role: "system",
          content: `${VEILLE_SELECTION.replace("jusqu'à N", `jusqu'à ${want}`).replace("moins de N", `moins de ${want}`)}
Réponds UNIQUEMENT JSON : {"keep":[0,3,5]} indices parmi la liste numérotée, au plus ${want} indices, du plus fort au plus faible.`,
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
    // Une réponse vide est un choix : aucun candidat ne convenait.
    return picked.slice(0, want);
  } catch (err) {
    console.error("newsletter veille cluster", err);
  }
  return fallback();
}

async function blurbsForItems(
  items: BriefItem[],
  depth: "free" | "plus",
): Promise<BriefItem[]> {
  if (!process.env.MOONSHOT_API_KEY) return items;
  // Limite de sécurité seulement : on ne coupe jamais au milieu d'une phrase.
  const maxChars = depth === "plus" ? 1400 : 420;
  const instruction =
    depth === "plus"
      ? `Tu rédiges le BRIEF PREMIUM Rempart+ : pour chaque point, 4 à 6 phrases ARGUMENTÉES (faits, noms, chiffres, puis une lecture politique courte, sans sarcasme), 900 caractères au plus.`
      : `Tu rédiges le BRIEF GRATUIT : pour chaque point, 1 à 2 phrases denses (faits, noms, chiffres), 350 caractères au plus. Pas d'édito.`;

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
Chaque texte se termine par une phrase complète, jamais coupé en cours de phrase. Pour un point [site], reprends tous les faits de son chapô. N'écris que ce que le titre et le texte fournis établissent.
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
      blurb: fitSentences(byI.get(i) || it.blurb, maxChars),
    }));
  } catch (err) {
    console.error("newsletter blurbs", depth, err);
    // Sans modèle, le chapô de l'article est repris en entier.
    return items;
  }
}

export async function buildTenPointBrief(): Promise<BriefItem[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const articles = await prisma.article.findMany({
    where: { status: "published", publishedAt: { gte: since } },
    orderBy: [{ publishedAt: "desc" }],
    take: 10,
    select: {
      publicId: true,
      title: true,
      excerpt: true,
      category: true,
    },
  });

  // Tous les articles du jour (6 ou 7 d'habitude), chapô entier ; la veille complète jusqu'à 10.
  const siteItems: BriefItem[] = articles.map((a) => ({
    title: a.title,
    blurb: a.excerpt.trim(),
    href: absoluteUrl(articlePublicPath(a.publicId)),
    section: categoryLabel(a.category),
    kind: "site",
  }));

  const siteTitles = siteItems.map((s) => s.title);
  const needVeille = Math.max(0, 10 - siteItems.length);
  let veille: BriefItem[] = [];
  try {
    const feed = needVeille > 0 ? await fetchSpittinVeille(30) : [];
    const picked = await pickDistinctVeille(feed, siteTitles, needVeille);
    veille = picked.map((h) => ({
      title: h.title,
      blurb: h.title,
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
    plusCancelLink: premium,
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
