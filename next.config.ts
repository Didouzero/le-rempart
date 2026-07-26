import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "@prisma/client", "@resvg/resvg-js"],
};

export default nextConfig;
