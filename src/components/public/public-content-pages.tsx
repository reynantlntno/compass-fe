import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Inbox,
} from "lucide-react";

import { ContentRetryButton } from "@/components/public/content-retry-button";
import { ExternalLink } from "@/components/public/external-link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import type {
  PublicContentKind,
  PublicContentListState,
} from "@/lib/public-content";
import type { PublicContentSchema } from "@/lib/api/generated/model";

const contentCopy = {
  announcements: {
    label: "Announcements",
    title: "A few notes from the office",
    description: "Updates and reminders from the office.",
    itemAction: "Read announcement",
    emptyTitle: "No announcements just yet",
    emptyDescription: "There are no public announcements to browse at the moment.",
    notFoundTitle: "That announcement isn’t here",
    notFoundDescription: "We couldn’t find the announcement you were looking for.",
  },
  resources: {
    label: "Resources",
    title: "Helpful things to keep nearby",
    description: "Practical reading and trusted links from the office.",
    itemAction: "View resource",
    emptyTitle: "No resources just yet",
    emptyDescription: "There are no public resources to browse at the moment.",
    notFoundTitle: "That resource isn’t here",
    notFoundDescription: "We couldn’t find the resource you were looking for.",
  },
} as const satisfies Record<PublicContentKind, Record<string, string>>;

function clean(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

function formatDate(value: string | null | undefined) {
  const normalized = clean(value);
  if (!normalized) return null;

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatLabel(value: string | null | undefined, fallback: string) {
  const normalized = clean(value)?.toLowerCase();
  if (!normalized) return fallback;

  const knownLabels: Record<string, string> = {
    forms: "Forms and templates",
    general: "General",
    guidelines: "Guidelines and policies",
    link: "External resource",
    mental_health: "Mental health resources",
    page: "Information page",
  };

  return knownLabels[normalized] ?? normalized.replace(/[_-]+/g, " ");
}

function contentHref(kind: PublicContentKind, slug: string) {
  return `/${kind}/${encodeURIComponent(slug)}`;
}

function isExternalUrl(value: string | null | undefined) {
  const normalized = clean(value);
  if (!normalized) return false;

  try {
    const url = new URL(normalized);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function ContentMeta({
  content,
  kind,
}: {
  content: PublicContentSchema;
  kind: PublicContentKind;
}) {
  const publishedDate = formatDate(content.published_at);
  const values = [
    clean(content.category) && formatLabel(content.category, "Category"),
    kind === "resources" && clean(content.resource_type)
      ? formatLabel(content.resource_type, "Resource")
      : null,
    publishedDate ? `Published ${publishedDate}` : null,
  ].filter((value): value is string => Boolean(value));

  if (values.length === 0) return null;

  return (
    <p className="public-item__meta">
      {values.map((value, index) => (
        <span key={`${value}-${index}`}>
          {index > 0 ? <span aria-hidden="true"> · </span> : null}
          {value}
        </span>
      ))}
    </p>
  );
}

function ContentIndexHeading({ kind }: { kind: PublicContentKind }) {
  const copy = contentCopy[kind];

  return (
    <header className="public-content-page__header">
      <p className="public-eyebrow">{copy.label}</p>
      <h1 id={`${kind}-heading`}>{copy.title}</h1>
      <p>{copy.description}</p>
    </header>
  );
}

function ContentEmptyState({ kind }: { kind: PublicContentKind }) {
  const copy = contentCopy[kind];

  return (
    <div className="public-content-state public-content-state--empty" role="status" aria-live="polite">
      <span className="public-content-state__icon" aria-hidden="true">
        <Inbox />
      </span>
      <div>
        <h2>{copy.emptyTitle}</h2>
        <p>{copy.emptyDescription}</p>
      </div>
    </div>
  );
}

export function PublicContentUnavailable({ kind }: { kind: PublicContentKind }) {
  const copy = contentCopy[kind];

  return (
    <div className="public-content-state" role="status" aria-live="polite">
      <span className="public-eyebrow">{copy.label}</span>
      <h2>We can’t show this right now</h2>
      <p>Please try again later.</p>
      <ContentRetryButton />
    </div>
  );
}

export function PublicContentDetailUnavailable({ kind }: { kind: PublicContentKind }) {
  return (
    <section className="public-section public-content-page public-content-page--state">
      <div className="public-shell public-reading-width">
        <PublicContentUnavailable kind={kind} />
      </div>
    </section>
  );
}

export function PublicContentNotFound({ kind }: { kind: PublicContentKind }) {
  const copy = contentCopy[kind];

  return (
    <section className="public-section public-content-page public-content-page--state">
      <div className="public-shell public-reading-width">
        <div className="public-content-state" role="status" aria-live="polite">
          <span className="public-eyebrow">{copy.label}</span>
          <h1>{copy.notFoundTitle}</h1>
          <p>{copy.notFoundDescription}</p>
          <Link className="public-content-detail__back" href={`/${kind}`}>
            <ArrowLeft aria-hidden="true" />
            Back to {copy.label.toLowerCase()}
          </Link>
        </div>
      </div>
    </section>
  );
}

function ContentPagination({
  kind,
  page,
  pageSize,
  total,
}: {
  kind: PublicContentKind;
  page: number;
  pageSize: number;
  total: number;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const hrefFor = (nextPage: number) =>
    nextPage === 1 ? `/${kind}` : `/${kind}?page=${nextPage}`;
  const copy = contentCopy[kind];

  return (
    <nav className="public-content-pagination" aria-label={`${copy.label} pages`}>
      {page > 1 ? (
        <Link href={hrefFor(page - 1)}>
          <ArrowLeft aria-hidden="true" />
          Previous
        </Link>
      ) : (
        <span className="public-content-pagination__disabled" aria-hidden="true">
          <ArrowLeft aria-hidden="true" />
          Previous
        </span>
      )}
      <span aria-current="page">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)}>
          Next
          <ArrowRight aria-hidden="true" />
        </Link>
      ) : (
        <span className="public-content-pagination__disabled" aria-hidden="true">
          Next
          <ArrowRight aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}

function OutOfRangeState({
  kind,
  pageSize,
  total,
}: {
  kind: PublicContentKind;
  pageSize: number;
  total: number;
}) {
  const copy = contentCopy[kind];
  const lastPage = Math.ceil(total / pageSize);
  const previousHref = lastPage > 1 ? `/${kind}?page=${lastPage}` : `/${kind}`;

  return (
    <div className="public-content-state" role="status" aria-live="polite">
      <span className="public-eyebrow">{copy.label}</span>
      <h2>There’s nothing on this page</h2>
      <p>Try an earlier page to keep browsing.</p>
      <Link className="public-content-detail__back" href={previousHref}>
        <ArrowLeft aria-hidden="true" />
        Go to the previous page
      </Link>
    </div>
  );
}

function ContentListItem({
  content,
  kind,
}: {
  content: PublicContentSchema;
  kind: PublicContentKind;
}) {
  const copy = contentCopy[kind];
  const href = contentHref(kind, content.slug);
  const summary = clean(content.summary);

  return (
    <li className="public-content-list__item">
      <ContentMeta content={content} kind={kind} />
      <h2>
        <Link href={href}>{content.title}</Link>
      </h2>
      {summary ? <p>{summary}</p> : null}
      <Link className="public-content-link" href={href}>
        {copy.itemAction}
        <ArrowUpRight aria-hidden="true" className="public-content-link__icon" />
      </Link>
    </li>
  );
}

export function PublicContentIndex({
  data,
  kind,
}: {
  data: PublicContentListState;
  kind: PublicContentKind;
}) {
  return (
    <section className="public-section public-content-page" aria-labelledby={`${kind}-heading`}>
      <div className="public-shell public-reading-width">
        <ContentIndexHeading kind={kind} />
        {data.state === "unavailable" ? (
          <PublicContentUnavailable kind={kind} />
        ) : data.state === "empty" ? (
          <ContentEmptyState kind={kind} />
        ) : data.state === "out_of_range" ? (
          <OutOfRangeState
            kind={kind}
            pageSize={data.pageSize}
            total={data.total}
          />
        ) : (
          <>
            <ul className="public-content-list">
              {data.items.map((content) => (
                <ContentListItem content={content} kind={kind} key={content.slug} />
              ))}
            </ul>
            <ContentPagination
              kind={kind}
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
            />
          </>
        )}
      </div>
    </section>
  );
}

/** The only public boundary that renders backend-sanitized rich text. */
export function PublicRichText({ html }: { html: string }) {
  const normalized = html.trim();
  if (!normalized) return null;

  return (
    <div
      className="public-rich-text"
      dangerouslySetInnerHTML={{ __html: normalized }}
    />
  );
}

function ResourceGateway({ content }: { content: PublicContentSchema }) {
  const href = isExternalUrl(content.external_url) ? content.external_url : null;

  if (!href) {
    return (
      <div className="public-content-state" role="status" aria-live="polite">
        <span className="public-eyebrow">Resource</span>
        <h2>This resource isn’t available right now</h2>
        <p>Please try again later.</p>
        <ContentRetryButton />
      </div>
    );
  }

  return (
    <section className="public-resource-gateway" aria-labelledby="resource-gateway-heading">
      <p className="public-eyebrow">External resource</p>
      <h2 id="resource-gateway-heading">Continue to the resource</h2>
      <p>
        This link opens a trusted external resource in a new tab. COMPASS does not embed
        external websites in the page.
      </p>
      <ExternalLink
        ariaLabel={`Open ${content.title}; opens in a new tab`}
        href={href}
      >
        Open {content.title}
      </ExternalLink>
    </section>
  );
}

function EmptyBodyNotice({ kind }: { kind: PublicContentKind }) {
  return (
    <p className="public-content-detail__empty-body" role="status" aria-live="polite">
      There are no additional details for this {kind === "announcements" ? "announcement" : "resource"}.
    </p>
  );
}

export function PublicContentDetail({
  content,
  kind,
}: {
  content: PublicContentSchema;
  kind: PublicContentKind;
}) {
  const copy = contentCopy[kind];
  const isAnnouncement = kind === "announcements";
  const body = clean(content.body_html);

  return (
    <article className="public-section public-content-page public-content-detail">
      <div className="public-shell public-reading-width">
        <Link className="public-content-detail__back" href={`/${kind}`}>
          <ArrowLeft aria-hidden="true" />
          Back to {copy.label.toLowerCase()}
        </Link>
        <header className="public-content-detail__header">
          <ContentMeta content={content} kind={kind} />
          <h1>{content.title}</h1>
          {clean(content.summary) ? <p>{content.summary}</p> : null}
        </header>
        {isAnnouncement ? (
          body ? <PublicRichText html={body} /> : <EmptyBodyNotice kind={kind} />
        ) : content.resource_type === "page" ? (
          body ? <PublicRichText html={body} /> : <EmptyBodyNotice kind={kind} />
        ) : (
          <ResourceGateway content={content} />
        )}
      </div>
    </article>
  );
}

export function PublicContentError({
  kind,
  reset,
}: {
  kind: PublicContentKind;
  reset: () => void;
}) {
  const copy = contentCopy[kind];

  return (
    <section className="public-section public-content-page public-content-page--state">
      <div className="public-shell public-reading-width">
        <div className="public-content-state" role="alert">
          <span className="public-eyebrow">{copy.label}</span>
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

export function PublicContentLoading({
  detail = false,
  kind,
}: {
  detail?: boolean;
  kind: PublicContentKind;
}) {
  const copy = contentCopy[kind];

  return (
    <section
      className={`public-section public-content-page public-content-loading${detail ? " public-content-loading--detail" : ""}`}
      aria-busy="true"
    >
      <div className="public-shell public-reading-width">
        <div className="public-content-loading__status" role="status" aria-live="polite">
          <Spinner aria-hidden="true" className="size-4" />
          <span>Loading {copy.label.toLowerCase()}…</span>
        </div>
        <div aria-hidden="true">
          {detail ? <DetailSkeleton /> : <ListSkeleton />}
        </div>
      </div>
    </section>
  );
}

function ListSkeleton() {
  return (
    <div className="public-content-skeleton-list">
      <Skeleton className="public-content-skeleton__heading" />
      <Skeleton className="public-content-skeleton__summary" />
      <div className="public-content-skeleton-list__items">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="public-content-skeleton-list__item" key={index}>
            <Skeleton className="public-content-skeleton__meta" />
            <Skeleton className="public-content-skeleton__title" />
            <Skeleton className="public-content-skeleton__line" />
            <Skeleton className="public-content-skeleton__action" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="public-content-skeleton-detail">
      <Skeleton className="public-content-skeleton__back" />
      <Skeleton className="public-content-skeleton__meta" />
      <Skeleton className="public-content-skeleton-detail__title" />
      <Skeleton className="public-content-skeleton-detail__summary" />
      <div className="public-content-skeleton-detail__body">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton className="public-content-skeleton__line" key={index} />
        ))}
      </div>
    </div>
  );
}
