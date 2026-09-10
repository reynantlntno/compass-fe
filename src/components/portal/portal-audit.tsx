"use client";

import Link from "next/link";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";

import { usePortalAccess } from "@/components/portal/portal-access-provider";
import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
import { PortalFilterPanel } from "@/components/portal/portal-filter-panel";
import { PortalPageHeader } from "@/components/portal/portal-page-header";
import { PORTAL_CAPABILITIES } from "@/components/portal/portal-navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AuditApiError,
  getPortalAuditEntries,
  getPortalAuditEntryDetail,
  type AuditApiErrorKind,
  type PortalAuditFilters,
} from "@/lib/api/audit";
import type {
  AuditEntryProjectionSchema,
  AuditPageSchema,
  AuditSafeContextSchema,
} from "@/lib/api/generated/model";

type AuditLoadState =
  | { kind: "loading" }
  | { kind: "ready"; page: AuditPageSchema }
  | { kind: "unavailable"; error: AuditApiErrorKind };

type AuditDetailState =
  | { kind: "idle" }
  | { kind: "loading"; entryId: number }
  | { kind: "ready"; entry: AuditEntryProjectionSchema; entryId: number }
  | { kind: "unavailable"; entryId: number; error: AuditApiErrorKind };

const EVENT_CATEGORY_OPTIONS = [
  { label: "All event categories", value: "" },
  { label: "Security", value: "SECURITY" },
  { label: "System", value: "SYSTEM" },
  { label: "Authorization", value: "AUTHORIZATION" },
  { label: "Token batch", value: "TOKEN_BATCH" },
] as const;

const SEVERITY_OPTIONS = [
  { label: "All severities", value: "" },
  { label: "Debug", value: "DEBUG" },
  { label: "Info", value: "INFO" },
  { label: "Warning", value: "WARNING" },
  { label: "Error", value: "ERROR" },
  { label: "Critical", value: "CRITICAL" },
] as const;

const EVENT_CATEGORIES = new Set(
  EVENT_CATEGORY_OPTIONS.filter((option) => option.value).map(
    (option) => option.value,
  ),
);
const SEVERITIES = new Set(
  SEVERITY_OPTIONS.filter((option) => option.value).map(
    (option) => option.value,
  ),
);
const SAFE_FILTER = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/;
const MAX_PAGE = 100_000;
const MAX_FILTER_LENGTH = 100;

const CONTEXT_KEYS: readonly (keyof AuditSafeContextSchema)[] = [
  "status",
  "from_status",
  "to_status",
  "decision",
  "decision_code",
  "reason_code",
  "result_code",
  "operation",
  "outcome",
  "scope",
  "policy_key",
  "success",
  "has_notes",
  "count",
];

const CONTEXT_LABELS: Record<keyof AuditSafeContextSchema, string> = {
  count: "Count",
  decision: "Decision",
  decision_code: "Decision code",
  from_status: "Previous status",
  has_notes: "Notes",
  operation: "Operation",
  outcome: "Outcome",
  policy_key: "Policy",
  reason_code: "Reason",
  result_code: "Result",
  scope: "Scope",
  status: "Status",
  success: "Successful",
  to_status: "New status",
};

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function normalizeSafeFilter(value: string | null) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 && normalized.length <= MAX_FILTER_LENGTH && SAFE_FILTER.test(normalized)
    ? normalized
    : null;
}

function normalizeDateFilter(value: string | null) {
  const normalized = value?.trim() ?? "";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(normalized) ||
    Number.isNaN(Date.parse(`${normalized}T00:00:00`))
  ) {
    return null;
  }
  return normalized;
}

function parseEnumFilter(
  value: string | null,
  allowed: ReadonlySet<string>,
) {
  return value && allowed.has(value) ? value : null;
}

function parsePage(value: string | null) {
  const page = Number(value);
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_PAGE) return 1;
  return page;
}

function parseFilters(searchParams: {
  get: (key: string) => string | null;
}): PortalAuditFilters {
  return {
    actionType: normalizeSafeFilter(searchParams.get("action_type")),
    createdFrom: normalizeDateFilter(searchParams.get("created_from")),
    createdUntil: normalizeDateFilter(searchParams.get("created_until")),
    eventCategory: parseEnumFilter(
      searchParams.get("event_category"),
      EVENT_CATEGORIES,
    ),
    requestId: normalizeSafeFilter(searchParams.get("request_id")),
    severity: parseEnumFilter(searchParams.get("severity"), SEVERITIES),
    sourceApp: normalizeSafeFilter(searchParams.get("source_app")),
    targetModel: normalizeSafeFilter(searchParams.get("target_model")),
    traceId: normalizeSafeFilter(searchParams.get("trace_id")),
  };
}

function filterValue(filters: PortalAuditFilters, key: keyof PortalAuditFilters) {
  return filters[key] ?? "";
}

function filtersKey(filters: PortalAuditFilters) {
  return [
    filters.eventCategory,
    filters.severity,
    filters.actionType,
    filters.sourceApp,
    filters.targetModel,
    filters.createdFrom,
    filters.createdUntil,
    filters.requestId,
    filters.traceId,
  ]
    .map((value) => value ?? "")
    .join("|");
}

function auditHref(filters: PortalAuditFilters, page = 1) {
  const params = new URLSearchParams();
  const values: ReadonlyArray<[string, string | null | undefined]> = [
    ["event_category", filters.eventCategory],
    ["severity", filters.severity],
    ["action_type", filters.actionType],
    ["source_app", filters.sourceApp],
    ["target_model", filters.targetModel],
    ["created_from", filters.createdFrom],
    ["created_until", filters.createdUntil],
    ["request_id", filters.requestId],
    ["trace_id", filters.traceId],
  ];

  for (const [key, value] of values) {
    if (value) params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `/portal/audit?${query}` : "/portal/audit";
}

function formatLabel(value: string) {
  const words = value
    .trim()
    .replace(/[._:-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .filter(Boolean);
  if (words.length === 0) return "Unavailable";
  return words.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(" ");
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function severityTone(value: string) {
  switch (value.toLowerCase()) {
    case "critical":
    case "error":
      return "error";
    case "warning":
      return "warning";
    default:
      return "neutral";
  }
}

function readErrorMessage(error: AuditApiErrorKind, subject: string) {
  if (error === "permission") return `This ${subject} section isn’t available for this account.`;
  if (error === "rate_limited") return `Too many requests for ${subject}. Please wait and try again.`;
  if (error === "validation") return `The ${subject} filters could not be applied.`;
  return `We couldn’t load ${subject} right now.`;
}

function contextValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  return formatLabel(value);
}

function contextEntries(context: AuditSafeContextSchema) {
  return CONTEXT_KEYS.flatMap((key) => {
    const value = contextValue(context[key]);
    return value ? [{ key, label: CONTEXT_LABELS[key], value }] : [];
  });
}

function auditFiltersFromForm(formData: FormData): PortalAuditFilters {
  return parseFilters({
    get: (key) => {
      const value = formData.get(key);
      return typeof value === "string" ? value : null;
    },
  });
}

function AuditFilters({ filters }: { filters: PortalAuditFilters }) {
  const router = useRouter();
  const [isFilterNavigationPending, startFilterNavigation] = useTransition();
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextFilters = auditFiltersFromForm(new FormData(event.currentTarget));

    if (
      nextFilters.createdFrom &&
      nextFilters.createdUntil &&
      nextFilters.createdFrom > nextFilters.createdUntil
    ) {
      setValidationMessage("The To date must not be earlier than the From date.");
      return;
    }

    setValidationMessage(null);
    startFilterNavigation(() => router.push(auditHref(nextFilters)));
  };

  return (
    <PortalFilterPanel
      accessibleLabel="audit filters"
      action="/portal/audit"
      ariaBusy={isFilterNavigationPending}
      className="portal-audit__filters"
      onSubmit={handleSubmit}
      resetKey={filtersKey(filters)}
      summary="Filter technical activity by category, source, or date."
    >
      <div className="portal-audit__filter-grid">
        <div className="portal-audit__filter-field">
          <Label htmlFor="portal-audit-event-category">Event category</Label>
          <select
            defaultValue={filterValue(filters, "eventCategory")}
            id="portal-audit-event-category"
            name="event_category"
          >
            {EVENT_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="portal-audit__filter-field">
          <Label htmlFor="portal-audit-severity">Severity</Label>
          <select
            defaultValue={filterValue(filters, "severity")}
            id="portal-audit-severity"
            name="severity"
          >
            {SEVERITY_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="portal-audit__filter-field">
          <Label htmlFor="portal-audit-action">Action type</Label>
          <Input
            defaultValue={filterValue(filters, "actionType")}
            id="portal-audit-action"
            maxLength={MAX_FILTER_LENGTH}
            name="action_type"
            placeholder="e.g. SYSTEM_HEALTH_CHECK"
          />
        </div>
        <div className="portal-audit__filter-field">
          <Label htmlFor="portal-audit-source">Source app</Label>
          <Input
            defaultValue={filterValue(filters, "sourceApp")}
            id="portal-audit-source"
            maxLength={MAX_FILTER_LENGTH}
            name="source_app"
            placeholder="e.g. apps.system"
          />
        </div>
        <div className="portal-audit__filter-field">
          <Label htmlFor="portal-audit-target">Target model</Label>
          <Input
            defaultValue={filterValue(filters, "targetModel")}
            id="portal-audit-target"
            maxLength={MAX_FILTER_LENGTH}
            name="target_model"
            placeholder="e.g. system.Health"
          />
        </div>
        <div className="portal-audit__filter-field">
          <Label htmlFor="portal-audit-created-from">From date</Label>
          <Input
            defaultValue={filterValue(filters, "createdFrom")}
            id="portal-audit-created-from"
            name="created_from"
            type="date"
          />
        </div>
        <div className="portal-audit__filter-field">
          <Label htmlFor="portal-audit-created-until">To date</Label>
          <Input
            defaultValue={filterValue(filters, "createdUntil")}
            id="portal-audit-created-until"
            name="created_until"
            type="date"
          />
        </div>
        <div className="portal-audit__filter-field">
          <Label htmlFor="portal-audit-request-id">Request correlation</Label>
          <Input
            defaultValue={filterValue(filters, "requestId")}
            id="portal-audit-request-id"
            maxLength={MAX_FILTER_LENGTH}
            name="request_id"
            placeholder="Optional"
          />
        </div>
        <div className="portal-audit__filter-field">
          <Label htmlFor="portal-audit-trace-id">Trace correlation</Label>
          <Input
            defaultValue={filterValue(filters, "traceId")}
            id="portal-audit-trace-id"
            maxLength={MAX_FILTER_LENGTH}
            name="trace_id"
            placeholder="Optional"
          />
        </div>
      </div>
      {validationMessage ? (
        <p className="portal-audit__filter-validation" role="alert">
          {validationMessage}
        </p>
      ) : null}
      <div className="portal-audit__filter-actions">
        <Button
          disabled={isFilterNavigationPending}
          size="sm"
          type="submit"
          variant="default"
        >
          Apply filters
        </Button>
        <Link className="portal-audit__filter-clear" href="/portal/audit">
          Clear filters
        </Link>
      </div>
    </PortalFilterPanel>
  );
}

function AuditDetails({
  detail,
  detailsId,
  onRetry,
}: {
  detail: AuditDetailState;
  detailsId: string;
  onRetry: () => void;
}) {
  if (detail.kind === "loading" || detail.kind === "idle") {
    return (
      <div
        aria-live="polite"
        className="portal-audit__details"
        id={detailsId}
        role="status"
      >
        Loading details…
      </div>
    );
  }

  if (detail.kind === "unavailable") {
    return (
      <div
        className="portal-audit__details portal-audit__details--state"
        id={detailsId}
        role="alert"
      >
        <p>{readErrorMessage(detail.error, "audit details")}</p>
        <Button onClick={onRetry} size="sm" type="button" variant="outline">
          <RefreshCw aria-hidden="true" />
          Try again
        </Button>
      </div>
    );
  }

  const entries = contextEntries(detail.entry.safe_context);

  return (
    <div className="portal-audit__details" id={detailsId}>
      <dl className="portal-audit__detail-grid">
        {detail.entry.target_reference ? (
          <div>
            <dt>Reference</dt>
            <dd>{detail.entry.target_reference}</dd>
          </div>
        ) : null}
        {entries.map(({ key, label, value }) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {detail.entry.target_reference || entries.length > 0 ? null : (
        <p className="portal-audit__details-empty">
          No additional safe context is available for this entry.
        </p>
      )}
    </div>
  );
}

function AuditRow({
  detail,
  entry,
  expanded,
  index,
  onRetry,
  onToggle,
}: {
  detail: AuditDetailState;
  entry: AuditEntryProjectionSchema;
  expanded: boolean;
  index: number;
  onRetry: () => void;
  onToggle: () => void;
}) {
  const createdAt = formatTimestamp(entry.created_at);
  const detailsId = `portal-audit-details-${index}`;
  const actionLabel = formatLabel(entry.action_type);

  return (
    <>
      <TableRow className="portal-audit__table-row">
        <TableCell data-label="Severity">
          <Badge
            className="portal-audit__severity"
            data-tone={severityTone(entry.severity)}
            variant="outline"
          >
            {formatLabel(entry.severity)}
          </Badge>
        </TableCell>
        <TableCell data-label="Action">
          <div className="portal-audit__action-cell">
            <span className="portal-audit__row-action">{actionLabel}</span>
            <button
              aria-controls={detailsId}
              aria-expanded={expanded}
              aria-label={`${expanded ? "Hide" : "Show"} details for ${actionLabel}`}
              className="portal-audit__row-indicator"
              onClick={onToggle}
              type="button"
            >
              <ChevronDown className={expanded ? "is-expanded" : undefined} />
            </button>
          </div>
        </TableCell>
        <TableCell data-label="Event category">
          {formatLabel(entry.event_category)}
        </TableCell>
        <TableCell data-label="Source">
          {formatLabel(entry.source_app)}
        </TableCell>
        <TableCell data-label="Target model">
          {formatLabel(entry.target_model)}
        </TableCell>
        <TableCell data-label="Actor role">
          <span className="portal-audit__row-actor">
            {formatLabel(entry.actor_role)}
          </span>
        </TableCell>
        <TableCell data-label="Created">
          {createdAt ? <time dateTime={entry.created_at}>{createdAt}</time> : "Unavailable"}
        </TableCell>
      </TableRow>
      {expanded ? (
        <TableRow className="portal-audit__details-row">
          <TableCell className="portal-audit__details-cell" colSpan={7}>
            <AuditDetails
              detail={detail}
              detailsId={detailsId}
              onRetry={onRetry}
            />
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function AuditPagination({
  filters,
  page,
  pageSize,
  total,
}: {
  filters: PortalAuditFilters;
  page: number;
  pageSize: number;
  total: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Audit trail pagination" className="portal-audit__pagination">
      {page > 1 ? (
        <Link className="portal-audit__pagination-link" href={auditHref(filters, page - 1)}>
          <ChevronLeft aria-hidden="true" />
          Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="portal-audit__pagination-current">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link className="portal-audit__pagination-link" href={auditHref(filters, page + 1)}>
          Next
          <ChevronRight aria-hidden="true" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

function AuditListSkeleton() {
  return (
    <div aria-hidden="true" className="portal-audit__table-wrap">
      <Table className="portal-audit__table">
        <TableHeader>
          <TableRow>
            {Array.from({ length: 7 }, (_, index) => (
              <TableHead key={index}>
                <Skeleton as="span" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }, (_, rowIndex) => (
            <TableRow className="portal-audit__table-row" key={rowIndex}>
              {Array.from({ length: 7 }, (_, cellIndex) => (
                <TableCell data-label="" key={cellIndex}>
                  <Skeleton as="span" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AuditUnavailable({
  error,
  onRetry,
}: {
  error: AuditApiErrorKind;
  onRetry: () => void;
}) {
  return (
    <div className="portal-audit__state" role="status">
      <h2>Audit activity is unavailable right now.</h2>
      <p>{readErrorMessage(error, "audit activity")}</p>
      <Button onClick={onRetry} type="button" variant="outline">
        <RefreshCw aria-hidden="true" />
        Try again
      </Button>
    </div>
  );
}

function AuditAccessState({
  kind,
  onRetry,
}: {
  kind: "forbidden" | "unavailable";
  onRetry?: () => void;
}) {
  return (
    <section
      aria-labelledby="portal-audit-heading"
      className="portal-audit portal-audit--state"
    >
      <PortalPageHeader
        current="Audit trail"
        description="Review technical activity visible to this account."
        headingId="portal-audit-heading"
        title="Audit trail"
      />
      <PortalCollectionFrame className="portal-audit__frame portal-audit__frame--state">
        <h2>
          {kind === "forbidden"
            ? "This page isn’t available for this account."
            : "Audit trail isn’t available right now."}
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

function AuditWorkspace() {
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const filters = useMemo(
    () => parseFilters(new URLSearchParams(queryString)),
    [queryString],
  );
  const [loadState, setLoadState] = useState<AuditLoadState>({ kind: "loading" });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailState, setDetailState] = useState<AuditDetailState>({ kind: "idle" });
  const [reloadKey, setReloadKey] = useState(0);
  const listRequestRef = useRef<AbortController | null>(null);
  const detailRequestRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      listRequestRef.current?.abort();
      detailRequestRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    listRequestRef.current?.abort();
    detailRequestRef.current?.abort();
    const requestParams = new URLSearchParams(queryString);
    const requestFilters = parseFilters(requestParams);
    const requestPage = parsePage(requestParams.get("page"));

    void Promise.resolve()
      .then(() => {
        if (!mountedRef.current || controller.signal.aborted) return null;
        setLoadState({ kind: "loading" });
        setExpandedId(null);
        setDetailState({ kind: "idle" });
        return getPortalAuditEntries(requestPage, requestFilters, controller.signal);
      })
      .then((page) => {
        if (page && mountedRef.current && !controller.signal.aborted) {
          setLoadState({ kind: "ready", page });
        }
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        if (mountedRef.current && !controller.signal.aborted) {
          setLoadState({
            kind: "unavailable",
            error: error instanceof AuditApiError ? error.kind : "unavailable",
          });
        }
      });

    listRequestRef.current = controller;
    return () => controller.abort();
  }, [queryString, reloadKey]);

  const loadDetail = (entryId: number) => {
    detailRequestRef.current?.abort();
    const controller = new AbortController();
    detailRequestRef.current = controller;
    setDetailState({ kind: "loading", entryId });

    void getPortalAuditEntryDetail(entryId, controller.signal)
      .then((entry) => {
        if (mountedRef.current && !controller.signal.aborted) {
          setDetailState({ kind: "ready", entryId, entry });
        }
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        if (mountedRef.current && !controller.signal.aborted) {
          setDetailState({
            kind: "unavailable",
            entryId,
            error: error instanceof AuditApiError ? error.kind : "unavailable",
          });
        }
      });
  };

  const handleToggle = (entry: AuditEntryProjectionSchema) => {
    if (expandedId === entry.id) {
      detailRequestRef.current?.abort();
      setExpandedId(null);
      setDetailState({ kind: "idle" });
      return;
    }

    setExpandedId(entry.id);
    loadDetail(entry.id);
  };

  const handleRetryDetail = (entryId: number) => {
    if (expandedId !== entryId) return;
    loadDetail(entryId);
  };

  const page = loadState.kind === "ready" ? loadState.page : null;

  return (
    <section aria-labelledby="portal-audit-heading" className="portal-audit">
      <PortalPageHeader
        current="Audit trail"
        description="Review technical activity visible to this account."
        headingId="portal-audit-heading"
        title="Audit trail"
      />
      <AuditFilters filters={filters} />
      <PortalCollectionFrame
        aria-busy={loadState.kind === "loading"}
        className="portal-audit__frame"
      >
        {loadState.kind === "loading" ? <AuditListSkeleton /> : null}
        {loadState.kind === "unavailable" ? (
          <AuditUnavailable
            error={loadState.error}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        ) : null}
        {page && page.items.length > 0 ? (
          <div className="portal-audit__table-wrap">
            <Table className="portal-audit__table">
              <caption className="portal-audit__table-caption">
                Technical audit activity
              </caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Event category</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Target model</TableHead>
                  <TableHead>Actor role</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.items.map((entry, index) => (
                  <AuditRow
                    detail={
                      detailState.kind !== "idle" && detailState.entryId === entry.id
                        ? detailState
                        : { kind: "idle" }
                    }
                    entry={entry}
                    expanded={expandedId === entry.id}
                    index={index}
                    key={entry.id}
                    onRetry={() => handleRetryDetail(entry.id)}
                    onToggle={() => handleToggle(entry)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
        {page && page.items.length === 0 ? (
          <div className="portal-audit__empty" role="status">
            <h2>No technical audit activity to show.</h2>
            <p>Try changing the filters or check back after more activity is recorded.</p>
          </div>
        ) : null}
        {page ? (
          <AuditPagination
            filters={filters}
            page={page.page}
            pageSize={page.page_size}
            total={page.total}
          />
        ) : null}
      </PortalCollectionFrame>
    </section>
  );
}

export function PortalAuditLoading() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading audit trail"
      className="portal-audit portal-audit--loading"
      role="status"
    >
      <span className="sr-only">Loading audit trail…</span>
      <PortalPageHeader
        current="Audit trail"
        description={
          <Skeleton
            as="span"
            aria-hidden="true"
            className="portal-audit__skeleton-summary"
          />
        }
        headingId="portal-audit-heading"
        title={
          <Skeleton
            as="span"
            aria-hidden="true"
            className="portal-audit__skeleton-heading"
          />
        }
      />
      <PortalFilterPanel
        accessibleLabel="audit filters"
        className="portal-audit__filters portal-audit__filters--loading"
        action="/portal/audit"
        ariaBusy
        resetKey="audit-loading"
        summary={
          <Skeleton
            as="span"
            aria-hidden="true"
            className="portal-audit__skeleton-summary"
          />
        }
      >
        <div className="portal-audit__filter-grid portal-audit__filters--loading-grid">
          {Array.from({ length: 9 }, (_, index) => (
            <Skeleton as="span" key={index} />
          ))}
        </div>
      </PortalFilterPanel>
      <PortalCollectionFrame className="portal-audit__frame">
        <AuditListSkeleton />
      </PortalCollectionFrame>
    </section>
  );
}

export function PortalAuditPage() {
  const { hasCapability, refreshAccess, status } = usePortalAccess();

  if (status === "loading") return <PortalAuditLoading />;
  if (status === "unavailable") {
    return <AuditAccessState kind="unavailable" onRetry={() => void refreshAccess()} />;
  }
  if (!hasCapability(PORTAL_CAPABILITIES.auditView)) {
    return <AuditAccessState kind="forbidden" />;
  }

  return <AuditWorkspace />;
}
