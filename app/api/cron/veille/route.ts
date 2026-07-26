import { NextRequest, NextResponse } from "next/server";
import { runVeilleCycle } from "@/lib/veille/run";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorize(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  if (header === `Bearer ${secret}`) return true;
  const q = request.nextUrl.searchParams.get("secret");
  return q === secret;
}

async function handle(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // force=1 : saute seulement le check horaire (jamais la validation Telegram)
  const force =
    request.nextUrl.searchParams.get("force") === "1" ||
    request.nextUrl.searchParams.get("force") === "true";

  try {
    const result = await runVeilleCycle({ force });
    // Garde-fou : le cron ne doit JAMAIS publier directement
    if (
      result.ok &&
      result.message === "Publié" &&
      !result.pendingId
    ) {
      console.error("CRON SAFETY: unexpected direct publish blocked path", result);
      return NextResponse.json(
        {
          ok: false,
          message:
            "Sécurité : publication directe interdite. Validation Telegram obligatoire.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("cron veille failed", err);
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : "échec",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
