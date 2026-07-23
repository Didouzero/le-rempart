import { NextResponse } from "next/server";
import { z } from "zod";
import { generateArticleFromSource } from "@/lib/kimi";
import { fetchSourceText } from "@/lib/fetch-source";

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

    const article = await generateArticleFromSource({
      title,
      sourceText,
      sourceUrl: sourceUrl || undefined,
    });

    return NextResponse.json(article);
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
