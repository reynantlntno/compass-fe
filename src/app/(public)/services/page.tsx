import type { Metadata } from "next";

import {
  PublicServiceGuide,
  PublicServiceGuideState,
} from "@/components/public/public-service-guide";
import { getPublicBranding } from "@/lib/branding";
import { getPublicServiceGuide } from "@/lib/public-service-guide";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [branding, guide] = await Promise.all([
    getPublicBranding(),
    getPublicServiceGuide(),
  ]);

  const title = guide.state === "ready" ? guide.data.title : "Services";
  const description =
    guide.state === "ready" && guide.data.summary.trim()
      ? guide.data.summary
      : `Services and support from the ${branding.officeName}.`;

  return { title, description };
}

export default async function ServicesPage() {
  const [branding, guide] = await Promise.all([
    getPublicBranding(),
    getPublicServiceGuide(),
  ]);

  return (
    <section className="public-section public-content-page public-service-page" aria-labelledby="services-heading">
      <div className="public-shell public-reading-width">
        <header className="public-content-page__header public-service-page__header">
          <p className="public-eyebrow">Services</p>
          <h1 id="services-heading">
            {guide.state === "ready" ? guide.data.title : "Services and support"}
          </h1>
          {guide.state === "ready" && guide.data.summary.trim() ? (
            <p>{guide.data.summary}</p>
          ) : null}
        </header>

        {guide.state === "ready" ? (
          <PublicServiceGuide
            contact={branding.email}
            guide={guide.data}
            officeHours={branding.officeHours}
          />
        ) : (
          <PublicServiceGuideState state={guide.state} />
        )}
      </div>
    </section>
  );
}
