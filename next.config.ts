import type { NextConfig } from "next";

const compassApiBaseUrl = process.env.COMPASS_API_BASE_URL?.replace(/\/+$/, "");
const compassEnvironment = process.env.COMPASS_ENVIRONMENT?.trim().toLowerCase();
const compassIndexable =
  process.env.NODE_ENV === "production" && compassEnvironment === "production";

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
  async headers() {
    if (compassIndexable) return [];

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
