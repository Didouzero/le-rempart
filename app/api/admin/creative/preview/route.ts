import { NextResponse } from "next/server";
import { z } from "zod";
import {
  fetchCreativeBackground,
  renderRempartCreative,
} from "@/lib/creative";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  title: z.string().min(8),
  highlightWords: z.array(z.string()).optional(),
});

/** POST /api/admin/creative/preview — retourne une PNG 1080×1440 */
export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Titre requis." }, { status: 400 });
    }

    const { title, highlightWords } = parsed.data;
    const bg = await fetchCreativeBackground({ title });
    const png = await renderRempartCreative({
      background: bg.buffer,
      title,
      highlightWords:
        highlightWords && highlightWords.length > 0
          ? highlightWords
          : guessHighlights(title),
    });

    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("creative preview failed", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Échec génération créative",
      },
      { status: 500 },
    );
  }
}

function guessHighlights(title: string): string[] {
  const words = title.toUpperCase().split(/\s+/).filter(Boolean);
  // Heuristique : noms propres / mots longs
  return words.filter((w) => w.length >= 6).slice(0, 6);
}
