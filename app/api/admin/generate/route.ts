import { NextResponse } from "next/server";
import { z } from "zod";
import { generateArticlePipeline } from "@/lib/kimi";
import { fetchSourceText } from "@/lib/fetch-source";

/** Research + écriture : budget temps élargi (Knowledge Builder). */
export const maxDuration = 300;

const bodySchema = z.object({
  title: z.string().min(1),
  sourceText: z.string().optional().nullable(),
  sourceUrl: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Titre et source (texte ou lien) requis." },
        { status: 400 },
      );
    }

    const { title } = parsed.data;
    let sourceText = parsed.data.sourceText?.trim() || "";
    const sourceUrl = parsed.data.sourceUrl?.trim() || "";

    if (!sourceText && !sourceUrl) {
      return NextResponse.json(
        { error: "Fournissez un texte source ou une URL." },
        { status: 400 },
      );
    }

    if (sourceUrl) {
      try {
        const fetched = await fetchSourceText(sourceUrl);
        sourceText = [sourceText, fetched].filter(Boolean).join("\n\n");
      } catch (err) {
        if (!sourceText) {
          return NextResponse.json(
            {
              error:
                err instanceof Error
                  ? err.message
                  : "Impossible de récupérer l'URL",
            },
            { status: 400 },
          );
        }
      }
    }

    const pipeline = await generateArticlePipeline({
      title,
      sourceText,
      sourceUrl: sourceUrl || undefined,
    });
    const article = pipeline.artifacts.article;
    if (!article) {
      return NextResponse.json(
        { error: "Pipeline éditorial : aucun article produit" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ...article,
      researchDossier: pipeline.dossier,
      writingMetadata: pipeline.writingMetadata,
      quality: pipeline.quality
        ? {
            ready: pipeline.quality.ready,
            missing: pipeline.quality.missing,
            nextQueries: pipeline.quality.nextQueries,
            scores: pipeline.quality.scores,
            coverage: pipeline.quality.coverage,
          }
        : null,
      pipelineMode: pipeline.mode,
      observability: {
        runId: pipeline.observability.runId,
        mode: pipeline.observability.mode,
        totalDurationMs: pipeline.observability.totalDurationMs,
        timings: pipeline.observability.timings,
        tokensByStage: pipeline.observability.tokensByStage,
        tokensTotal: pipeline.observability.tokensTotal,
        coverage: pipeline.observability.coverage,
        writingMetadata: pipeline.observability.writingMetadata,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Erreur lors de la génération",
      },
      { status: 500 },
    );
  }
}
