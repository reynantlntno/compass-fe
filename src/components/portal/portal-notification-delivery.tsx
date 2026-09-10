"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ChevronDown,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";

import { CompassSurface } from "@/components/compass/compass-surface";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortalAccess } from "@/components/portal/portal-access-provider";
import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
import { PortalListRow } from "@/components/portal/portal-list-row";
import { PORTAL_CAPABILITIES } from "@/components/portal/portal-navigation";
import { PortalPageHeader } from "@/components/portal/portal-page-header";
import { PortalViewMenu } from "@/components/portal/portal-view-menu";
import {
  deadLetterPortalNotificationDelivery,
  getPortalNotificationDelivery,
  NotificationDeliveryApiError,
  retryPortalNotificationDelivery,
  type NotificationDeliveryErrorKind,
} from "@/lib/api/notification-delivery";
import { createIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";
import type {
  DeadLetterSchema,
  TechnicalDeliveryPageSchema,
  TechnicalDeliverySchema,
} from "@/lib/api/generated/model";

type DeliveryStatus =
  | "all"
  | "pending"
  | "processing"
  | "sent"
  | "failed"
  | "dead"
  | "cancelled";

type DeliveryActionKind = "retry" | "dead-letter";

type DeliveryAction = {
  delivery: TechnicalDeliverySchema;
  kind: DeliveryActionKind;
  reason: string;
};

type DeliveryLoadState =
  | { kind: "loading" }
  | { kind: "ready"; page: TechnicalDeliveryPageSchema }
  | { kind: "unavailable"; error: NotificationDeliveryErrorKind };

type DeliveryMutationState = {
  deliveryId: string;
  fingerprint: string;
  key: IdempotencyKey | null;
  kind: DeliveryActionKind;
  message: string | null;
  state: "pending" | "error";
};

type MutationKeyEntry = {
  fingerprint: string;
  key: IdempotencyKey;
};

const DELIVERY_STATUS_FILTERS: readonly {
  label: string;
  value: DeliveryStatus;
}[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Processing", value: "processing" },
  { label: "Sent", value: "sent" },
  { label: "Failed", value: "failed" },
  { label: "Dead", value: "dead" },
  { label: "Cancelled", value: "cancelled" },
];

const DELIVERY_STATE_OPTIONS = [
  { label: "All delivery states", value: "" },
  { label: "Queued", value: "queued" },
  { label: "Sending", value: "sending" },
  { label: "Sent", value: "sent" },
  { label: "Delayed", value: "delayed" },
  { label: "Failed", value: "failed" },
  { label: "Retry exhausted", value: "retry_exhausted" },
  { label: "Bounced", value: "bounced" },
  { label: "Cancelled", value: "cancelled" },
] as const;

const DEAD_LETTER_REASONS = [
  { label: "Permanent provider failure", value: "provider_permanent_failure" },
  { label: "Recipient address rejected", value: "recipient_invalid" },
  { label: "Manual operational review", value: "manual_operational_review" },
] as const;

const DELIVERY_STATUS_VALUES = new Set<DeliveryStatus>([
  "all",
  "pending",
  "processing",
  "sent",
  "failed",
  "dead",
  "cancelled",
]);

const DELIVERY_STATE_VALUES: ReadonlySet<string> = new Set(
  DELIVERY_STATE_OPTIONS.filter((option) => option.value).map(
    (option) => option.value,
  ),
);

const MAX_TEMPLATE_KEY_LENGTH = 100;

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function parseStatus(value: string | null): DeliveryStatus {
  return value && DELIVERY_STATUS_VALUES.has(value as DeliveryStatus)
    ? (value as DeliveryStatus)
    : "all";
}

function parseDeliveryState(value: string | null) {
  return value && DELIVERY_STATE_VALUES.has(value) ? value : null;
}

function parseTemplateKey(value: string | null) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 && normalized.length <= MAX_TEMPLATE_KEY_LENGTH
    ? normalized
    : null;
}

function parsePage(value: string | null) {
  const page = Number(value);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10_000) return 1;
  return page;
}

function deliveryHref(
  status: DeliveryStatus,
  page = 1,
  filters: {
    deliveryState?: string | null;
    templateKey?: string | null;
  } = {},
) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (filters.deliveryState) params.set("delivery_state", filters.deliveryState);
  if (filters.templateKey) params.set("template_key", filters.templateKey);
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `/portal/notification-delivery?${query}` : "/portal/notification-delivery";
}

function formatDeliveryStatus(value: TechnicalDeliverySchema["status"]) {
  switch (value) {
    case "pending":
      return "Pending";
    case "processing":
      return "Processing";
    case "sent":
      return "Sent";
    case "failed":
      return "Failed";
    case "dead":
      return "Dead";
    case "cancelled":
      return "Cancelled";
    default:
      return "Status unavailable";
  }
}

function formatDeliveryState(value: TechnicalDeliverySchema["delivery_state"]) {
  switch (value) {
    case "queued":
      return "Queued";
    case "sending":
      return "Sending";
    case "sent":
      return "Sent";
    case "delayed":
      return "Delayed";
    case "failed":
      return "Failed";
    case "retry_exhausted":
      return "Retry exhausted";
    case "bounced":
      return "Bounced";
    case "cancelled":
      return "Cancelled";
    default:
      return "Delivery state unavailable";
  }
}

function statusTone(value: TechnicalDeliverySchema["status"]) {
  if (value === "sent") return "ok";
  if (value === "failed" || value === "dead") return "error";
  if (value === "cancelled") return "muted";
  return "warning";
}

function formatDeliveryDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function canRetry(delivery: TechnicalDeliverySchema) {
  return (
    (delivery.status === "failed" || delivery.status === "dead") &&
    delivery.delivery_state !== "bounced"
  );
}

function canDeadLetter(delivery: TechnicalDeliverySchema) {
  return delivery.status !== "sent" && delivery.status !== "cancelled";
}

function mutationMessage(kind: NotificationDeliveryErrorKind) {
  switch (kind) {
    case "conflict":
      return "This delivery changed. Refresh the list and try again.";
    case "permission":
      return "This action isn’t available for this account.";
    case "validation":
      return "Check the action details and try again.";
    case "rate_limited":
      return "Too many attempts. Please wait before trying again.";
    default:
      return "This action is temporarily unavailable. Try again.";
  }
}

function loadMessage(kind: NotificationDeliveryErrorKind) {
  if (kind === "permission") {
    return "Notification delivery isn’t available for this account.";
  }
  if (kind === "rate_limited") {
    return "Too many delivery requests. Please wait and try again.";
  }
  return "Notification delivery is unavailable right now.";
}

function DeliveryPageHeader({
  description = "Review delivery status and take action on failed messages.",
  headingId = "portal-delivery-heading",
  title = "Notification delivery",
}: {
  description?: ReactNode;
  headingId?: string;
  title?: ReactNode;
}) {
  return (
    <PortalPageHeader
      className="portal-delivery__page-header"
      current="Notification delivery"
      description={description}
      headingId={headingId}
      title={title}
    />
  );
}

function DeliveryNavSkeleton() {
  return (
    <div aria-hidden="true" className="portal-view-menu portal-delivery__nav-skeleton">
      <Skeleton className="portal-delivery__nav-skeleton-trigger" />
    </div>
  );
}

function DeliveryFilters({
  deliveryState,
  status,
  templateKey,
}: {
  deliveryState: string | null;
  status: DeliveryStatus;
  templateKey: string | null;
}) {
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [isFilterNavigationPending, startFilterNavigation] = useTransition();

  const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const submittedDeliveryState = formData.get("delivery_state");
    const submittedTemplateKey = formData.get("template_key");
    const nextHref = deliveryHref(status, 1, {
      deliveryState:
        typeof submittedDeliveryState === "string"
          ? parseDeliveryState(submittedDeliveryState)
          : null,
      templateKey:
        typeof submittedTemplateKey === "string"
          ? parseTemplateKey(submittedTemplateKey)
          : null,
    });

    startFilterNavigation(() => router.push(nextHref));
  };

  return (
    <form
      action="/portal/notification-delivery"
      aria-busy={isFilterNavigationPending || undefined}
      className="compass-surface portal-delivery__filters"
      data-tone="subtle"
      key={`${status}:${deliveryState ?? ""}:${templateKey ?? ""}`}
      method="get"
      onSubmit={handleFilterSubmit}
    >
      {status !== "all" ? <input name="status" type="hidden" value={status} /> : null}
      <Collapsible
        className="portal-delivery__filters-disclosure"
        defaultOpen
        onOpenChange={(open) => setFiltersOpen(open)}
      >
        <div className="portal-delivery__filters-header">
          <div className="portal-delivery__filters-heading">
            <p className="portal-delivery__filters-kicker">Filters</p>
            <p className="portal-delivery__filters-summary">
              Narrow delivery records by state or template.
            </p>
          </div>
          <CollapsibleTrigger
            render={
              <Button
                aria-label={filtersOpen ? "Hide delivery filters" : "Show delivery filters"}
                className="portal-delivery__filters-toggle"
                size="sm"
                type="button"
                variant="outline"
              >
                {filtersOpen ? "Hide filters" : "Show filters"}
                <ChevronDown
                  aria-hidden="true"
                  className={filtersOpen ? "portal-delivery__filters-toggle-icon--open" : undefined}
                />
              </Button>
            }
          />
        </div>
        <CollapsibleContent className="portal-delivery__filters-content">
          <div className="portal-delivery__filters-grid">
            <div className="portal-delivery__filter-field">
              <Label htmlFor="portal-delivery-state">Delivery state</Label>
              <select
                defaultValue={deliveryState ?? ""}
                id="portal-delivery-state"
                name="delivery_state"
              >
                {DELIVERY_STATE_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="portal-delivery__filter-field portal-delivery__filter-field--template">
              <Label htmlFor="portal-delivery-template">Template key</Label>
              <Input
                defaultValue={templateKey ?? ""}
                id="portal-delivery-template"
                maxLength={MAX_TEMPLATE_KEY_LENGTH}
                name="template_key"
                placeholder="Filter by template key"
              />
            </div>
            <div className="portal-delivery__filter-actions">
              <Button
                disabled={isFilterNavigationPending}
                size="sm"
                type="submit"
                variant="default"
              >
                Apply filters
              </Button>
              <Link
                className="portal-delivery__filter-clear"
                href={deliveryHref(status)}
              >
                Clear
              </Link>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </form>
  );
}

function DeliveryLoadingState() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading notification delivery"
      className="portal-delivery portal-delivery--loading"
      role="status"
    >
      <span className="sr-only">Loading notification delivery…</span>
      <DeliveryPageHeader
        description={
          <Skeleton
            as="span"
            aria-hidden="true"
            className="portal-delivery__skeleton-summary"
          />
        }
        title={
          <Skeleton
            as="span"
            aria-hidden="true"
            className="portal-delivery__skeleton-heading"
          />
        }
      />
      <DeliveryNavSkeleton />
      <CompassSurface className="portal-delivery__filters portal-delivery__filters--loading" tone="subtle">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </CompassSurface>
      <PortalCollectionFrame className="portal-delivery__frame">
        <div aria-hidden="true" className="portal-delivery__skeleton-list">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="portal-delivery__skeleton-row" key={index}>
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </div>
          ))}
        </div>
      </PortalCollectionFrame>
    </section>
  );
}

export function PortalNotificationDeliveryLoading() {
  return <DeliveryLoadingState />;
}

function DeliveryAccessState({
  kind,
  onRetry,
}: {
  kind: "forbidden" | "unavailable";
  onRetry?: () => void;
}) {
  return (
    <section
      aria-labelledby="portal-delivery-heading"
      className="portal-delivery portal-delivery--state"
    >
      <DeliveryPageHeader />
      <PortalCollectionFrame className="portal-delivery__frame portal-delivery__frame--state">
        <h2 id="portal-delivery-state-heading">
          {kind === "forbidden"
            ? "This page isn’t available for this account."
            : "Notification delivery isn’t available right now."}
        </h2>
        <p>
          {kind === "forbidden"
            ? "Return to your workspace to continue."
            : "Try again when the connection is ready."}
        </p>
        {onRetry ? (
          <Button onClick={onRetry} type="button" variant="outline">
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        ) : null}
      </PortalCollectionFrame>
    </section>
  );
}

function DeliveryUnavailableState({
  error,
  onRetry,
}: {
  error: NotificationDeliveryErrorKind;
  onRetry: () => void;
}) {
  return (
    <div
      aria-labelledby="portal-delivery-unavailable-heading"
      className="portal-delivery__state"
      role="status"
    >
      <h2 id="portal-delivery-unavailable-heading">{loadMessage(error)}</h2>
      <p>Try again when the connection is ready.</p>
      <Button onClick={onRetry} type="button" variant="outline">
        <RefreshCw aria-hidden="true" />
        Try again
      </Button>
    </div>
  );
}

function DeliveryEmptyState() {
  return (
    <div className="portal-delivery__empty" role="status">
      <h2>No delivery records to show.</h2>
      <p>Delivery metadata will appear here when messages are queued.</p>
    </div>
  );
}

function DeliveryFact({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="portal-delivery__fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function DeliveryRow({
  delivery,
  expanded,
  index,
  mutation,
  onAction,
  onToggle,
}: {
  delivery: TechnicalDeliverySchema;
  expanded: boolean;
  index: number;
  mutation: DeliveryMutationState | null;
  onAction: (delivery: TechnicalDeliverySchema, kind: DeliveryActionKind) => void;
  onToggle: (delivery: TechnicalDeliverySchema) => void;
}) {
  const detailsId = `portal-delivery-details-${index}`;
  const createdAt = formatDeliveryDate(delivery.created_at);
  const sentAt = formatDeliveryDate(delivery.sent_at);
  const nextRetryAt = formatDeliveryDate(delivery.next_retry_at);
  const providerUpdatedAt = formatDeliveryDate(delivery.provider_status_updated_at);
  const statusLabel = formatDeliveryStatus(delivery.status);
  const deliveryStateLabel = formatDeliveryState(delivery.delivery_state);
  const deliveryStateIsRedundant = statusLabel === deliveryStateLabel;
  const mutationForRow = mutation?.deliveryId === delivery.id ? mutation : null;
  const isUpdating = mutationForRow?.state === "pending";
  const showError =
    Boolean(delivery.last_error_safe_summary) &&
    (delivery.status === "failed" ||
      delivery.status === "dead" ||
      delivery.delivery_state === "bounced");

  return (
    <PortalListRow
      className="portal-delivery__row"
      data-status={delivery.status}
      data-tone={statusTone(delivery.status)}
    >
      <button
        aria-controls={detailsId}
        aria-expanded={expanded}
        className="portal-delivery__toggle"
        disabled={isUpdating}
        onClick={() => onToggle(delivery)}
        type="button"
      >
        <span className="portal-delivery__toggle-copy">
          <span className="portal-delivery__row-primary">
            <span className="portal-delivery__template-key">{delivery.template_key}</span>
            <span className="portal-delivery__row-heading">
              <Badge
                aria-label={
                  deliveryStateIsRedundant
                    ? `Status and delivery state: ${statusLabel}`
                    : `Status: ${statusLabel}`
                }
                className="portal-delivery__status-badge"
                variant="outline"
              >
                {statusLabel}
              </Badge>
              {!deliveryStateIsRedundant ? (
                <Badge
                  aria-label={`Delivery state: ${deliveryStateLabel}`}
                  className="portal-delivery__state-badge"
                  variant="ghost"
                >
                  {deliveryStateLabel}
                </Badge>
              ) : null}
            </span>
          </span>
          {showError ? (
            <span className="portal-delivery__error-summary">
              {delivery.last_error_safe_summary}
            </span>
          ) : null}
          <span className="portal-delivery__compact-meta">
            <span>
              {delivery.attempts} of {delivery.max_attempts} attempts
            </span>
            {sentAt ? (
              <span>
                Sent <time dateTime={delivery.sent_at ?? undefined}>{sentAt}</time>
              </span>
            ) : null}
            {nextRetryAt ? (
              <span>
                Next retry <time dateTime={delivery.next_retry_at ?? undefined}>{nextRetryAt}</time>
              </span>
            ) : null}
          </span>
        </span>
        <span className="portal-delivery__toggle-meta">
          {createdAt ? (
            <time dateTime={delivery.created_at ?? undefined}>{createdAt}</time>
          ) : null}
          <span aria-hidden="true" className="portal-delivery__toggle-indicator">
            <ChevronDown className={expanded ? "is-expanded" : undefined} />
          </span>
        </span>
      </button>

      {expanded ? (
        <div className="portal-delivery__details" id={detailsId}>
          <dl className="portal-delivery__fact-grid">
            <DeliveryFact
              label="Attempts"
              value={`${delivery.attempts} of ${delivery.max_attempts}`}
            />
            {createdAt ? (
              <DeliveryFact
                label="Created"
                value={<time dateTime={delivery.created_at ?? undefined}>{createdAt}</time>}
              />
            ) : null}
            {sentAt ? (
              <DeliveryFact
                label="Sent"
                value={<time dateTime={delivery.sent_at ?? undefined}>{sentAt}</time>}
              />
            ) : null}
            {nextRetryAt ? (
              <DeliveryFact
                label="Next retry"
                value={<time dateTime={delivery.next_retry_at ?? undefined}>{nextRetryAt}</time>}
              />
            ) : null}
            {providerUpdatedAt ? (
              <DeliveryFact
                label="Provider update"
                value={
                  <time dateTime={delivery.provider_status_updated_at ?? undefined}>
                    {providerUpdatedAt}
                  </time>
                }
              />
            ) : null}
          </dl>
          {showError ? (
            <p className="portal-delivery__details-error">
              {delivery.last_error_safe_summary}
            </p>
          ) : null}
          {mutationForRow?.state === "pending" ? (
            <p aria-live="polite" className="portal-delivery__mutation-status" role="status">
              Updating delivery…
            </p>
          ) : null}
          <div className="portal-delivery__row-actions">
            {canRetry(delivery) ? (
              <Button
                disabled={isUpdating}
                onClick={() => onAction(delivery, "retry")}
                size="sm"
                type="button"
                variant="outline"
              >
                <RotateCcw aria-hidden="true" />
                Retry delivery
              </Button>
            ) : null}
            {canDeadLetter(delivery) ? (
              <Button
                disabled={isUpdating}
                onClick={() => onAction(delivery, "dead-letter")}
                size="sm"
                type="button"
                variant="outline"
              >
                <Archive aria-hidden="true" />
                Move to dead letter
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </PortalListRow>
  );
}

function DeliveryPagination({
  page,
  filters,
  status,
}: {
  page: TechnicalDeliveryPageSchema;
  filters: { deliveryState: string | null; templateKey: string | null };
  status: DeliveryStatus;
}) {
  const totalPages = Math.max(1, Math.ceil(page.total / page.page_size));
  const hasPrevious = page.page > 1;
  const hasNext = page.page < totalPages;

  if (!hasPrevious && !hasNext) return null;

  return (
    <Pagination aria-label="Notification delivery pages" className="portal-delivery__pagination">
      <PaginationContent>
      {hasPrevious ? (
        <PaginationItem>
          <PaginationPrevious
            href={deliveryHref(status, page.page - 1, filters)}
            text="Previous"
          />
        </PaginationItem>
      ) : (
        <PaginationItem aria-hidden="true" className="portal-delivery__pagination-spacer" />
      )}
      <PaginationItem className="portal-delivery__pagination-current">
        <span aria-current="page">Page {page.page} of {totalPages}</span>
      </PaginationItem>
      {hasNext ? (
        <PaginationItem>
          <PaginationNext
            href={deliveryHref(status, page.page + 1, filters)}
            text="Next"
          />
        </PaginationItem>
      ) : (
        <PaginationItem aria-hidden="true" className="portal-delivery__pagination-spacer" />
      )}
      </PaginationContent>
    </Pagination>
  );
}

export function PortalNotificationDeliveryPage() {
  const { hasCapability, refreshAccess, status: accessStatus } = usePortalAccess();

  if (accessStatus === "loading") return <DeliveryLoadingState />;
  if (accessStatus === "unavailable") {
    return (
      <DeliveryAccessState
        kind="unavailable"
        onRetry={() => void refreshAccess()}
      />
    );
  }
  if (!hasCapability(PORTAL_CAPABILITIES.notificationsDeliveryOperate)) {
    return <DeliveryAccessState kind="forbidden" />;
  }

  return <NotificationDeliveryWorkspace />;
}

function NotificationDeliveryWorkspace() {
  const searchParams = useSearchParams();
  const status = parseStatus(searchParams.get("status"));
  const deliveryState = parseDeliveryState(searchParams.get("delivery_state"));
  const templateKey = parseTemplateKey(searchParams.get("template_key"));
  const pageNumber = parsePage(searchParams.get("page"));
  const queryScope = `${status}:${deliveryState ?? ""}:${templateKey ?? ""}:${pageNumber}`;
  const [loadState, setLoadState] = useState<DeliveryLoadState>({ kind: "loading" });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [action, setAction] = useState<DeliveryAction | null>(null);
  const [mutation, setMutation] = useState<DeliveryMutationState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const mutationKeysRef = useRef(new Map<string, MutationKeyEntry>());
  const mutationRequestRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      mutationRequestRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setExpandedId(null);
      setAction(null);
      setMutation(null);
      setNotice(null);
    });

    return () => {
      active = false;
    };
  }, [queryScope]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void Promise.resolve()
      .then(() => {
        if (!active || controller.signal.aborted) return null;
        setLoadState({ kind: "loading" });
        return getPortalNotificationDelivery(
          pageNumber,
          {
            deliveryState,
            status: status === "all" ? null : status,
            templateKey,
          },
          controller.signal,
        );
      })
      .then((page) => {
        if (page && active && !controller.signal.aborted) {
          setLoadState({ kind: "ready", page });
        }
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        if (active && !controller.signal.aborted) {
          setLoadState({
            kind: "unavailable",
            error:
              error instanceof NotificationDeliveryApiError
                ? error.kind
                : "unavailable",
          });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [deliveryState, pageNumber, reloadKey, status, templateKey]);

  const getMutationKey = (scope: string, fingerprint: string) => {
    const existing = mutationKeysRef.current.get(scope);
    if (existing?.fingerprint === fingerprint) return existing.key;

    const key = createIdempotencyKey();
    mutationKeysRef.current.set(scope, { fingerprint, key });
    return key;
  };

  const discardMutationKey = (scope: string) => {
    mutationKeysRef.current.delete(scope);
  };

  const openAction = (
    delivery: TechnicalDeliverySchema,
    kind: DeliveryActionKind,
  ) => {
    setAction({ delivery, kind, reason: "" });
    setMutation(null);
  };

  const handleAction = async () => {
    if (!action) return;

    const reason = action.reason;
    if (action.kind === "dead-letter" && !DEAD_LETTER_REASONS.some((item) => item.value === reason)) {
      setMutation({
        deliveryId: action.delivery.id,
        fingerprint: "",
        key: null,
        kind: action.kind,
        message: "Choose a reason before moving this delivery to dead letter.",
        state: "error",
      });
      return;
    }

    const scope = `delivery:${action.kind}:${action.delivery.id}`;
    const fingerprint = JSON.stringify({ kind: action.kind, reason });
    let key: IdempotencyKey;
    try {
      key = getMutationKey(scope, fingerprint);
    } catch {
      setMutation({
        deliveryId: action.delivery.id,
        fingerprint,
        key: null,
        kind: action.kind,
        message: "This action is temporarily unavailable. Please try again later.",
        state: "error",
      });
      return;
    }

    setMutation({
      deliveryId: action.delivery.id,
      fingerprint,
      key,
      kind: action.kind,
      message: action.kind === "retry" ? "Retrying delivery…" : "Moving delivery to dead letter…",
      state: "pending",
    });
    mutationRequestRef.current?.abort();
    const controller = new AbortController();
    mutationRequestRef.current = controller;

    try {
      const payload: DeadLetterSchema = { reason };
      if (action.kind === "retry") {
        await retryPortalNotificationDelivery(action.delivery.id, key, controller.signal);
      } else {
        await deadLetterPortalNotificationDelivery(
          action.delivery.id,
          payload,
          key,
          controller.signal,
        );
      }
    } catch (error: unknown) {
      if (isAbortError(error)) return;
      if (!mountedRef.current || controller.signal.aborted) return;
      if (mutationRequestRef.current === controller) mutationRequestRef.current = null;

      const kind =
        error instanceof NotificationDeliveryApiError
          ? error.kind
          : "unavailable";
      if (kind === "conflict") {
        discardMutationKey(scope);
        setAction(null);
        setMutation(null);
        setNotice(mutationMessage(kind));
        setReloadKey((value) => value + 1);
      } else {
        setMutation({
          deliveryId: action.delivery.id,
          fingerprint,
          key,
          kind: action.kind,
          message: mutationMessage(kind),
          state: "error",
        });
      }
      return;
    }

    if (!mountedRef.current || controller.signal.aborted) return;
    if (mutationRequestRef.current === controller) mutationRequestRef.current = null;
    discardMutationKey(scope);
    setAction(null);
    setMutation(null);
    setNotice(
      action.kind === "retry"
        ? "The delivery was queued for retry."
        : "The delivery was moved to dead letter.",
    );
    setExpandedId(null);
    setReloadKey((value) => value + 1);
  };

  const handleActionChange = (reason: string) => {
    if (!action) return;
    discardMutationKey(`delivery:${action.kind}:${action.delivery.id}`);
    setAction({ ...action, reason });
    setMutation(null);
  };

  const navItems = DELIVERY_STATUS_FILTERS.map((item) => ({
    ...item,
    href: deliveryHref(item.value, 1, { deliveryState, templateKey }),
  }));

  return (
    <section aria-labelledby="portal-delivery-heading" className="portal-delivery">
      <DeliveryPageHeader />
      <PortalViewMenu
        activeValue={status}
        ariaLabel="Notification delivery status"
        items={navItems}
        label="View"
      />
      <DeliveryFilters
        deliveryState={deliveryState}
        status={status}
        templateKey={templateKey}
      />

      <PortalCollectionFrame
        aria-busy={loadState.kind === "loading" || mutation?.state === "pending"}
        className="portal-delivery__frame"
      >
        {notice ? (
          <p aria-live="polite" className="portal-delivery__notice" role="status">
            {notice}
          </p>
        ) : null}
        {loadState.kind === "loading" ? (
          <div aria-hidden="true" className="portal-delivery__skeleton-list">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="portal-delivery__skeleton-row" key={index}>
                <Skeleton />
                <Skeleton />
                <Skeleton />
              </div>
            ))}
          </div>
        ) : null}
        {loadState.kind === "unavailable" ? (
          <DeliveryUnavailableState
            error={loadState.error}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        ) : null}
        {loadState.kind === "ready" ? (
          loadState.page.items.length > 0 ? (
            <>
              <ul
                aria-label={
                  status === "all"
                    ? "All notification deliveries"
                    : `${formatDeliveryStatus(status)} notification deliveries`
                }
                className="portal-delivery__list"
              >
                {loadState.page.items.map((delivery, index) => (
                  <DeliveryRow
                    delivery={delivery}
                    expanded={expandedId === delivery.id}
                    index={index}
                    key={delivery.id}
                    mutation={mutation}
                    onAction={openAction}
                    onToggle={(nextDelivery) =>
                      setExpandedId((current) =>
                        current === nextDelivery.id ? null : nextDelivery.id,
                      )
                    }
                  />
                ))}
              </ul>
              <DeliveryPagination
                filters={{ deliveryState, templateKey }}
                page={loadState.page}
                status={status}
              />
            </>
          ) : (
            <DeliveryEmptyState />
          )
        ) : null}
      </PortalCollectionFrame>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && mutation?.state !== "pending") {
            if (action) discardMutationKey(`delivery:${action.kind}:${action.delivery.id}`);
            setAction(null);
            setMutation(null);
          }
        }}
        open={action !== null}
      >
        <AlertDialogContent className="compass-surface portal-delivery__dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {action?.kind === "retry"
                ? "Retry this delivery?"
                : "Move this delivery to dead letter?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {action?.kind === "retry"
                ? "The delivery will be queued for another attempt."
                : "Choose a reason so the delivery can be reviewed safely."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {action?.kind === "dead-letter" ? (
            <div className="portal-delivery__dialog-field">
              <Label htmlFor="portal-delivery-dead-letter-reason">Reason</Label>
              <select
                aria-invalid={mutation?.state === "error" || undefined}
                aria-describedby={mutation?.state === "error" ? "portal-delivery-dialog-error" : undefined}
                id="portal-delivery-dead-letter-reason"
                onChange={(event) => handleActionChange(event.target.value)}
                value={action.reason}
              >
                <option disabled value="">
                  Select a reason
                </option>
                {DEAD_LETTER_REASONS.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {mutation?.state === "pending" ? (
            <p aria-live="polite" className="portal-delivery__dialog-status" role="status">
              {mutation.message}
            </p>
          ) : null}
          {mutation?.state === "error" ? (
            <p id="portal-delivery-dialog-error" className="portal-delivery__dialog-error" role="alert">
              {mutation.message}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation?.state === "pending"}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation?.state === "pending"}
              onClick={() => void handleAction()}
            >
              {mutation?.state === "pending"
                ? "Updating…"
                : action?.kind === "retry"
                  ? "Retry delivery"
                  : "Move to dead letter"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
