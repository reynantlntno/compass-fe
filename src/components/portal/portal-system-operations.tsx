"use client";

import { useSearchParams } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Code2,
  Database,
  RefreshCw,
  RotateCcw,
  Server,
  Settings2,
  Wrench,
  XCircle,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { CompassFrame } from "@/components/compass/compass-frame";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { usePortalAccess } from "@/components/portal/portal-access-provider";
import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
import { PORTAL_CAPABILITIES } from "@/components/portal/portal-navigation";
import { PortalListRow } from "@/components/portal/portal-list-row";
import { PortalPageHeader } from "@/components/portal/portal-page-header";
import { PortalWorkspaceNav } from "@/components/portal/portal-workspace-nav";
import {
  activateSystemMaintenance,
  cancelSystemMaintenance,
  completeSystemMaintenance,
  extendSystemMaintenance,
  getSystemEnvironmentSummary,
  getSystemErrors,
  getSystemMaintenance,
  getSystemOperationRuns,
  getSystemOperationsCatalog,
  getSystemReleaseMetadata,
  reopenSystemError,
  resolveSystemError,
  scheduleSystemMaintenance,
  SystemOperationsApiError,
  type SystemOperationsErrorKind,
} from "@/lib/api/system-operations";
import { createIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";
import type {
  ApplicationErrorProjectionSchema,
  DiagnosticTransitionSchema,
  EnvironmentSummarySchema,
  MaintenancePageSchema,
  MaintenanceProjectionSchema,
  MaintenanceScheduleSchema,
  MaintenanceTransitionSchema,
  OperationalCommandCatalogSchema,
  OperationalRunPageSchema,
  ReleaseMetadataSchema,
} from "@/lib/api/generated/model";

type OperationsSectionId = "errors" | "maintenance" | "release" | "history";

const OPERATIONS_SECTION_IDS: readonly OperationsSectionId[] = [
  "errors",
  "maintenance",
  "release",
  "history",
];

const OPERATIONS_NAV_ITEMS = [
  {
    href: "/portal/system-operations?section=errors",
    label: "Errors",
    value: "errors",
  },
  {
    href: "/portal/system-operations?section=maintenance",
    label: "Maintenance",
    value: "maintenance",
  },
  {
    href: "/portal/system-operations?section=release",
    label: "Release & environment",
    value: "release",
  },
  {
    href: "/portal/system-operations?section=history",
    label: "History",
    value: "history",
  },
] as const;

type ReadState<T> =
  | { kind: "loading" }
  | { kind: "ready"; data: T }
  | { kind: "unavailable"; error: SystemOperationsErrorKind };

type RetryKey =
  | "errors"
  | "maintenance"
  | "release"
  | "environment"
  | "catalog"
  | "history";

type ReloadKey = RetryKey;

type ErrorAction = {
  error: ApplicationErrorProjectionSchema;
  kind: "resolve" | "reopen";
};

type MaintenanceAction = {
  kind: "activate" | "cancel" | "complete" | "extend";
  maintenance: MaintenanceProjectionSchema;
};

type MutationKeyEntry = {
  fingerprint: string;
  key: IdempotencyKey;
};

const EMPTY_RETRY_COUNTS: Record<RetryKey, number> = {
  errors: 0,
  maintenance: 0,
  release: 0,
  environment: 0,
  catalog: 0,
  history: 0,
};

const EMPTY_RELOAD_COUNTS: Record<ReloadKey, number> = {
  errors: 0,
  maintenance: 0,
  release: 0,
  environment: 0,
  catalog: 0,
  history: 0,
};

const MAX_ERROR_NOTE_LENGTH = 500;
const MAX_REASON_CODE_LENGTH = 120;
const MAX_PUBLIC_MESSAGE_LENGTH = 1000;

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function getErrorKind(error: unknown): SystemOperationsErrorKind {
  return error instanceof SystemOperationsApiError ? error.kind : "unavailable";
}

function isOperationsSection(value: string | null): value is OperationsSectionId {
  return value !== null && OPERATIONS_SECTION_IDS.includes(value as OperationsSectionId);
}

function parsePage(value: string | null) {
  const page = Number(value);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100_000) return 1;
  return page;
}

function sectionHref(section: OperationsSectionId, page = 1) {
  const params = new URLSearchParams({ section });
  if (page > 1) params.set("page", String(page));
  return `/portal/system-operations?${params.toString()}`;
}

function formatLabel(value: string) {
  const words = value
    .trim()
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ");
  if (!words) return "Unavailable";
  return words.charAt(0).toUpperCase() + words.slice(1);
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

function toLocalDateTimeValue(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localDateTimeToIso(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function pageCount(page: { page: number; page_size: number; total: number }) {
  return Math.max(1, Math.ceil(page.total / page.page_size));
}

function readErrorMessage(error: SystemOperationsErrorKind, subject: string) {
  if (error === "permission") return `This ${subject} section isn’t available for this account.`;
  if (error === "rate_limited") return `Too many requests for ${subject}. Please wait and try again.`;
  return `We couldn’t load ${subject} right now.`;
}

function mutationErrorMessage(error: SystemOperationsErrorKind) {
  switch (error) {
    case "conflict":
      return "This change could not be completed because the data changed. Refresh and try again.";
    case "permission":
      return "This action isn’t available for this account.";
    case "validation":
      return "Check the details and try again.";
    case "rate_limited":
      return "Too many attempts. Please wait before trying again.";
    default:
      return "This action is temporarily unavailable. Try again.";
  }
}

function severityLabel(value: string) {
  switch (value) {
    case "critical":
      return "Critical";
    case "error":
      return "Error";
    case "warning":
      return "Warning";
    case "info":
      return "Info";
    case "debug":
      return "Debug";
    default:
      return "Severity unavailable";
  }
}

function maintenanceStatusLabel(value: string) {
  switch (value) {
    case "scheduled":
      return "Scheduled";
    case "active":
      return "Active";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Status unavailable";
  }
}

function outcomeLabel(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "success" || normalized === "succeeded" || normalized === "completed") {
    return "Completed";
  }
  if (normalized === "failed" || normalized === "failure" || normalized === "error") {
    return "Failed";
  }
  if (normalized === "running" || normalized === "started") return "Running";
  return formatLabel(value);
}

function statusTone(value: string) {
  const normalized = value.trim().toLowerCase();
  if (["critical", "error", "failed", "failure"].includes(normalized)) return "error";
  if (["warning", "active", "running"].includes(normalized)) return "warning";
  if (["completed", "success", "succeeded", "ok"].includes(normalized)) return "ok";
  return "neutral";
}

function OperationsPagination({
  label,
  page,
  pageSize,
  section,
  total,
}: {
  label: string;
  page: number;
  pageSize: number;
  section: OperationsSectionId;
  total: number;
}) {
  const pages = pageCount({ page, page_size: pageSize, total });
  if (pages <= 1) return null;

  return (
    <Pagination aria-label={`${label} pages`} className="portal-operations__pagination">
      <PaginationContent>
        <PaginationItem>
          {page > 1 ? (
            <PaginationPrevious href={sectionHref(section, page - 1)} />
          ) : (
            <span aria-hidden="true" className="portal-operations__pagination-placeholder" />
          )}
        </PaginationItem>
        <PaginationItem className="portal-operations__pagination-current">
          <span aria-live="polite">Page {page} of {pages}</span>
        </PaginationItem>
        <PaginationItem>
          {page < pages ? (
            <PaginationNext href={sectionHref(section, page + 1)} />
          ) : (
            <span aria-hidden="true" className="portal-operations__pagination-placeholder" />
          )}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

function OperationsSectionHeader({
  children,
  description,
  id,
  title,
}: {
  children?: ReactNode;
  description: string;
  id: string;
  title: string;
}) {
  return (
    <header className="portal-operations__section-header">
      <div>
        <h2 id={id}>{title}</h2>
        <p>{description}</p>
      </div>
      {children ? <div className="portal-operations__section-actions">{children}</div> : null}
    </header>
  );
}

function OperationsLoadingState({ label }: { label: string }) {
  return (
    <div aria-busy="true" className="portal-operations__state" role="status">
      <span className="sr-only">Loading {label.toLowerCase()}…</span>
      <Skeleton aria-hidden="true" className="portal-operations__skeleton-line portal-operations__skeleton-line--short" />
      <Skeleton aria-hidden="true" className="portal-operations__skeleton-line" />
      <Skeleton aria-hidden="true" className="portal-operations__skeleton-line portal-operations__skeleton-line--long" />
    </div>
  );
}

function OperationsUnavailableState({
  error,
  label,
  onRetry,
}: {
  error: SystemOperationsErrorKind;
  label: string;
  onRetry: () => void;
}) {
  return (
    <div className="portal-operations__state portal-operations__state--unavailable" role="status">
      <p>{readErrorMessage(error, label)}</p>
      <Button onClick={onRetry} type="button" variant="outline">
        <RefreshCw aria-hidden="true" />
        Try again
      </Button>
    </div>
  );
}

function OperationsEmptyState({ children }: { children: ReactNode }) {
  return <p className="portal-operations__empty">{children}</p>;
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="portal-operations__fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ErrorSection({
  onAction,
  onRetry,
  page,
}: {
  onAction: (error: ApplicationErrorProjectionSchema) => void;
  onRetry: () => void;
  page: ReadState<ReturnType<typeof getSystemErrors> extends Promise<infer T> ? T : never>;
}) {
  return (
    <section aria-labelledby="portal-operations-errors-heading" className="portal-operations__section">
      <OperationsSectionHeader
        description="Review redacted application issues and update their status when they have been addressed."
        id="portal-operations-errors-heading"
        title="Errors"
      />
      {page.kind === "loading" ? <OperationsLoadingState label="application errors" /> : null}
      {page.kind === "unavailable" ? (
        <OperationsUnavailableState error={page.error} label="application errors" onRetry={onRetry} />
      ) : null}
      {page.kind === "ready" ? (
        page.data.items.length > 0 ? (
          <>
            <div className="portal-operations__table-wrap">
              <Table className="portal-operations__table portal-operations__table--errors">
                <caption className="sr-only">Application errors</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severity</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead>Context</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {page.data.items.map((error) => {
                    const createdAt = formatTimestamp(error.created_at);
                    const routeContext = error.route_name ?? error.path_template;
                    return (
                      <TableRow key={error.error_id}>
                        <TableCell className="portal-operations__table-cell" data-label="Severity">
                          <Badge className="portal-operations__status-badge" data-tone={statusTone(error.severity)} variant="outline">
                            {severityLabel(error.severity)}
                          </Badge>
                        </TableCell>
                        <TableCell className="portal-operations__table-cell" data-label="State">
                          <Badge className="portal-operations__state-badge" data-tone={error.is_resolved ? "ok" : "warning"} variant="outline">
                            {error.is_resolved ? "Resolved" : "Open"}
                          </Badge>
                        </TableCell>
                        <TableCell className="portal-operations__table-cell" data-label="Category">
                          {formatLabel(error.category)}
                        </TableCell>
                        <TableCell className="portal-operations__table-cell portal-operations__table-cell--message" data-label="Message">
                          {error.safe_message}
                        </TableCell>
                        <TableCell className="portal-operations__table-cell" data-label="Environment">
                          {error.environment}
                        </TableCell>
                        <TableCell className="portal-operations__table-cell" data-label="Context">
                          <div className="portal-operations__table-context">
                            {error.release_version ? <span>Release {error.release_version}</span> : null}
                            {error.build_id ? <span>Build {error.build_id}</span> : null}
                            {routeContext ? <span>{routeContext}</span> : null}
                            {!error.release_version && !error.build_id && !routeContext ? <span>—</span> : null}
                          </div>
                        </TableCell>
                        <TableCell className="portal-operations__table-cell" data-label="Created">
                          {createdAt ? <time dateTime={error.created_at}>{createdAt}</time> : "—"}
                        </TableCell>
                        <TableCell className="portal-operations__table-cell portal-operations__table-cell--action" data-label="Action">
                          <Button onClick={() => onAction(error)} size="sm" type="button" variant="outline">
                            {error.is_resolved ? <RotateCcw aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
                            {error.is_resolved ? "Reopen" : "Resolve"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <OperationsPagination
              label="Application errors"
              page={page.data.page}
              pageSize={page.data.page_size}
              section="errors"
              total={page.data.total}
            />
          </>
        ) : (
          <OperationsEmptyState>No application errors to show.</OperationsEmptyState>
        )
      ) : null}
    </section>
  );
}

function MaintenanceSection({
  onAction,
  onRetry,
  onSchedule,
  page,
}: {
  onAction: (maintenance: MaintenanceProjectionSchema, kind: MaintenanceAction["kind"]) => void;
  onRetry: () => void;
  onSchedule: () => void;
  page: ReadState<MaintenancePageSchema>;
}) {
  return (
    <section aria-labelledby="portal-operations-maintenance-heading" className="portal-operations__section">
      <OperationsSectionHeader
        description="Schedule and manage public maintenance windows for the system."
        id="portal-operations-maintenance-heading"
        title="Maintenance"
      >
        <Button onClick={onSchedule} type="button" variant="outline">
          <CalendarClock aria-hidden="true" />
          Schedule maintenance
        </Button>
      </OperationsSectionHeader>
      {page.kind === "loading" ? <OperationsLoadingState label="maintenance windows" /> : null}
      {page.kind === "unavailable" ? (
        <OperationsUnavailableState error={page.error} label="maintenance windows" onRetry={onRetry} />
      ) : null}
      {page.kind === "ready" ? (
        page.data.items.length > 0 ? (
          <>
            <ul className="portal-operations__list">
              {page.data.items.map((maintenance) => {
                const startsAt = formatTimestamp(maintenance.starts_at);
                const endsAt = formatTimestamp(maintenance.ends_at);
                const createdAt = formatTimestamp(maintenance.created_at);
                const canActivate = maintenance.status === "scheduled";
                const canCancel = maintenance.status === "scheduled" || maintenance.status === "active";
                const canExtend = maintenance.status === "active";
                const canComplete = maintenance.status === "active";
                return (
                  <PortalListRow className="portal-operations__row" key={maintenance.id}>
                    <div className="portal-operations__row-heading">
                      <Badge className="portal-operations__status-badge" data-tone={statusTone(maintenance.status)} variant="outline">
                        {maintenanceStatusLabel(maintenance.status)}
                      </Badge>
                      {maintenance.is_expired ? <Badge className="portal-operations__state-badge" variant="outline">Expired</Badge> : null}
                    </div>
                    <h3>{maintenance.safe_public_message || "Maintenance window"}</h3>
                    <dl className="portal-operations__fact-grid">
                      {startsAt ? <Fact label="Starts" value={<time dateTime={maintenance.starts_at ?? undefined}>{startsAt}</time>} /> : null}
                      {endsAt ? <Fact label="Ends" value={<time dateTime={maintenance.ends_at ?? undefined}>{endsAt}</time>} /> : null}
                      {createdAt ? <Fact label="Scheduled" value={<time dateTime={maintenance.created_at ?? undefined}>{createdAt}</time>} /> : null}
                    </dl>
                    <div className="portal-operations__row-actions">
                      {canActivate ? (
                        <Button onClick={() => onAction(maintenance, "activate")} size="sm" type="button" variant="outline">
                          <Wrench aria-hidden="true" />
                          Activate
                        </Button>
                      ) : null}
                      {canExtend ? (
                        <Button onClick={() => onAction(maintenance, "extend")} size="sm" type="button" variant="outline">
                          <Clock3 aria-hidden="true" />
                          Extend
                        </Button>
                      ) : null}
                      {canComplete ? (
                        <Button onClick={() => onAction(maintenance, "complete")} size="sm" type="button" variant="outline">
                          <CheckCircle2 aria-hidden="true" />
                          Complete
                        </Button>
                      ) : null}
                      {canCancel ? (
                        <Button onClick={() => onAction(maintenance, "cancel")} size="sm" type="button" variant="ghost">
                          <XCircle aria-hidden="true" />
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </PortalListRow>
                );
              })}
            </ul>
            <OperationsPagination
              label="Maintenance windows"
              page={page.data.page}
              pageSize={page.data.page_size}
              section="maintenance"
              total={page.data.total}
            />
          </>
        ) : (
          <OperationsEmptyState>No maintenance windows to show.</OperationsEmptyState>
        )
      ) : null}
    </section>
  );
}

function ReleaseSection({
  catalog,
  environment,
  onRetry,
  release,
}: {
  catalog: ReadState<OperationalCommandCatalogSchema>;
  environment: ReadState<EnvironmentSummarySchema>;
  onRetry: (key: Extract<RetryKey, "catalog" | "environment" | "release">) => void;
  release: ReadState<ReleaseMetadataSchema>;
}) {
  return (
    <section aria-labelledby="portal-operations-release-heading" className="portal-operations__section">
      <OperationsSectionHeader
        description="Review the bounded release, environment, and available operation catalog information."
        id="portal-operations-release-heading"
        title="Release & environment"
      />
      <div className="portal-operations__release-grid">
        <OperationsInfoGroup icon={<Server aria-hidden="true" />} title="Release">
          {release.kind === "loading" ? <OperationsLoadingState label="release information" /> : null}
          {release.kind === "unavailable" ? <OperationsUnavailableState error={release.error} label="release information" onRetry={() => onRetry("release")} /> : null}
          {release.kind === "ready" ? (
            <dl className="portal-operations__fact-grid">
              <Fact label="Environment" value={release.data.environment} />
              <Fact label="Version" value={release.data.release.version} />
              <Fact label="Build" value={release.data.release.build_id} />
              <Fact label="Configuration" value={release.data.release.configured ? "Configured" : "Not configured"} />
            </dl>
          ) : null}
        </OperationsInfoGroup>
        <OperationsInfoGroup icon={<Database aria-hidden="true" />} title="Environment">
          {environment.kind === "loading" ? <OperationsLoadingState label="environment information" /> : null}
          {environment.kind === "unavailable" ? <OperationsUnavailableState error={environment.error} label="environment information" onRetry={() => onRetry("environment")} /> : null}
          {environment.kind === "ready" ? (
            <dl className="portal-operations__fact-grid">
              <Fact label="Environment" value={environment.data.environment} />
              <Fact label="Deployment" value={environment.data.deployment_class} />
              <Fact label="Maintenance" value={environment.data.maintenance.active ? "Active" : "Not active"} />
              <Fact label="Storage" value={environment.data.components.protected_storage_backend} />
              <Fact label="Cache" value={environment.data.components.cache_backend} />
              <Fact label="Notification worker" value={environment.data.components.notification_worker_enabled ? "Enabled" : "Disabled"} />
              <Fact label="Backup worker" value={environment.data.components.backup_worker_enabled ? "Enabled" : "Disabled"} />
            </dl>
          ) : null}
        </OperationsInfoGroup>
      </div>
      <OperationsInfoGroup icon={<Code2 aria-hidden="true" />} title="Operation catalog">
        {catalog.kind === "loading" ? <OperationsLoadingState label="operation catalog" /> : null}
        {catalog.kind === "unavailable" ? <OperationsUnavailableState error={catalog.error} label="operation catalog" onRetry={() => onRetry("catalog")} /> : null}
        {catalog.kind === "ready" ? (
          catalog.data.items.length > 0 ? (
            <ul className="portal-operations__catalog">
              {catalog.data.items.map((item) => (
                <li className="portal-operations__catalog-item" key={item.key}>
                  <div>
                    <h3>{item.label}</h3>
                    <p>{item.key}</p>
                  </div>
                  <span>{formatLabel(item.mode)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <OperationsEmptyState>No operations are currently listed.</OperationsEmptyState>
          )
        ) : null}
      </OperationsInfoGroup>
    </section>
  );
}

function OperationsInfoGroup({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section aria-labelledby={`portal-operations-group-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} className="portal-operations__info-group">
      <div className="portal-operations__info-heading">
        {icon}
        <h3 id={`portal-operations-group-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function HistorySection({
  catalog,
  onRetry,
  page,
}: {
  catalog: ReadState<OperationalCommandCatalogSchema>;
  onRetry: () => void;
  page: ReadState<OperationalRunPageSchema>;
}) {
  return (
    <section aria-labelledby="portal-operations-history-heading" className="portal-operations__section">
      <OperationsSectionHeader
        description="Review read-only records of operational runs."
        id="portal-operations-history-heading"
        title="History"
      />
      {page.kind === "loading" ? <OperationsLoadingState label="operation history" /> : null}
      {page.kind === "unavailable" ? <OperationsUnavailableState error={page.error} label="operation history" onRetry={onRetry} /> : null}
      {page.kind === "ready" ? (
        page.data.items.length > 0 ? (
          <>
            <div className="portal-operations__table-wrap">
              <Table className="portal-operations__table portal-operations__table--history">
                <caption className="sr-only">Operational history</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Command</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Finished</TableHead>
                    <TableHead>Context</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {page.data.items.map((run) => {
                    const commandLabel = catalog.kind === "ready"
                      ? catalog.data.items.find((item) => item.key === run.command_key)?.label
                      : null;
                    const startedAt = formatTimestamp(run.started_at);
                    const finishedAt = formatTimestamp(run.finished_at);
                    return (
                      <TableRow key={run.id}>
                        <TableCell className="portal-operations__table-cell portal-operations__table-cell--message" data-label="Command">
                          <strong>{commandLabel ?? run.command_key}</strong>
                          <span className="portal-operations__table-secondary">{run.command_key}</span>
                        </TableCell>
                        <TableCell className="portal-operations__table-cell" data-label="Outcome">
                          <Badge className="portal-operations__status-badge" data-tone={statusTone(run.outcome)} variant="outline">
                            {outcomeLabel(run.outcome)}
                          </Badge>
                        </TableCell>
                        <TableCell className="portal-operations__table-cell" data-label="Mode">
                          {formatLabel(run.mode)}
                        </TableCell>
                        <TableCell className="portal-operations__table-cell" data-label="Environment">
                          {run.environment}
                        </TableCell>
                        <TableCell className="portal-operations__table-cell" data-label="Reason">
                          {formatLabel(run.reason_code)}
                        </TableCell>
                        <TableCell className="portal-operations__table-cell" data-label="Started">
                          {startedAt ? <time dateTime={run.started_at ?? undefined}>{startedAt}</time> : "—"}
                        </TableCell>
                        <TableCell className="portal-operations__table-cell" data-label="Finished">
                          {finishedAt ? <time dateTime={run.finished_at ?? undefined}>{finishedAt}</time> : "—"}
                        </TableCell>
                        <TableCell className="portal-operations__table-cell" data-label="Context">
                          <div className="portal-operations__table-context">
                            {run.outcome_reason_code ? <span>{formatLabel(run.outcome_reason_code)}</span> : null}
                            {run.release_version ? <span>Release {run.release_version}</span> : null}
                            {run.build_id ? <span>Build {run.build_id}</span> : null}
                            {!run.outcome_reason_code && !run.release_version && !run.build_id ? <span>—</span> : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <OperationsPagination
              label="Operation history"
              page={page.data.page}
              pageSize={page.data.page_size}
              section="history"
              total={page.data.total}
            />
          </>
        ) : (
          <OperationsEmptyState>No operational runs to show.</OperationsEmptyState>
        )
      ) : null}
    </section>
  );
}

function OperationsFrameSkeleton() {
  return (
    <CompassFrame aria-hidden="true" as="div" className="portal-operations__frame portal-operations__frame--loading">
      <Skeleton className="portal-operations__skeleton-line portal-operations__skeleton-line--short" />
      <Skeleton className="portal-operations__skeleton-line portal-operations__skeleton-line--heading" />
      <Skeleton className="portal-operations__skeleton-line portal-operations__skeleton-line--long" />
      <div className="portal-operations__skeleton-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="portal-operations__skeleton-block" key={index} />
        ))}
      </div>
    </CompassFrame>
  );
}

function OperationsWorkspaceNavSkeleton() {
  return (
    <div aria-hidden="true" className="compass-surface portal-workspace-nav portal-operations__nav-skeleton" data-tone="subtle">
      <div className="portal-workspace-nav__skeleton-list">
        {OPERATIONS_NAV_ITEMS.map((item) => (
          <Skeleton className="portal-operations__skeleton-tab" key={item.value} />
        ))}
      </div>
    </div>
  );
}

export function PortalSystemOperationsLoading() {
  return (
    <section aria-busy="true" aria-labelledby="portal-operations-loading-heading" className="portal-operations portal-operations--loading" role="status">
      <span className="sr-only">Loading system operations…</span>
      <PortalPageHeader
        current="System operations"
        description="Review application issues, maintenance windows, release context, and operational history."
        headingId="portal-operations-loading-heading"
        title="System operations"
      />
      <div className="portal-operations__workspace">
        <OperationsWorkspaceNavSkeleton />
        <OperationsFrameSkeleton />
      </div>
    </section>
  );
}

function PortalSystemOperationsAccessState({
  kind,
  onRetry,
}: {
  kind: "forbidden" | "unavailable";
  onRetry?: () => void;
}) {
  return (
    <section aria-labelledby="portal-operations-access-heading" className="portal-operations portal-operations--state" role={kind === "unavailable" ? "alert" : undefined}>
      <PortalPageHeader
        current="System operations"
        description="Review application issues, maintenance windows, release context, and operational history."
        headingId="portal-operations-heading"
        title="System operations"
      />
      <PortalCollectionFrame as="div" className="portal-operations__frame portal-operations__frame--state">
        <Settings2 aria-hidden="true" className="portal-operations__state-icon" />
        <h2 id="portal-operations-access-heading">
          {kind === "forbidden" ? "This page isn’t available for this account." : "System operations isn’t available right now."}
        </h2>
        <p>
          {kind === "forbidden" ? "Return to your workspace to continue." : "Try again when the connection is ready."}
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

export function PortalSystemOperationsPage() {
  const { hasCapability, refreshAccess, status } = usePortalAccess();

  if (status === "loading") return <PortalSystemOperationsLoading />;
  if (status === "unavailable") {
    return <PortalSystemOperationsAccessState kind="unavailable" onRetry={() => void refreshAccess()} />;
  }
  if (!hasCapability(PORTAL_CAPABILITIES.systemOperationsManage)) {
    return <PortalSystemOperationsAccessState kind="forbidden" />;
  }

  return <SystemOperationsWorkspace />;
}

function SystemOperationsWorkspace() {
  const searchParams = useSearchParams();
  const requestedSection = searchParams.get("section");
  const activeSection: OperationsSectionId = isOperationsSection(requestedSection)
    ? requestedSection
    : "errors";
  const activePage = parsePage(searchParams.get("page"));

  const [retryCounts, setRetryCounts] = useState(EMPTY_RETRY_COUNTS);
  const [reloadCounts, setReloadCounts] = useState(EMPTY_RELOAD_COUNTS);
  const [errorsState, setErrorsState] = useState<ReadState<Awaited<ReturnType<typeof getSystemErrors>>>>({ kind: "loading" });
  const [maintenanceState, setMaintenanceState] = useState<ReadState<MaintenancePageSchema>>({ kind: "loading" });
  const [releaseState, setReleaseState] = useState<ReadState<ReleaseMetadataSchema>>({ kind: "loading" });
  const [environmentState, setEnvironmentState] = useState<ReadState<EnvironmentSummarySchema>>({ kind: "loading" });
  const [catalogState, setCatalogState] = useState<ReadState<OperationalCommandCatalogSchema>>({ kind: "loading" });
  const [historyState, setHistoryState] = useState<ReadState<OperationalRunPageSchema>>({ kind: "loading" });

  const mutationKeysRef = useRef(new Map<string, MutationKeyEntry>());
  const [mutationNotice, setMutationNotice] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<ErrorAction | null>(null);
  const [errorNote, setErrorNote] = useState("");
  const [errorMutation, setErrorMutation] = useState<"pending" | "error" | null>(null);
  const [errorMutationMessage, setErrorMutationMessage] = useState<string | null>(null);
  const [maintenanceAction, setMaintenanceAction] = useState<MaintenanceAction | null>(null);
  const [maintenanceReason, setMaintenanceReason] = useState("");
  const [maintenanceEndsAt, setMaintenanceEndsAt] = useState("");
  const [maintenanceMutation, setMaintenanceMutation] = useState<"pending" | "error" | null>(null);
  const [maintenanceMutationMessage, setMaintenanceMutationMessage] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleValues, setScheduleValues] = useState({
    startsAt: "",
    endsAt: "",
    publicMessage: "",
    reasonCode: "",
  });
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

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

  const retrySection = (section: RetryKey) => {
    setRetryCounts((current) => ({ ...current, [section]: current[section] + 1 }));
  };

  const reloadSections = (sections: readonly ReloadKey[]) => {
    setReloadCounts((current) => {
      const next = { ...current };
      for (const section of sections) next[section] += 1;
      return next;
    });
  };

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!active) return;
        setErrorsState({ kind: "loading" });
        return getSystemErrors(activeSection === "errors" ? activePage : 1, controller.signal);
      })
      .then((data) => {
        if (active && data) setErrorsState({ kind: "ready", data });
      })
      .catch((error: unknown) => {
        if (active && !isAbortError(error)) setErrorsState({ kind: "unavailable", error: getErrorKind(error) });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [activePage, activeSection, reloadCounts.errors, retryCounts.errors]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!active) return;
        setMaintenanceState({ kind: "loading" });
        return getSystemMaintenance(activeSection === "maintenance" ? activePage : 1, controller.signal);
      })
      .then((data) => {
        if (active && data) setMaintenanceState({ kind: "ready", data });
      })
      .catch((error: unknown) => {
        if (active && !isAbortError(error)) setMaintenanceState({ kind: "unavailable", error: getErrorKind(error) });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [activePage, activeSection, reloadCounts.maintenance, retryCounts.maintenance]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!active) return;
        setReleaseState({ kind: "loading" });
        return getSystemReleaseMetadata(controller.signal);
      })
      .then((data) => {
        if (active && data) setReleaseState({ kind: "ready", data });
      })
      .catch((error: unknown) => {
        if (active && !isAbortError(error)) setReleaseState({ kind: "unavailable", error: getErrorKind(error) });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadCounts.release, retryCounts.release]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!active) return;
        setEnvironmentState({ kind: "loading" });
        return getSystemEnvironmentSummary(controller.signal);
      })
      .then((data) => {
        if (active && data) setEnvironmentState({ kind: "ready", data });
      })
      .catch((error: unknown) => {
        if (active && !isAbortError(error)) setEnvironmentState({ kind: "unavailable", error: getErrorKind(error) });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadCounts.environment, retryCounts.environment]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!active) return;
        setCatalogState({ kind: "loading" });
        return getSystemOperationsCatalog(controller.signal);
      })
      .then((data) => {
        if (active && data) setCatalogState({ kind: "ready", data });
      })
      .catch((error: unknown) => {
        if (active && !isAbortError(error)) setCatalogState({ kind: "unavailable", error: getErrorKind(error) });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadCounts.catalog, retryCounts.catalog]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!active) return;
        setHistoryState({ kind: "loading" });
        return getSystemOperationRuns(activeSection === "history" ? activePage : 1, controller.signal);
      })
      .then((data) => {
        if (active && data) setHistoryState({ kind: "ready", data });
      })
      .catch((error: unknown) => {
        if (active && !isAbortError(error)) setHistoryState({ kind: "unavailable", error: getErrorKind(error) });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [activePage, activeSection, reloadCounts.history, retryCounts.history]);

  const openErrorAction = (error: ApplicationErrorProjectionSchema) => {
    setErrorAction({ error, kind: error.is_resolved ? "reopen" : "resolve" });
    setErrorNote("");
    setErrorMutation(null);
    setErrorMutationMessage(null);
  };

  const handleErrorMutation = async () => {
    const action = errorAction;
    if (!action) return;

    const note = errorNote.trim();
    const scope = `error:${action.kind}:${action.error.error_id}`;
    const fingerprint = `${action.kind}:${action.error.error_id}:${note}`;
    const key = getMutationKey(scope, fingerprint);
    const payload: DiagnosticTransitionSchema = note ? { note } : {};
    setErrorMutation("pending");
    setErrorMutationMessage(null);

    try {
      if (action.kind === "resolve") {
        await resolveSystemError(action.error.error_id, payload, key);
      } else {
        await reopenSystemError(action.error.error_id, payload, key);
      }
      discardMutationKey(scope);
      setErrorAction(null);
      setErrorNote("");
      setErrorMutation(null);
      setMutationNotice(action.kind === "resolve" ? "The application error was resolved." : "The application error was reopened.");
      reloadSections(["errors", "history"]);
    } catch (error: unknown) {
      setErrorMutation("error");
      const kind = getErrorKind(error);
      setErrorMutationMessage(mutationErrorMessage(kind));
      if (kind === "conflict") reloadSections(["errors", "history"]);
    }
  };

  const openMaintenanceAction = (
    maintenance: MaintenanceProjectionSchema,
    kind: MaintenanceAction["kind"],
  ) => {
    setMaintenanceAction({ maintenance, kind });
    setMaintenanceReason("");
    setMaintenanceEndsAt(kind === "extend" ? toLocalDateTimeValue(maintenance.ends_at) : "");
    setMaintenanceMutation(null);
    setMaintenanceMutationMessage(null);
  };

  const handleMaintenanceMutation = async () => {
    const action = maintenanceAction;
    if (!action) return;

    const reason = maintenanceReason.trim();
    const endsAt = maintenanceEndsAt.trim();
    if (reason.length > MAX_REASON_CODE_LENGTH) {
      setMaintenanceMutation("error");
      setMaintenanceMutationMessage("Use 120 characters or fewer for the reason code.");
      return;
    }
    if (action.kind === "extend" && !endsAt) {
      setMaintenanceMutation("error");
      setMaintenanceMutationMessage("Enter a new end time before extending the window.");
      return;
    }

    const endsAtIso = endsAt ? localDateTimeToIso(endsAt) : null;
    if (endsAt && !endsAtIso) {
      setMaintenanceMutation("error");
      setMaintenanceMutationMessage("Enter a valid end time and try again.");
      return;
    }
    if (endsAtIso && action.maintenance.starts_at) {
      const start = new Date(action.maintenance.starts_at).getTime();
      const end = new Date(endsAtIso).getTime();
      if (!Number.isNaN(start) && end <= start) {
        setMaintenanceMutation("error");
        setMaintenanceMutationMessage("The end time must be after the start time.");
        return;
      }
    }

    const expectedUpdatedAt = action.maintenance.updated_at ?? null;
    const payload: MaintenanceTransitionSchema = {
      ...(endsAtIso && (action.kind === "activate" || action.kind === "extend") ? { ends_at: endsAtIso } : {}),
      ...(expectedUpdatedAt ? { expected_updated_at: expectedUpdatedAt } : {}),
      ...(reason ? { reason_code: reason } : {}),
    };
    const scope = `maintenance:${action.kind}:${action.maintenance.id}`;
    const fingerprint = JSON.stringify({ endsAt: endsAtIso, expectedUpdatedAt, reason });
    const key = getMutationKey(scope, fingerprint);
    setMaintenanceMutation("pending");
    setMaintenanceMutationMessage(null);

    try {
      if (action.kind === "activate") await activateSystemMaintenance(action.maintenance.id, payload, key);
      if (action.kind === "extend") await extendSystemMaintenance(action.maintenance.id, payload, key);
      if (action.kind === "complete") await completeSystemMaintenance(action.maintenance.id, payload, key);
      if (action.kind === "cancel") await cancelSystemMaintenance(action.maintenance.id, payload, key);
      discardMutationKey(scope);
      setMaintenanceAction(null);
      setMaintenanceReason("");
      setMaintenanceEndsAt("");
      setMaintenanceMutation(null);
      setMutationNotice("The maintenance window was updated.");
      reloadSections(["maintenance", "release", "environment", "history"]);
    } catch (error: unknown) {
      setMaintenanceMutation("error");
      const kind = getErrorKind(error);
      setMaintenanceMutationMessage(mutationErrorMessage(kind));
      if (kind === "conflict") {
        reloadSections(["maintenance", "release", "environment", "history"]);
      }
    }
  };

  const openSchedule = () => {
    setScheduleOpen(true);
    setScheduleError(null);
    setScheduleSubmitting(false);
  };

  const updateScheduleValue = (field: keyof typeof scheduleValues, value: string) => {
    discardMutationKey("maintenance:schedule");
    setScheduleValues((current) => ({ ...current, [field]: value }));
    setScheduleError(null);
  };

  const handleScheduleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const startsAt = localDateTimeToIso(scheduleValues.startsAt);
    const endsAt = localDateTimeToIso(scheduleValues.endsAt);
    const publicMessage = scheduleValues.publicMessage.trim();
    const reasonCode = scheduleValues.reasonCode.trim();

    if (!startsAt || !endsAt) {
      setScheduleError("Enter a valid start and end time.");
      return;
    }
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      setScheduleError("The end time must be after the start time.");
      return;
    }
    if (publicMessage.length > MAX_PUBLIC_MESSAGE_LENGTH) {
      setScheduleError("Use 1,000 characters or fewer for the public message.");
      return;
    }
    if (reasonCode.length > MAX_REASON_CODE_LENGTH) {
      setScheduleError("Use 120 characters or fewer for the reason code.");
      return;
    }

    const payload: MaintenanceScheduleSchema = {
      ends_at: endsAt,
      starts_at: startsAt,
      ...(publicMessage ? { public_message: publicMessage } : {}),
      ...(reasonCode ? { reason_code: reasonCode } : {}),
    };
    const fingerprint = JSON.stringify(payload);
    const key = getMutationKey("maintenance:schedule", fingerprint);
    setScheduleSubmitting(true);
    setScheduleError(null);

    try {
      await scheduleSystemMaintenance(payload, key);
      discardMutationKey("maintenance:schedule");
      setScheduleOpen(false);
      setScheduleValues({ startsAt: "", endsAt: "", publicMessage: "", reasonCode: "" });
      setMutationNotice("The maintenance window was scheduled.");
      reloadSections(["maintenance", "release", "environment", "history"]);
    } catch (error: unknown) {
      setScheduleError(mutationErrorMessage(getErrorKind(error)));
    } finally {
      setScheduleSubmitting(false);
    }
  };

  const navItems = OPERATIONS_NAV_ITEMS.map((item) => ({
    ...item,
    href: sectionHref(item.value, 1),
  }));

  const renderActiveSection = () => {
    switch (activeSection) {
      case "maintenance":
        return (
          <MaintenanceSection
            onAction={openMaintenanceAction}
            onRetry={() => retrySection("maintenance")}
            onSchedule={openSchedule}
            page={maintenanceState}
          />
        );
      case "release":
        return (
          <ReleaseSection
            catalog={catalogState}
            environment={environmentState}
            onRetry={retrySection}
            release={releaseState}
          />
        );
      case "history":
        return (
          <HistorySection
            catalog={catalogState}
            onRetry={() => retrySection("history")}
            page={historyState}
          />
        );
      default:
        return (
          <ErrorSection
            onAction={openErrorAction}
            onRetry={() => retrySection("errors")}
            page={errorsState}
          />
        );
    }
  };

  return (
    <section aria-labelledby="portal-operations-heading" className="portal-operations">
      <PortalPageHeader
        current="System operations"
        description="Review application issues, maintenance windows, release context, and operational history."
        headingId="portal-operations-heading"
        title="System operations"
      />
      <div className="portal-operations__workspace">
        <PortalWorkspaceNav
          activeValue={activeSection}
          ariaLabel="System operations sections"
          items={navItems}
        />
        <PortalCollectionFrame as="div" className="portal-operations__frame">
          {mutationNotice ? (
            <p aria-live="polite" className="portal-operations__notice" role="status">
              {mutationNotice}
            </p>
          ) : null}
          {renderActiveSection()}
        </PortalCollectionFrame>
      </div>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && errorMutation !== "pending") setErrorAction(null);
        }}
        open={errorAction !== null}
      >
        <AlertDialogContent className="compass-surface portal-operations__dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {errorAction?.kind === "resolve" ? "Resolve this application error?" : "Reopen this application error?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {errorAction?.kind === "resolve" ? "Mark this redacted error as resolved." : "Make this redacted error active again for follow-up."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="portal-operations__dialog-field">
            <Label htmlFor="portal-operations-error-note">Note (optional)</Label>
            <Textarea
              id="portal-operations-error-note"
              maxLength={MAX_ERROR_NOTE_LENGTH}
              onChange={(event) => {
                discardMutationKey(`error:${errorAction?.kind ?? "resolve"}:${errorAction?.error.error_id ?? ""}`);
                setErrorNote(event.target.value);
                setErrorMutation(null);
                setErrorMutationMessage(null);
              }}
              value={errorNote}
            />
          </div>
          {errorMutationMessage ? <p className="portal-operations__dialog-error" role="alert">{errorMutationMessage}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={errorMutation === "pending"}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={errorMutation === "pending"} onClick={() => void handleErrorMutation()}>
              {errorMutation === "pending" ? "Updating…" : "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && maintenanceMutation !== "pending") setMaintenanceAction(null);
        }}
        open={maintenanceAction !== null}
      >
        <AlertDialogContent className="compass-surface portal-operations__dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {maintenanceAction ? `${formatLabel(maintenanceAction.kind)} maintenance window?` : "Update maintenance window?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              The selected maintenance window will be updated using the current backend state.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {maintenanceAction?.kind === "activate" || maintenanceAction?.kind === "extend" ? (
            <div className="portal-operations__dialog-field">
              <Label htmlFor="portal-operations-maintenance-end">End time {maintenanceAction.kind === "extend" ? "(required)" : "(optional)"}</Label>
              <Input
                id="portal-operations-maintenance-end"
                onChange={(event) => {
                  discardMutationKey(`maintenance:${maintenanceAction.kind}:${maintenanceAction.maintenance.id}`);
                  setMaintenanceEndsAt(event.target.value);
                  setMaintenanceMutation(null);
                  setMaintenanceMutationMessage(null);
                }}
                type="datetime-local"
                value={maintenanceEndsAt}
              />
            </div>
          ) : null}
          <div className="portal-operations__dialog-field">
            <Label htmlFor="portal-operations-maintenance-reason">Reason code (optional)</Label>
            <Input
              id="portal-operations-maintenance-reason"
              maxLength={MAX_REASON_CODE_LENGTH}
              onChange={(event) => {
                if (maintenanceAction) discardMutationKey(`maintenance:${maintenanceAction.kind}:${maintenanceAction.maintenance.id}`);
                setMaintenanceReason(event.target.value);
                setMaintenanceMutation(null);
                setMaintenanceMutationMessage(null);
              }}
              value={maintenanceReason}
            />
          </div>
          {maintenanceMutationMessage ? <p className="portal-operations__dialog-error" role="alert">{maintenanceMutationMessage}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={maintenanceMutation === "pending"}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={maintenanceMutation === "pending"} onClick={() => void handleMaintenanceMutation()}>
              {maintenanceMutation === "pending" ? "Updating…" : "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open && !scheduleSubmitting) setScheduleOpen(false);
        }}
        open={scheduleOpen}
      >
        <DialogContent className="compass-surface portal-operations__dialog">
          <DialogHeader>
            <DialogTitle>Schedule maintenance</DialogTitle>
            <DialogDescription>Set the public maintenance window and message.</DialogDescription>
          </DialogHeader>
          <form className="portal-operations__dialog-form" onSubmit={handleScheduleSubmit}>
            <div className="portal-operations__dialog-field">
              <Label htmlFor="portal-operations-schedule-start">Start time</Label>
              <Input
                id="portal-operations-schedule-start"
                onChange={(event) => updateScheduleValue("startsAt", event.target.value)}
                required
                type="datetime-local"
                value={scheduleValues.startsAt}
              />
            </div>
            <div className="portal-operations__dialog-field">
              <Label htmlFor="portal-operations-schedule-end">End time</Label>
              <Input
                id="portal-operations-schedule-end"
                onChange={(event) => updateScheduleValue("endsAt", event.target.value)}
                required
                type="datetime-local"
                value={scheduleValues.endsAt}
              />
            </div>
            <div className="portal-operations__dialog-field">
              <Label htmlFor="portal-operations-schedule-message">Public message (optional)</Label>
              <Textarea
                id="portal-operations-schedule-message"
                maxLength={MAX_PUBLIC_MESSAGE_LENGTH}
                onChange={(event) => updateScheduleValue("publicMessage", event.target.value)}
                value={scheduleValues.publicMessage}
              />
            </div>
            <div className="portal-operations__dialog-field">
              <Label htmlFor="portal-operations-schedule-reason">Reason code (optional)</Label>
              <Input
                id="portal-operations-schedule-reason"
                maxLength={MAX_REASON_CODE_LENGTH}
                onChange={(event) => updateScheduleValue("reasonCode", event.target.value)}
                value={scheduleValues.reasonCode}
              />
            </div>
            {scheduleError ? <p className="portal-operations__dialog-error" role="alert">{scheduleError}</p> : null}
            <DialogFooter>
              <Button disabled={scheduleSubmitting} onClick={() => setScheduleOpen(false)} type="button" variant="outline">
                Cancel
              </Button>
              <Button disabled={scheduleSubmitting} type="submit">
                {scheduleSubmitting ? "Scheduling…" : "Schedule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
