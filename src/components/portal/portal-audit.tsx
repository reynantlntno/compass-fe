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
import {
  PORTAL_AUDIT_PLANE_ORDER,
  type PortalAuditPlane,
} from "@/components/portal/portal-navigation";
import { PortalViewMenu } from "@/components/portal/portal-view-menu";
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

type AuditEventCategoryOption = { label: string; value: string };

const EVENT_CATEGORY_OPTIONS: Record<
  PortalAuditPlane,
  readonly AuditEventCategoryOption[]
> = {
  technical: [
    { label: "All event categories", value: "" },
    { label: "Security", value: "SECURITY" },
    { label: "System", value: "SYSTEM" },
    { label: "Authorization", value: "AUTHORIZATION" },
    { label: "Token batch", value: "TOKEN_BATCH" },
  ],
  business: [
    { label: "All event categories", value: "" },
    { label: "Workflow", value: "WORKFLOW" },
    { label: "Content", value: "CONTENT" },
    { label: "Form", value: "FORM" },
    { label: "Form collection", value: "FORM_COLLECTION" },
    { label: "Governance", value: "GOVERNANCE" },
    { label: "Authorization", value: "AUTHORIZATION" },
  ],
  privacy: [
    { label: "All event categories", value: "" },
    { label: "Privacy", value: "PRIVACY" },
    { label: "Privacy governance", value: "PRIVACY_GOVERNANCE" },
    { label: "Data access", value: "DATA_ACCESS" },
    { label: "Governance", value: "GOVERNANCE" },
  ],
};

const PLANE_LABELS: Record<PortalAuditPlane, string> = {
  technical: "Technical",
  business: "Business",
  privacy: "Privacy",
};

type AuditTableColumn =
  | "severity"
  | "action"
  | "eventCategory"
  | "sourceApp"
  | "targetModel"
  | "actorRole"
  | "created";

type AuditTechnicalFilter =
  | "sourceApp"
  | "targetModel"
  | "requestId"
  | "traceId";

type AuditPlanePresentation = {
  actionColumnLabel: string;
  columns: readonly AuditTableColumn[];
  description: string;
  filterSummary: string;
  visibleFilterFields: readonly AuditTechnicalFilter[];
};

const AUDIT_PLANE_PRESENTATION: Record<
  PortalAuditPlane,
  AuditPlanePresentation
> = {
  technical: {
    actionColumnLabel: "Action",
    columns: [
      "severity",
      "action",
      "eventCategory",
      "sourceApp",
      "targetModel",
      "actorRole",
      "created",
    ],
    description: "Review technical activity visible to this account.",
    filterSummary: "Filter technical activity by category, source, or date.",
    visibleFilterFields: ["sourceApp", "targetModel", "requestId", "traceId"],
  },
  business: {
    actionColumnLabel: "Activity",
    columns: ["severity", "action", "eventCategory", "actorRole", "created"],
    description: "Review business activity visible to this account.",
    filterSummary:
      "Filter business activity by category, severity, action, or date.",
    visibleFilterFields: [],
  },
  privacy: {
    actionColumnLabel: "Activity",
    columns: ["severity", "action", "eventCategory", "actorRole", "created"],
    description: "Review privacy activity visible to this account.",
    filterSummary:
      "Filter privacy activity by category, severity, action, or date.",
    visibleFilterFields: [],
  },
};

const AUDIT_TABLE_COLUMN_LABELS: Record<AuditTableColumn, string> = {
  action: "Action",
  actorRole: "Actor role",
  created: "Created",
  eventCategory: "Event category",
  severity: "Severity",
  sourceApp: "Source",
  targetModel: "Target model",
};

function auditColumnLabel(plane: PortalAuditPlane, column: AuditTableColumn) {
  if (column === "action") {
    return AUDIT_PLANE_PRESENTATION[plane].actionColumnLabel;
  }
  return AUDIT_TABLE_COLUMN_LABELS[column];
}

function hasAuditFilter(
  plane: PortalAuditPlane,
  field: AuditTechnicalFilter,
) {
  return AUDIT_PLANE_PRESENTATION[plane].visibleFilterFields.includes(field);
}

const SEVERITY_OPTIONS = [
  { label: "All severities", value: "" },
  { label: "Debug", value: "DEBUG" },
  { label: "Info", value: "INFO" },
  { label: "Warning", value: "WARNING" },
  { label: "Error", value: "ERROR" },
  { label: "Critical", value: "CRITICAL" },
] as const;

const EVENT_CATEGORIES: Record<PortalAuditPlane, ReadonlySet<string>> = {
  technical: new Set(
    EVENT_CATEGORY_OPTIONS.technical
      .filter((option) => option.value)
      .map((option) => option.value),
  ),
  business: new Set(
    EVENT_CATEGORY_OPTIONS.business
      .filter((option) => option.value)
      .map((option) => option.value),
  ),
  privacy: new Set(
    EVENT_CATEGORY_OPTIONS.privacy
      .filter((option) => option.value)
      .map((option) => option.value),
  ),
};
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

function orderedAuditPlanes(authorizedPlanes: readonly PortalAuditPlane[]) {
  return PORTAL_AUDIT_PLANE_ORDER.filter((plane) =>
    authorizedPlanes.includes(plane),
  );
}

function normalizeAuditPlane(
  value: string | null,
  authorizedPlanes: readonly PortalAuditPlane[],
) {
  const orderedPlanes = orderedAuditPlanes(authorizedPlanes);
  if (value && orderedPlanes.includes(value as PortalAuditPlane)) {
    return value as PortalAuditPlane;
  }
  return orderedPlanes[0] ?? null;
}

function parseFilters(searchParams: {
  get: (key: string) => string | null;
}, plane: PortalAuditPlane): PortalAuditFilters {
  return {
    actionType: normalizeSafeFilter(searchParams.get("action_type")),
    createdFrom: normalizeDateFilter(searchParams.get("created_from")),
    createdUntil: normalizeDateFilter(searchParams.get("created_until")),
    eventCategory: parseEnumFilter(
      searchParams.get("event_category"),
      EVENT_CATEGORIES[plane],
    ),
    requestId: hasAuditFilter(plane, "requestId")
      ? normalizeSafeFilter(searchParams.get("request_id"))
      : null,
    severity: parseEnumFilter(searchParams.get("severity"), SEVERITIES),
    sourceApp: hasAuditFilter(plane, "sourceApp")
      ? normalizeSafeFilter(searchParams.get("source_app"))
      : null,
    targetModel: hasAuditFilter(plane, "targetModel")
      ? normalizeSafeFilter(searchParams.get("target_model"))
      : null,
    traceId: hasAuditFilter(plane, "traceId")
      ? normalizeSafeFilter(searchParams.get("trace_id"))
      : null,
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

function auditHref(
  plane: PortalAuditPlane,
  filters: PortalAuditFilters,
  page = 1,
) {
  const params = new URLSearchParams();
  params.set("plane", plane);
  const values: Array<[string, string | null | undefined]> = [
    ["event_category", filters.eventCategory],
    ["severity", filters.severity],
    ["action_type", filters.actionType],
    ["created_from", filters.createdFrom],
    ["created_until", filters.createdUntil],
  ];

  const technicalValues: ReadonlyArray<[
    AuditTechnicalFilter,
    string,
    string | null | undefined,
  ]> = [
    ["sourceApp", "source_app", filters.sourceApp],
    ["targetModel", "target_model", filters.targetModel],
    ["requestId", "request_id", filters.requestId],
    ["traceId", "trace_id", filters.traceId],
  ];

  for (const [field, key, value] of technicalValues) {
    if (hasAuditFilter(plane, field)) values.push([key, value]);
  }

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

function AuditFilters({
  filters,
  plane,
}: {
  filters: PortalAuditFilters;
  plane: PortalAuditPlane;
}) {
  const router = useRouter();
  const [isFilterNavigationPending, startFilterNavigation] = useTransition();
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const presentation = AUDIT_PLANE_PRESENTATION[plane];

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextFilters = parseFilters(
      {
        get: (key) => {
          const value = formData.get(key);
          return typeof value === "string" ? value : null;
        },
      },
      plane,
    );

    if (
      nextFilters.createdFrom &&
      nextFilters.createdUntil &&
      nextFilters.createdFrom > nextFilters.createdUntil
    ) {
      setValidationMessage("The To date must not be earlier than the From date.");
      return;
    }

    setValidationMessage(null);
    startFilterNavigation(() => router.push(auditHref(plane, nextFilters)));
  };

  return (
    <PortalFilterPanel
      accessibleLabel="audit filters"
      action="/portal/audit"
      ariaBusy={isFilterNavigationPending}
      className="portal-audit__filters"
      onSubmit={handleSubmit}
      resetKey={`${plane}|${filtersKey(filters)}`}
      summary={presentation.filterSummary}
    >
      <div className="portal-audit__filter-grid">
        <div className="portal-audit__filter-field">
          <Label htmlFor="portal-audit-event-category">Event category</Label>
          <select
            defaultValue={filterValue(filters, "eventCategory")}
            id="portal-audit-event-category"
            name="event_category"
          >
            {EVENT_CATEGORY_OPTIONS[plane].map((option) => (
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
        {hasAuditFilter(plane, "sourceApp") ? (
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
        ) : null}
        {hasAuditFilter(plane, "targetModel") ? (
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
        ) : null}
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
        {hasAuditFilter(plane, "requestId") ? (
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
        ) : null}
        {hasAuditFilter(plane, "traceId") ? (
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
        ) : null}
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
        <Link
          className="portal-audit__filter-clear"
          href={auditHref(plane, {})}
        >
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
  plane,
}: {
  detail: AuditDetailState;
  entry: AuditEntryProjectionSchema;
  expanded: boolean;
  index: number;
  onRetry: () => void;
  onToggle: () => void;
  plane: PortalAuditPlane;
}) {
  const createdAt = formatTimestamp(entry.created_at);
  const detailsId = `portal-audit-details-${index}`;
  const actionLabel = formatLabel(entry.action_type);
  const presentation = AUDIT_PLANE_PRESENTATION[plane];

  return (
    <>
      <TableRow className="portal-audit__table-row">
        {presentation.columns.map((column) => {
          const label = auditColumnLabel(plane, column);

          switch (column) {
            case "severity":
              return (
                <TableCell data-label={label} key={column}>
                  <Badge
                    className="portal-audit__severity"
                    data-tone={severityTone(entry.severity)}
                    variant="outline"
                  >
                    {formatLabel(entry.severity)}
                  </Badge>
                </TableCell>
              );
            case "action":
              return (
                <TableCell data-label={label} key={column}>
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
              );
            case "eventCategory":
              return (
                <TableCell data-label={label} key={column}>
                  {formatLabel(entry.event_category)}
                </TableCell>
              );
            case "sourceApp":
              return (
                <TableCell data-label={label} key={column}>
                  {formatLabel(entry.source_app)}
                </TableCell>
              );
            case "targetModel":
              return (
                <TableCell data-label={label} key={column}>
                  {formatLabel(entry.target_model)}
                </TableCell>
              );
            case "actorRole":
              return (
                <TableCell data-label={label} key={column}>
                  <span className="portal-audit__row-actor">
                    {formatLabel(entry.actor_role)}
                  </span>
                </TableCell>
              );
            case "created":
              return (
                <TableCell data-label={label} key={column}>
                  {createdAt ? (
                    <time dateTime={entry.created_at}>{createdAt}</time>
                  ) : (
                    "Unavailable"
                  )}
                </TableCell>
              );
          }
        })}
      </TableRow>
      {expanded ? (
        <TableRow className="portal-audit__details-row">
          <TableCell
            className="portal-audit__details-cell"
            colSpan={presentation.columns.length}
          >
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
  plane,
  page,
  pageSize,
  total,
}: {
  filters: PortalAuditFilters;
  plane: PortalAuditPlane;
  page: number;
  pageSize: number;
  total: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Audit trail pagination" className="portal-audit__pagination">
      {page > 1 ? (
        <Link
          className="portal-audit__pagination-link"
          href={auditHref(plane, filters, page - 1)}
        >
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
        <Link
          className="portal-audit__pagination-link"
          href={auditHref(plane, filters, page + 1)}
        >
          Next
          <ChevronRight aria-hidden="true" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

function AuditListSkeleton({ plane }: { plane: PortalAuditPlane }) {
  const columnCount = AUDIT_PLANE_PRESENTATION[plane].columns.length;

  return (
    <div aria-hidden="true" className="portal-audit__table-wrap">
      <Table className={`portal-audit__table portal-audit__table--${plane}`}>
        <TableHeader>
          <TableRow>
            {Array.from({ length: columnCount }, (_, index) => (
              <TableHead key={index}>
                <Skeleton as="span" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }, (_, rowIndex) => (
            <TableRow className="portal-audit__table-row" key={rowIndex}>
              {Array.from({ length: columnCount }, (_, cellIndex) => (
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
  plane,
}: {
  error: AuditApiErrorKind;
  onRetry: () => void;
  plane: PortalAuditPlane;
}) {
  const activityLabel = `${PLANE_LABELS[plane]} activity`;

  return (
    <div className="portal-audit__state" role="status">
      <h2>{activityLabel} is unavailable right now.</h2>
      <p>{readErrorMessage(error, activityLabel.toLowerCase())}</p>
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
        description="Review authorized audit activity visible to this account."
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

function AuditWorkspace({
  auditPlanes,
}: {
  auditPlanes: readonly PortalAuditPlane[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const rawPlane = useMemo(
    () => new URLSearchParams(queryString).get("plane"),
    [queryString],
  );
  const selectedPlane = useMemo(
    () => normalizeAuditPlane(rawPlane, auditPlanes),
    [auditPlanes, rawPlane],
  );
  const plane = selectedPlane ?? PORTAL_AUDIT_PLANE_ORDER[0];
  const filters = useMemo(
    () => parseFilters(new URLSearchParams(queryString), plane),
    [plane, queryString],
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
    if (!selectedPlane || !queryString) return;

    const params = new URLSearchParams(queryString);
    const canonicalFilters = parseFilters(params, selectedPlane);
    const canonicalPage = parsePage(params.get("page"));
    const canonicalHref = auditHref(
      selectedPlane,
      canonicalFilters,
      canonicalPage,
    );
    const currentHref = `/portal/audit?${queryString}`;
    if (canonicalHref !== currentHref) {
      router.replace(canonicalHref, { scroll: false });
    }
  }, [queryString, router, selectedPlane]);

  useEffect(() => {
    const controller = new AbortController();
    listRequestRef.current?.abort();
    detailRequestRef.current?.abort();
    const requestParams = new URLSearchParams(queryString);
    const requestPlane =
      normalizeAuditPlane(requestParams.get("plane"), auditPlanes) ?? plane;
    const requestFilters = parseFilters(requestParams, requestPlane);
    const requestPage = parsePage(requestParams.get("page"));

    void Promise.resolve()
      .then(() => {
        if (!mountedRef.current || controller.signal.aborted) return null;
        setLoadState({ kind: "loading" });
        setExpandedId(null);
        setDetailState({ kind: "idle" });
        return getPortalAuditEntries(
          requestPlane,
          requestPage,
          requestFilters,
          controller.signal,
        );
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
  }, [auditPlanes, plane, queryString, reloadKey]);

  const loadDetail = (entryId: number) => {
    detailRequestRef.current?.abort();
    const controller = new AbortController();
    detailRequestRef.current = controller;
    setDetailState({ kind: "loading", entryId });

    void getPortalAuditEntryDetail(entryId, plane, controller.signal)
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
  const planeLabel = PLANE_LABELS[plane];
  const presentation = AUDIT_PLANE_PRESENTATION[plane];
  const planeMenuItems = orderedAuditPlanes(auditPlanes).map((item) => ({
    href: auditHref(item, { ...filters, eventCategory: null }),
    label: PLANE_LABELS[item],
    value: item,
  }));

  return (
    <section aria-labelledby="portal-audit-heading" className="portal-audit">
      <PortalPageHeader
        actions={
          planeMenuItems.length > 1 ? (
            <PortalViewMenu
              activeValue={plane}
              ariaLabel="Audit plane"
              items={planeMenuItems}
              label="Plane"
            />
          ) : undefined
        }
        current="Audit trail"
        description={presentation.description}
        headingId="portal-audit-heading"
        title="Audit trail"
      />
      <AuditFilters filters={filters} plane={plane} />
      <PortalCollectionFrame
        aria-busy={loadState.kind === "loading"}
        className="portal-audit__frame"
      >
        {loadState.kind === "loading" ? (
          <AuditListSkeleton plane={plane} />
        ) : null}
        {loadState.kind === "unavailable" ? (
          <AuditUnavailable
            error={loadState.error}
            onRetry={() => setReloadKey((value) => value + 1)}
            plane={plane}
          />
        ) : null}
        {page && page.items.length > 0 ? (
          <div className="portal-audit__table-wrap">
            <Table
              className={`portal-audit__table portal-audit__table--${plane}`}
            >
              <caption className="portal-audit__table-caption">
                {planeLabel} audit activity
              </caption>
              <TableHeader>
                <TableRow>
                  {presentation.columns.map((column) => (
                    <TableHead key={column}>
                      {auditColumnLabel(plane, column)}
                    </TableHead>
                  ))}
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
                    plane={plane}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
        {page && page.items.length === 0 ? (
          <div className="portal-audit__empty" role="status">
            <h2>No {planeLabel.toLowerCase()} audit activity to show.</h2>
            <p>Try changing the filters or check back after more activity is recorded.</p>
          </div>
        ) : null}
        {page ? (
          <AuditPagination
            filters={filters}
            plane={plane}
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
        <AuditListSkeleton plane="technical" />
      </PortalCollectionFrame>
    </section>
  );
}

export function PortalAuditPage() {
  const { auditPlanes, refreshAccess, status } = usePortalAccess();

  if (status === "loading") return <PortalAuditLoading />;
  if (status === "unavailable") {
    return <AuditAccessState kind="unavailable" onRetry={() => void refreshAccess()} />;
  }
  if (auditPlanes.length === 0) {
    return <AuditAccessState kind="forbidden" />;
  }

  return <AuditWorkspace auditPlanes={auditPlanes} />;
}
