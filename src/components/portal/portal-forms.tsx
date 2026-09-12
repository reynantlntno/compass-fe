"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp, ClipboardList, RefreshCw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
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
import { FORMS_NAV_ITEMS, getFormsNavItems, type FormsNavItem, type FormsSection } from "@/components/portal/portal-forms-navigation";
import {
  EXIT_INTERVIEW_QUEUE_STATUSES,
  FORMS_QUEUE_ORDERS,
  FormsApiError,
  formsHref,
  getPortalExitInterviewAnswers,
  getPortalExitInterviewQueue,
  getPortalExitInterviewQueueDetail,
  getPortalInventoryQueue,
  getPortalInventoryQueueDetail,
  getPortalInventorySubmittedAnswers,
  INVENTORY_QUEUE_STATUSES,
  parseExitInterviewFilters,
  parseInventoryFilters,
  acknowledgePortalExitInterview,
  archivePortalExitInterview,
  reopenPortalExitInterview,
  reopenPortalInventory,
  voidPortalExitInterview,
  type FormsListFilters,
  type PortalExitInterviewQueueDetail,
  type PortalExitInterviewQueueItem,
  type PortalFormsPage,
  type PortalInventoryQueueDetail,
  type PortalInventoryQueueItem,
} from "@/lib/api/forms";
import { createIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";

const INVENTORY_STATUS_OPTIONS = [
  { label: "Submitted", value: "SUBMITTED" },
  { label: "Reopened for correction", value: "REOPENED_FOR_CORRECTION" },
] as const;

const EXIT_STATUS_OPTIONS = [
  { label: "Draft", value: "DRAFT" },
  { label: "Submitted", value: "SUBMITTED" },
  { label: "Reopened for correction", value: "REOPENED_FOR_CORRECTION" },
  { label: "Voided", value: "VOIDED" },
  { label: "Archived", value: "ARCHIVED" },
] as const;

type FormsLoadState<T> =
  | { kind: "loading" }
  | { kind: "ready"; page: PortalFormsPage<T> }
  | { kind: "forbidden" }
  | { kind: "unavailable"; error: "unavailable" | "rate_limited" | "validation" };

type SensitiveState<T> =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; detail: T };

type InventoryDetailState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; detail: PortalInventoryQueueDetail; sensitive?: SensitiveState<PortalInventoryQueueDetail> };

type ExitDetailState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; detail: PortalExitInterviewQueueDetail; sensitive?: SensitiveState<PortalExitInterviewQueueDetail> };

type InventoryActionIntent = { kind: "inventory-reopen"; item: PortalInventoryQueueItem };
type ExitAction = "acknowledge" | "reopen" | "void" | "archive";
type ExitActionIntent = { kind: "exit"; action: ExitAction; item: PortalExitInterviewQueueItem };
type ActionIntent = InventoryActionIntent | ExitActionIntent;
type MutationState = { scope: string; state: "pending" | "success" | "error"; message: string };
type MutationKeyEntry = { fingerprint: string; key: IdempotencyKey };

const MAX_QUERY_LENGTH = 120;
const MAX_PAGE = 100_000;
const ORDER_SET = new Set<string>(FORMS_QUEUE_ORDERS);
const INVENTORY_STATUS_SET = new Set<string>(INVENTORY_QUEUE_STATUSES);
const EXIT_STATUS_SET = new Set<string>(EXIT_INTERVIEW_QUEUE_STATUSES);

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function labelForValue(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function parsePage(value: string | null) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1;
}

function formsLoadMessage(error: FormsLoadState<unknown>["kind"] | "rate_limited" | "validation") {
  if (error === "rate_limited") return "Too many forms requests. Please wait and try again.";
  if (error === "validation") return "The forms filters could not be applied.";
  return "Forms and submissions are unavailable right now.";
}

function mutationMessage(error: FormsApiError) {
  switch (error.kind) {
    case "conflict": return "This submission changed. Refresh the workspace and try again.";
    case "permission": return "This action is not available for this account.";
    case "validation": return "Check the submission details and try again.";
    case "rate_limited": return "Too many attempts. Please wait before trying again.";
    default: return "This submission action is temporarily unavailable. Try again.";
  }
}

function detailId(prefix: string, value: string) {
  return `${prefix}-${value.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function safeAnswerValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "No response recorded";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).slice(0, 2_000);
  }
  return "Recorded response";
}

function AnswerSummary({ answers }: { answers: Record<string, unknown> | null }) {
  if (!answers) return <p>Submitted answers are unavailable in this view.</p>;
  const entries = Object.entries(answers)
    .filter(([key]) => !/(email|password|token|secret|raw.?id|control.?number)/i.test(key))
    .slice(0, 80);
  if (!entries.length) return <p>No displayable answers are available.</p>;
  return (
    <div className="portal-counseling__routine-sensitive">
      <p className="portal-counseling__kicker">Authorized submitted answers</p>
      <dl>
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt>{labelForValue(key)}</dt>
            <dd>{safeAnswerValue(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function FormsHeader() {
  return (
    <PortalPageHeader
      className="portal-counseling__page-header"
      current="Forms & submissions"
      description="Review authorized student form submissions within your workspace scope."
      headingId="portal-forms-heading"
      title="Forms & submissions"
    />
  );
}

function FormsFilterPanel({ section, filters }: { section: FormsSection; filters: FormsListFilters }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const options = section === "inventory" ? INVENTORY_STATUS_OPTIONS : EXIT_STATUS_OPTIONS;
  const allowed = section === "inventory" ? INVENTORY_STATUS_SET : EXIT_STATUS_SET;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const statuses = [...new Set(form.getAll("status"))]
      .filter((value): value is string => typeof value === "string" && allowed.has(value));
    const orderValue = String(form.get("order") ?? "recent");
    const next: FormsListFilters = {
      q: String(form.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH) || null,
      status: statuses.length ? statuses.join(",") : null,
      statuses,
      academicYear: String(form.get("academic_year") ?? "").trim().slice(0, 100) || null,
      revision: String(form.get("revision") ?? "").trim().slice(0, 100) || null,
      order: ORDER_SET.has(orderValue) ? orderValue as FormsListFilters["order"] : "recent",
    };
    startTransition(() => router.push(formsHref(section, 1, next), { scroll: false }));
  };

  return (
    <PortalFilterPanel
      accessibleLabel={`${section === "inventory" ? "individual inventory" : "exit interview"} filters`}
      action={`/portal/forms?section=${section}`}
      ariaBusy={isPending}
      className="portal-counseling__filters"
      onSubmit={handleSubmit}
      resetKey={`${section}:${filters.q ?? ""}:${filters.status ?? ""}:${filters.academicYear ?? ""}:${filters.revision ?? ""}:${filters.order}`}
      summary={`Search and narrow the ${section === "inventory" ? "inventory submissions" : "exit interviews"} visible to this account.`}
    >
      <div className="portal-counseling__filters-grid">
        <div className="portal-counseling__filter-field portal-counseling__filter-field--search">
          <Label htmlFor="portal-forms-query">Search</Label>
          <Input
            defaultValue={filters.q ?? ""}
            id="portal-forms-query"
            maxLength={MAX_QUERY_LENGTH}
            name="q"
            placeholder={section === "inventory" ? "Student name or student number" : "Reference, student name, or student number"}
          />
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-forms-status">Status</Label>
          <PortalStatusFilter
            ariaLabel={`Choose ${section === "inventory" ? "inventory" : "exit interview"} statuses`}
            id="portal-forms-status"
            options={options}
            selectedValues={filters.statuses}
            title="Submission status"
          />
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-forms-academic-year">Academic year</Label>
          <Input defaultValue={filters.academicYear ?? ""} id="portal-forms-academic-year" maxLength={100} name="academic_year" placeholder="e.g. 2026–2027" />
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-forms-revision">Form revision</Label>
          <Input defaultValue={filters.revision ?? ""} id="portal-forms-revision" maxLength={100} name="revision" placeholder="Code or revision" />
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-forms-order">Order</Label>
          <select defaultValue={filters.order} id="portal-forms-order" name="order">
            <option value="recent">Recently updated</option>
            <option value="oldest">Oldest updated first</option>
          </select>
        </div>
      </div>
      <div className="portal-counseling__filter-actions">
        <Button disabled={isPending} size="sm" type="submit">Apply filters</Button>
        <Link className="portal-counseling__filter-clear" href={`/portal/forms?section=${section}`}>Clear</Link>
      </div>
    </PortalFilterPanel>
  );
}

function InventoryDetails({
  state,
  onRetry,
  onSensitive,
  onSensitiveRetry,
}: {
  state: InventoryDetailState | undefined;
  onRetry: () => void;
  onSensitive: () => void;
  onSensitiveRetry: () => void;
}) {
  if (!state || state.kind === "loading") {
    return <div className="portal-counseling__detail-state" role="status"><Skeleton as="span" /><Skeleton as="span" /></div>;
  }
  if (state.kind === "error") {
    return <div className="portal-counseling__detail-state" role="status"><p>Inventory details are unavailable right now.</p><Button onClick={onRetry} size="sm" type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button></div>;
  }
  const detail = state.detail;
  const facts = [
    ["Academic year", detail.academic_year],
    ["Form revision", `${detail.schema_key} · ${detail.schema_version}`],
    ["Status", labelForValue(detail.status)],
    ["Submitted", formatTimestamp(detail.submitted_at)],
    ["Reopened", formatTimestamp(detail.reopened_at)],
    ["Latest update", formatTimestamp(detail.updated_at)],
  ];
  return (
    <div className="portal-counseling__detail-content">
      <dl>{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {detail.status === "SUBMITTED" && !state.sensitive ? <Button onClick={onSensitive} size="sm" type="button" variant="outline">View submitted answers</Button> : null}
      {state.sensitive?.kind === "loading" ? <div className="portal-counseling__detail-state" role="status"><Skeleton as="span" /><Skeleton as="span" /></div> : null}
      {state.sensitive?.kind === "error" ? <div className="portal-counseling__detail-state" role="status"><p>Submitted answers are unavailable right now.</p><Button onClick={onSensitiveRetry} size="sm" type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button></div> : null}
      {state.sensitive?.kind === "ready" ? <AnswerSummary answers={state.sensitive.detail.answers} /> : null}
    </div>
  );
}

function ExitDetails({
  state,
  onRetry,
  onSensitive,
  onSensitiveRetry,
}: {
  state: ExitDetailState | undefined;
  onRetry: () => void;
  onSensitive: () => void;
  onSensitiveRetry: () => void;
}) {
  if (!state || state.kind === "loading") {
    return <div className="portal-counseling__detail-state" role="status"><Skeleton as="span" /><Skeleton as="span" /></div>;
  }
  if (state.kind === "error") {
    return <div className="portal-counseling__detail-state" role="status"><p>Exit interview details are unavailable right now.</p><Button onClick={onRetry} size="sm" type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button></div>;
  }
  const detail = state.detail;
  const facts = [
    ["Academic year", detail.academic_year],
    ["Graduation year", detail.graduation_year_snapshot || "Not recorded"],
    ["Form", `${detail.form_title} · ${detail.form_code} · ${detail.form_revision}`],
    ["Status", labelForValue(detail.status)],
    ["Submitted", formatTimestamp(detail.submitted_at)],
    ["Acknowledged", formatTimestamp(detail.counselor_acknowledged_at)],
    ["Latest update", formatTimestamp(detail.updated_at)],
  ];
  return (
    <div className="portal-counseling__detail-content">
      <dl>{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {detail.status !== "DRAFT" && !state.sensitive ? <Button onClick={onSensitive} size="sm" type="button" variant="outline">View authorized answers</Button> : null}
      {state.sensitive?.kind === "loading" ? <div className="portal-counseling__detail-state" role="status"><Skeleton as="span" /><Skeleton as="span" /></div> : null}
      {state.sensitive?.kind === "error" ? <div className="portal-counseling__detail-state" role="status"><p>Authorized answers are unavailable right now.</p><Button onClick={onSensitiveRetry} size="sm" type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button></div> : null}
      {state.sensitive?.kind === "ready" ? <AnswerSummary answers={state.sensitive.detail.answers} /> : null}
    </div>
  );
}

function InventoryTable({
  items,
  details,
  expanded,
  mutation,
  canReopen,
  onAction,
  onRetry,
  onSensitive,
  onSensitiveRetry,
  onToggle,
}: {
  items: PortalInventoryQueueItem[];
  details: Map<PortalInventoryQueueItem, InventoryDetailState>;
  expanded: PortalInventoryQueueItem | null;
  mutation: MutationState | null;
  canReopen: boolean;
  onAction: (item: PortalInventoryQueueItem) => void;
  onRetry: (item: PortalInventoryQueueItem) => void;
  onSensitive: (item: PortalInventoryQueueItem) => void;
  onSensitiveRetry: (item: PortalInventoryQueueItem) => void;
  onToggle: (item: PortalInventoryQueueItem) => void;
}) {
  return (
    <div className="portal-counseling__table-wrap">
      <table className="portal-counseling__table">
        <thead><tr><th scope="col">Student</th><th scope="col">Academic year</th><th scope="col">Form revision</th><th scope="col">Status</th><th scope="col">Submitted/updated</th><th scope="col">Details &amp; actions</th></tr></thead>
        <tbody>
          {items.map((item, index) => {
            const isExpanded = expanded === item;
            const rowId = `${item.academic_year}-${item.schema_version}-${index}`;
            const expandedId = detailId("portal-inventory-detail", rowId);
            const scope = `inventory-${rowId}`;
            const rowMutation = mutation?.scope === scope ? mutation : null;
            return <Fragment key={rowId}>
              <tr className={isExpanded ? "is-expanded" : undefined}>
                <td data-label="Student"><span className="portal-counseling__student-name">{item.student_display_name}</span>{item.student_number ? <span className="portal-counseling__student-number">{item.student_number}</span> : null}</td>
                <td data-label="Academic year">{item.academic_year}</td>
                <td data-label="Form revision">{item.schema_key} · {item.schema_version}</td>
                <td data-label="Status"><Badge data-tone={item.status.toLowerCase()} variant="outline">{labelForValue(item.status)}</Badge></td>
                <td data-label="Submitted/updated"><span>{formatTimestamp(item.submitted_at)}</span><span className="portal-counseling__student-number">Updated {formatTimestamp(item.updated_at)}</span></td>
                <td data-label="Details & actions"><div className="portal-counseling__details-actions"><Button aria-controls={expandedId} aria-expanded={isExpanded} aria-label={`${isExpanded ? "Hide" : "Show"} inventory details`} onClick={() => onToggle(item)} size="xs" type="button" variant="outline">{isExpanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}<span className="sr-only">{isExpanded ? "Hide" : "Show"} details</span></Button>{canReopen && item.status === "SUBMITTED" ? <Button onClick={() => onAction(item)} size="xs" type="button" variant="ghost">Reopen</Button> : null}</div></td>
              </tr>
              {isExpanded ? <tr className="portal-counseling__detail-row"><td colSpan={6} id={expandedId}><InventoryDetails state={details.get(item)} onRetry={() => onRetry(item)} onSensitive={() => onSensitive(item)} onSensitiveRetry={() => onSensitiveRetry(item)} />{rowMutation ? <p className={`portal-counseling__mutation portal-counseling__mutation--${rowMutation.state}`} role={rowMutation.state === "error" ? "alert" : "status"}>{rowMutation.message}</p> : null}</td></tr> : null}
            </Fragment>;
          })}
        </tbody>
      </table>
    </div>
  );
}

function ExitInterviewTable({
  items,
  details,
  expanded,
  mutation,
  capabilities,
  onAction,
  onRetry,
  onSensitive,
  onSensitiveRetry,
  onToggle,
}: {
  items: PortalExitInterviewQueueItem[];
  details: Map<PortalExitInterviewQueueItem, ExitDetailState>;
  expanded: PortalExitInterviewQueueItem | null;
  mutation: MutationState | null;
  capabilities: (capability: string) => boolean;
  onAction: (action: ExitAction, item: PortalExitInterviewQueueItem) => void;
  onRetry: (item: PortalExitInterviewQueueItem) => void;
  onSensitive: (item: PortalExitInterviewQueueItem) => void;
  onSensitiveRetry: (item: PortalExitInterviewQueueItem) => void;
  onToggle: (item: PortalExitInterviewQueueItem) => void;
}) {
  return (
    <div className="portal-counseling__table-wrap">
      <table className="portal-counseling__table">
        <thead><tr><th scope="col">Student</th><th scope="col">Exit interview reference</th><th scope="col">Academic year</th><th scope="col">Form revision</th><th scope="col">Status</th><th scope="col">Submitted/updated</th><th scope="col">Details &amp; actions</th></tr></thead>
        <tbody>
          {items.map((item) => {
            const isExpanded = expanded === item;
            const expandedId = detailId("portal-exit-interview-detail", item.reference_code);
            const scope = `exit-${item.reference_code}`;
            const rowMutation = mutation?.scope === scope ? mutation : null;
            const actions: ExitAction[] = [];
            if (item.status === "SUBMITTED" && capabilities(PORTAL_CAPABILITIES.exitInterviewsAcknowledge)) actions.push("acknowledge");
            if (item.status === "SUBMITTED" && capabilities(PORTAL_CAPABILITIES.exitInterviewsReopen)) actions.push("reopen");
            if (["SUBMITTED", "REOPENED_FOR_CORRECTION"].includes(item.status) && capabilities(PORTAL_CAPABILITIES.exitInterviewsVoid)) actions.push("void");
            if (item.status === "SUBMITTED" && capabilities(PORTAL_CAPABILITIES.exitInterviewsArchive)) actions.push("archive");
            return <Fragment key={item.reference_code}>
              <tr className={isExpanded ? "is-expanded" : undefined}>
                <td data-label="Student"><span className="portal-counseling__student-name">{item.student_display_name}</span>{item.student_number ? <span className="portal-counseling__student-number">{item.student_number}</span> : null}</td>
                <td data-label="Exit interview reference"><span className="portal-counseling__reference">{item.reference_code}</span></td>
                <td data-label="Academic year">{item.academic_year}</td>
                <td data-label="Form revision">{item.form_code} · {item.form_revision}</td>
                <td data-label="Status"><Badge data-tone={item.status.toLowerCase()} variant="outline">{labelForValue(item.status)}</Badge></td>
                <td data-label="Submitted/updated"><span>{formatTimestamp(item.submitted_at)}</span><span className="portal-counseling__student-number">Updated {formatTimestamp(item.updated_at)}</span></td>
                <td data-label="Details & actions"><div className="portal-counseling__details-actions"><Button aria-controls={expandedId} aria-expanded={isExpanded} aria-label={`${isExpanded ? "Hide" : "Show"} exit interview details`} onClick={() => onToggle(item)} size="xs" type="button" variant="outline">{isExpanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}<span className="sr-only">{isExpanded ? "Hide" : "Show"} details</span></Button>{actions.map((action) => <Button key={action} onClick={() => onAction(action, item)} size="xs" type="button" variant={action === "void" ? "outline" : "ghost"}>{labelForValue(action)}</Button>)}</div></td>
              </tr>
              {isExpanded ? <tr className="portal-counseling__detail-row"><td colSpan={7} id={expandedId}><ExitDetails state={details.get(item)} onRetry={() => onRetry(item)} onSensitive={() => onSensitive(item)} onSensitiveRetry={() => onSensitiveRetry(item)} />{rowMutation ? <p className={`portal-counseling__mutation portal-counseling__mutation--${rowMutation.state}`} role={rowMutation.state === "error" ? "alert" : "status"}>{rowMutation.message}</p> : null}</td></tr> : null}
            </Fragment>;
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ section }: { section: FormsSection }) {
  const label = section === "inventory" ? "inventory submissions" : "exit interviews";
  return <div className="portal-counseling__empty" role="status"><h2>No {label} to show.</h2><p>Try changing the filters or check back after more submissions are recorded.</p></div>;
}

function FormsPagination({ section, page, filters }: { section: FormsSection; page: PortalFormsPage<unknown>; filters: FormsListFilters }) {
  const totalPages = Math.max(1, Math.ceil(page.total / page.page_size));
  if (totalPages <= 1) return null;
  return <Pagination aria-label={`${section === "inventory" ? "Inventory" : "Exit interview"} pages`} className="portal-counseling__pagination"><PaginationContent><PaginationItem>{page.page > 1 ? <PaginationPrevious href={formsHref(section, page.page - 1, filters)} text="Previous" /> : <span aria-hidden="true" className="portal-counseling__pagination-spacer" />}</PaginationItem><PaginationItem className="portal-counseling__pagination-current"><span aria-current="page">Page {page.page} of {totalPages}</span></PaginationItem><PaginationItem>{page.page < totalPages ? <PaginationNext href={formsHref(section, page.page + 1, filters)} text="Next" /> : <span aria-hidden="true" className="portal-counseling__pagination-spacer" />}</PaginationItem></PaginationContent></Pagination>;
}

export function PortalFormsLoading() {
  return <section aria-busy="true" aria-labelledby="portal-forms-loading-heading" className="portal-counseling portal-counseling--loading" role="status"><span className="sr-only">Loading forms and submissions…</span><FormsHeader /><div className="portal-counseling__workspace"><div aria-hidden="true" className="compass-surface portal-workspace-nav portal-counseling__nav-skeleton" data-tone="subtle">{FORMS_NAV_ITEMS.map((item) => <Skeleton className="portal-counseling__nav-skeleton-line" key={item.value} />)}</div><div className="portal-counseling__active-content"><PortalFilterPanel action="/portal/forms?section=inventory" ariaBusy className="portal-counseling__filters" resetKey="forms-loading" summary={<Skeleton as="span" aria-hidden="true" className="portal-counseling__skeleton-summary" />}><div aria-hidden="true" className="portal-counseling__filter-skeleton-grid">{Array.from({ length: 5 }, (_, index) => <Skeleton as="span" key={index} />)}</div></PortalFilterPanel><PortalCollectionFrame className="portal-counseling__frame"><div aria-hidden="true" className="portal-counseling__table-skeleton">{Array.from({ length: 5 }, (_, row) => <div className="portal-counseling__table-skeleton-row" key={row}>{Array.from({ length: 7 }, (_, cell) => <Skeleton as="span" key={cell} />)}</div>)}</div></PortalCollectionFrame></div></div></section>;
}

export function PortalFormsPage() {
  const { hasCapability, status: accessStatus } = usePortalAccess();
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawQuery = searchParams.toString();
  const requestedSection = searchParams.get("section");
  const requested = requestedSection === "exit-interviews" ? "exit-interviews" : requestedSection === "inventory" ? "inventory" : "inventory";
  const navItems = useMemo<FormsNavItem[]>(() => accessStatus === "ready" ? getFormsNavItems(hasCapability) : [...FORMS_NAV_ITEMS], [accessStatus, hasCapability]);
  const section = (navItems.find((item) => item.value === requested)?.value ?? navItems[0]?.value ?? "inventory") as FormsSection;
  const filters = useMemo(() => section === "inventory" ? parseInventoryFilters(searchParams) : parseExitInterviewFilters(searchParams), [searchParams, section]);
  const pageNumber = parsePage(searchParams.get("page"));
  const canonicalHref = formsHref(section, pageNumber, filters);
  const canonicalQuery = canonicalHref.split("?")[1] ?? "";
  const [inventoryState, setInventoryState] = useState<FormsLoadState<PortalInventoryQueueItem>>({ kind: "loading" });
  const [exitState, setExitState] = useState<FormsLoadState<PortalExitInterviewQueueItem>>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedInventory, setExpandedInventory] = useState<PortalInventoryQueueItem | null>(null);
  const [expandedExit, setExpandedExit] = useState<PortalExitInterviewQueueItem | null>(null);
  const [inventoryDetails, setInventoryDetails] = useState<Map<PortalInventoryQueueItem, InventoryDetailState>>(new Map());
  const [exitDetails, setExitDetails] = useState<Map<PortalExitInterviewQueueItem, ExitDetailState>>(new Map());
  const [actionIntent, setActionIntent] = useState<ActionIntent | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [mutation, setMutation] = useState<MutationState | null>(null);
  const mutationKeysRef = useRef<Map<string, MutationKeyEntry>>(new Map());
  const canQueue = accessStatus === "ready" && navItems.length > 0;

  useEffect(() => {
    if (rawQuery !== canonicalQuery) router.replace(canonicalHref, { scroll: false });
  }, [canonicalHref, canonicalQuery, rawQuery, router]);

  useEffect(() => {
    if (!canQueue) return;
    const controller = new AbortController();
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active || controller.signal.aborted) return;
      setMutation(null);
      setExpandedInventory(null);
      setExpandedExit(null);
      setInventoryDetails(new Map());
      setExitDetails(new Map());
      setInventoryState({ kind: "loading" });
      setExitState({ kind: "loading" });
      if (section === "inventory") {
        const page = await getPortalInventoryQueue(pageNumber, filters, controller.signal);
        if (active && !controller.signal.aborted) setInventoryState({ kind: "ready", page });
      } else {
        const page = await getPortalExitInterviewQueue(pageNumber, filters, controller.signal);
        if (active && !controller.signal.aborted) setExitState({ kind: "ready", page });
      }
    }).catch((error: unknown) => {
      if (!active || controller.signal.aborted || isAbortError(error)) return;
      const state = error instanceof FormsApiError && error.kind === "permission"
        ? { kind: "forbidden" as const }
        : { kind: "unavailable" as const, error: error instanceof FormsApiError && (error.kind === "rate_limited" || error.kind === "validation") ? error.kind : "unavailable" as const };
      if (section === "inventory") setInventoryState(state);
      else setExitState(state);
    });
    return () => { active = false; controller.abort(); };
  }, [canQueue, filters, pageNumber, reloadKey, section]);

  const loadInventoryDetail = (item: PortalInventoryQueueItem) => {
    setInventoryDetails((current) => new Map(current).set(item, { kind: "loading" }));
    void getPortalInventoryQueueDetail(item).then((detail) => {
      setInventoryDetails((current) => new Map(current).set(item, { kind: "ready", detail }));
    }).catch((error: unknown) => {
      if (!isAbortError(error)) setInventoryDetails((current) => new Map(current).set(item, { kind: "error" }));
    });
  };

  const loadInventorySensitive = (item: PortalInventoryQueueItem) => {
    setInventoryDetails((current) => {
      const next = new Map(current);
      const existing = next.get(item);
      if (existing?.kind === "ready") next.set(item, { ...existing, sensitive: { kind: "loading" } });
      return next;
    });
    void getPortalInventorySubmittedAnswers(item).then((detail) => {
      setInventoryDetails((current) => {
        const next = new Map(current);
        const existing = next.get(item);
        if (existing?.kind === "ready") next.set(item, { ...existing, sensitive: { kind: "ready", detail } });
        return next;
      });
    }).catch((error: unknown) => {
      if (!isAbortError(error)) setInventoryDetails((current) => {
        const next = new Map(current);
        const existing = next.get(item);
        if (existing?.kind === "ready") next.set(item, { ...existing, sensitive: { kind: "error" } });
        return next;
      });
    });
  };

  const loadExitDetail = (item: PortalExitInterviewQueueItem) => {
    setExitDetails((current) => new Map(current).set(item, { kind: "loading" }));
    void getPortalExitInterviewQueueDetail(item.reference_code).then((detail) => {
      setExitDetails((current) => new Map(current).set(item, { kind: "ready", detail }));
    }).catch((error: unknown) => {
      if (!isAbortError(error)) setExitDetails((current) => new Map(current).set(item, { kind: "error" }));
    });
  };

  const loadExitSensitive = (item: PortalExitInterviewQueueItem) => {
    setExitDetails((current) => {
      const next = new Map(current);
      const existing = next.get(item);
      if (existing?.kind === "ready") next.set(item, { ...existing, sensitive: { kind: "loading" } });
      return next;
    });
    void getPortalExitInterviewAnswers(item.reference_code).then((detail) => {
      setExitDetails((current) => {
        const next = new Map(current);
        const existing = next.get(item);
        if (existing?.kind === "ready") next.set(item, { ...existing, sensitive: { kind: "ready", detail } });
        return next;
      });
    }).catch((error: unknown) => {
      if (!isAbortError(error)) setExitDetails((current) => {
        const next = new Map(current);
        const existing = next.get(item);
        if (existing?.kind === "ready") next.set(item, { ...existing, sensitive: { kind: "error" } });
        return next;
      });
    });
  };

  const toggleInventory = (item: PortalInventoryQueueItem) => {
    if (expandedInventory === item) return setExpandedInventory(null);
    setExpandedExit(null);
    setExpandedInventory(item);
    if (!inventoryDetails.has(item)) loadInventoryDetail(item);
  };

  const toggleExit = (item: PortalExitInterviewQueueItem) => {
    if (expandedExit === item) return setExpandedExit(null);
    setExpandedInventory(null);
    setExpandedExit(item);
    if (!exitDetails.has(item)) loadExitDetail(item);
  };

  const getMutationKey = (scope: string, fingerprint: string) => {
    const existing = mutationKeysRef.current.get(scope);
    if (existing?.fingerprint === fingerprint) return existing.key;
    const key = createIdempotencyKey();
    mutationKeysRef.current.set(scope, { fingerprint, key });
    return key;
  };

  const confirmAction = async () => {
    if (!actionIntent) return;
    const reasonRequired = actionIntent.kind === "inventory-reopen" || actionIntent.action !== "acknowledge";
    const reason = actionReason.trim();
    if (reasonRequired && !reason) {
      setActionError("A bounded reason is required.");
      return;
    }
    const scope = actionIntent.kind === "inventory-reopen"
      ? `inventory-${actionIntent.item.academic_year}-${actionIntent.item.schema_version}`
      : `exit-${actionIntent.item.reference_code}`;
    const action = actionIntent.kind === "inventory-reopen" ? "reopen" : actionIntent.action;
    const fingerprint = `${action}:${reason}`;
    const key = getMutationKey(scope, fingerprint);
    setMutation({ scope, state: "pending", message: "Saving change…" });
    setActionError(null);
    try {
      if (actionIntent.kind === "inventory-reopen") {
        await reopenPortalInventory(actionIntent.item, reason, "", key);
      } else if (actionIntent.action === "acknowledge") {
        await acknowledgePortalExitInterview(actionIntent.item.reference_code, key);
      } else if (actionIntent.action === "reopen") {
        await reopenPortalExitInterview(actionIntent.item.reference_code, reason, key);
      } else if (actionIntent.action === "void") {
        await voidPortalExitInterview(actionIntent.item.reference_code, reason, key);
      } else {
        await archivePortalExitInterview(actionIntent.item.reference_code, reason, key);
      }
      setMutation({ scope, state: "success", message: "Change saved." });
      setActionIntent(null);
      setActionReason("");
      setReloadKey((value) => value + 1);
    } catch (error) {
      if (error instanceof FormsApiError) {
        setMutation({ scope, state: "error", message: mutationMessage(error) });
        setActionError(mutationMessage(error));
      } else {
        setMutation({ scope, state: "error", message: "This action is temporarily unavailable. Try again." });
        setActionError("This action is temporarily unavailable. Try again.");
      }
    }
  };

  const currentLoadState = section === "inventory" ? inventoryState : exitState;
  const currentPage = currentLoadState.kind === "ready" ? currentLoadState.page : null;

  if (accessStatus === "loading") return <PortalFormsLoading />;
  if (!canQueue) {
    return <section aria-labelledby="portal-forms-access-heading" className="portal-counseling portal-counseling--state"><FormsHeader /><PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state"><ClipboardList aria-hidden="true" className="portal-counseling__state-icon" /><h2 id="portal-forms-access-heading">Forms and submissions aren’t available for this account.</h2><p>Return to your workspace to continue.</p></PortalCollectionFrame></section>;
  }

  return (
    <section aria-labelledby="portal-forms-heading" className="portal-counseling portal-forms">
      <FormsHeader />
      <div className="portal-counseling__workspace">
        <PortalWorkspaceNav activeValue={section} ariaLabel="Forms and submissions sections" items={navItems} />
        <div className="portal-counseling__active-content">
          <FormsFilterPanel filters={filters} section={section} />
          {currentLoadState.kind === "loading" ? <PortalCollectionFrame className="portal-counseling__frame"><div aria-hidden="true" className="portal-counseling__table-skeleton">{Array.from({ length: 5 }, (_, row) => <div className="portal-counseling__table-skeleton-row" key={row}>{Array.from({ length: section === "inventory" ? 6 : 7 }, (_, cell) => <Skeleton as="span" key={cell} />)}</div>)}</div></PortalCollectionFrame> : null}
          {currentLoadState.kind === "forbidden" ? <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state"><h2>This page isn’t available for this account.</h2><p>Return to your workspace to continue.</p></PortalCollectionFrame> : null}
          {currentLoadState.kind === "unavailable" ? <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state"><h2>{formsLoadMessage(currentLoadState.error)}</h2><p>Try again when the connection is ready.</p><Button onClick={() => setReloadKey((value) => value + 1)} type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button></PortalCollectionFrame> : null}
          {currentLoadState.kind === "ready" && currentPage ? <PortalCollectionFrame aria-labelledby="portal-forms-results-heading" className="portal-counseling__frame"><div className="portal-counseling__frame-heading"><div><p className="portal-counseling__kicker">{section === "inventory" ? "Individual Inventory" : "Exit Interviews"}</p><h2 id="portal-forms-results-heading">{section === "inventory" ? "Inventory submissions" : "Exit interviews"}</h2></div><p className="portal-counseling__result-count">{currentPage.total} {currentPage.total === 1 ? "submission" : "submissions"}</p></div>{mutation ? <p className={`portal-counseling__mutation portal-counseling__mutation--${mutation.state}`} role={mutation.state === "error" ? "alert" : "status"}>{mutation.message}</p> : null}{currentPage.items.length === 0 ? <EmptyState section={section} /> : section === "inventory" ? <InventoryTable canReopen={hasCapability(PORTAL_CAPABILITIES.inventoryReopen)} details={inventoryDetails} expanded={expandedInventory} items={currentPage.items as PortalInventoryQueueItem[]} mutation={mutation} onAction={(item) => { setActionIntent({ kind: "inventory-reopen", item }); setActionReason(""); setActionError(null); }} onRetry={(item) => loadInventoryDetail(item)} onSensitive={(item) => loadInventorySensitive(item)} onSensitiveRetry={(item) => loadInventorySensitive(item)} onToggle={toggleInventory} /> : <ExitInterviewTable capabilities={hasCapability} details={exitDetails} expanded={expandedExit} items={currentPage.items as PortalExitInterviewQueueItem[]} mutation={mutation} onAction={(action, item) => { setActionIntent({ kind: "exit", action, item }); setActionReason(""); setActionError(null); }} onRetry={(item) => loadExitDetail(item)} onSensitive={(item) => loadExitSensitive(item)} onSensitiveRetry={(item) => loadExitSensitive(item)} onToggle={toggleExit} />}<FormsPagination filters={filters} page={currentPage as PortalFormsPage<unknown>} section={section} /></PortalCollectionFrame> : null}
        </div>
      </div>
      <AlertDialog onOpenChange={(open) => { if (!open && mutation?.state !== "pending") { setActionIntent(null); setActionReason(""); setActionError(null); } }} open={actionIntent !== null}>
        <AlertDialogContent className="portal-counseling__dialog" size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{actionIntent?.kind === "inventory-reopen" ? "Reopen inventory for correction" : actionIntent ? labelForValue(actionIntent.action) : "Submission action"}</AlertDialogTitle>
            <AlertDialogDescription>{actionIntent?.kind === "inventory-reopen" ? "This sends the submitted inventory into the existing correction workflow." : "Review this submission action before continuing."}</AlertDialogDescription>
          </AlertDialogHeader>
          {actionIntent && (actionIntent.kind === "inventory-reopen" || actionIntent.action !== "acknowledge") ? <div className="portal-counseling__dialog-field"><Label htmlFor="portal-forms-action-reason">Reason</Label><Textarea id="portal-forms-action-reason" maxLength={500} onChange={(event) => setActionReason(event.target.value)} value={actionReason} /></div> : null}
          {actionError ? <p className="portal-counseling__dialog-error" role="alert">{actionError}</p> : null}
          <AlertDialogFooter><AlertDialogCancel disabled={mutation?.state === "pending"}>Keep submission</AlertDialogCancel><AlertDialogAction disabled={mutation?.state === "pending"} onClick={() => void confirmAction()}>{mutation?.state === "pending" ? "Saving…" : "Continue"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
