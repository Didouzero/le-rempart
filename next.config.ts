import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "@prisma/client", "@resvg/resvg-js"],
  async redirects() {
    return [
      {
        source: "/rubriques/patrimoine",
        destination: "/rubriques/politique",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
