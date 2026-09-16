import Link from "next/link";
import { ArrowUpRight, Clock3, Mail, MapPin, Phone } from "lucide-react";

import { PublicContactForm } from "@/components/public/public-contact-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import type { PublicIdentityConfig } from "@/lib/public-identity";

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

function OfficeDetails({ identity }: { identity: PublicIdentityConfig }) {
  const location = officeLocation(identity);
  const phone = phoneHref(identity.phone);

  if (!hasOfficeDetails(identity)) return null;

  return (
    <aside aria-labelledby="contact-office-details-heading" className="public-contact-page__office">
      <p className="public-eyebrow">Office details</p>
      <h2 id="contact-office-details-heading">Where to find the office</h2>
      <p className="public-contact-page__office-name">
        {identity.officeName}
        <br />
        <span>
          {identity.institutionName}
          {identity.campus ? ` · ${identity.campus}` : ""}
        </span>
      </p>

      <dl className="public-contact-page__office-list">
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
    </aside>
  );
}

export function PublicContactContent({ identity }: { identity: PublicIdentityConfig }) {
  return (
    <div className="public-contact-page__layout">
      <div className="public-contact-page__main">
        <header className="public-content-detail__header public-contact-page__header">
          <p className="public-eyebrow">Contact the office</p>
          <h1 id="contact-heading">Send a message to {identity.officeName}.</h1>
          <p>
            Use this form for a question, suggestion, feedback, or concern. Share only what the
            office needs to understand your message.
          </p>
        </header>
        <PublicContactForm />
      </div>

      <OfficeDetails identity={identity} />
    </div>
  );
}

export function PublicContactError({ reset }: { reset: () => void }) {
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

export function PublicContactLoading() {
  return (
    <section
      aria-busy="true"
      className="public-section public-content-page public-content-loading public-contact-page__loading"
    >
      <div className="public-shell public-reading-width">
        <div className="public-content-loading__status" role="status" aria-live="polite">
          <Spinner aria-hidden="true" className="size-4" />
          <span>Loading the contact page…</span>
        </div>
        <div aria-hidden="true" className="public-contact-page__loading-grid">
          <div>
            <Skeleton className="public-content-skeleton__heading" />
            <Skeleton className="public-content-skeleton__summary" />
            <div className="public-contact-page__loading-form">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton className="public-contact-page__loading-field" key={index} />
              ))}
              <Skeleton className="public-contact-page__loading-message" />
              <Skeleton className="public-contact-page__loading-consents" />
              <Skeleton className="public-contact-page__loading-action" />
            </div>
          </div>
          <Skeleton className="public-contact-page__loading-office" />
        </div>
      </div>
    </section>
  );
}

export function PublicContactPageLink() {
  return (
    <Link className="public-content-link" href="/contact">
      Contact the office
      <ArrowUpRight aria-hidden="true" className="public-content-link__icon" />
    </Link>
  );
}
