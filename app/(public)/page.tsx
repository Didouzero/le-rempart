import type { Metadata } from "next";
import { HomeFeed } from "@/components/HomeFeed";
import {
  SITE_DEFAULT_TITLE,
  SITE_DESCRIPTION,
  buildPageMetadata,
} from "@/lib/seo";

// Servie depuis le cache CDN, rafraîchie chaque minute et à chaque publication.
// « /?page=… » et « /?q=… » sont réécrites vers /accueil par le middleware.
export const revalidate = 60;

export const metadata: Metadata = buildPageMetadata({
  title: SITE_DEFAULT_TITLE,
  description: SITE_DESCRIPTION,
  path: "/",
  absoluteTitle: true,
});

export default function HomePage() {
  return <HomeFeed requested={1} q="" />;
}
