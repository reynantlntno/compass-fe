import type { Metadata } from "next";

import { PublicRichText } from "@/components/public/public-content-pages";
import {
  PublicPrivacyUnavailable,
} from "@/components/public/public-privacy-page";
import { ExternalLink } from "@/components/public/external-link";
import { isExternalUrl } from "@/components/public/public-link";
import { getPublicBranding } from "@/lib/branding";
import { formatPublicDate } from "@/lib/public-date";
import { getPublicPrivacyNotice } from "@/lib/public-privacy-notice";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPublicBranding();
  const title = `${branding.productName} Privacy Notice — ${branding.officeName}`;

  return {
    title,
    description: `How ${branding.productName} handles personal information for the ${branding.officeName}.`,
  };
}

export default async function PrivacyPage() {
  const [branding, privacy] = await Promise.all([
    getPublicBranding(),
    getPublicPrivacyNotice(),
  ]);
  const institutionalPrivacyLink = branding.privacyLinks.find((link) =>
    isExternalUrl(link.url),
  );
  const effectiveDate =
    privacy.state === "ready"
      ? formatPublicDate(privacy.data.effective_at)
      : null;

  return (
    <article className="public-section public-content-page public-content-detail public-privacy-page">
      <div className="public-shell public-reading-width">
        <header className="public-content-detail__header">
          <p className="public-eyebrow">Privacy</p>
          <h1>{branding.productName} Privacy Notice — {branding.officeName}</h1>
          <p>
            How {branding.productName} handles personal information for the {branding.officeName}.
          </p>
          {privacy.state === "ready" ? (
            <p className="public-item__meta public-privacy-page__meta">
              Version {privacy.data.version}
              {effectiveDate
                ? ` · Effective ${effectiveDate}`
                : ""}
            </p>
          ) : null}
        </header>

        {privacy.state === "ready" ? (
          <PublicRichText html={privacy.data.body_html} />
        ) : (
          <PublicPrivacyUnavailable />
        )}

        {institutionalPrivacyLink ? (
          <section
            aria-labelledby="institutional-privacy-heading"
            className="public-privacy-page__institutional"
          >
            <p className="public-eyebrow">Institutional notice</p>
            <h2 id="institutional-privacy-heading">{institutionalPrivacyLink.label}</h2>
            <p>
              {branding.productName} operates under {branding.institutionName}. Read the
              institutional notice for broader privacy information.
            </p>
            <ExternalLink href={institutionalPrivacyLink.url}>
              Read {institutionalPrivacyLink.label}
            </ExternalLink>
          </section>
        ) : null}
      </div>
    </article>
  );
}
