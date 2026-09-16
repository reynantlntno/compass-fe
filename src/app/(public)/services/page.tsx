import type { Metadata } from "next";
import Link from "next/link";

import { PublicServiceGuide } from "@/components/public/public-service-guide";
import { PUBLIC_SERVICE_PAGE_CONTENT } from "@/lib/public-site-copy";

export function generateMetadata(): Metadata {
  return {
    title: PUBLIC_SERVICE_PAGE_CONTENT.title,
    description: PUBLIC_SERVICE_PAGE_CONTENT.introduction,
  };
}

export default function ServicesPage() {
  return (
    <section className="public-section public-content-page public-service-page" aria-labelledby="services-heading">
      <div className="public-shell public-reading-width">
        <header className="public-content-page__header public-service-page__header">
          <p className="public-eyebrow">{PUBLIC_SERVICE_PAGE_CONTENT.statusLabel}</p>
          <h1 id="services-heading">
            {PUBLIC_SERVICE_PAGE_CONTENT.title}
          </h1>
          <p>{PUBLIC_SERVICE_PAGE_CONTENT.introduction}</p>
          <p>
            <Link className="public-content-link" href="/login">
              Sign in to COMPASS
            </Link>
          </p>
        </header>

        <PublicServiceGuide services={PUBLIC_SERVICE_PAGE_CONTENT.services} />
      </div>
    </section>
  );
}
