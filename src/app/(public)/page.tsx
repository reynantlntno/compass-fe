import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Clock3,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { HomepageCharacter } from "@/components/public/homepage-character";
import { HomepageAccountAction } from "@/components/public/homepage-account-action";
import { PaperSheet } from "@/components/public/paper-sheet";
import { StickyNote } from "@/components/public/sticky-note";
import { getPublicBranding } from "@/lib/branding";
import { getHomepageContent } from "@/lib/homepage";
import { formatPublicDate } from "@/lib/public-date";

function phoneHref(value: string | null) {
  if (!value) return null;

  const normalized = value.replace(/[^0-9+]/g, "");
  return normalized ? "tel:" + normalized : null;
}

function contentLabel(value: string | null | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function HomepageAction({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const content = (
    <>
      <span className="homepage-action__label">{label}</span>
      <ArrowUpRight aria-hidden="true" className="homepage-action__icon" />
    </>
  );

  return href.startsWith("/") ? (
    <Link className="homepage-action" href={href}>
      {content}
    </Link>
  ) : (
    <a className="homepage-action" href={href}>
      {content}
    </a>
  );
}

function OfficeDetails({
  branding,
}: {
  branding: Awaited<ReturnType<typeof getPublicBranding>>;
}) {
  const location = branding.officeLocation || branding.address;
  const phone = phoneHref(branding.phone);
  const hasDetails = Boolean(
    branding.campus ||
      location ||
      branding.officeHours ||
      branding.email ||
      branding.phone,
  );

  if (!hasDetails) return null;

  return (
    <section
      className="homepage-section homepage-office"
      aria-labelledby="office-details-heading"
    >
      <div className="homepage-office__intro">
        <HomepageCharacter
          character="wave"
          className="homepage-office__character"
          sizes="(max-width: 40rem) 5.75rem, 8rem"
        />
        <div className="homepage-office__intro-copy">
          <p className="homepage-kicker">Office details</p>
          <h2 id="office-details-heading">Reach the {branding.officeName}</h2>
          <p>
            {branding.institutionName}
            {branding.campus ? " · " + branding.campus : ""}
          </p>
        </div>
      </div>
      <dl className="homepage-office__details">
        {location ? (
          <div className="homepage-office__detail homepage-office__detail--location">
            <dt>
              <MapPin aria-hidden="true" />
              Location
            </dt>
            <dd>{location}</dd>
          </div>
        ) : null}
        {branding.officeHours ? (
          <div className="homepage-office__detail">
            <dt>
              <Clock3 aria-hidden="true" />
              Office hours
            </dt>
            <dd>{branding.officeHours}</dd>
          </div>
        ) : null}
        {branding.email ? (
          <div className="homepage-office__detail">
            <dt>
              <Mail aria-hidden="true" />
              Email
            </dt>
            <dd>
              <a href={"mailto:" + branding.email}>{branding.email}</a>
            </dd>
          </div>
        ) : null}
        {branding.phone && phone ? (
          <div className="homepage-office__detail">
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
    </section>
  );
}

export default async function Home() {
  const [branding, content] = await Promise.all([
    getPublicBranding(),
    getHomepageContent(),
  ]);
  const serviceGuide = content.serviceGuide;
  const hasServices = Boolean(serviceGuide?.entries.length);
  const contact = "/contact";
  const actions = [
    contact
      ? {
          href: contact,
          label: "Contact the office",
        }
      : null,
    hasServices
      ? {
          href: "/services",
          label: "View service guide",
        }
      : null,
    content.announcements.length > 0
      ? {
          href: "#announcements",
          label: "See announcements",
        }
      : null,
    content.resources.length > 0
      ? {
          href: "#resources",
          label: "Browse resources",
        }
      : null,
  ].filter((action): action is NonNullable<typeof action> => action !== null);
  const contentGuideSection =
    content.announcements.length > 0
      ? "announcements"
      : content.resources.length > 0
        ? "resources"
        : null;

  return (
    <div className="homepage">
      <section className="homepage-hero" aria-labelledby="homepage-heading">
        <div className="homepage-hero__backdrop" aria-hidden="true" />
        <div className="public-shell homepage-hero__inner">
          <div className="homepage-hero__copy">
            <h1 id="homepage-heading">
              Navigating your journey, <span>together.</span>
            </h1>
            <p className="homepage-hero__summary">
              Start with what is available here, or reach the {branding.officeName} directly
              if you are not sure where to begin.
            </p>
            <div className="homepage-hero__actions">
              <HomepageAccountAction />
              {actions.length > 0 ? (
                <a className="homepage-secondary-action" href="#start-here">
                  Start here
                  <ArrowDown aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </div>
          <div className="homepage-hero__art">
            <Image
              src="/images/compass/gco-characters.png"
              alt="Illustration of four people representing the COMPASS community"
              width={721}
              height={339}
              priority
              sizes="(max-width: 52rem) 58vw, 38rem"
            />
          </div>
        </div>
      </section>

      {actions.length > 0 ? (
        <section
          id="start-here"
          className="public-shell homepage-section homepage-start"
          aria-labelledby="start-here-heading"
        >
          <div className="homepage-section__heading">
            <h2 id="start-here-heading">What brings you here?</h2>
            <p>Choose a place to begin.</p>
          </div>
          <div className="homepage-start__layout">
            <HomepageCharacter
              character="point-up"
              className="homepage-start__character"
              sizes="(max-width: 40rem) 7rem, 10rem"
            />
            <PaperSheet className="homepage-start__sheet" tone="paper">
              <div
                className={`homepage-actions-list${
                  actions.length === 1 ? " homepage-actions-list--single" : ""
                }`}
              >
                {actions.map((action) => (
                  <HomepageAction key={action.label} {...action} />
                ))}
              </div>
            </PaperSheet>
          </div>
        </section>
      ) : null}

      {content.announcements.length > 0 ? (
        <section
          id="announcements"
          className="homepage-section public-shell"
          aria-labelledby="announcements-heading"
        >
          <div
            className={`homepage-section__heading${
              contentGuideSection === "announcements"
                ? " homepage-section__heading--with-character"
                : ""
            }`}
          >
            {contentGuideSection === "announcements" ? (
              <HomepageCharacter
                character="point-right"
                className="homepage-content-guide__character"
                sizes="(max-width: 40rem) 5.75rem, 8rem"
              />
            ) : null}
            <div>
              <h2 id="announcements-heading">What’s new</h2>
              <p>Announcements from the {branding.officeName}.</p>
            </div>
          </div>
          <div className="homepage-notes-grid">
            {content.announcements.map((item, index) => {
              const publishedDate = formatPublicDate(item.published_at);

              return (
                <StickyNote
                  key={item.id}
                  rotation={index % 2 === 0 ? "left" : "right"}
                  showTape
                  tone={index % 2 === 0 ? "butter" : "sage"}
                >
                  <p className="homepage-content-meta">
                    {contentLabel(item.category, "Announcement")}
                    {publishedDate ? " · " + publishedDate : ""}
                  </p>
                  <h3>
                    <Link
                      className="homepage-content-title"
                      href={`/announcements/${encodeURIComponent(item.slug)}`}
                    >
                      {item.title}
                    </Link>
                  </h3>
                  {item.summary ? <p>{item.summary}</p> : null}
                  <Link
                    className="homepage-content-link"
                    href={`/announcements/${encodeURIComponent(item.slug)}`}
                  >
                    Read announcement
                    <ArrowUpRight aria-hidden="true" />
                  </Link>
                </StickyNote>
              );
            })}
          </div>
        </section>
      ) : null}

      {hasServices && serviceGuide ? (
        <section
          id="services"
          className="homepage-section public-shell"
          aria-labelledby="services-heading"
        >
          <div className="homepage-service-preview">
            <div className="homepage-service-preview__copy">
              <h2 id="services-heading">{serviceGuide.title}</h2>
              {serviceGuide.summary ? <p>{serviceGuide.summary}</p> : null}
            </div>
            <Link
              className="public-content-link homepage-service-preview__link"
              href="/services"
            >
              Read the service guide
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </section>
      ) : null}

      {content.resources.length > 0 ? (
        <section
          id="resources"
          className="homepage-section public-shell"
          aria-labelledby="resources-heading"
        >
          <div
            className={`homepage-section__heading${
              contentGuideSection === "resources"
                ? " homepage-section__heading--with-character"
                : ""
            }`}
          >
            {contentGuideSection === "resources" ? (
              <HomepageCharacter
                character="point-right"
                className="homepage-content-guide__character"
                sizes="(max-width: 40rem) 5.75rem, 8rem"
              />
            ) : null}
            <div>
              <p className="homepage-kicker">Resources</p>
              <h2 id="resources-heading">Information to keep close.</h2>
              <p>Public resources from the {branding.officeName}.</p>
            </div>
          </div>
          <div className="homepage-resources-grid">
            {content.resources.map((item) => (
              <PaperSheet key={item.id} tone="plain">
                <p className="homepage-content-meta">
                  {contentLabel(item.resource_type, "Resource")}
                </p>
                <h3>
                  <Link
                    className="homepage-content-title"
                    href={`/resources/${encodeURIComponent(item.slug)}`}
                  >
                    {item.title}
                  </Link>
                </h3>
                {item.summary ? <p>{item.summary}</p> : null}
                <Link
                  className="homepage-content-link"
                  href={`/resources/${encodeURIComponent(item.slug)}`}
                >
                  View resource
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              </PaperSheet>
            ))}
          </div>
        </section>
      ) : null}

      <div className="public-shell">
        <OfficeDetails branding={branding} />
      </div>
    </div>
  );
}
