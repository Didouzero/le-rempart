import type { TagKind } from "@prisma/client";
import { slugify } from "@/lib/slug";

/** Lecture et nettoyage des sujets, sans accès à la base (contrôle du canal Claude). */

export const TAG_KINDS: TagKind[] = ["personne", "organisation", "lieu", "sujet"];
export const MAX_TAGS_PER_ARTICLE = 5;

export type ProposedTag = { name: string; kind: TagKind };

/** Les rubriques ont déjà leur page : jamais de sujet du même nom. */
const FORBIDDEN = new Set(
  [
    "immigration",
    "justice",
    "economie",
    "politique",
    "insolite",
    "france",
    "francais",
    "actualite",
    "gouvernement",
    "societe",
    "medias",
    "faits-divers",
  ].map((s) => slugify(s)),
);

/**
 * Ligne « SUJETS : » d'un texte prêt :
 * « Emmanuel Grégoire (personne), Cour des comptes (organisation), OQTF (sujet) ».
 */
export function parseTagLine(line: string): ProposedTag[] {
  const items = [...line.matchAll(/([^,()]+?)\s*\(\s*(personne|organisation|lieu|sujet)\s*\)/gi)].map(
    (m) => ({ name: m[1], kind: m[2].toLowerCase() }),
  );
  return normalizeTags(items);
}

/** Nettoie une liste de sujets : noms propres, types connus, pas de doublon ni de sujet trop large. */
export function normalizeTags(list: unknown[]): ProposedTag[] {
  const out: ProposedTag[] = [];
  for (const item of list) {
    const name = String((item as { name?: unknown })?.name ?? "")
      .replace(/\s+/g, " ")
      .trim();
    const kind = String((item as { kind?: unknown })?.kind ?? "") as TagKind;
    if (!name || name.length > 60 || !TAG_KINDS.includes(kind)) continue;
    const slug = slugify(name);
    if (!slug || FORBIDDEN.has(slug)) continue;
    if (out.some((t) => slugify(t.name) === slug)) continue;
    out.push({ name, kind });
  }
  return out.slice(0, MAX_TAGS_PER_ARTICLE);
}

