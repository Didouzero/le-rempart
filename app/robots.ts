import type { MetadataRoute } from "next";
import { siteUrlBase } from "@/lib/article-url";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrlBase();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/"],
      },
    ],
    sitemap: [`${base}/sitemap.xml`, `${base}/news-sitemap.xml`],
    host: base,
  };
}
