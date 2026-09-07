import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Diagnostic léger : dit si Resend est configuré, sans exposer la clé. */
export async function GET() {
  const hasKey = Boolean(process.env.RESEND_API_KEY?.trim());
  const from =
    process.env.NEWSLETTER_FROM?.trim() ||
    "Le Rempart <contact@le-rempart.org>";
  return NextResponse.json({
    resendConfigured: hasKey,
    from,
  });
}
