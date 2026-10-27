/**
 * Liens dans le corps des articles : sources citées (liens externes) et
 * articles du Rempart sur des sujets proches (liens internes).
 * Seuls les liens autorisés survivent : un lien inventé redevient du texte.
 */

import { articlePublicPath } from "@/lib/article-url";
import { outletFromUrl } from "@/lib/flash-info";

// L'adresse peut contenir une paire de parenthèses (ex. « …-(dont-une-peine)-… »).
const MD_LINK = /\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g;
const SOURCES_HEADING = "## Sources";

export type LinkPolicy = {
  /** URLs de sources réellement lues. */
  external: Set<string>;
  /** publicId des articles du Rempart proposés. */
  internal: Set<number>;
};

function internalId(href: string): number | null {
  const m = href.match(
    /^(?:https?:\/\/(?:www\.)?le-rempart\.org)?\/articles\/(\d+)\/?$/i,
  );
  return m ? Number(m[1]) : null;
}

// Jamais de lien vers un réseau social dans un article : seulement la presse.
const SOCIAL = /^https?:\/\/([a-z0-9-]+\.)*(instagram\.com|facebook\.com|fb\.watch|x\.com|twitter\.com|tiktok\.com|youtube\.com|youtu\.be|t\.me|threads\.net|snapchat\.com|linkedin\.com)\//i;

export function isSocialUrl(href: string): boolean {
  return SOCIAL.test(href);
}

/** Garde les liens autorisés (internes normalisés en /articles/ID), retire les autres. */
export function enforceLinks(markdown: string, policy: LinkPolicy): string {
  return markdown.replace(MD_LINK, (full, text: string, href: string) => {
    const id = internalId(href);
    if (id !== null) {
      return policy.internal.has(id) ? `[${text}](${articlePublicPath(id)})` : text;
    }
    return policy.external.has(href) && !isSocialUrl(href) ? full : text;
  });
}

export function countLinks(markdown: string): { external: number; internal: number } {
  let external = 0;
  let internal = 0;
  for (const m of markdown.matchAll(MD_LINK)) {
    if (internalId(m[2]!) !== null) internal += 1;
    else if (/^https?:\/\//i.test(m[2]!)) external += 1;
  }
  return { external, internal };
}

/**
 * Applique une correction de texte sans toucher aux adresses des liens
 * (la typographie française casserait « https:// »).
 */
export function outsideLinkTargets(
  markdown: string,
  fix: (text: string) => string,
): string {
  const targets: string[] = [];
  const masked = markdown.replace(MD_LINK, (_full, text: string, href: string) => {
    targets.push(href);
    return `[${text}](\u0000${targets.length - 1}\u0000)`;
  });
  return fix(masked).replace(/\(\s*\u0000\s*(\d+)\s*\u0000\s*\)/g, (_m, i) => `(${targets[Number(i)]})`);
}

/** Retire une section « ## Sources » existante (pour la régénérer). */
export function stripSourcesSection(markdown: string): string {
  const i = markdown.indexOf(`\n${SOURCES_HEADING}\n`);
  return i < 0 ? markdown.trimEnd() : markdown.slice(0, i).trimEnd();
}

/** Section finale listant les sources citées, une ligne par média. */
export function sourcesSection(
  sources: Array<{ url: string; title?: string }>,
): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const s of sources) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    const outlet = outletFromUrl(s.url) || s.url;
    const title = (s.title || "").replace(/[[\]]/g, "").trim();
    lines.push(
      title && title !== outlet && title !== s.url
        ? `- ${outlet} : [${title}](${s.url})`
        : `- [${outlet}](${s.url})`,
    );
  }
  return lines.length ? `${SOURCES_HEADING}\n\n${lines.join("\n")}` : "";
}

/** URLs externes citées dans le corps, dans l'ordre d'apparition. */
export function citedUrls(markdown: string): string[] {
  const urls: string[] = [];
  for (const m of markdown.matchAll(MD_LINK)) {
    if (/^https?:\/\//i.test(m[2]!) && !urls.includes(m[2]!)) urls.push(m[2]!);
  }
  return urls;
}

export const READ_ALSO = "**À lire aussi :**";

/**
 * Insère l'encadré « À lire aussi » après le deuxième paragraphe du texte
 * (avant le premier intertitre s'il vient plus tôt).
 */
export function insertReadAlso(
  markdown: string,
  items: Array<{ publicId: number; title: string }>,
): string {
  if (!items.length || markdown.includes(READ_ALSO)) return markdown;
  const block = `${READ_ALSO} ${items
    .map((b) => `[${b.title.replace(/[[\]]/g, "")}](${articlePublicPath(b.publicId)})`)
    .join(" · ")}`;
  const paras = markdown.split(/\n{2,}/);
  let at = 0;
  let seen = 0;
  for (let i = 0; i < paras.length; i++) {
    if (paras[i]!.startsWith("#")) {
      if (seen > 0) break;
      continue;
    }
    seen += 1;
    at = i + 1;
    if (seen === 2) break;
  }
  paras.splice(at, 0, block);
  return paras.join("\n\n");
}

/** Articles du Rempart déjà liés dans le texte (/articles/ID). */
export function linkedArticleIds(markdown: string): number[] {
  return [...markdown.matchAll(/\]\(\/articles\/(\d+)\)/g)].map((m) => Number(m[1]));
}
