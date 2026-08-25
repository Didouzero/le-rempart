import type { ArticleArtifact } from "@/lib/pipeline/types";
import { ARTICLE_LENGTH } from "@/lib/writing/constraints";
import type { WritingMetadata } from "@/lib/writing/types";

function humanizeCopy(text: string): string {
  return text
    .replace(/\u2014/g, ",")
    .replace(/\u2013/g, ",")
    .replace(/\s+—\s+/g, ", ")
    .replace(/\s+–\s+/g, ", ")
    .replace(/\s*,\s*,+/g, ", ")
    .replace(
      /\b(Il convient de noter que|Il est important de (noter|souligner) que|Dans un contexte où|En conclusion,?|Cela étant dit,?|Il va sans dire que)\s*/gi,
      "",
    )
    .replace(/ {2,}/g, " ")
    .trim();
}

function normalizeParaKey(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\*\*/g, "")
    .replace(/^#+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeParagraphs(content: string): string {
  const parts = content.split(/\n\n+/);
  const seen: string[] = [];
  const out: string[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = normalizeParaKey(trimmed);
    if (!key) continue;

    const isHeading = /^##\s/.test(trimmed);
    const duplicate = seen.some((prev) => {
      if (prev === key) return true;
      if (isHeading || prev.startsWith("##")) return false;
      if (prev.length < 60 || key.length < 60) return false;
      const shorter = prev.length <= key.length ? prev : key;
      const longer = prev.length > key.length ? prev : key;
      return longer.includes(shorter) && longer.length - shorter.length < 50;
    });

    if (duplicate) continue;
    seen.push(key);
    out.push(trimmed);
  }

  return out.join("\n\n");
}

export function countWords(text: string): number {
  return text
    .replace(/##\s+/g, " ")
    .replace(/\*\*/g, "")
    .split(/\s+/)
    .filter(Boolean).length;
}

function titleCaseNews(title: string): string {
  const t = title.replace(/\s+/g, " ").trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x || "").trim()).filter(Boolean);
}

export function parseWritingResponse(
  raw: string,
  opts: {
    subjectTitle: string;
    structureVariantId: string;
    minWords: number;
    /** Dossier vide : brève courte tolérée (2 H2, plancher bas). */
    cautious?: boolean;
  },
): { article: ArticleArtifact; metadata: WritingMetadata } {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Writing Agent : JSON introuvable");
  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

  if (!parsed.title || !parsed.content || !parsed.excerpt) {
    throw new Error("Writing Agent : JSON article incomplet");
  }

  const content = dedupeParagraphs(
    humanizeCopy(String(parsed.content).trim()),
  );

  if (
    /créative visuelle|brief Telegram|RESEARCH DOSSIER|Rédige un article/i.test(
      content,
    )
  ) {
    throw new Error("Writing Agent : article contaminé par le prompt");
  }

  if (
    /Le titre pose un fait précis\. Sans enjoliver/i.test(content) ||
    /Nous reviendrons sur ce dossier dès que des précisions/i.test(content)
  ) {
    throw new Error("Writing Agent : template générique détecté");
  }

  const words = countWords(content);
  const floor = opts.cautious
    ? ARTICLE_LENGTH.cautiousMinWords
    : ARTICLE_LENGTH.softAcceptMin;
  if (words < floor) {
    throw new Error(
      `Writing Agent : article trop court (${words} mots, plancher ${floor})`,
    );
  }
  if (words > ARTICLE_LENGTH.hardMaxWords) {
    throw new Error(
      `Writing Agent : article trop long (${words} mots, max ${ARTICLE_LENGTH.hardMaxWords})`,
    );
  }
  const lengthWarning =
    words < opts.minWords
      ? `Longueur sous cible (${words} mots, cible ${opts.minWords}) — accepté pour éviter un fallback legacy.`
      : null;

  const h2Count = (content.match(/^##\s+/gm) || []).length;
  const minH2 = opts.cautious ? 2 : 3;
  if (h2Count < minH2) {
    throw new Error(`Writing Agent : trop peu de H2 (${h2Count})`);
  }
  if (h2Count > 10) {
    throw new Error(`Writing Agent : trop de H2 (${h2Count})`);
  }

  // Analyse Rempart ne doit pas être le premier H2
  const firstH2 = content.match(/^##\s+(.+)$/m)?.[1]?.toLowerCase() || "";
  if (/analyse|édito|opinion|billet/.test(firstH2)) {
    throw new Error(
      "Writing Agent : l'analyse éditoriale ne doit pas ouvrir l'article",
    );
  }

  const meta = (parsed.metadata || {}) as Record<string, unknown>;
  const metadata: WritingMetadata = {
    plan: asStringArray(meta.plan),
    sectionsUsed: asStringArray(meta.sectionsUsed),
    sectionsIgnored: asStringArray(meta.sectionsIgnored),
    unusedDossierElements: asStringArray(meta.unusedDossierElements),
    warnings: asStringArray(meta.warnings),
    wordCount: words,
    structureVariant: opts.structureVariantId,
  };

  if (lengthWarning) metadata.warnings.push(lengthWarning);

  if (metadata.plan.length === 0) {
    metadata.plan = [...content.matchAll(/^##\s+(.+)$/gm)].map((m) =>
      m[1]!.trim(),
    );
    metadata.warnings.push("plan manquant dans metadata — reconstruit depuis H2");
  }

  return {
    article: {
      title: humanizeCopy(titleCaseNews(String(parsed.title))),
      excerpt: humanizeCopy(String(parsed.excerpt).trim()),
      content,
    },
    metadata,
  };
}
