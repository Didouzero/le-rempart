import { NextResponse } from "next/server";
import { z } from "zod";
import { getDossierBrief } from "@/lib/investigation-draft";
import { rewriteInvestigation } from "@/lib/investigation";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  prompt: z.string().min(40).optional(),
});

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const existing = await prisma.specialDossier.findUnique({
      where: { id },
      select: { id: true, title: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    }

    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    const posted = parsed.success ? parsed.data.prompt?.trim() : "";
    const prompt = posted || (await getDossierBrief(id)) || "";
    if (prompt.length < 40) {
      return NextResponse.json(
        {
          error:
            "Colle le prompt complet (.txt) pour régénérer. Il n’a pas été enregistré sur cette enquête.",
        },
        { status: 400 },
      );
    }

    const result = await rewriteInvestigation({
      dossierId: id,
      prompt,
      headline: existing.title,
    });
    const dossier = await prisma.specialDossier.findUnique({ where: { id } });
    return NextResponse.json({ ...result, dossier });
  } catch (err) {
    console.error("dossier regenerate", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Régénération impossible",
      },
      { status: 500 },
    );
  }
}
