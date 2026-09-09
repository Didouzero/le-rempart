import { getKimiTextModel } from "@/lib/kimi-legacy";
import { moonshotChat } from "@/lib/moonshot";
import { serializeDossierForWriter } from "@/lib/research/agent";
import type { ResearchDossier } from "@/lib/research/types";
import { ARTICLE_LENGTH } from "@/lib/writing/constraints";

export type InvestigationWritingDraft = {
  title: string;
  excerpt: string;
  plan: string[];
  /** Corps Markdown par entrée du plan ; chaîne vide = pas encore rédigé. */
  sections: string[];
};

function uniqueHeadings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const t = raw.replace(/^#+\s*/, "").replace(/\s+/g, " ").trim();
    if (t.length < 8 || t.length > 160) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** Plan déjà posé dans le brief (FORMAT FINAL / ##) — évite un appel Kimi. */
export function extractPlanFromBrief(prompt: string): string[] {
  const format = prompt.match(/FORMAT FINAL[\s\S]{0,12000}/i)?.[0] || "";
  const fromFormat: string[] = [];
  if (format) {
    for (const m of format.matchAll(
      /^\s*(?:#{2,3}\s+|(?:\d+)[.)]\s+)(.{8,160})$/gm,
    )) {
      fromFormat.push(m[1]!.replace(/^#+\s*/, "").trim());
    }
  }
  const uniqueFormat = uniqueHeadings(fromFormat);
  if (uniqueFormat.length >= 6) return uniqueFormat.slice(0, 22);

  const h2: string[] = [];
  for (const m of prompt.matchAll(/^##\s+(.+)$/gm)) {
    h2.push(m[1]!.trim());
  }
  const uniqueH2 = uniqueHeadings(h2);
  if (uniqueH2.length >= 6) return uniqueH2.slice(0, 22);
  return [];
}

function planFromDossier(dossier: ResearchDossier, subject: string): string[] {
  const plan: string[] = [];
  plan.push(`Ce qui est établi — ${subject}`.slice(0, 120));
  if (dossier.chronology.length >= 2) plan.push("Chronologie");
  if (dossier.actors.length >= 2) plan.push("Les acteurs et leurs responsabilités");
  if ((dossier.legalContext.investigations?.length || 0) > 0) {
    plan.push("Procédure, justice, documents");
  }
  if (dossier.reactions && Object.values(dossier.reactions).some((x) => x.length)) {
    plan.push("Réactions et contradictions");
  }
  plan.push("Ce que l’on ne sait pas encore");
  return uniqueHeadings(plan).slice(0, 16);
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("JSON introuvable");
  return JSON.parse(match[0]) as Record<string, unknown>;
}

export async function startInvestigationWritingDraft(input: {
  prompt: string;
  subject: string;
  dossier: ResearchDossier;
  timeoutMs: number;
}): Promise<InvestigationWritingDraft> {
  let plan = extractPlanFromBrief(input.prompt);
  if (plan.length < 6) plan = planFromDossier(input.dossier, input.subject);

  if (plan.length < 6) {
    const raw = await moonshotChat({
      model: "kimi-k2.6",
      maxTokens: 1800,
      timeoutMs: Math.min(45_000, input.timeoutMs),
      messages: [
        {
          role: "system",
          content:
            "Tu es rédacteur en chef du Rempart. Réponds UNIQUEMENT en JSON.",
        },
        {
          role: "user",
          content: [
            `Sujet : ${input.subject}`,
            "Propose 10 à 16 titres ## pour une enquête payante exhaustive.",
            "Si le brief a un plan, SUIS-LE. JSON : {\"title\":\"...\",\"excerpt\":\"2-4 phrases\",\"plan\":[\"H2\",...]}",
            input.prompt.slice(0, 12000),
          ].join("\n\n"),
        },
      ],
    });
    const parsed = parseJsonObject(raw);
    const title = String(parsed.title || input.subject).trim();
    const excerpt = String(parsed.excerpt || "").trim();
    const fromModel = Array.isArray(parsed.plan)
      ? parsed.plan.map((x) => String(x || "").trim())
      : [];
    plan = uniqueHeadings(fromModel).slice(0, 22);
    if (plan.length < 6) plan = planFromDossier(input.dossier, input.subject);
    return {
      title: title.slice(0, 180) || input.subject,
      excerpt: excerpt.slice(0, 1500) || `${input.subject}.`,
      plan,
      sections: plan.map(() => ""),
    };
  }

  const raw = await moonshotChat({
    model: "kimi-k2.6",
    maxTokens: 700,
    timeoutMs: Math.min(35_000, input.timeoutMs),
    messages: [
      {
        role: "system",
        content: "JSON uniquement : titre + chapô d'une enquête Le Rempart.",
      },
      {
        role: "user",
        content: [
          `Sujet : ${input.subject}`,
          `Plan : ${plan.join(" | ")}`,
          'JSON : {"title":"...","excerpt":"2 à 4 phrases factuelles"}',
        ].join("\n"),
      },
    ],
  }).catch(() => "");

  let title = input.subject;
  let excerpt = `${input.subject}.`;
  if (raw) {
    try {
      const parsed = parseJsonObject(raw);
      if (parsed.title) title = String(parsed.title).trim().slice(0, 180);
      if (parsed.excerpt) excerpt = String(parsed.excerpt).trim().slice(0, 1500);
    } catch {
      /* keep defaults */
    }
  }

  return {
    title,
    excerpt,
    plan,
    sections: plan.map(() => ""),
  };
}

export async function writeNextInvestigationSection(input: {
  prompt: string;
  subject: string;
  dossier: ResearchDossier;
  draft: InvestigationWritingDraft;
  timeoutMs: number;
}): Promise<InvestigationWritingDraft> {
  const index = input.draft.sections.findIndex((s) => !s.trim());
  if (index < 0) return input.draft;

  const heading = input.draft.plan[index] || `Section ${index + 1}`;
  const already = input.draft.plan
    .map((h, i) => (input.draft.sections[i]?.trim() ? `✓ ${h}` : `… ${h}`))
    .join("\n");

  const raw = await moonshotChat({
    model: getKimiTextModel(),
    maxTokens: 4500,
    timeoutMs: Math.min(90_000, input.timeoutMs),
    reasoningEffort: "low",
    messages: [
      {
        role: "system",
        content: [
          "Tu es rédacteur en chef du Rempart, enquête payante.",
          "Tu rédiges UNE seule section ##, dense, sourcée, 400 à 700 mots.",
          "Pas de JSON. Markdown uniquement. Commence par ## titre.",
          "Faits d'abord, lecture de droite argumentée ensuite (pas d'invective).",
          "N'invente rien hors brief + dossier. Citations en *« … »*.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `Sujet : ${input.subject}`,
          `SECTION À RÉDIGER MAINTENANT : ${heading}`,
          `Plan global (ne rédige PAS les autres) :\n${already}`,
          "BRIEF (faits et consignes) :",
          input.prompt.slice(0, 14000),
          serializeDossierForWriter(input.dossier).slice(0, 18000),
        ].join("\n\n"),
      },
    ],
  });

  let body = raw.trim();
  if (!/^##\s/m.test(body)) {
    body = `## ${heading}\n\n${body}`;
  }
  const next = {
    ...input.draft,
    sections: [...input.draft.sections],
  };
  next.sections[index] = body;
  return next;
}

export function assembleInvestigationArticle(
  draft: InvestigationWritingDraft,
): { title: string; excerpt: string; content: string; wordCount: number; remaining: number } {
  const content = draft.sections.filter((s) => s.trim()).join("\n\n");
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const remaining = draft.sections.filter((s) => !s.trim()).length;
  return {
    title: draft.title,
    excerpt: draft.excerpt,
    content,
    wordCount,
    remaining,
  };
}

export function investigationWritingDone(
  draft: InvestigationWritingDraft,
): boolean {
  if (draft.sections.some((s) => !s.trim())) return false;
  const words = draft.sections.join(" ").split(/\s+/).filter(Boolean).length;
  return words >= ARTICLE_LENGTH.investigationMinWords;
}
