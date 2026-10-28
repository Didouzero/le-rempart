import { rssResponse } from "@/lib/rss";

export const dynamic = "force-dynamic";

/** Flux RSS de tout le site. */
export function GET() {
  return rssResponse();
}
