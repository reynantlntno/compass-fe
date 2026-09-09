import type { Metadata } from "next";

import {
  PublicAboutContent,
  PublicAboutState,
} from "@/components/public/public-about-page";
import { getPublicBranding } from "@/lib/branding";
import { getPublicServiceGuide } from "@/lib/public-service-guide";
import { getPublicAboutPage } from "@/lib/public-about";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [branding, about] = await Promise.all([
    getPublicBranding(),
    getPublicAboutPage(),
  ]);

  if (about.state !== "ready") {
    return { title: `About ${branding.officeName}` };
  }

  const summary = about.data.summary.trim();

  return {
    title: `${about.data.title} | ${branding.productName}`,
    ...(summary ? { description: summary } : {}),
  };
}

export default async function AboutPage() {
  const [branding, about, serviceGuide] = await Promise.all([
    getPublicBranding(),
    getPublicAboutPage(),
    getPublicServiceGuide(),
  ]);

  return (
    <article
      aria-labelledby="about-heading"
      className="public-section public-content-page public-about-page"
    >
      <div className="public-shell public-reading-width">
        {about.state === "ready" ? (
          <PublicAboutContent
            branding={branding}
            page={about}
            showServicesLink={serviceGuide.state === "ready"}
          />
        ) : (
          <PublicAboutState state={about.state} />
        )}
      </div>
    </article>
  );
}
