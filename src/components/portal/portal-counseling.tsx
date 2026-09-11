"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp, HeartHandshake, RefreshCw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";

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
import { Textarea } from "@/components/ui/textarea";
import { usePortalAccess } from "@/components/portal/portal-access-provider";
import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
import { PortalFilterPanel } from "@/components/portal/portal-filter-panel";
import { PortalPageHeader } from "@/components/portal/portal-page-header";
import { PORTAL_CAPABILITIES } from "@/components/portal/portal-navigation";
import { PortalStatusFilter } from "@/components/portal/portal-status-filter";
import { PortalWorkspaceNav } from "@/components/portal/portal-workspace-nav";
import { RoutineInterviewsView } from "@/components/portal/portal-routine-interviews";
import {
  COUNSELING_SESSION_ASSIGNMENTS,
  COUNSELING_SESSION_MODES,
  COUNSELING_SESSION_ORDERS,
  COUNSELING_SESSION_SOURCES,
  COUNSELING_SESSION_STATUSES,
  COUNSELING_SESSION_TYPES,
  cancelPortalCounselingSession,
  completePortalCounselingSession,
  CounselingApiError,
  finalizePortalCounselingSession,
  getPortalCounselingSessionDetail,
  getPortalCounselingSessions,
  lockPortalCounselingSession,
  noShowPortalCounselingSession,
  savePortalCounselingNote,
  startPortalCounselingSession,
  type CounselingListFilters,
  type CounselingSessionAssignment,
  type CounselingSessionMode,
  type CounselingSessionOrder,
  type CounselingSessionSource,
  type CounselingSessionStatus,
  type CounselingSessionType,
  type PortalCounselingSession,
  type PortalCounselingSessionPage,
} from "@/lib/api/counseling";
import { createIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";
import {
  parseRoutineInterviewStatuses,
  routineInterviewHref,
} from "@/lib/api/routine-interviews";

type ParsedFilters = CounselingListFilters & { statuses: CounselingSessionStatus[] };

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; page: PortalCounselingSessionPage }
  | { kind: "unavailable"; error: "unavailable" | "rate_limited" | "validation" }
  | { kind: "forbidden" };

type DetailState =
  | { kind: "loading" }
  | { kind: "ready"; session: PortalCounselingSession }
  | { kind: "error" };

type SessionAction = "start" | "save" | "complete" | "cancel" | "no-show" | "finalize" | "lock";

type ActionIntent = { action: SessionAction; session: PortalCounselingSession };

type MutationState = {
  referenceCode: string;
  message: string;
  state: "pending" | "error" | "success";
};

type MutationKeyEntry = { fingerprint: string; key: IdempotencyKey };

const SESSION_STATUS_OPTIONS: readonly { label: string; value: CounselingSessionStatus }[] = [
  { label: "Scheduled", value: "SCHEDULED" },
  { label: "In progress", value: "IN_PROGRESS" },
  { label: "Notes draft", value: "COUNSELOR_NOTES_DRAFT" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Finalized", value: "FINALIZED" },
  { label: "Locked", value: "LOCKED" },
  { label: "Cancelled", value: "CANCELLED" },
  { label: "No-show", value: "NO_SHOW" },
];

const SESSION_TYPE_OPTIONS: readonly { label: string; value: CounselingSessionType }[] = [
  { label: "Counseling", value: "COUNSELING" },
  { label: "Routine interview", value: "ROUTINE_INTERVIEW" },
  { label: "Follow-up", value: "FOLLOW_UP" },
  { label: "Triage", value: "TRIAGE" },
  { label: "Administrative interview", value: "ADMINISTRATIVE_INTERVIEW" },
];

const SESSION_MODE_OPTIONS: readonly { label: string; value: CounselingSessionMode }[] = [
  { label: "On-site", value: "ONSITE" },
  { label: "Online", value: "ONLINE" },
];

const SESSION_SOURCE_OPTIONS: readonly { label: string; value: CounselingSessionSource }[] = [
  { label: "Walk-in", value: "WALK_IN" },
  { label: "Called in", value: "CALLED_IN" },
  { label: "Referred", value: "REFERRED" },
  { label: "Appointment", value: "APPOINTMENT" },
  { label: "Counselor initiated", value: "COUNSELOR_INITIATED" },
  { label: "Call slip", value: "CALL_SLIP" },
  { label: "Routine form collection", value: "ROUTINE_COLLECTION" },
  { label: "E-counseling", value: "ECOUNSELING" },
  { label: "Urgent support", value: "URGENT_SUPPORT" },
];

const ASSIGNMENT_OPTIONS: readonly { label: string; value: CounselingSessionAssignment }[] = [
  { label: "All assignments", value: "all" },
  { label: "Assigned to me", value: "mine" },
  { label: "Unassigned", value: "unassigned" },
];

const STATUS_SET = new Set<string>(COUNSELING_SESSION_STATUSES);
const TYPE_SET = new Set<string>(COUNSELING_SESSION_TYPES);
const MODE_SET = new Set<string>(COUNSELING_SESSION_MODES);
const SOURCE_SET = new Set<string>(COUNSELING_SESSION_SOURCES);
const ASSIGNMENT_SET = new Set<string>(COUNSELING_SESSION_ASSIGNMENTS);
const ORDER_SET = new Set<string>(COUNSELING_SESSION_ORDERS);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PAGE = 100_000;
const MAX_QUERY_LENGTH = 120;

const NAV_ITEMS = [
  { href: "/portal/counseling?section=sessions", label: "Sessions", value: "sessions" },
  { href: "/portal/counseling?section=routine-interviews", label: "Routine interviews", value: "routine-interviews" },
] as const;

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function parseDate(value: string | null) {
  return value && DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? value : null;
}

function parsePage(value: string | null) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1;
}

function parseStatuses(value: string | null) {
  if (!value) return [];
  return [...new Set(value.split(",").map((item) => item.trim().toUpperCase()))].filter(
    (item): item is CounselingSessionStatus => STATUS_SET.has(item),
  );
}

function parseFilters(params: { get: (name: string) => string | null }): ParsedFilters {
  const statuses = parseStatuses(params.get("status"));
  const q = params.get("q")?.trim() ?? "";
  const sessionType = params.get("type");
  const sessionMode = params.get("mode");
  const sessionSource = params.get("source");
  const assignment = params.get("assignment");
  const order = params.get("order");
  return {
    q: q && q.length <= MAX_QUERY_LENGTH ? q : null,
    status: statuses.length ? statuses.join(",") : null,
    statuses,
    sessionType: sessionType && TYPE_SET.has(sessionType) ? sessionType as CounselingSessionType : null,
    sessionMode: sessionMode && MODE_SET.has(sessionMode) ? sessionMode as CounselingSessionMode : null,
    sessionSource: sessionSource && SOURCE_SET.has(sessionSource) ? sessionSource as CounselingSessionSource : null,
    assignment: assignment && ASSIGNMENT_SET.has(assignment) ? assignment as CounselingSessionAssignment : "all",
    dateFrom: parseDate(params.get("date_from")),
    dateTo: parseDate(params.get("date_to")),
    order: order && ORDER_SET.has(order) ? order as CounselingSessionOrder : "recent",
  };
}

function sessionHref(page: number, filters: ParsedFilters | CounselingListFilters) {
  const params = new URLSearchParams({ section: "sessions" });
  const statuses = "statuses" in filters ? filters.statuses : filters.status?.split(",").filter(Boolean) ?? [];
  if (statuses.length) params.set("status", statuses.join(","));
  if (filters.q?.trim()) params.set("q", filters.q.trim().slice(0, MAX_QUERY_LENGTH));
  if (filters.sessionType) params.set("type", filters.sessionType);
  if (filters.sessionMode) params.set("mode", filters.sessionMode);
  if (filters.sessionSource) params.set("source", filters.sessionSource);
  if (filters.assignment && filters.assignment !== "all") params.set("assignment", filters.assignment);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  if (filters.order && filters.order !== "recent") params.set("order", filters.order);
  if (page > 1) params.set("page", String(page));
  return `/portal/counseling?${params.toString()}`;
}

function labelForValue(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatSchedule(session: PortalCounselingSession) {
  const start = formatTimestamp(session.scheduled_start_at);
  const end = formatTimestamp(session.scheduled_end_at);
  if (!start) return "Schedule not set";
  return end ? `${start} – ${end}` : start;
}

function loadMessage(kind: LoadState["kind"] | "rate_limited" | "validation") {
  if (kind === "rate_limited") return "Too many counseling requests. Please wait and try again.";
  if (kind === "validation") return "The counseling filters could not be applied.";
  return "Counseling sessions are unavailable right now.";
}

function mutationMessage(error: CounselingApiError) {
  switch (error.kind) {
    case "conflict": return "This session changed. Refresh the workspace and try again.";
    case "permission": return "This action is not available for this account.";
    case "validation": return "Check the session details and try again.";
    case "rate_limited": return "Too many attempts. Please wait before trying again.";
    default: return "This session action is temporarily unavailable. Try again.";
  }
}

function canAction(action: SessionAction, session: PortalCounselingSession, hasCapability: (capability: string) => boolean) {
  if (action === "start" || action === "cancel" || action === "no-show") return session.status === "SCHEDULED";
  if (action === "save" || action === "complete") return session.status === "IN_PROGRESS" || session.status === "COUNSELOR_NOTES_DRAFT";
  if (action === "finalize") return session.status === "COMPLETED";
  return session.status === "FINALIZED" && hasCapability(PORTAL_CAPABILITIES.counselingSessionLock);
}

function actionLabel(action: SessionAction) {
  switch (action) {
    case "no-show": return "Mark no-show";
    case "save": return "Save notes";
    case "complete": return "Complete session";
    case "cancel": return "Cancel session";
    case "finalize": return "Finalize session";
    case "lock": return "Lock session";
    default: return "Start session";
  }
}

function detailId(referenceCode: string) {
  return `portal-counseling-detail-${referenceCode.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function CounselingHeader({ description = "Review and manage counseling sessions within your authorized scope.", title = "Counseling" }: { description?: ReactNode; title?: ReactNode }) {
  return <PortalPageHeader className="portal-counseling__page-header" current="Counseling" description={description} headingId="portal-counseling-heading" title={title} />;
}

function CounselingFilterPanel({ filters }: { filters: ParsedFilters }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rangeError, setRangeError] = useState<string | null>(null);
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const dateFrom = parseDate(String(form.get("date_from") ?? ""));
    const dateTo = parseDate(String(form.get("date_to") ?? ""));
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setRangeError("The start date must be on or before the end date.");
      return;
    }
    setRangeError(null);
    const statuses = form.getAll("status").filter((value): value is string => typeof value === "string" && STATUS_SET.has(value));
    const next: ParsedFilters = {
      q: String(form.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH) || null,
      status: statuses.length ? statuses.join(",") : null,
      statuses: statuses as CounselingSessionStatus[],
      sessionType: TYPE_SET.has(String(form.get("type") ?? "")) ? String(form.get("type")) as CounselingSessionType : null,
      sessionMode: MODE_SET.has(String(form.get("mode") ?? "")) ? String(form.get("mode")) as CounselingSessionMode : null,
      sessionSource: SOURCE_SET.has(String(form.get("source") ?? "")) ? String(form.get("source")) as CounselingSessionSource : null,
      assignment: ASSIGNMENT_SET.has(String(form.get("assignment") ?? "all")) ? String(form.get("assignment")) as CounselingSessionAssignment : "all",
      dateFrom,
      dateTo,
      order: ORDER_SET.has(String(form.get("order") ?? "recent")) ? String(form.get("order")) as CounselingSessionOrder : "recent",
    };
    startTransition(() => router.push(sessionHref(1, next), { scroll: false }));
  };
  return (
    <PortalFilterPanel
      accessibleLabel="counseling session filters"
      action="/portal/counseling?section=sessions"
      ariaBusy={isPending}
      className="portal-counseling__filters"
      onSubmit={handleSubmit}
      resetKey={`${filters.q ?? ""}:${filters.status ?? ""}:${filters.sessionType ?? ""}:${filters.sessionMode ?? ""}:${filters.sessionSource ?? ""}:${filters.assignment}:${filters.dateFrom ?? ""}:${filters.dateTo ?? ""}:${filters.order}`}
      summary="Search and narrow the sessions visible to this account."
    >
      <div className="portal-counseling__filters-grid">
        <div className="portal-counseling__filter-field portal-counseling__filter-field--search">
          <Label htmlFor="portal-counseling-query">Search</Label>
          <Input defaultValue={filters.q ?? ""} id="portal-counseling-query" maxLength={MAX_QUERY_LENGTH} name="q" placeholder="Reference, student name, or student number" />
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-counseling-status">Status</Label>
          <PortalStatusFilter
            ariaLabel="Choose counseling session statuses"
            id="portal-counseling-status"
            options={SESSION_STATUS_OPTIONS}
            selectedValues={filters.statuses}
            title="Session status"
          />
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-counseling-type">Session type</Label>
          <select defaultValue={filters.sessionType ?? ""} id="portal-counseling-type" name="type"><option value="">All session types</option>{SESSION_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-counseling-mode">Mode</Label>
          <select defaultValue={filters.sessionMode ?? ""} id="portal-counseling-mode" name="mode"><option value="">All modes</option>{SESSION_MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-counseling-source">Source</Label>
          <select defaultValue={filters.sessionSource ?? ""} id="portal-counseling-source" name="source"><option value="">All sources</option>{SESSION_SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-counseling-assignment">Assignment</Label>
          <select defaultValue={filters.assignment ?? "all"} id="portal-counseling-assignment" name="assignment">{ASSIGNMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        </div>
        <div className="portal-counseling__filter-field"><Label htmlFor="portal-counseling-from">From date</Label><Input defaultValue={filters.dateFrom ?? ""} id="portal-counseling-from" name="date_from" type="date" /></div>
        <div className="portal-counseling__filter-field"><Label htmlFor="portal-counseling-to">To date</Label><Input defaultValue={filters.dateTo ?? ""} id="portal-counseling-to" name="date_to" type="date" /></div>
        <div className="portal-counseling__filter-field"><Label htmlFor="portal-counseling-order">Order</Label><select defaultValue={filters.order ?? "recent"} id="portal-counseling-order" name="order"><option value="recent">Recently updated</option><option value="upcoming">Upcoming first</option></select></div>
      </div>
      {rangeError ? <p className="portal-counseling__filter-error" role="alert">{rangeError}</p> : null}
      <div className="portal-counseling__filter-actions"><Button disabled={isPending} size="sm" type="submit">Apply filters</Button><Link className="portal-counseling__filter-clear" href="/portal/counseling?section=sessions">Clear</Link></div>
    </PortalFilterPanel>
  );
}

function CounselingLoadingState({ section = "sessions" }: { section?: "sessions" | "routine-interviews" }) {
  const isRoutine = section === "routine-interviews";
  return (
    <section aria-busy="true" aria-labelledby="portal-counseling-loading-heading" className="portal-counseling portal-counseling--loading" role="status">
      <span className="sr-only">Loading {isRoutine ? "routine interviews" : "counseling sessions"}…</span>
      <CounselingHeader title="Counseling" />
      <div className="portal-counseling__workspace">
        <div aria-hidden="true" className="compass-surface portal-workspace-nav portal-counseling__nav-skeleton" data-tone="subtle">{Array.from({ length: 2 }, (_, index) => <Skeleton className="portal-counseling__nav-skeleton-line" key={index} />)}</div>
        <div className="portal-counseling__content-skeleton"><PortalFilterPanel action={isRoutine ? "/portal/counseling?section=routine-interviews" : "/portal/counseling?section=sessions"} ariaBusy className="portal-counseling__filters" resetKey="counseling-loading" summary={<Skeleton as="span" aria-hidden="true" className="portal-counseling__skeleton-summary" />}><div aria-hidden="true" className="portal-counseling__filter-skeleton-grid">{Array.from({ length: isRoutine ? 1 : 9 }, (_, index) => <Skeleton as="span" key={index} />)}</div></PortalFilterPanel><PortalCollectionFrame className="portal-counseling__frame"><div aria-hidden="true" className="portal-counseling__table-skeleton">{Array.from({ length: 5 }, (_, row) => <div className="portal-counseling__table-skeleton-row" key={row}>{Array.from({ length: isRoutine ? 6 : 8 }, (_, cell) => <Skeleton as="span" key={cell} />)}</div>)}</div></PortalCollectionFrame></div>
      </div>
    </section>
  );
}

function CounselingAccessState({ kind, onRetry }: { kind: "forbidden" | "unavailable"; onRetry?: () => void }) {
  return (
    <section aria-labelledby="portal-counseling-access-heading" className="portal-counseling portal-counseling--state" role={kind === "unavailable" ? "alert" : undefined}>
      <CounselingHeader />
      <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state">
        <HeartHandshake aria-hidden="true" className="portal-counseling__state-icon" />
        <h2 id="portal-counseling-access-heading">{kind === "forbidden" ? "This page isn’t available for this account." : "Counseling isn’t available right now."}</h2>
        <p>{kind === "forbidden" ? "Return to your workspace to continue." : "Try again when the connection is ready."}</p>
        {onRetry ? <Button onClick={onRetry} type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button> : null}
      </PortalCollectionFrame>
    </section>
  );
}

function EmptyState() {
  return <div className="portal-counseling__empty" role="status"><h2>No counseling sessions to show.</h2><p>Try changing the filters or check back after more sessions are recorded.</p></div>;
}

function SessionDetails({ detail, onRetry }: { detail: DetailState | undefined; onRetry: () => void }) {
  if (!detail || detail.kind === "loading") return <div className="portal-counseling__detail-state" role="status"><Skeleton as="span" /><Skeleton as="span" /></div>;
  if (detail.kind === "error") return <div className="portal-counseling__detail-state" role="status"><p>Session details are unavailable right now.</p><Button onClick={onRetry} size="sm" type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button></div>;
  const value = detail.session;
  const facts = [
    ["Schedule", formatSchedule(value)],
    ["Type", labelForValue(value.session_type)],
    ["Mode", labelForValue(value.session_mode)],
    ["Source", labelForValue(value.session_source)],
    ["Status", labelForValue(value.status)],
    value.assignment_state ? ["Assignment", value.assignment_state] : null,
  ].filter((fact): fact is [string, string] => Boolean(fact && fact[1]));
  return <div className="portal-counseling__detail-content"><dl>{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div>;
}

function SessionActions({ session, hasCapability, onAction }: { session: PortalCounselingSession; hasCapability: (capability: string) => boolean; onAction: (action: SessionAction, session: PortalCounselingSession) => void }) {
  const actions: SessionAction[] = ["start", "save", "complete", "cancel", "no-show", "finalize", "lock"].filter((action): action is SessionAction => canAction(action as SessionAction, session, hasCapability));
  if (!actions.length) return null;
  return <div aria-label={`Actions for ${session.reference_code}`} className="portal-counseling__row-actions">{actions.map((action) => <Button key={action} onClick={() => onAction(action, session)} size="xs" type="button" variant={action === "cancel" || action === "no-show" || action === "lock" ? "outline" : "ghost"}>{actionLabel(action)}</Button>)}</div>;
}

function SessionTable({ sessions, details, expandedReference, hasCapability, mutation, onAction, onRetryDetail, onToggle }: { sessions: PortalCounselingSession[]; details: Record<string, DetailState>; expandedReference: string | null; hasCapability: (capability: string) => boolean; mutation: MutationState | null; onAction: (action: SessionAction, session: PortalCounselingSession) => void; onRetryDetail: (session: PortalCounselingSession) => void; onToggle: (session: PortalCounselingSession) => void }) {
  return (
    <div className="portal-counseling__table-wrap">
      <table className="portal-counseling__table">
        <thead><tr><th scope="col">Student</th><th scope="col">Session reference</th><th scope="col">Type</th><th scope="col">Mode</th><th scope="col">Status</th><th scope="col">Schedule</th><th scope="col">Assignment</th><th scope="col">Details &amp; actions</th></tr></thead>
        <tbody>
          {sessions.map((session) => {
            const expanded = expandedReference === session.reference_code;
            const expandedId = detailId(session.reference_code);
            const rowMutation = mutation?.referenceCode === session.reference_code ? mutation : null;
            return <Fragment key={session.reference_code}>
              <tr className={expanded ? "is-expanded" : undefined}>
                <td data-label="Student"><span className="portal-counseling__student-name">{session.student_display_name ?? "Student details unavailable"}</span>{session.student_number ? <span className="portal-counseling__student-number">{session.student_number}</span> : null}</td>
                <td data-label="Session reference"><span className="portal-counseling__reference">{session.reference_code}</span></td>
                <td data-label="Type">{labelForValue(session.session_type)}</td>
                <td data-label="Mode">{labelForValue(session.session_mode)}</td>
                <td data-label="Status"><Badge data-tone={session.status.toLowerCase()} variant="outline">{labelForValue(session.status)}</Badge></td>
                <td data-label="Schedule">{formatSchedule(session)}</td>
                <td data-label="Assignment">{session.assignment_state ?? "Assignment unavailable"}</td>
                <td data-label="Details & actions"><div className="portal-counseling__details-actions"><Button aria-controls={expandedId} aria-expanded={expanded} aria-label={`${expanded ? "Hide" : "Show"} details for ${session.reference_code}`} onClick={() => onToggle(session)} size="xs" type="button" variant="outline">{expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}<span className="sr-only">{expanded ? "Hide" : "Show"} details</span></Button><SessionActions hasCapability={hasCapability} onAction={onAction} session={session} /></div></td>
              </tr>
              {expanded ? <tr className="portal-counseling__detail-row"><td colSpan={8} id={expandedId}><SessionDetails detail={details[session.reference_code]} onRetry={() => onRetryDetail(session)} />{rowMutation ? <p className={`portal-counseling__mutation portal-counseling__mutation--${rowMutation.state}`} role={rowMutation.state === "error" ? "alert" : "status"}>{rowMutation.message}</p> : null}</td></tr> : null}
            </Fragment>;
          })}
        </tbody>
      </table>
    </div>
  );
}

function SessionsPagination({ page, filters }: { page: PortalCounselingSessionPage; filters: ParsedFilters }) {
  const totalPages = Math.max(1, Math.ceil(page.total / page.page_size));
  if (totalPages <= 1) return null;
  return <Pagination aria-label="Counseling session pages" className="portal-counseling__pagination"><PaginationContent><PaginationItem>{page.page > 1 ? <PaginationPrevious href={sessionHref(page.page - 1, filters)} text="Previous" /> : <span aria-hidden="true" className="portal-counseling__pagination-spacer" />}</PaginationItem><PaginationItem className="portal-counseling__pagination-current"><span aria-current="page">Page {page.page} of {totalPages}</span></PaginationItem><PaginationItem>{page.page < totalPages ? <PaginationNext href={sessionHref(page.page + 1, filters)} text="Next" /> : <span aria-hidden="true" className="portal-counseling__pagination-spacer" />}</PaginationItem></PaginationContent></Pagination>;
}

export function PortalCounselingPage() {
  const { hasCapability, refreshAccess, status: accessStatus } = usePortalAccess();
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawQuery = searchParams.toString();
  const section = searchParams.get("section") === "routine-interviews" ? "routine-interviews" : "sessions";
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const routineStatuses = useMemo(() => parseRoutineInterviewStatuses(searchParams.get("status")), [searchParams]);
  const pageNumber = parsePage(searchParams.get("page"));
  const canonicalHref = section === "routine-interviews" ? routineInterviewHref(pageNumber, routineStatuses) : sessionHref(pageNumber, filters);
  const canonicalQuery = canonicalHref.split("?")[1] ?? "";
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedReference, setExpandedReference] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, DetailState>>({});
  const [actionIntent, setActionIntent] = useState<ActionIntent | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [noteValues, setNoteValues] = useState({ student_visible_summary: "", counselor_narrative: "", recommendations: "", special_concerns: "", follow_up_needed: false, follow_up_notes: "" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [mutation, setMutation] = useState<MutationState | null>(null);
  const mutationKeysRef = useRef<Map<string, MutationKeyEntry>>(new Map());
  const canQueue = accessStatus === "ready" && hasCapability(PORTAL_CAPABILITIES.counselingSessionsQueueView);
  const queryKey = `${rawQuery}:${reloadKey}:${canQueue}:${section}`;

  useEffect(() => {
    if (rawQuery !== canonicalQuery) router.replace(canonicalHref, { scroll: false });
  }, [canonicalHref, canonicalQuery, rawQuery, router]);

  useEffect(() => {
    if (!canQueue || section !== "sessions") return;
    const controller = new AbortController();
    let active = true;
    void Promise.resolve().then(() => {
      if (!active || controller.signal.aborted) return null;
      setLoadState({ kind: "loading" });
      setExpandedReference(null);
      setDetails({});
      return getPortalCounselingSessions(pageNumber, filters, controller.signal);
    }).then((page) => {
      if (page && active && !controller.signal.aborted) setLoadState({ kind: "ready", page });
    }).catch((error: unknown) => {
      if (!active || controller.signal.aborted || isAbortError(error)) return;
      if (error instanceof CounselingApiError && error.kind === "permission") setLoadState({ kind: "forbidden" });
      else setLoadState({ kind: "unavailable", error: error instanceof CounselingApiError && (error.kind === "rate_limited" || error.kind === "validation") ? error.kind : "unavailable" });
    });
    return () => { active = false; controller.abort(); };
  }, [canQueue, filters, pageNumber, queryKey, section]);

  const getMutationKey = (scope: string, fingerprint: string) => {
    const existing = mutationKeysRef.current.get(scope);
    if (existing?.fingerprint === fingerprint) return existing.key;
    const key = createIdempotencyKey();
    mutationKeysRef.current.set(scope, { fingerprint, key });
    return key;
  };

  const openAction = (action: SessionAction, session: PortalCounselingSession) => {
    setActionIntent({ action, session });
    setActionReason("");
    setActionError(null);
    setNoteValues({ student_visible_summary: "", counselor_narrative: "", recommendations: "", special_concerns: "", follow_up_needed: false, follow_up_notes: "" });
  };

  const handleConfirmAction = async () => {
    if (!actionIntent) return;
    const { action, session } = actionIntent;
    const reason = actionReason.trim();
    if (action === "cancel" && !reason) {
      setActionError("Add a short reason before cancelling this session.");
      return;
    }
    const payload = { ...noteValues, ...(reason ? { recommendations: reason } : {}) };
    const fingerprint = JSON.stringify({ action, referenceCode: session.reference_code, reason, payload });
    const scope = `counseling:${action}:${session.reference_code}`;
    const key = getMutationKey(scope, fingerprint);
    setMutation({ referenceCode: session.reference_code, message: "Saving session change…", state: "pending" });
    try {
      if (action === "start") await startPortalCounselingSession(session.reference_code, key);
      else if (action === "save") await savePortalCounselingNote(session.reference_code, payload, key);
      else if (action === "complete") await completePortalCounselingSession(session.reference_code, payload, key);
      else if (action === "cancel") await cancelPortalCounselingSession(session.reference_code, { reason }, key);
      else if (action === "no-show") await noShowPortalCounselingSession(session.reference_code, key);
      else if (action === "finalize") await finalizePortalCounselingSession(session.reference_code, key);
      else await lockPortalCounselingSession(session.reference_code, key);
      mutationKeysRef.current.delete(scope);
      setMutation({ referenceCode: session.reference_code, message: "Session updated.", state: "success" });
      setActionIntent(null);
      setReloadKey((value) => value + 1);
    } catch (error: unknown) {
      const apiError = error instanceof CounselingApiError ? error : new CounselingApiError("unavailable");
      if (apiError.kind !== "unavailable" && apiError.kind !== "rate_limited") mutationKeysRef.current.delete(scope);
      setMutation({ referenceCode: session.reference_code, message: mutationMessage(apiError), state: "error" });
    }
  };

  const toggleDetails = (session: PortalCounselingSession) => {
    if (expandedReference === session.reference_code) {
      setExpandedReference(null);
      return;
    }
    setExpandedReference(session.reference_code);
    if (details[session.reference_code]) return;
    setDetails((current) => ({ ...current, [session.reference_code]: { kind: "loading" } }));
    void getPortalCounselingSessionDetail(session.reference_code).then((detail) => setDetails((current) => ({ ...current, [session.reference_code]: { kind: "ready", session: detail } }))).catch((error: unknown) => {
      if (!isAbortError(error)) setDetails((current) => ({ ...current, [session.reference_code]: { kind: "error" } }));
    });
  };

  const retryDetails = (session: PortalCounselingSession) => {
    setDetails((current) => ({ ...current, [session.reference_code]: { kind: "loading" } }));
    void getPortalCounselingSessionDetail(session.reference_code).then((detail) => setDetails((current) => ({ ...current, [session.reference_code]: { kind: "ready", session: detail } }))).catch(() => setDetails((current) => ({ ...current, [session.reference_code]: { kind: "error" } })));
  };

  if (accessStatus === "loading") return <CounselingLoadingState section={section} />;
  if (accessStatus === "unavailable") return <CounselingAccessState kind="unavailable" onRetry={() => void refreshAccess()} />;
  if (!canQueue) return <CounselingAccessState kind="forbidden" />;
  if (section === "routine-interviews") return <RoutineInterviewsView hasCapability={hasCapability} />;
  if (loadState.kind === "loading") return <CounselingLoadingState />;
  if (loadState.kind === "forbidden") return <CounselingAccessState kind="forbidden" />;
  if (loadState.kind === "unavailable") return <section aria-labelledby="portal-counseling-heading" className="portal-counseling portal-counseling--state"><CounselingHeader /><CounselingFilterPanel filters={filters} /><PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state"><h2>{loadMessage(loadState.error)}</h2><p>Try again when the connection is ready.</p><Button onClick={() => setReloadKey((value) => value + 1)} type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button></PortalCollectionFrame></section>;

  const page = loadState.page;
  return <section aria-labelledby="portal-counseling-heading" className="portal-counseling">
    <CounselingHeader />
    <div className="portal-counseling__workspace">
      <PortalWorkspaceNav activeValue={section} ariaLabel="Counseling sections" items={NAV_ITEMS} />
      <div className="portal-counseling__active-content">
        <CounselingFilterPanel filters={filters} />
        <PortalCollectionFrame aria-labelledby="portal-counseling-results-heading" className="portal-counseling__frame">
          <div className="portal-counseling__frame-heading"><div><p className="portal-counseling__kicker">Sessions</p><h2 id="portal-counseling-results-heading">Counseling sessions</h2></div><p className="portal-counseling__result-count">{page.total} {page.total === 1 ? "session" : "sessions"}</p></div>
          {mutation ? <p className={`portal-counseling__mutation portal-counseling__mutation--${mutation.state}`} role={mutation.state === "error" ? "alert" : "status"}>{mutation.message}</p> : null}
          {page.items.length ? <SessionTable details={details} expandedReference={expandedReference} hasCapability={hasCapability} mutation={mutation} onAction={openAction} onRetryDetail={retryDetails} onToggle={toggleDetails} sessions={page.items} /> : <EmptyState />}
          <SessionsPagination filters={filters} page={page} />
        </PortalCollectionFrame>
      </div>
    </div>

    <AlertDialog onOpenChange={(open) => { if (!open && mutation?.state !== "pending") { setActionIntent(null); setActionError(null); } }} open={actionIntent !== null}>
      <AlertDialogContent className="portal-counseling__dialog" size="sm">
        <AlertDialogHeader><AlertDialogTitle>{actionIntent ? actionLabel(actionIntent.action) : "Session action"}</AlertDialogTitle><AlertDialogDescription>{actionIntent ? `${actionIntent.session.reference_code} will be updated using the current session state.` : "Review this session action before continuing."}</AlertDialogDescription></AlertDialogHeader>
        {actionIntent?.action === "cancel" ? <div className="portal-counseling__dialog-field"><Label htmlFor="portal-counseling-reason">Reason</Label><Textarea id="portal-counseling-reason" maxLength={2_000} onChange={(event) => setActionReason(event.target.value)} value={actionReason} /></div> : null}
        {actionIntent && ["save", "complete"].includes(actionIntent.action) ? <div className="portal-counseling__note-fields"><div className="portal-counseling__dialog-field"><Label htmlFor="portal-counseling-summary">Student-visible summary</Label><Textarea id="portal-counseling-summary" maxLength={2_000} onChange={(event) => setNoteValues((current) => ({ ...current, student_visible_summary: event.target.value }))} value={noteValues.student_visible_summary} /></div><div className="portal-counseling__dialog-field"><Label htmlFor="portal-counseling-narrative">Counselor narrative</Label><Textarea id="portal-counseling-narrative" maxLength={4_000} onChange={(event) => setNoteValues((current) => ({ ...current, counselor_narrative: event.target.value }))} value={noteValues.counselor_narrative} /></div><div className="portal-counseling__dialog-field"><Label htmlFor="portal-counseling-recommendations">Recommendations</Label><Textarea id="portal-counseling-recommendations" maxLength={2_000} onChange={(event) => setNoteValues((current) => ({ ...current, recommendations: event.target.value }))} value={noteValues.recommendations} /></div></div> : null}
        {actionError ? <p className="portal-counseling__dialog-error" role="alert">{actionError}</p> : null}
        <AlertDialogFooter><AlertDialogCancel disabled={mutation?.state === "pending"}>Keep session</AlertDialogCancel><AlertDialogAction disabled={mutation?.state === "pending"} onClick={() => void handleConfirmAction()}>{mutation?.state === "pending" ? "Saving…" : "Continue"}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}

export function PortalCounselingLoading() {
  return <CounselingLoadingState />;
}
