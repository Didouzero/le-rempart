import type { MetadataRoute } from "next";
import { siteUrlBase } from "@/lib/article-url";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrlBase();

  return {
    rules: [
      {
        userAgent: "*",
        // Les illustrations sont servies sous /api/media/ : Google et Facebook doivent pouvoir les lire.
        allow: ["/", "/api/media/"],
        disallow: ["/admin", "/api/"],
      },
    ],
    sitemap: [`${base}/sitemap.xml`, `${base}/news-sitemap.xml`],
    host: base,
  };
}
