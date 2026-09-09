"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ContentRetryButton } from "@/components/public/content-retry-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import type {
  PublicServiceGuideSchema,
  ServiceGuideFieldsSchema,
} from "@/lib/api/generated/model";
import type { PublicServiceGuideState as PublicServiceGuideResult } from "@/lib/public-service-guide";
import { formatPublicDate } from "@/lib/public-date";

const fieldKeys = [
  "requirements",
  "fees",
  "timelines",
  "receipt_rules",
  "claim_rules",
  "proxy_claims",
  "office_hours",
  "contact",
] as const satisfies ReadonlyArray<keyof ServiceGuideFieldsSchema>;

const privacyNotes: Record<string, string> = {
  public: "Public information that does not require a signed-in account.",
  personal: "Uses personal information supplied through the approved COMPASS service.",
  internal: "For signed-in users and authorized office processing.",
  sensitive: "Handled as sensitive office information with restricted access.",
  counseling_confidential:
    "Counseling-related information is limited to approved roles, purposes, and assignments.",
};

function normalized(value: string | null | undefined) {
  const result = value?.trim();
  return result || null;
}

function anchorId(value: string, fallback: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-") || fallback;
}

function GuideField({
  field,
}: {
  field: ServiceGuideFieldsSchema[keyof ServiceGuideFieldsSchema];
}) {
  const value = field.confirmed ? normalized(field.value) : null;

  return (
    <div className="public-service-guide__field">
      <dt>{field.label}</dt>
      <dd>{value ?? "Not currently confirmed by the office."}</dd>
    </div>
  );
}

function ServiceFields({ fields }: { fields: ServiceGuideFieldsSchema }) {
  return (
    <dl className="public-service-guide__fields">
      {fieldKeys.map((key) => (
        <GuideField field={fields[key]} key={key} />
      ))}
    </dl>
  );
}

function ServiceEntry({
  entry,
  index,
}: {
  entry: PublicServiceGuideSchema["entries"][number];
  index: number;
}) {
  const summary = normalized(entry.summary);
  const description = normalized(entry.description);
  const privacyNote = privacyNotes[entry.privacy_level] ?? null;
  const entryId = anchorId(entry.anchor, `service-${index + 1}`);

  return (
    <AccordionItem className="public-service-guide__item" id={entryId} value={entry.key}>
      <AccordionTrigger className="public-service-guide__trigger">
        <span className="public-service-guide__trigger-copy">
          <span aria-hidden="true" className="public-service-guide__number">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="public-service-guide__trigger-text">
            <span className="public-service-guide__title">{entry.label}</span>
            {summary ? <span className="public-service-guide__summary">{summary}</span> : null}
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="public-service-guide__content">
        <div className="public-service-guide__overview">
          {summary && summary !== description ? (
            <p className="public-service-guide__lede">{summary}</p>
          ) : null}
          {description ? <p>{description}</p> : null}
          {!entry.available && normalized(entry.availability_label) ? (
            <p className="public-service-guide__availability">{entry.availability_label}</p>
          ) : null}
          {privacyNote ? (
            <div className="public-service-guide__privacy">
              <p className="public-eyebrow">Access and privacy</p>
              <p>{privacyNote}</p>
            </div>
          ) : null}
        </div>

        {entry.steps.length > 0 ? (
          <section
            aria-labelledby={`${entryId}-steps`}
            className="public-service-guide__steps"
          >
            <p className="public-eyebrow" id={`${entryId}-steps`}>
              How it works
            </p>
            <ol>
              {entry.steps.map((step, stepIndex) => (
                <li key={step.key}>
                  <span aria-hidden="true" className="public-service-guide__step-number">
                    {String(stepIndex + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h4>{step.label}</h4>
                    {normalized(step.description) ? <p>{step.description}</p> : null}
                    {normalized(step.boundary) ? (
                      <span>{step.boundary}</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section
          aria-labelledby={`${entryId}-details`}
          className="public-service-guide__details"
        >
          <p className="public-eyebrow" id={`${entryId}-details`}>
            Service details
          </p>
          <ServiceFields fields={entry.fields} />
        </section>
      </AccordionContent>
    </AccordionItem>
  );
}

export function PublicServiceGuideMeta({
  guide,
  officeHours,
  contact,
}: {
  guide: PublicServiceGuideSchema;
  officeHours?: string | null;
  contact?: string | null;
}) {
  const effectiveDate = formatPublicDate(guide.effective_date);
  const values = [
    { label: "Version", value: normalized(guide.version_label) },
    { label: "Effective", value: effectiveDate },
    { label: "Maintained by", value: normalized(guide.owner_office) },
    { label: "Office hours", value: normalized(officeHours) },
    { label: "Contact", value: normalized(contact) },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));

  return (
    <dl className="public-service-guide__meta" aria-label="Service guide information">
      {values.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PublicServiceGuide({
  guide,
  officeHours,
  contact,
}: {
  guide: PublicServiceGuideSchema;
  officeHours?: string | null;
  contact?: string | null;
}) {
  return (
    <div className="public-service-guide">
      <PublicServiceGuideMeta
        contact={contact}
        guide={guide}
        officeHours={officeHours}
      />
      <Accordion
        className="public-service-guide__accordion"
        defaultValue={[guide.entries[0].key]}
        multiple={false}
      >
        {guide.entries.map((entry, index) => (
          <ServiceEntry entry={entry} index={index} key={entry.key} />
        ))}
      </Accordion>
    </div>
  );
}

export function PublicServiceGuideState({
  state,
}: {
  state: Exclude<PublicServiceGuideResult["state"], "ready">;
}) {
  const copy = {
    empty: {
      title: "No services are listed just yet",
      description: "Please check back later for the office service guide.",
    },
    not_published: {
      title: "The service guide isn’t available yet",
      description: "Please check back later for the current office guide.",
    },
    unavailable: {
      title: "We can’t show this right now",
      description: "Please try again later.",
    },
  }[state];

  return (
    <div className="public-content-state public-service-guide__state" role="status" aria-live="polite">
      <p className="public-eyebrow">Services</p>
      <h2>{copy.title}</h2>
      <p>{copy.description}</p>
      {state === "unavailable" ? <ContentRetryButton /> : null}
    </div>
  );
}

export function PublicServiceGuideError({ reset }: { reset: () => void }) {
  return (
    <section className="public-section public-content-page public-content-page--state">
      <div className="public-shell public-reading-width">
        <div className="public-content-state" role="alert">
          <p className="public-eyebrow">Services</p>
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

export function PublicServiceGuideLoading() {
  return (
    <section
      aria-busy="true"
      className="public-section public-content-page public-content-loading public-service-guide__loading"
    >
      <div className="public-shell public-reading-width">
        <div className="public-content-loading__status" role="status" aria-live="polite">
          <Spinner aria-hidden="true" className="size-4" />
          <span>Loading services…</span>
        </div>
        <div aria-hidden="true">
          <Skeleton className="public-content-skeleton__heading" />
          <Skeleton className="public-content-skeleton__summary" />
          <div className="public-service-guide__skeleton-meta">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton className="public-service-guide__skeleton-meta-item" key={index} />
            ))}
          </div>
          <div className="public-service-guide__skeleton-list">
            {Array.from({ length: 5 }, (_, index) => (
              <div className="public-service-guide__skeleton-item" key={index}>
                <Skeleton className="public-service-guide__skeleton-number" />
                <Skeleton className="public-service-guide__skeleton-title" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
