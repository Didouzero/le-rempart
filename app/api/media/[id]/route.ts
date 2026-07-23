import { NextResponse } from "next/server";
import { prisma, withDbTimeout } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

function sniffMime(buf: Buffer, declared: string | null): string {
  if (declared && declared.startsWith("image/") && !declared.includes("octet-stream")) {
    return declared;
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF") {
    return "image/webp";
  }
  return "image/jpeg";
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;

  try {
    const article = await withDbTimeout(
      prisma.article.findUnique({
        where: { id },
        select: { coverImageData: true, coverImageMime: true },
      }),
    );

    if (!article?.coverImageData) {
      return new NextResponse("Not found", { status: 404 });
    }

    const buffer = Buffer.from(article.coverImageData);
    const mime = sniffMime(buffer, article.coverImageMime);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new NextResponse("Error", { status: 500 });
  }
}
