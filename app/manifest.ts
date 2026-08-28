import type { MetadataRoute } from "next";
import {
  SITE_DESCRIPTION,
  SITE_LOGO_SQUARE,
  SITE_NAME,
} from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    lang: "fr",
    background_color: "#0c0a09",
    theme_color: "#0c0a09",
    icons: [
      {
        src: SITE_LOGO_SQUARE,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
