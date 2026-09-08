import type { NextConfig } from "next";

const compassApiBaseUrl = process.env.COMPASS_API_BASE_URL?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  trailingSlash: true,
  async rewrites() {
    if (!compassApiBaseUrl) {
      throw new Error(
        "COMPASS_API_BASE_URL is required to configure the /api/v1 proxy.",
      );
    }

    return [
      {
        source: "/api/v1/:path*/",
        destination: `${compassApiBaseUrl}/api/v1/:path*/`,
      },
    ];
  },
};

export default nextConfig;
