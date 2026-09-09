import Link from "next/link";
import { ArrowUpRight, Clock3, Mail, MapPin, Phone } from "lucide-react";

import { ContentRetryButton } from "@/components/public/content-retry-button";
import { PublicContactPageLink } from "@/components/public/public-contact-page";
import { PublicRichText } from "@/components/public/public-content-pages";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import type { BrandingConfig } from "@/lib/branding";
import type { PublicAboutPageState } from "@/lib/public-about";

function phoneHref(value: string | null) {
  if (!value) return null;

  const normalized = value.replace(/[^0-9+]/g, "");
  return normalized ? `tel:${normalized}` : null;
}

function officeLocation(branding: BrandingConfig) {
  return branding.officeLocation || branding.address;
}

function hasOfficeDetails(branding: BrandingConfig) {
  return Boolean(
    branding.campus ||
      officeLocation(branding) ||
      branding.officeHours ||
      branding.email ||
      branding.phone,
  );
}

function AboutOfficeDetails({ branding }: { branding: BrandingConfig }) {
  const location = officeLocation(branding);
  const phone = phoneHref(branding.phone);

  if (!hasOfficeDetails(branding)) return null;

  return (
    <aside
      aria-labelledby="about-office-details-heading"
      className="public-about-page__office"
    >
      <p className="public-eyebrow">Office details</p>
      <h2 id="about-office-details-heading">{branding.officeName}</h2>
      <p className="public-about-page__office-institution">
        {branding.institutionName}
        {branding.campus ? ` · ${branding.campus}` : ""}
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
        {branding.officeHours ? (
          <div>
            <dt>
              <Clock3 aria-hidden="true" />
              Office hours
            </dt>
            <dd>{branding.officeHours}</dd>
          </div>
        ) : null}
        {branding.email ? (
          <div>
            <dt>
              <Mail aria-hidden="true" />
              Email
            </dt>
            <dd>
              <a href={`mailto:${branding.email}`}>{branding.email}</a>
            </dd>
          </div>
        ) : null}
        {branding.phone && phone ? (
          <div>
            <dt>
              <Phone aria-hidden="true" />
              Phone
            </dt>
            <dd>
              <a href={phone}>{branding.phone}</a>
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

export function PublicAboutContent({
  branding,
  page,
  showServicesLink,
}: {
  branding: BrandingConfig;
  page: Extract<PublicAboutPageState, { state: "ready" }>;
  showServicesLink: boolean;
}) {
  const summary = page.data.summary.trim();

  return (
    <div className="public-about-page__grid">
      <div className="public-about-page__main">
        <header className="public-content-detail__header public-about-page__header">
          <p className="public-eyebrow">About the office</p>
          <h1 id="about-heading">{page.data.title}</h1>
          {summary ? <p>{summary}</p> : null}
        </header>

        <PublicRichText html={page.data.body_html} />

        {showServicesLink ? (
          <div className="public-about-page__actions">
            <Link className="public-content-link" href="/services">
              View service guide
              <ArrowUpRight aria-hidden="true" className="public-content-link__icon" />
            </Link>
          </div>
        ) : null}
      </div>

      <AboutOfficeDetails branding={branding} />
    </div>
  );
}

export function PublicAboutState({
  state,
}: {
  state: Exclude<PublicAboutPageState["state"], "ready">;
}) {
  const copy =
    state === "empty"
      ? {
          title: "About information isn’t available yet",
          description: "Please check back later.",
        }
      : {
          title: "We can’t show this right now",
          description: "Please try again later.",
        };

  return (
    <div
      aria-live="polite"
      className="public-content-state public-about-page__state"
      role="status"
    >
      <p className="public-eyebrow">About the office</p>
      <h1 id="about-heading">{copy.title}</h1>
      <p>{copy.description}</p>
      {state === "unavailable" ? <ContentRetryButton /> : null}
    </div>
  );
}

export function PublicAboutError({ reset }: { reset: () => void }) {
  return (
    <section className="public-section public-content-page public-content-page--state">
      <div className="public-shell public-reading-width">
        <div className="public-content-state" role="alert">
          <p className="public-eyebrow">About the office</p>
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
