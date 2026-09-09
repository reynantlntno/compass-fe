import type { Metadata } from "next";

export const COMPASS_OPEN_GRAPH_IMAGE = "/images/compass/compass-open-graph.jpg";

const OPEN_GRAPH_IMAGE_ALT = "COMPASS — UCN Guidance and Counseling Office";

export function getCompassMetadataBase(): URL | undefined {
  const configuredUrl = process.env.COMPASS_CLIENT_BASE_URL?.trim();
  if (!configuredUrl) return undefined;

  try {
    const parsed = new URL(configuredUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export function isCompassIndexable(): boolean {
  const environment = process.env.COMPASS_ENVIRONMENT?.trim().toLowerCase();
  return process.env.NODE_ENV === "production" && environment === "production";
}

export function getCompassRobotsMetadata(): NonNullable<Metadata["robots"]> {
  if (isCompassIndexable()) {
    return { index: true, follow: true };
  }

  return {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noarchive: true,
      noimageindex: true,
      "max-video-preview": -1,
      "max-image-preview": "none",
      "max-snippet": -1,
    },
  };
}

export function getCompassSocialMetadata(
  title: string,
  description: string,
  imageAlt = OPEN_GRAPH_IMAGE_ALT,
) {
  return {
    openGraph: {
      type: "website" as const,
      siteName: "COMPASS",
      title,
      description,
      images: [
        {
          url: COMPASS_OPEN_GRAPH_IMAGE,
          width: 1200,
          height: 630,
          alt: imageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
      images: [COMPASS_OPEN_GRAPH_IMAGE],
    },
  } satisfies Pick<Metadata, "openGraph" | "twitter">;
}
