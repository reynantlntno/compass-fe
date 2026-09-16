import type { Metadata } from "next";

import { PublicRichText } from "@/components/public/public-content-pages";
import {
  PublicPrivacyUnavailable,
} from "@/components/public/public-privacy-page";
import { ExternalLink } from "@/components/public/external-link";
import { getPublicIdentity } from "@/lib/public-identity";
import { formatPublicDate } from "@/lib/public-date";
import { getPublicPrivacyNotice } from "@/lib/public-privacy-notice";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const identity = await getPublicIdentity();
  const title = `${identity.productName} Privacy Notice — ${identity.officeName}`;

  return {
    title,
    description: `How ${identity.productName} handles personal information for the ${identity.officeName}.`,
  };
}

export default async function PrivacyPage() {
  const [identity, privacy] = await Promise.all([
    getPublicIdentity(),
    getPublicPrivacyNotice(),
  ]);
  const institutionalPrivacyLink = identity.privacyLinks[0];
  const effectiveDate =
    privacy.state === "ready"
      ? formatPublicDate(privacy.data.effective_at)
      : null;

  return (
    <article className="public-section public-content-page public-content-detail public-privacy-page">
      <div className="public-shell public-reading-width">
        <header className="public-content-detail__header">
          <h1>{identity.productName} Privacy Notice — {identity.officeName}</h1>
          <p>
            How {identity.productName} handles personal information for the {identity.officeName}.
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
              {identity.productName} operates under {identity.institutionName}. Read the
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
