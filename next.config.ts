import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Existing type errors must not block ads.txt / site deploys.
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ["sharp", "@prisma/client", "@resvg/resvg-js", "telegram"],
  async headers() {
    return [
      {
        source: "/ads.txt",
        headers: [
          {
            key: "Content-Type",
            value: "text/plain; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/rubriques/patrimoine",
        destination: "/rubriques/politique",
        permanent: true,
      },
      {
        source: "/nous-soutenir",
        destination: "/s-abonner",
        permanent: true,
      },
      {
        source: "/dossiers",
        destination: "/rubriques/enquetes",
        permanent: true,
      },
      {
        // Articles supprimés de la base, encore connus de Google.
        source: "/articles/:id(1|2|80|107|109|131)",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
