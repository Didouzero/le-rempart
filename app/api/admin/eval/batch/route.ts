import { NextResponse } from "next/server";
import { z } from "zod";
import { runAbEvaluation } from "@/lib/eval/ab";
import subjectsFile from "@/lib/eval/subjects.json";

export const maxDuration = 300;

const bodySchema = z.object({
  /** Nombre de sujets (1–5 par requête HTTP pour rester sous les timeouts). */
  limit: z.number().int().min(1).max(5).optional().default(1),
  offset: z.number().int().min(0).optional().default(0),
  includeDossier: z.boolean().optional().default(false),
  ids: z.array(z.string()).optional(),
});

type SubjectRow = {
  id: string;
  title: string;
  category?: string;
  sourceUrl?: string | null;
};

/**
 * Batch A/B borné (1–5 sujets / appel).
 * Pour 30–50 sujets : enchaîner via le script CLI `npm run eval:ab`.
 */
export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
    }

    const all = (subjectsFile as { subjects: SubjectRow[] }).subjects;
    let slice = all;
    if (parsed.data.ids?.length) {
      const want = new Set(parsed.data.ids);
      slice = all.filter((s) => want.has(s.id));
    } else {
      slice = all.slice(
        parsed.data.offset,
        parsed.data.offset + parsed.data.limit,
      );
    }

    const results = [];
    for (const row of slice) {
      const started = Date.now();
      try {
        const ab = await runAbEvaluation(
          {
            title: row.title,
            sourceUrl: row.sourceUrl || undefined,
          },
          { includeDossier: parsed.data.includeDossier },
        );
        results.push({
          id: row.id,
          category: row.category,
          ok: true,
          durationMs: Date.now() - started,
          comparison: ab.comparison,
          legacy: {
            title: ab.legacy.article.title,
            metrics: ab.legacy.metrics,
            observability: {
              ...ab.legacy.observability,
              dossier: undefined,
            },
          },
          new: {
            title: ab.neu.article.title,
            metrics: ab.neu.metrics,
            writingMetadata: ab.neu.observability.writingMetadata,
            coverage: ab.neu.observability.coverage,
            quality: ab.neu.observability.quality
              ? {
                  ready: ab.neu.observability.quality.ready,
                  missing: ab.neu.observability.quality.missing,
                  scores: ab.neu.observability.quality.scores,
                }
              : null,
            observability: {
              runId: ab.neu.observability.runId,
              totalDurationMs: ab.neu.observability.totalDurationMs,
              timings: ab.neu.observability.timings,
              tokensTotal: ab.neu.observability.tokensTotal,
              tokensByStage: ab.neu.observability.tokensByStage,
            },
            article: ab.neu.article,
          },
          legacyArticle: ab.legacy.article,
        });
      } catch (err) {
        results.push({
          id: row.id,
          category: row.category,
          ok: false,
          durationMs: Date.now() - started,
          error: err instanceof Error ? err.message : "échec",
        });
      }
    }

    return NextResponse.json({
      totalSubjects: all.length,
      offset: parsed.data.offset,
      count: results.length,
      results,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur batch eval" },
      { status: 500 },
    );
  }
}
