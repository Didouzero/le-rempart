import { NextResponse } from "next/server";
import { z } from "zod";
import { runAbEvaluation, runLegacyArm, runNewArm } from "@/lib/eval/ab";
import { fetchSourceText } from "@/lib/fetch-source";

export const maxDuration = 300;

const bodySchema = z.object({
  title: z.string().min(1),
  sourceText: z.string().optional().nullable(),
  sourceUrl: z.string().optional().nullable(),
  caption: z.string().optional().nullable(),
  /** legacy | new | both (défaut) */
  mode: z.enum(["legacy", "new", "both"]).optional().default("both"),
  includeDossier: z.boolean().optional().default(true),
});

/**
 * Comparaison A/B (dev) :
 * - mode=both : ancien + nouveau pipeline
 * - mode=legacy | new : un seul bras
 */
export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
    }

    const {
      title,
      caption,
      mode,
      includeDossier,
    } = parsed.data;
    let sourceText = parsed.data.sourceText?.trim() || "";
    const sourceUrl = parsed.data.sourceUrl?.trim() || "";

    if (sourceUrl && !sourceText) {
      try {
        sourceText = await fetchSourceText(sourceUrl);
      } catch (err) {
        console.error("eval ab scrape failed", err);
      }
    }

    const subject = {
      title,
      sourceText: sourceText || undefined,
      sourceUrl: sourceUrl || undefined,
      caption: caption?.trim() || undefined,
    };

    if (mode === "legacy") {
      const legacy = await runLegacyArm(subject, { includeDossier });
      return NextResponse.json({ subject, legacy });
    }
    if (mode === "new") {
      const neu = await runNewArm(subject, { includeDossier });
      return NextResponse.json({ subject, new: neu });
    }

    const result = await runAbEvaluation(subject, { includeDossier });
    return NextResponse.json({
      subject: result.subject,
      legacy: result.legacy,
      new: result.neu,
      comparison: result.comparison,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Erreur évaluation A/B",
      },
      { status: 500 },
    );
  }
}
