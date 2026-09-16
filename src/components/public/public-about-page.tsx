import Link from "next/link";
import { ArrowUpRight, Clock3, Mail, MapPin, Phone } from "lucide-react";

import { PublicContactPageLink } from "@/components/public/public-contact-page";
import { ExternalLink } from "@/components/public/external-link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import type { PublicIdentityConfig } from "@/lib/public-identity";
import {
  ABOUT_PAGE_CONTENT,
  type AboutSection,
  type PublicCopySegment,
} from "@/lib/public-site-copy";

function phoneHref(value: string | null) {
  if (!value) return null;

  const normalized = value.replace(/[^0-9+]/g, "");
  return normalized ? `tel:${normalized}` : null;
}

function officeLocation(identity: PublicIdentityConfig) {
  return identity.officeLocation || identity.address;
}

function hasOfficeDetails(identity: PublicIdentityConfig) {
  return Boolean(
    identity.campus ||
      officeLocation(identity) ||
      identity.officeHours ||
      identity.email ||
      identity.phone,
  );
}

function AboutOfficeDetails({ identity }: { identity: PublicIdentityConfig }) {
  const location = officeLocation(identity);
  const phone = phoneHref(identity.phone);

  if (!hasOfficeDetails(identity)) return null;

  return (
    <aside
      aria-labelledby="about-office-details-heading"
      className="public-about-page__office"
    >
      <p className="public-eyebrow">Office details</p>
      <h2 id="about-office-details-heading">{identity.officeName}</h2>
      <p className="public-about-page__office-institution">
        {identity.institutionName}
        {identity.campus ? ` · ${identity.campus}` : ""}
      </p>

      <dl className="public-about-page__office-list">
        {location ? (
          <div>
            <dt>
              <MapPin aria-hidden="true" />
              Location
            </dt>
            <dd>{location}</dd>
          </div>
        ) : null}
        {identity.officeHours ? (
          <div>
            <dt>
              <Clock3 aria-hidden="true" />
              Office hours
            </dt>
            <dd>{identity.officeHours}</dd>
          </div>
        ) : null}
        {identity.email ? (
          <div>
            <dt>
              <Mail aria-hidden="true" />
              Email
            </dt>
            <dd>
              <a href={`mailto:${identity.email}`}>{identity.email}</a>
            </dd>
          </div>
        ) : null}
        {identity.phone && phone ? (
          <div>
            <dt>
              <Phone aria-hidden="true" />
              Phone
            </dt>
            <dd>
              <a href={phone}>{identity.phone}</a>
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="public-about-page__contact-action">
        <PublicContactPageLink />
      </div>
    </aside>
  );
}

function AboutCopySegment({
  segment,
  identity,
}: {
  segment: PublicCopySegment;
  identity: PublicIdentityConfig;
}) {
  if (typeof segment === "string") return segment;
  if (segment.href.startsWith("/")) {
    return <Link href={segment.href}>{segment.text}</Link>;
  }
  if (segment.href === "identity:official_website") {
    return identity.officialWebsite ? (
      <ExternalLink href={identity.officialWebsite} showArrow={false}>
        {segment.text}
      </ExternalLink>
    ) : segment.text;
  }

  return <ExternalLink href={segment.href} showArrow={false}>{segment.text}</ExternalLink>;
}

function AboutSectionContent({
  section,
  identity,
}: {
  section: AboutSection;
  identity: PublicIdentityConfig;
}) {
  return (
    <section className="public-about-page__copy-section">
      <h2>{section.heading}</h2>
      {section.paragraphs?.map((paragraph, index) => (
        <p key={`${section.heading}-paragraph-${index}`}>
            {paragraph.map((segment, segmentIndex) => (
            <AboutCopySegment
              identity={identity}
              key={`${segmentIndex}`}
              segment={segment}
            />
          ))}
        </p>
      ))}
      {section.list ? (
        <ul>
          {section.list.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : null}
    </section>
  );
}

export function PublicAboutContent({ identity }: { identity: PublicIdentityConfig }) {
  const summary = ABOUT_PAGE_CONTENT.summary.trim();

  return (
    <div className="public-about-page__grid">
      <div className="public-about-page__main">
        <header className="public-content-detail__header public-about-page__header">
          <p className="public-eyebrow">{ABOUT_PAGE_CONTENT.statusLabel}</p>
          <h1 id="about-heading">{ABOUT_PAGE_CONTENT.title}</h1>
          {summary ? <p>{summary}</p> : null}
        </header>

        <div className="public-rich-text public-about-page__copy">
          {ABOUT_PAGE_CONTENT.sections.map((section) => (
            <AboutSectionContent
              identity={identity}
              key={section.heading}
              section={section}
            />
          ))}
        </div>

        <div className="public-about-page__actions">
          <Link className="public-content-link" href="/services">
            View services
            <ArrowUpRight aria-hidden="true" className="public-content-link__icon" />
          </Link>
        </div>
      </div>

      <AboutOfficeDetails identity={identity} />
    </div>
  );
}

export function PublicAboutError({ reset }: { reset: () => void }) {
  return (
    <section className="public-section public-content-page public-content-page--state">
      <div className="public-shell public-reading-width">
        <div className="public-content-state" role="alert">
          <h1>We can’t show this right now</h1>
          <p>Try again, or come back later.</p>
          <Button type="button" variant="outline" onClick={reset}>
            Try again
          </Button>
        </div>
      </div>
    </section>
  );
}

export function PublicAboutLoading() {
  return (
    <section
      aria-busy="true"
      className="public-section public-content-page public-content-loading public-about-page__loading"
    >
      <div className="public-shell public-reading-width">
        <div className="public-content-loading__status" role="status" aria-live="polite">
          <Spinner aria-hidden="true" className="size-4" />
          <span>Loading about information…</span>
        </div>
        <div aria-hidden="true" className="public-about-page__loading-grid">
          <div>
            <Skeleton className="public-content-skeleton__heading" />
            <Skeleton className="public-content-skeleton__summary" />
            <div className="public-content-skeleton-detail__body">
              {Array.from({ length: 7 }, (_, index) => (
                <Skeleton className="public-content-skeleton__line" key={index} />
              ))}
            </div>
          </div>
          <Skeleton className="public-about-page__loading-office" />
        </div>
      </div>
    </section>
  );
}
