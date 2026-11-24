import { NextRequest, NextResponse } from "next/server";
import { startNewsletterJob } from "@/lib/newsletter-job";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { purgeOldCreatives } = await import("@/lib/creatives-retention");
    const purged = await purgeOldCreatives();
    if (purged > 0) console.log(`newsletter cron: ${purged} créatives de plus de 24 h retirées`);
  } catch (err) {
    console.error("newsletter cron: purge des créatives", err);
  }

  try {
    const { maybeRemindInvestigation } = await import(
      "@/lib/investigation-reminder"
    );
    await maybeRemindInvestigation();
  } catch (err) {
    console.error("newsletter cron: rappel enquête", err);
  }

  try {
    const { resumeStuckInvestigationJobs } = await import(
      "@/lib/investigation-job"
    );
    const resumed = await resumeStuckInvestigationJobs();
    if (resumed > 0) {
      console.info("newsletter cron: enquêtes relancées", resumed);
    }
  } catch (err) {
    console.error("newsletter cron: reprise enquêtes", err);
  }

  // Claude choisit et rédige sur le VPS ; sans lui, les chapôs du site partent (lib/newsletter-job.ts).
  const result = await startNewsletterJob();
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  return GET(req);
}
