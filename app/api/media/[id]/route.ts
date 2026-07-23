import { NextResponse } from "next/server";
import { prisma, withDbTimeout } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;

  try {
    const article = await withDbTimeout(
      prisma.article.findUnique({
        where: { id },
        select: { coverImageData: true, coverImageMime: true },
      }),
    );

    if (!article?.coverImageData || !article.coverImageMime) {
      return new NextResponse("Not found", { status: 404 });
    }

    return new NextResponse(Buffer.from(article.coverImageData), {
      status: 200,
      headers: {
        "Content-Type": article.coverImageMime,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new NextResponse("Error", { status: 500 });
  }
}
