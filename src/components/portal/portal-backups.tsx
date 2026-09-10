"use client";

import { useSearchParams } from "next/navigation";
import {
  ArchiveRestore,
  ChevronDown,
  CircleAlert,
  DatabaseBackup,
  FileCheck2,
  MoreHorizontal,
  RefreshCw,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { usePortalAccess } from "@/components/portal/portal-access-provider";
import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
import { PORTAL_CAPABILITIES } from "@/components/portal/portal-navigation";
import { PortalPageHeader } from "@/components/portal/portal-page-header";
import { PortalWorkspaceNav } from "@/components/portal/portal-workspace-nav";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  authorizeBackupRestore,
  BackupsApiError,
  cancelBackup,
  cancelBackupRestore,
  dryRunBackupRestore,
  getBackupArtifacts,
  getBackupJobDetail,
  getBackupJobs,
  getBackupsDashboard,
  getBackupRestoreDetail,
  getBackupRestores,
  queueBackup,
  requestBackup,
  requestRestore,
  verifyBackup,
  type BackupsApiErrorKind,
} from "@/lib/api/backups";
import { createIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";
import type {
  BackupArtifactPageSchema,
  BackupDashboardSchema,
  BackupJobPageSchema,
  BackupJobProjectionSchema,
  RestoreRequestPageSchema,
  RestoreRequestProjectionSchema,
  RestoreTransitionSchema,
  RestoreAuthorizationSchema,
} from "@/lib/api/generated/model";

type BackupsSectionId = "overview" | "jobs" | "restores";

const BACKUPS_SECTION_IDS: readonly BackupsSectionId[] = [
  "overview",
  "jobs",
  "restores",
];

const BACKUPS_NAV_ITEMS = [
  {
    href: "/portal/backups?section=overview",
    label: "Overview",
    value: "overview",
  },
  {
    href: "/portal/backups?section=jobs",
    label: "Jobs",
    value: "jobs",
  },
  {
    href: "/portal/backups?section=restores",
    label: "Restores",
    value: "restores",
  },
] as const;

const BACKUP_SCOPE_OPTIONS = [
  ["database", "Database"],
  ["media", "Media"],
  ["protected_files", "Protected files"],
  ["full", "Full"],
  ["config_snapshot", "Configuration snapshot"],
  ["verification", "Verification"],
] as const;

const RESTORE_SCOPE_OPTIONS = [
  ["database", "Database"],
  ["media", "Media"],
  ["protected_files", "Protected files"],
  ["full", "Full"],
  ["metadata_validation", "Metadata validation"],
] as const;

const AUTHORIZATION_TYPE_OPTIONS = [
  ["head_guidance_recorded", "Head Guidance recorded"],
  ["institutional_memo", "Institutional memo"],
  ["incident_response", "Incident response"],
  ["other_safe_reference", "Other safe reference"],
] as const;

type ReadState<T> =
  | { kind: "loading" }
  | { kind: "ready"; data: T }
  | { kind: "unavailable"; error: BackupsApiErrorKind };

type DetailState<T> =
  | { kind: "idle" }
  | { kind: "loading"; id: string }
  | { kind: "ready"; data: T; id: string }
  | { kind: "unavailable"; error: BackupsApiErrorKind; id: string };

type JobActionKind = "cancel" | "queue" | "verify";
type RestoreActionKind = "authorize" | "cancel" | "dry-run";

type JobAction = {
  kind: JobActionKind;
  job: BackupJobProjectionSchema;
};

type RestoreAction = {
  kind: RestoreActionKind;
  restore: RestoreRequestProjectionSchema;
};

type MutationKeyEntry = {
  fingerprint: string;
  key: IdempotencyKey;
};

type RetryKey = "dashboard" | "jobs" | "restores" | "job-detail" | "artifacts" | "restore-detail";

type ReloadKey = "dashboard" | "jobs" | "restores";

const EMPTY_RETRY_COUNTS: Record<RetryKey, number> = {
  artifacts: 0,
  dashboard: 0,
  "job-detail": 0,
  jobs: 0,
  "restore-detail": 0,
  restores: 0,
};

const EMPTY_RELOAD_COUNTS: Record<ReloadKey, number> = {
  dashboard: 0,
  jobs: 0,
  restores: 0,
};

const MAX_REASON_LENGTH = 100;
const MAX_REFERENCE_LENGTH = 255;
const MAX_CONFIRMATION_LENGTH = 100;

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function errorKind(error: unknown): BackupsApiErrorKind {
  return error instanceof BackupsApiError ? error.kind : "unavailable";
}

function isBackupsSection(value: string | null): value is BackupsSectionId {
  return value !== null && BACKUPS_SECTION_IDS.includes(value as BackupsSectionId);
}

function parsePage(value: string | null) {
  const page = Number(value);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100_000) return 1;
  return page;
}

function sectionHref(section: BackupsSectionId, page = 1) {
  const params = new URLSearchParams({ section });
  if (page > 1) params.set("page", String(page));
  return `/portal/backups?${params.toString()}`;
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

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function pageCount(page: { page_size: number; total: number }) {
  return Math.max(1, Math.ceil(page.total / page.page_size));
}

function statusTone(value: string) {
  const normalized = value.trim().toLowerCase();
  if (["failed", "dry_run_failed", "restore_failed", "expired"].includes(normalized)) return "error";
  if (["running", "queued", "requested", "authorized", "dry_run_started", "restore_started"].includes(normalized)) return "warning";
  if (["succeeded", "verified", "completed", "restore_completed", "dry_run_passed", "archive_validated"].includes(normalized)) return "ok";
  return "neutral";
}

function loadMessage(error: BackupsApiErrorKind, subject: string) {
  if (error === "permission") return `This ${subject} section isn’t available for this account.`;
  if (error === "rate_limited") return `Too many requests for ${subject}. Please wait and try again.`;
  return `We couldn’t load ${subject} right now.`;
}

function mutationMessage(error: BackupsApiErrorKind) {
  switch (error) {
    case "conflict":
      return "This item changed before the action completed. Refresh and try again.";
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

function valueLabel(value: string, options: readonly (readonly [string, string])[]) {
  return options.find(([option]) => option === value)?.[1] ?? formatLabel(value);
}

function jobLatestTimestamp(job: BackupJobProjectionSchema) {
  return (
    job.completed_at ??
    job.verified_at ??
    job.failed_at ??
    job.cancelled_at ??
    job.started_at ??
    job.queued_at ??
    job.requested_at
  );
}

function jobStatusLabel(job: BackupJobProjectionSchema) {
  return formatLabel(job.status);
}

function restoreStatusLabel(restore: RestoreRequestProjectionSchema) {
  return formatLabel(restore.status);
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="portal-backups__fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function BackupsPagination({
  label,
  page,
  section,
  total,
}: {
  label: string;
  page: { page: number; page_size: number; total: number };
  section: BackupsSectionId;
  total: number;
}) {
  const pages = pageCount({ page_size: page.page_size, total });
  if (pages <= 1) return null;

  return (
    <Pagination aria-label={`${label} pages`} className="portal-backups__pagination">
      <PaginationContent>
        <PaginationItem>
          {page.page > 1 ? (
            <PaginationPrevious href={sectionHref(section, page.page - 1)} />
          ) : (
            <span aria-hidden="true" className="portal-backups__pagination-placeholder" />
          )}
        </PaginationItem>
        <PaginationItem className="portal-backups__pagination-current">
          <span aria-live="polite">Page {page.page} of {pages}</span>
        </PaginationItem>
        <PaginationItem>
          {page.page < pages ? (
            <PaginationNext href={sectionHref(section, page.page + 1)} />
          ) : (
            <span aria-hidden="true" className="portal-backups__pagination-placeholder" />
          )}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

function BackupsLoadingState({ label }: { label: string }) {
  return (
    <div aria-busy="true" className="portal-backups__state" role="status">
      <span className="sr-only">Loading {label.toLowerCase()}…</span>
      <Skeleton aria-hidden="true" className="portal-backups__skeleton-line portal-backups__skeleton-line--short" />
      <Skeleton aria-hidden="true" className="portal-backups__skeleton-line" />
      <div className="portal-backups__skeleton-grid" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="portal-backups__skeleton-block" key={index} />
        ))}
      </div>
    </div>
  );
}

function BackupsUnavailableState({
  error,
  label,
  onRetry,
}: {
  error: BackupsApiErrorKind;
  label: string;
  onRetry: () => void;
}) {
  return (
    <div className="portal-backups__state portal-backups__state--unavailable" role="status">
      <p>{loadMessage(error, label)}</p>
      <Button onClick={onRetry} type="button" variant="outline">
        <RefreshCw aria-hidden="true" />
        Try again
      </Button>
    </div>
  );
}

function BackupsEmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="portal-empty-state portal-backups__empty" role="status">
      {children}
    </p>
  );
}

type BackupRowAction = {
  destructive?: boolean;
  icon: ReactNode;
  label: string;
  onSelect: () => void;
};

function BackupRowActions({
  actions,
  label,
}: {
  actions: readonly BackupRowAction[];
  label: string;
}) {
  if (actions.length === 0) return null;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`Open actions for ${label}`}
            className="portal-backups__action-trigger"
            size="icon-sm"
            type="button"
            variant="outline"
          />
        }
      >
        <MoreHorizontal aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        aria-label={`${label} actions`}
        className="compass-surface portal-backups__action-menu"
      >
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            onClick={action.onSelect}
            variant={action.destructive ? "destructive" : "default"}
          >
            {action.icon}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BackupOverviewSection({
  canOperate,
  onRequestBackup,
  onRetry,
  state,
}: {
  canOperate: boolean;
  onRequestBackup: () => void;
  onRetry: () => void;
  state: ReadState<BackupDashboardSchema>;
}) {
  return (
    <section aria-labelledby="portal-backups-overview-heading" className="portal-backups__section">
      <header className="portal-backups__section-header">
        <div>
          <h2 id="portal-backups-overview-heading">Overview</h2>
          <p>Review backup coverage and the current restore queue.</p>
        </div>
        {canOperate ? (
          <Button onClick={onRequestBackup} type="button" variant="outline">
            <DatabaseBackup aria-hidden="true" />
            Request backup
          </Button>
        ) : null}
      </header>
      {state.kind === "loading" ? <BackupsLoadingState label="backup overview" /> : null}
      {state.kind === "unavailable" ? (
        <BackupsUnavailableState error={state.error} label="backup overview" onRetry={onRetry} />
      ) : null}
      {state.kind === "ready" ? (
        <div className="portal-backups__overview-grid">
          <section aria-labelledby="portal-backups-summary-heading" className="portal-backups__info-group">
            <div className="portal-backups__info-heading">
              <DatabaseBackup aria-hidden="true" />
              <h3 id="portal-backups-summary-heading">Backups</h3>
            </div>
            <dl className="portal-backups__fact-grid">
              <Fact label="Total jobs" value={state.data.backups.total_jobs} />
              <Fact label="Queued or running" value={state.data.backups.queued_or_running_count} />
              <Fact label="Archives" value={state.data.backups.archive_count} />
              <Fact label="Verified archives" value={state.data.backups.verified_archive_count} />
              <Fact label="Failed" value={state.data.backups.failed_count} />
            </dl>
            {state.data.backups.latest_job ? (
              <div className="portal-backups__latest">
                <h4>Latest job</h4>
                <p>
                  {valueLabel(state.data.backups.latest_job.scope, BACKUP_SCOPE_OPTIONS)} · {jobStatusLabel(state.data.backups.latest_job)}
                </p>
                {jobLatestTimestamp(state.data.backups.latest_job) ? (
                  <time dateTime={jobLatestTimestamp(state.data.backups.latest_job) ?? undefined}>
                    {formatTimestamp(jobLatestTimestamp(state.data.backups.latest_job))}
                  </time>
                ) : null}
              </div>
            ) : null}
          </section>
          <section aria-labelledby="portal-backups-restores-summary-heading" className="portal-backups__info-group">
            <div className="portal-backups__info-heading">
              <ArchiveRestore aria-hidden="true" />
              <h3 id="portal-backups-restores-summary-heading">Restores</h3>
            </div>
            {state.data.restores ? (
              <>
                <dl className="portal-backups__fact-grid">
                  <Fact label="Total requests" value={state.data.restores.total_requests} />
                  <Fact label="Active" value={state.data.restores.active_count} />
                  <Fact label="Completed" value={state.data.restores.completed_count} />
                </dl>
                {state.data.restores.latest_request ? (
                  <div className="portal-backups__latest">
                    <h4>Latest request</h4>
                    <p>
                      {valueLabel(state.data.restores.latest_request.restore_scope, RESTORE_SCOPE_OPTIONS)} · {restoreStatusLabel(state.data.restores.latest_request)}
                    </p>
                    {state.data.restores.latest_request.updated_at ? (
                      <time dateTime={state.data.restores.latest_request.updated_at}>
                        {formatTimestamp(state.data.restores.latest_request.updated_at)}
                      </time>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <BackupsEmptyState>Restore summary isn’t available for this account.</BackupsEmptyState>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}

function BackupJobDetails({
  artifacts,
  detail,
  jobId,
  onRetryArtifacts,
  onRetryDetail,
}: {
  artifacts: DetailState<BackupArtifactPageSchema>;
  detail: DetailState<BackupJobProjectionSchema>;
  jobId: string;
  onRetryArtifacts: () => void;
  onRetryDetail: () => void;
}) {
  if (detail.kind === "loading" || detail.kind === "idle") {
    return <BackupsLoadingState label="backup job details" />;
  }
  if ((detail.kind === "ready" || detail.kind === "unavailable") && detail.id !== jobId) {
    return <BackupsLoadingState label="backup job details" />;
  }
  if (detail.kind === "unavailable") {
    return <BackupsUnavailableState error={detail.error} label="backup job details" onRetry={onRetryDetail} />;
  }
  if (detail.kind !== "ready") {
    return <BackupsLoadingState label="backup job details" />;
  }

  return (
    <div className="portal-backups__details">
      <dl className="portal-backups__fact-grid">
        <Fact label="Environment" value={detail.data.environment} />
        <Fact label="Retention" value={formatLabel(detail.data.retention_class)} />
        <Fact label="Storage" value={formatLabel(detail.data.storage_target_type)} />
        <Fact label="Size" value={formatBytes(detail.data.total_size_bytes)} />
        <Fact label="Artifacts" value={detail.data.artifact_count} />
        <Fact label="Encrypted at rest" value={detail.data.encrypted_at_rest ? "Yes" : "No"} />
        {detail.data.expires_at ? (
          <Fact label="Expires" value={<time dateTime={detail.data.expires_at}>{formatTimestamp(detail.data.expires_at)}</time>} />
        ) : null}
      </dl>
      <div className="portal-backups__detail-group">
        <h4>Included content</h4>
        <ul className="portal-backups__check-list">
          <li><span data-state={detail.data.includes_database ? "on" : "off"} />Database</li>
          <li><span data-state={detail.data.includes_media ? "on" : "off"} />Media</li>
          <li><span data-state={detail.data.includes_protected_files ? "on" : "off"} />Protected files</li>
          <li><span data-state={detail.data.includes_manifest ? "on" : "off"} />Manifest</li>
        </ul>
      </div>
      <div className="portal-backups__detail-group">
        <h4>Artifacts</h4>
        {artifacts.kind === "idle" || artifacts.kind === "loading" || artifacts.id !== jobId ? <BackupsLoadingState label="backup artifacts" /> : null}
        {artifacts.kind === "unavailable" && artifacts.id === jobId ? (
          <BackupsUnavailableState error={artifacts.error} label="backup artifacts" onRetry={onRetryArtifacts} />
        ) : null}
        {artifacts.kind === "ready" && artifacts.id === jobId ? (
          artifacts.data.items.length > 0 ? (
            <ul className="portal-backups__artifact-list">
              {artifacts.data.items.map((artifact) => (
                <li key={artifact.id}>
                  <span>{formatLabel(artifact.artifact_type)}</span>
                  <span>{formatLabel(artifact.encryption_status)}</span>
                  <span>{formatBytes(artifact.size_bytes)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <BackupsEmptyState>No artifacts to show.</BackupsEmptyState>
          )
        ) : null}
      </div>
    </div>
  );
}

function BackupJobsSection({
  artifacts,
  canOperate,
  canRestore,
  detail,
  onAction,
  onExpand,
  onRequestBackup,
  onRequestRestore,
  onRetry,
  onRetryArtifacts,
  onRetryDetail,
  page,
  expandedId,
}: {
  artifacts: DetailState<BackupArtifactPageSchema>;
  canOperate: boolean;
  canRestore: boolean;
  detail: DetailState<BackupJobProjectionSchema>;
  onAction: (kind: JobActionKind, job: BackupJobProjectionSchema) => void;
  onExpand: (job: BackupJobProjectionSchema) => void;
  onRequestBackup: () => void;
  onRequestRestore: (job: BackupJobProjectionSchema) => void;
  onRetry: () => void;
  onRetryArtifacts: () => void;
  onRetryDetail: () => void;
  page: ReadState<BackupJobPageSchema>;
  expandedId: string | null;
}) {
  return (
    <section aria-labelledby="portal-backups-jobs-heading" className="portal-backups__section">
      <header className="portal-backups__section-header">
        <div>
          <h2 id="portal-backups-jobs-heading">Backup jobs</h2>
          <p>Review archive jobs and take only the lifecycle actions currently allowed.</p>
        </div>
        {canOperate ? (
          <Button onClick={onRequestBackup} type="button" variant="outline">
            <DatabaseBackup aria-hidden="true" />
            Request backup
          </Button>
        ) : null}
      </header>
      {page.kind === "loading" ? <BackupsLoadingState label="backup jobs" /> : null}
      {page.kind === "unavailable" ? <BackupsUnavailableState error={page.error} label="backup jobs" onRetry={onRetry} /> : null}
      {page.kind === "ready" ? (
        page.data.items.length > 0 ? (
          <>
            <div className="portal-backups__table-wrap">
              <Table className="portal-backups__table portal-backups__table--jobs">
                <TableCaption className="sr-only">Backup jobs</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scope</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead>Latest activity</TableHead>
                    <TableHead>Size &amp; artifacts</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {page.data.items.map((job) => {
                    const expanded = expandedId === job.id;
                    const latest = jobLatestTimestamp(job);
                    const canQueue = canOperate && job.status === "requested";
                    const canVerify = job.status === "succeeded";
                    const canCancel = canOperate && ["requested", "queued", "running"].includes(job.status);
                    const canRequestRestore = canRestore && ["succeeded", "verified"].includes(job.status);
                    const actions: BackupRowAction[] = [];

                    if (canQueue) {
                      actions.push({
                        icon: <Upload aria-hidden="true" />,
                        label: "Queue",
                        onSelect: () => onAction("queue", job),
                      });
                    }
                    if (canVerify) {
                      actions.push({
                        icon: <ShieldCheck aria-hidden="true" />,
                        label: "Verify",
                        onSelect: () => onAction("verify", job),
                      });
                    }
                    if (canCancel) {
                      actions.push({
                        destructive: true,
                        icon: <XCircle aria-hidden="true" />,
                        label: "Cancel",
                        onSelect: () => onAction("cancel", job),
                      });
                    }
                    if (canRequestRestore) {
                      actions.push({
                        icon: <ArchiveRestore aria-hidden="true" />,
                        label: "Request restore",
                        onSelect: () => onRequestRestore(job),
                      });
                    }

                    return (
                      <Fragment key={job.id}>
                        <TableRow aria-expanded={expanded}>
                          <TableCell className="portal-backups__table-cell portal-backups__table-cell--primary" data-label="Scope">
                            {valueLabel(job.scope, BACKUP_SCOPE_OPTIONS)}
                          </TableCell>
                          <TableCell className="portal-backups__table-cell portal-backups__table-cell--status" data-label="Status">
                            <Badge data-tone={statusTone(job.status)} variant="outline">
                              {jobStatusLabel(job)}
                            </Badge>
                          </TableCell>
                          <TableCell className="portal-backups__table-cell" data-label="Environment">
                            {job.environment}
                          </TableCell>
                          <TableCell className="portal-backups__table-cell" data-label="Latest activity">
                            {latest ? <time dateTime={latest}>{formatTimestamp(latest)}</time> : "Not recorded"}
                          </TableCell>
                          <TableCell className="portal-backups__table-cell" data-label="Size & artifacts">
                            <span className="portal-backups__table-stack">
                              <span>{formatBytes(job.total_size_bytes)}</span>
                              <span>{job.artifact_count} {job.artifact_count === 1 ? "artifact" : "artifacts"}</span>
                            </span>
                          </TableCell>
                          <TableCell className="portal-backups__table-cell portal-backups__table-cell--action" data-label="Actions">
                            <Button
                              aria-controls={`portal-backup-job-details-${job.id}`}
                              aria-expanded={expanded}
                              aria-label={`${expanded ? "Hide" : "Show"} details for ${valueLabel(job.scope, BACKUP_SCOPE_OPTIONS)} backup`}
                              className="portal-backups__details-trigger"
                              onClick={() => onExpand(job)}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <ChevronDown aria-hidden="true" className="portal-backups__chevron" />
                              <span>{expanded ? "Hide" : "Details"}</span>
                            </Button>
                            <BackupRowActions actions={actions} label={`${valueLabel(job.scope, BACKUP_SCOPE_OPTIONS)} backup`} />
                          </TableCell>
                        </TableRow>
                        {expanded ? (
                          <TableRow className="portal-backups__detail-row">
                            <TableCell colSpan={6}>
                              <div className="portal-backups__row-details" id={`portal-backup-job-details-${job.id}`}>
                                <BackupJobDetails
                                  artifacts={artifacts}
                                  detail={detail}
                                  jobId={job.id}
                                  onRetryArtifacts={onRetryArtifacts}
                                  onRetryDetail={onRetryDetail}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <BackupsPagination
              label="Backup jobs"
              page={page.data}
              section="jobs"
              total={page.data.total}
            />
          </>
        ) : (
          <BackupsEmptyState>No backup jobs to show.</BackupsEmptyState>
        )
      ) : null}
    </section>
  );
}

function RestoreDetails({ restore }: { restore: RestoreRequestProjectionSchema }) {
  return (
    <div className="portal-backups__details">
      <dl className="portal-backups__fact-grid">
        <Fact label="Restore scope" value={valueLabel(restore.restore_scope, RESTORE_SCOPE_OPTIONS)} />
        <Fact label="Reason" value={formatLabel(restore.safe_reason_code)} />
        {restore.institutional_authorization_type ? (
          <Fact label="Authorization" value={formatLabel(restore.institutional_authorization_type)} />
        ) : null}
        {restore.dry_run_result_code ? <Fact label="Dry run" value={formatLabel(restore.dry_run_result_code)} /> : null}
        {restore.created_at ? <Fact label="Created" value={<time dateTime={restore.created_at}>{formatTimestamp(restore.created_at)}</time>} /> : null}
        {restore.updated_at ? <Fact label="Updated" value={<time dateTime={restore.updated_at}>{formatTimestamp(restore.updated_at)}</time>} /> : null}
      </dl>
      <div className="portal-backups__detail-group">
        <h4>Checklist</h4>
        {restore.checklist.length > 0 ? (
          <ul className="portal-backups__checklist">
            {restore.checklist.map((item) => (
              <li key={item.id}>
                <span className="portal-backups__status" data-tone={statusTone(item.status)}>{formatLabel(item.status)}</span>
                <span>{formatLabel(item.step_key)}</span>
                {item.safe_message_code ? <span>{formatLabel(item.safe_message_code)}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <BackupsEmptyState>No checklist items recorded.</BackupsEmptyState>
        )}
      </div>
    </div>
  );
}

function BackupRestoresSection({
  canOperate,
  detail,
  expandedId,
  onAction,
  onExpand,
  onRequestRestore,
  onRetry,
  onRetryDetail,
  page,
}: {
  canOperate: boolean;
  detail: DetailState<RestoreRequestProjectionSchema>;
  expandedId: string | null;
  onAction: (kind: RestoreActionKind, restore: RestoreRequestProjectionSchema) => void;
  onExpand: (restore: RestoreRequestProjectionSchema) => void;
  onRequestRestore: () => void;
  onRetry: () => void;
  onRetryDetail: () => void;
  page: ReadState<RestoreRequestPageSchema>;
}) {
  return (
    <section aria-labelledby="portal-backups-restores-heading" className="portal-backups__section">
      <header className="portal-backups__section-header">
        <div>
          <h2 id="portal-backups-restores-heading">Restore requests</h2>
          <p>Review restore requests, authorization, and dry-run readiness.</p>
        </div>
        {canOperate ? (
          <Button onClick={onRequestRestore} type="button" variant="outline">
            <ArchiveRestore aria-hidden="true" />
            Request restore
          </Button>
        ) : null}
      </header>
      {page.kind === "loading" ? <BackupsLoadingState label="restore requests" /> : null}
      {page.kind === "unavailable" ? <BackupsUnavailableState error={page.error} label="restore requests" onRetry={onRetry} /> : null}
      {page.kind === "ready" ? (
        page.data.items.length > 0 ? (
          <>
            <div className="portal-backups__table-wrap">
              <Table className="portal-backups__table portal-backups__table--restores">
                <TableCaption className="sr-only">Restore requests</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restore scope</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Authorization</TableHead>
                    <TableHead>Dry run</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {page.data.items.map((restore) => {
                    const expanded = expandedId === restore.id;
                    const canAuthorize = canOperate && restore.status === "requested";
                    const canDryRun = canOperate && ["requested", "authorized"].includes(restore.status);
                    const canCancel = canOperate && !["restore_completed", "restore_failed", "cancelled"].includes(restore.status);
                    const timestamp = restore.updated_at ?? restore.created_at;
                    const restoreDetailReady = detail.kind === "ready" && detail.id === restore.id;
                    const restoreDetailUnavailable = detail.kind === "unavailable" && detail.id === restore.id;
                    const actions: BackupRowAction[] = [];

                    if (canAuthorize) {
                      actions.push({
                        icon: <ShieldCheck aria-hidden="true" />,
                        label: "Record authorization",
                        onSelect: () => onAction("authorize", restore),
                      });
                    }
                    if (canDryRun) {
                      actions.push({
                        icon: <FileCheck2 aria-hidden="true" />,
                        label: "Run dry-run",
                        onSelect: () => onAction("dry-run", restore),
                      });
                    }
                    if (canCancel) {
                      actions.push({
                        destructive: true,
                        icon: <XCircle aria-hidden="true" />,
                        label: "Cancel restore",
                        onSelect: () => onAction("cancel", restore),
                      });
                    }

                    return (
                      <Fragment key={restore.id}>
                        <TableRow aria-expanded={expanded}>
                          <TableCell className="portal-backups__table-cell portal-backups__table-cell--primary" data-label="Restore scope">
                            {valueLabel(restore.restore_scope, RESTORE_SCOPE_OPTIONS)}
                          </TableCell>
                          <TableCell className="portal-backups__table-cell portal-backups__table-cell--status" data-label="Status">
                            <Badge data-tone={statusTone(restore.status)} variant="outline">
                              {restoreStatusLabel(restore)}
                            </Badge>
                          </TableCell>
                          <TableCell className="portal-backups__table-cell" data-label="Authorization">
                            {restore.institutional_authorization_type ? "Recorded" : "Not recorded"}
                          </TableCell>
                          <TableCell className="portal-backups__table-cell" data-label="Dry run">
                            {restore.dry_run_result_code ? formatLabel(restore.dry_run_result_code) : "Not run"}
                          </TableCell>
                          <TableCell className="portal-backups__table-cell" data-label="Updated">
                            {timestamp ? <time dateTime={timestamp}>{formatTimestamp(timestamp)}</time> : "Not recorded"}
                          </TableCell>
                          <TableCell className="portal-backups__table-cell portal-backups__table-cell--action" data-label="Actions">
                            <Button
                              aria-controls={`portal-backup-restore-details-${restore.id}`}
                              aria-expanded={expanded}
                              aria-label={`${expanded ? "Hide" : "Show"} details for ${valueLabel(restore.restore_scope, RESTORE_SCOPE_OPTIONS)} restore`}
                              className="portal-backups__details-trigger"
                              onClick={() => onExpand(restore)}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <ChevronDown aria-hidden="true" className="portal-backups__chevron" />
                              <span>{expanded ? "Hide" : "Details"}</span>
                            </Button>
                            <BackupRowActions actions={actions} label={`${valueLabel(restore.restore_scope, RESTORE_SCOPE_OPTIONS)} restore`} />
                          </TableCell>
                        </TableRow>
                        {expanded ? (
                          <TableRow className="portal-backups__detail-row">
                            <TableCell colSpan={6}>
                              <div className="portal-backups__row-details" id={`portal-backup-restore-details-${restore.id}`}>
                                {!restoreDetailReady && !restoreDetailUnavailable ? <BackupsLoadingState label="restore details" /> : null}
                                {restoreDetailUnavailable ? <BackupsUnavailableState error={detail.error} label="restore details" onRetry={onRetryDetail} /> : null}
                                {restoreDetailReady ? <RestoreDetails restore={detail.data} /> : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <BackupsPagination
              label="Restore requests"
              page={page.data}
              section="restores"
              total={page.data.total}
            />
          </>
        ) : (
          <BackupsEmptyState>No restore requests to show.</BackupsEmptyState>
        )
      ) : null}
    </section>
  );
}

function BackupsNavSkeleton() {
  return (
    <div aria-hidden="true" className="compass-surface portal-workspace-nav portal-backups__nav-skeleton" data-tone="subtle">
      <div className="portal-workspace-nav__skeleton-list">
        {BACKUPS_NAV_ITEMS.map((item) => (
          <Skeleton className="portal-backups__skeleton-tab" key={item.value} />
        ))}
      </div>
    </div>
  );
}

function BackupsFrameSkeleton() {
  return (
    <PortalCollectionFrame aria-hidden="true" as="div" className="portal-backups__frame portal-backups__frame--loading">
      <Skeleton className="portal-backups__skeleton-line portal-backups__skeleton-line--short" />
      <Skeleton className="portal-backups__skeleton-line portal-backups__skeleton-line--heading" />
      <Skeleton className="portal-backups__skeleton-line portal-backups__skeleton-line--long" />
      <div className="portal-backups__skeleton-grid">
        {Array.from({ length: 4 }, (_, index) => <Skeleton className="portal-backups__skeleton-block" key={index} />)}
      </div>
    </PortalCollectionFrame>
  );
}

export function PortalBackupsLoading() {
  return (
    <section aria-busy="true" aria-labelledby="portal-backups-loading-heading" className="portal-backups portal-backups--loading" role="status">
      <span className="sr-only">Loading backups and restore…</span>
      <PortalPageHeader
        current="Backups & restore"
        description="Review backup jobs, restore requests, and the safeguards around recovery work."
        headingId="portal-backups-loading-heading"
        title="Backups & restore"
      />
      <div className="portal-backups__workspace">
        <BackupsNavSkeleton />
        <BackupsFrameSkeleton />
      </div>
    </section>
  );
}

function BackupsAccessState({
  kind,
  onRetry,
}: {
  kind: "forbidden" | "unavailable";
  onRetry?: () => void;
}) {
  return (
    <section aria-labelledby="portal-backups-access-heading" className="portal-backups portal-backups--state" role={kind === "unavailable" ? "alert" : undefined}>
      <PortalPageHeader
        current="Backups & restore"
        description="Review backup jobs, restore requests, and the safeguards around recovery work."
        headingId="portal-backups-heading"
        title="Backups & restore"
      />
      <PortalCollectionFrame as="div" className="portal-backups__frame portal-backups__frame--state">
        <CircleAlert aria-hidden="true" className="portal-backups__state-icon" />
        <h2 id="portal-backups-access-heading">
          {kind === "forbidden" ? "This page isn’t available for this account." : "Backups & restore isn’t available right now."}
        </h2>
        <p>{kind === "forbidden" ? "Return to your workspace to continue." : "Try again when the connection is ready."}</p>
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

export function PortalBackupsPage() {
  const { hasCapability, refreshAccess, status } = usePortalAccess();

  if (status === "loading") return <PortalBackupsLoading />;
  if (status === "unavailable") {
    return <BackupsAccessState kind="unavailable" onRetry={() => void refreshAccess()} />;
  }
  if (!hasCapability(PORTAL_CAPABILITIES.backupsView)) {
    return <BackupsAccessState kind="forbidden" />;
  }

  return <BackupsWorkspace />;
}

function BackupsWorkspace() {
  const searchParams = useSearchParams();
  const requestedSection = searchParams.get("section");
  const activeSection: BackupsSectionId = isBackupsSection(requestedSection) ? requestedSection : "overview";
  const activePage = parsePage(searchParams.get("page"));
  const { hasCapability } = usePortalAccess();
  const canOperate = hasCapability(PORTAL_CAPABILITIES.backupsOperate);
  const canRestore = hasCapability(PORTAL_CAPABILITIES.restoresOperate);

  const [retryCounts, setRetryCounts] = useState(EMPTY_RETRY_COUNTS);
  const [reloadCounts, setReloadCounts] = useState(EMPTY_RELOAD_COUNTS);
  const [dashboardState, setDashboardState] = useState<ReadState<BackupDashboardSchema>>({ kind: "loading" });
  const [jobsState, setJobsState] = useState<ReadState<BackupJobPageSchema>>({ kind: "loading" });
  const [restoresState, setRestoresState] = useState<ReadState<RestoreRequestPageSchema>>({ kind: "loading" });
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [expandedRestoreId, setExpandedRestoreId] = useState<string | null>(null);
  const [jobDetailState, setJobDetailState] = useState<DetailState<BackupJobProjectionSchema>>({ kind: "idle" });
  const [artifactState, setArtifactState] = useState<DetailState<BackupArtifactPageSchema>>({ kind: "idle" });
  const [restoreDetailState, setRestoreDetailState] = useState<DetailState<RestoreRequestProjectionSchema>>({ kind: "idle" });
  const [notice, setNotice] = useState<string | null>(null);
  const mutationKeysRef = useRef(new Map<string, MutationKeyEntry>());
  const [jobAction, setJobAction] = useState<JobAction | null>(null);
  const [jobMutation, setJobMutation] = useState<"pending" | "error" | null>(null);
  const [jobMutationMessage, setJobMutationMessage] = useState<string | null>(null);
  const [restoreAction, setRestoreAction] = useState<RestoreAction | null>(null);
  const [restoreMutation, setRestoreMutation] = useState<"pending" | "error" | null>(null);
  const [restoreMutationMessage, setRestoreMutationMessage] = useState<string | null>(null);
  const [backupRequestOpen, setBackupRequestOpen] = useState(false);
  const [backupRequestValues, setBackupRequestValues] = useState({ reason: "", scope: "full" });
  const [backupRequestSubmitting, setBackupRequestSubmitting] = useState(false);
  const [backupRequestError, setBackupRequestError] = useState<string | null>(null);
  const [restoreRequestJob, setRestoreRequestJob] = useState<BackupJobProjectionSchema | null>(null);
  const [restoreRequestOpen, setRestoreRequestOpen] = useState(false);
  const [restoreRequestValues, setRestoreRequestValues] = useState({ reason: "", scope: "full" });
  const [restoreRequestSubmitting, setRestoreRequestSubmitting] = useState(false);
  const [restoreRequestError, setRestoreRequestError] = useState<string | null>(null);
  const [authorizationType, setAuthorizationType] = useState<string>(AUTHORIZATION_TYPE_OPTIONS[0][0]);
  const [authorizationReference, setAuthorizationReference] = useState("");
  const [cancelPhrase, setCancelPhrase] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const getMutationKey = (scope: string, fingerprint: string) => {
    const current = mutationKeysRef.current.get(scope);
    if (current?.fingerprint === fingerprint) return current.key;
    const key = createIdempotencyKey();
    mutationKeysRef.current.set(scope, { fingerprint, key });
    return key;
  };

  const discardMutationKey = (scope: string) => {
    mutationKeysRef.current.delete(scope);
  };

  const retry = (key: RetryKey) => {
    setRetryCounts((current) => ({ ...current, [key]: current[key] + 1 }));
  };

  const reload = (keys: readonly ReloadKey[]) => {
    setReloadCounts((current) => {
      const next = { ...current };
      for (const key of keys) next[key] += 1;
      return next;
    });
  };

  const toggleJob = (job: BackupJobProjectionSchema) => {
    if (expandedJobId === job.id) {
      setExpandedJobId(null);
      setJobDetailState({ kind: "idle" });
      setArtifactState({ kind: "idle" });
      return;
    }
    setExpandedJobId(job.id);
    setExpandedRestoreId(null);
    setJobDetailState({ kind: "loading", id: job.id });
    setArtifactState({ kind: "loading", id: job.id });
  };

  const toggleRestore = (restore: RestoreRequestProjectionSchema) => {
    if (expandedRestoreId === restore.id) {
      setExpandedRestoreId(null);
      setRestoreDetailState({ kind: "idle" });
      return;
    }
    setExpandedRestoreId(restore.id);
    setExpandedJobId(null);
    setRestoreDetailState({ kind: "loading", id: restore.id });
  };

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!active) return;
        setDashboardState({ kind: "loading" });
        return getBackupsDashboard(controller.signal);
      })
      .then((data) => {
        if (active && data) setDashboardState({ kind: "ready", data });
      })
      .catch((error: unknown) => {
        if (active && !isAbortError(error)) setDashboardState({ kind: "unavailable", error: errorKind(error) });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadCounts.dashboard, retryCounts.dashboard]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!active) return;
        setJobsState({ kind: "loading" });
        return getBackupJobs(activeSection === "jobs" ? activePage : 1, controller.signal);
      })
      .then((data) => {
        if (active && data) setJobsState({ kind: "ready", data });
      })
      .catch((error: unknown) => {
        if (active && !isAbortError(error)) setJobsState({ kind: "unavailable", error: errorKind(error) });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [activePage, activeSection, reloadCounts.jobs, retryCounts.jobs]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!active) return;
        setRestoresState({ kind: "loading" });
        return getBackupRestores(activeSection === "restores" ? activePage : 1, controller.signal);
      })
      .then((data) => {
        if (active && data) setRestoresState({ kind: "ready", data });
      })
      .catch((error: unknown) => {
        if (active && !isAbortError(error)) setRestoresState({ kind: "unavailable", error: errorKind(error) });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [activePage, activeSection, reloadCounts.restores, retryCounts.restores]);

  const jobDetailRetry = retryCounts["job-detail"];
  const artifactsRetry = retryCounts.artifacts;
  const restoreDetailRetry = retryCounts["restore-detail"];

  useEffect(() => {
    if (!expandedJobId) return;
    const jobId = expandedJobId;
    const controller = new AbortController();
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!active) return;
        setJobDetailState({ kind: "loading", id: jobId });
        return getBackupJobDetail(jobId, controller.signal);
      })
      .then((data) => {
        if (active && data) setJobDetailState({ kind: "ready", data, id: jobId });
      })
      .catch((error: unknown) => {
        if (active && !isAbortError(error)) setJobDetailState({ kind: "unavailable", error: errorKind(error), id: jobId });
      });
    void Promise.resolve()
      .then(() => {
        if (!active) return;
        setArtifactState({ kind: "loading", id: jobId });
        return getBackupArtifacts(jobId, 1, controller.signal);
      })
      .then((data) => {
        if (active && data) setArtifactState({ kind: "ready", data, id: jobId });
      })
      .catch((error: unknown) => {
        if (active && !isAbortError(error)) setArtifactState({ kind: "unavailable", error: errorKind(error), id: jobId });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [expandedJobId, artifactsRetry, jobDetailRetry]);

  useEffect(() => {
    if (!expandedRestoreId) return;
    const restoreId = expandedRestoreId;
    const controller = new AbortController();
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!active) return;
        setRestoreDetailState({ kind: "loading", id: restoreId });
        return getBackupRestoreDetail(restoreId, controller.signal);
      })
      .then((data) => {
        if (active && data) setRestoreDetailState({ kind: "ready", data, id: restoreId });
      })
      .catch((error: unknown) => {
        if (active && !isAbortError(error)) setRestoreDetailState({ kind: "unavailable", error: errorKind(error), id: restoreId });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [expandedRestoreId, restoreDetailRetry]);

  const openJobAction = (kind: JobActionKind, job: BackupJobProjectionSchema) => {
    setJobAction({ kind, job });
    setJobMutation(null);
    setJobMutationMessage(null);
  };

  const handleJobAction = async () => {
    const action = jobAction;
    if (!action) return;
    const scope = `backup-job:${action.kind}:${action.job.id}`;
    const fingerprint = JSON.stringify({ expectedUpdatedAt: action.job.resource_version });
    const key = getMutationKey(scope, fingerprint);
    setJobMutation("pending");
    setJobMutationMessage(null);
    try {
      if (action.kind === "queue") await queueBackup(action.job.id, action.job.resource_version, key);
      if (action.kind === "verify") await verifyBackup(action.job.id, action.job.resource_version, key);
      if (action.kind === "cancel") await cancelBackup(action.job.id, action.job.resource_version, key);
    } catch (error: unknown) {
      const kind = errorKind(error);
      setJobMutation("error");
      setJobMutationMessage(mutationMessage(kind));
      if (kind === "conflict") {
        discardMutationKey(scope);
        setJobAction(null);
        reload(["dashboard", "jobs"]);
        setNotice("The backup job changed, so the list was refreshed. Try the action again if it is still available.");
      }
      return;
    }
    discardMutationKey(scope);
    setJobAction(null);
    setJobMutation(null);
    setNotice(`The backup job was ${action.kind === "queue" ? "queued" : action.kind === "verify" ? "verified" : "cancelled"}.`);
    reload(["dashboard", "jobs"]);
  };

  const openRestoreAction = (kind: RestoreActionKind, restore: RestoreRequestProjectionSchema) => {
    setRestoreAction({ kind, restore });
    setRestoreMutation(null);
    setRestoreMutationMessage(null);
    setAuthorizationType(AUTHORIZATION_TYPE_OPTIONS[0][0]);
    setAuthorizationReference("");
    setCancelPhrase("");
    setCancelReason("");
  };

  const handleRestoreAction = async () => {
    const action = restoreAction;
    if (!action) return;
    const reference = authorizationReference.trim();
    const reason = cancelReason.trim();
    if (action.kind === "authorize" && (!reference || reference.length > MAX_REFERENCE_LENGTH)) {
      setRestoreMutation("error");
      setRestoreMutationMessage(`Enter an authorization reference of ${MAX_REFERENCE_LENGTH} characters or fewer.`);
      return;
    }
    if (action.kind === "cancel" && cancelPhrase !== "CANCEL RESTORE") {
      setRestoreMutation("error");
      setRestoreMutationMessage("Enter CANCEL RESTORE exactly to confirm this cancellation.");
      return;
    }
    if (action.kind === "cancel" && (!reason || reason.length > MAX_REASON_LENGTH)) {
      setRestoreMutation("error");
      setRestoreMutationMessage(`Enter a reason of ${MAX_REASON_LENGTH} characters or fewer.`);
      return;
    }
    const scope = `restore:${action.kind}:${action.restore.id}`;
    const fingerprint = JSON.stringify({
      authorizationReference: reference,
      authorizationType,
      cancelPhrase,
      cancelReason: reason,
      expectedUpdatedAt: action.restore.updated_at,
    });
    const key = getMutationKey(scope, fingerprint);
    setRestoreMutation("pending");
    setRestoreMutationMessage(null);
    try {
      if (action.kind === "authorize") {
        const payload: RestoreAuthorizationSchema = {
          authorization_reference: reference,
          authorization_type: authorizationType,
          expected_updated_at: action.restore.updated_at ?? null,
        };
        await authorizeBackupRestore(action.restore.id, payload, key);
      }
      if (action.kind === "dry-run") {
        await dryRunBackupRestore(action.restore.id, { expected_updated_at: action.restore.updated_at ?? null }, key);
      }
      if (action.kind === "cancel") {
        const payload: RestoreTransitionSchema = {
          confirmation_phrase: cancelPhrase,
          expected_updated_at: action.restore.updated_at ?? null,
          reason,
        };
        await cancelBackupRestore(action.restore.id, payload, key);
      }
    } catch (error: unknown) {
      const kind = errorKind(error);
      setRestoreMutation("error");
      setRestoreMutationMessage(mutationMessage(kind));
      if (kind === "conflict") {
        discardMutationKey(scope);
        setRestoreAction(null);
        reload(["dashboard", "restores"]);
        setNotice("The restore request changed, so the list was refreshed. Try the action again if it is still available.");
      }
      return;
    }
    discardMutationKey(scope);
    setRestoreAction(null);
    setRestoreMutation(null);
    setNotice(`The restore request was ${action.kind === "authorize" ? "authorized" : action.kind === "dry-run" ? "checked with a dry-run" : "cancelled"}.`);
    reload(["dashboard", "restores"]);
  };

  const submitBackupRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reason = backupRequestValues.reason.trim();
    if (reason.length > MAX_REASON_LENGTH) {
      setBackupRequestError(`Use ${MAX_REASON_LENGTH} characters or fewer for the reason.`);
      return;
    }
    const payload = {
      scope: backupRequestValues.scope,
      ...(reason ? { reason } : {}),
    };
    const scope = "backup-request";
    const fingerprint = JSON.stringify(payload);
    const key = getMutationKey(scope, fingerprint);
    setBackupRequestSubmitting(true);
    setBackupRequestError(null);
    try {
      await requestBackup(payload, key);
    } catch (error: unknown) {
      setBackupRequestError(mutationMessage(errorKind(error)));
      setBackupRequestSubmitting(false);
      return;
    }
    discardMutationKey(scope);
    setBackupRequestSubmitting(false);
    setBackupRequestOpen(false);
    setBackupRequestValues({ reason: "", scope: "full" });
    setNotice("The backup job was requested.");
    reload(["dashboard", "jobs"]);
  };

  const submitRestoreRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const source = restoreRequestJob;
    const reason = restoreRequestValues.reason.trim();
    if (!source) {
      setRestoreRequestError("Choose a succeeded or verified backup first.");
      return;
    }
    if (!reason || reason.length > MAX_REASON_LENGTH) {
      setRestoreRequestError(`Enter a reason of ${MAX_REASON_LENGTH} characters or fewer.`);
      return;
    }
    const payload = {
      backup_job_id: source.id,
      reason,
      restore_scope: restoreRequestValues.scope,
    };
    const scope = "restore-request";
    const fingerprint = JSON.stringify(payload);
    const key = getMutationKey(scope, fingerprint);
    setRestoreRequestSubmitting(true);
    setRestoreRequestError(null);
    try {
      await requestRestore(payload, key);
    } catch (error: unknown) {
      setRestoreRequestError(mutationMessage(errorKind(error)));
      setRestoreRequestSubmitting(false);
      return;
    }
    discardMutationKey(scope);
    setRestoreRequestSubmitting(false);
    setRestoreRequestOpen(false);
    setRestoreRequestJob(null);
    setRestoreRequestValues({ reason: "", scope: "full" });
    setNotice("The restore request was submitted.");
    reload(["dashboard", "restores"]);
  };

  const openBackupRequest = () => {
    setBackupRequestError(null);
    setBackupRequestOpen(true);
  };

  const openRestoreRequest = (job?: BackupJobProjectionSchema) => {
    const eligible = job ?? (jobsState.kind === "ready" ? jobsState.data.items.find((item) => ["succeeded", "verified"].includes(item.status)) : undefined);
    setRestoreRequestJob(eligible ?? null);
    setRestoreRequestError(eligible ? null : "No succeeded or verified backup is available on the loaded page.");
    setRestoreRequestValues({ reason: "", scope: "full" });
    setRestoreRequestOpen(true);
  };

  const closeJobAction = (open: boolean) => {
    if (!open && jobMutation !== "pending") {
      if (jobAction) discardMutationKey(`backup-job:${jobAction.kind}:${jobAction.job.id}`);
      setJobAction(null);
    }
  };

  const closeRestoreAction = (open: boolean) => {
    if (!open && restoreMutation !== "pending") {
      if (restoreAction) discardMutationKey(`restore:${restoreAction.kind}:${restoreAction.restore.id}`);
      setRestoreAction(null);
    }
  };

  const closeBackupRequest = (open: boolean) => {
    if (!open && !backupRequestSubmitting) {
      discardMutationKey("backup-request");
      setBackupRequestOpen(false);
    }
  };

  const closeRestoreRequest = (open: boolean) => {
    if (!open && !restoreRequestSubmitting) {
      discardMutationKey("restore-request");
      setRestoreRequestOpen(false);
      setRestoreRequestJob(null);
    }
  };

  const navItems = BACKUPS_NAV_ITEMS.map((item) => ({ ...item, href: sectionHref(item.value, 1) }));

  const renderActiveSection = () => {
    if (activeSection === "jobs") {
      return (
        <BackupJobsSection
          artifacts={artifactState}
          canOperate={canOperate}
          canRestore={canRestore}
          detail={jobDetailState}
          expandedId={expandedJobId}
          onAction={openJobAction}
          onExpand={toggleJob}
          onRequestBackup={openBackupRequest}
          onRequestRestore={openRestoreRequest}
          onRetry={() => retry("jobs")}
          onRetryArtifacts={() => retry("artifacts")}
          onRetryDetail={() => retry("job-detail")}
          page={jobsState}
        />
      );
    }
    if (activeSection === "restores") {
      return (
        <BackupRestoresSection
          canOperate={canRestore}
          detail={restoreDetailState}
          expandedId={expandedRestoreId}
          onAction={openRestoreAction}
          onExpand={toggleRestore}
          onRequestRestore={() => openRestoreRequest()}
          onRetry={() => retry("restores")}
          onRetryDetail={() => retry("restore-detail")}
          page={restoresState}
        />
      );
    }
    return (
      <BackupOverviewSection
        canOperate={canOperate}
        onRequestBackup={openBackupRequest}
        onRetry={() => retry("dashboard")}
        state={dashboardState}
      />
    );
  };

  return (
    <section aria-labelledby="portal-backups-heading" className="portal-backups">
      <PortalPageHeader
        current="Backups & restore"
        description="Review backup jobs, restore requests, and the safeguards around recovery work."
        headingId="portal-backups-heading"
        title="Backups & restore"
      />
      <div className="portal-backups__workspace">
        <PortalWorkspaceNav
          activeValue={activeSection}
          ariaLabel="Backups and restore sections"
          items={navItems}
        />
        <PortalCollectionFrame
          aria-busy={jobMutation === "pending" || restoreMutation === "pending" || backupRequestSubmitting || restoreRequestSubmitting}
          as="div"
          className="portal-backups__frame"
        >
          {notice ? <p aria-live="polite" className="portal-backups__notice" role="status">{notice}</p> : null}
          {renderActiveSection()}
        </PortalCollectionFrame>
      </div>

      <AlertDialog onOpenChange={closeJobAction} open={jobAction !== null}>
        <AlertDialogContent className="compass-surface portal-backups__dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {jobAction?.kind === "queue" ? "Queue this backup job?" : jobAction?.kind === "verify" ? "Verify this backup job?" : "Cancel this backup job?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {jobAction?.kind === "queue" ? "The requested job will be placed in the backup queue." : jobAction?.kind === "verify" ? "The succeeded archive will be checked using the existing verification workflow." : "The selected backup job will be cancelled if its current state still allows it."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {jobMutationMessage ? <p className="portal-backups__dialog-error" role="alert">{jobMutationMessage}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={jobMutation === "pending"}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={jobMutation === "pending"} onClick={() => void handleJobAction()}>
              {jobMutation === "pending" ? "Updating…" : "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog onOpenChange={closeRestoreAction} open={restoreAction !== null}>
        <AlertDialogContent className="compass-surface portal-backups__dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {restoreAction?.kind === "authorize" ? "Record restore authorization?" : restoreAction?.kind === "dry-run" ? "Run a restore dry-run?" : "Cancel this restore request?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {restoreAction?.kind === "authorize" ? "Record the supported institutional authorization for this restore request." : restoreAction?.kind === "dry-run" ? "Run the backend dry-run checks without starting a restore." : "Cancellation is irreversible for this restore request and requires an exact confirmation phrase."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {restoreAction?.kind === "authorize" ? (
            <div className="portal-backups__dialog-form">
              <div className="portal-backups__dialog-field">
                <Label htmlFor="portal-backups-authorization-type">Authorization type</Label>
                <select className="portal-backups__select" id="portal-backups-authorization-type" onChange={(event) => { if (restoreAction) discardMutationKey(`restore:authorize:${restoreAction.restore.id}`); setAuthorizationType(event.target.value); setRestoreMutation(null); setRestoreMutationMessage(null); }} value={authorizationType}>
                  {AUTHORIZATION_TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="portal-backups__dialog-field">
                <Label htmlFor="portal-backups-authorization-reference">Authorization reference</Label>
                <Input id="portal-backups-authorization-reference" maxLength={MAX_REFERENCE_LENGTH} onChange={(event) => { if (restoreAction) discardMutationKey(`restore:authorize:${restoreAction.restore.id}`); setAuthorizationReference(event.target.value); setRestoreMutation(null); setRestoreMutationMessage(null); }} value={authorizationReference} />
              </div>
            </div>
          ) : null}
          {restoreAction?.kind === "cancel" ? (
            <div className="portal-backups__dialog-form">
              <div className="portal-backups__dialog-field">
                <Label htmlFor="portal-backups-cancel-phrase">Type CANCEL RESTORE</Label>
                <Input id="portal-backups-cancel-phrase" maxLength={MAX_CONFIRMATION_LENGTH} onChange={(event) => { if (restoreAction) discardMutationKey(`restore:cancel:${restoreAction.restore.id}`); setCancelPhrase(event.target.value); setRestoreMutation(null); setRestoreMutationMessage(null); }} value={cancelPhrase} />
              </div>
              <div className="portal-backups__dialog-field">
                <Label htmlFor="portal-backups-cancel-reason">Reason</Label>
                <Textarea id="portal-backups-cancel-reason" maxLength={MAX_REASON_LENGTH} onChange={(event) => { if (restoreAction) discardMutationKey(`restore:cancel:${restoreAction.restore.id}`); setCancelReason(event.target.value); setRestoreMutation(null); setRestoreMutationMessage(null); }} value={cancelReason} />
              </div>
            </div>
          ) : null}
          {restoreMutationMessage ? <p className="portal-backups__dialog-error" role="alert">{restoreMutationMessage}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoreMutation === "pending"}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={restoreMutation === "pending"} onClick={() => void handleRestoreAction()}>
              {restoreMutation === "pending" ? "Updating…" : "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog onOpenChange={closeBackupRequest} open={backupRequestOpen}>
        <DialogContent className="compass-surface portal-backups__dialog">
          <DialogHeader>
            <DialogTitle>Request a backup</DialogTitle>
            <DialogDescription>Choose a supported backup scope and provide a short operational reason.</DialogDescription>
          </DialogHeader>
          <form className="portal-backups__dialog-form" onSubmit={submitBackupRequest}>
            <div className="portal-backups__dialog-field">
              <Label htmlFor="portal-backups-request-scope">Scope</Label>
              <select className="portal-backups__select" id="portal-backups-request-scope" onChange={(event) => { discardMutationKey("backup-request"); setBackupRequestValues((current) => ({ ...current, scope: event.target.value })); setBackupRequestError(null); }} value={backupRequestValues.scope}>
                {BACKUP_SCOPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="portal-backups__dialog-field">
              <Label htmlFor="portal-backups-request-reason">Reason (optional)</Label>
              <Textarea id="portal-backups-request-reason" maxLength={MAX_REASON_LENGTH} onChange={(event) => { discardMutationKey("backup-request"); setBackupRequestValues((current) => ({ ...current, reason: event.target.value })); setBackupRequestError(null); }} value={backupRequestValues.reason} />
            </div>
            {backupRequestError ? <p className="portal-backups__dialog-error" role="alert">{backupRequestError}</p> : null}
            <DialogFooter>
              <Button disabled={backupRequestSubmitting} onClick={() => setBackupRequestOpen(false)} type="button" variant="outline">Cancel</Button>
              <Button disabled={backupRequestSubmitting} type="submit">{backupRequestSubmitting ? "Requesting…" : "Request backup"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={closeRestoreRequest} open={restoreRequestOpen}>
        <DialogContent className="compass-surface portal-backups__dialog">
          <DialogHeader>
            <DialogTitle>Request a restore</DialogTitle>
            <DialogDescription>Restore requests can start only from a succeeded or verified backup.</DialogDescription>
          </DialogHeader>
          <form className="portal-backups__dialog-form" onSubmit={submitRestoreRequest}>
            {restoreRequestJob ? (
              <p className="portal-backups__dialog-context">Source: {valueLabel(restoreRequestJob.scope, BACKUP_SCOPE_OPTIONS)} backup · {jobStatusLabel(restoreRequestJob)}</p>
            ) : <p className="portal-backups__dialog-error" role="alert">{restoreRequestError ?? "No eligible backup is available."}</p>}
            <div className="portal-backups__dialog-field">
              <Label htmlFor="portal-backups-restore-scope">Restore scope</Label>
              <select className="portal-backups__select" id="portal-backups-restore-scope" onChange={(event) => { discardMutationKey("restore-request"); setRestoreRequestValues((current) => ({ ...current, scope: event.target.value })); setRestoreRequestError(null); }} value={restoreRequestValues.scope}>
                {RESTORE_SCOPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="portal-backups__dialog-field">
              <Label htmlFor="portal-backups-restore-reason">Reason</Label>
              <Textarea id="portal-backups-restore-reason" maxLength={MAX_REASON_LENGTH} onChange={(event) => { discardMutationKey("restore-request"); setRestoreRequestValues((current) => ({ ...current, reason: event.target.value })); setRestoreRequestError(null); }} required value={restoreRequestValues.reason} />
            </div>
            {restoreRequestError && restoreRequestJob ? <p className="portal-backups__dialog-error" role="alert">{restoreRequestError}</p> : null}
            <DialogFooter>
              <Button disabled={restoreRequestSubmitting} onClick={() => setRestoreRequestOpen(false)} type="button" variant="outline">Cancel</Button>
              <Button disabled={restoreRequestSubmitting || !restoreRequestJob} type="submit">{restoreRequestSubmitting ? "Requesting…" : "Request restore"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
