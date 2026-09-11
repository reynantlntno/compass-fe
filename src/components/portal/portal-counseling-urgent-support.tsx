"use client";

import { ChevronDown, ChevronUp, HeartHandshake, RefreshCw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";

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
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
import { PortalFilterPanel } from "@/components/portal/portal-filter-panel";
import { PortalPageHeader } from "@/components/portal/portal-page-header";
import { PORTAL_CAPABILITIES } from "@/components/portal/portal-navigation";
import { PortalStatusFilter } from "@/components/portal/portal-status-filter";
import { type CounselingNavItem } from "@/components/portal/portal-counseling-navigation";
import { PortalWorkspaceNav } from "@/components/portal/portal-workspace-nav";
import { CounselingApiError } from "@/lib/api/counseling";
import { createIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";
import {
  closePortalUrgentSupport,
  getPortalUrgentCounselorOptions,
  getPortalUrgentSupport,
  getPortalUrgentSupportDetail,
  grantPortalUrgentSupportAccess,
  parseUrgentSupportFilters,
  revokePortalUrgentSupportAccess,
  reviewPortalUrgentSupport,
  triagePortalUrgentSupport,
  urgentSupportHref,
  URGENT_SUPPORT_ASSIGNMENTS,
  URGENT_SUPPORT_ORDERS,
  URGENT_SUPPORT_REVIEW_STATUSES,
  URGENT_SUPPORT_SOURCE_TYPES,
  URGENT_SUPPORT_STATUSES,
  URGENT_SUPPORT_URGENCY_LEVELS,
  type PortalUrgentCounselorOption,
  type PortalUrgentSupport,
  type PortalUrgentSupportDetail,
  type PortalUrgentSupportPage,
  type UrgentSupportAssignment,
  type UrgentSupportOrder,
  type UrgentSupportReviewStatus,
  type UrgentSupportSource,
  type UrgentSupportStatus,
  type UrgentSupportUrgency,
} from "@/lib/api/urgent-support";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; page: PortalUrgentSupportPage }
  | { kind: "unavailable"; error: "unavailable" | "rate_limited" | "validation" }
  | { kind: "forbidden" };

type DetailState =
  | { kind: "loading" }
  | { kind: "ready"; detail: PortalUrgentSupportDetail }
  | { kind: "error" };

type OptionState =
  | { kind: "loading" }
  | { kind: "ready"; options: PortalUrgentCounselorOption[] }
  | { kind: "error" };

type UrgentAction = "triage" | "review" | "close" | "grant" | "revoke";
type ActionIntent = { action: UrgentAction; request: PortalUrgentSupport; grantToken?: string };
type MutationState = { referenceCode: string; state: "pending" | "success" | "error"; message: string };
type MutationKeyEntry = { fingerprint: string; key: IdempotencyKey };

const STATUS_OPTIONS: readonly { label: string; value: UrgentSupportStatus }[] = [
  { label: "Open", value: "OPEN" },
  { label: "Triage access granted", value: "TRIAGE_ACCESS_GRANTED" },
  { label: "Triage in progress", value: "TRIAGE_IN_PROGRESS" },
  { label: "Pending Head Guidance review", value: "PENDING_HEAD_REVIEW" },
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "Revoked", value: "REVOKED" },
  { label: "Closed", value: "CLOSED" },
  { label: "Expired", value: "EXPIRED" },
];
const URGENCY_OPTIONS: readonly { label: string; value: UrgentSupportUrgency }[] = [
  { label: "Immediate triage", value: "IMMEDIATE_TRIAGE" },
  { label: "Same-day review", value: "SAME_DAY_REVIEW" },
  { label: "Prompt review", value: "PROMPT_REVIEW" },
];
const SOURCE_OPTIONS: readonly { label: string; value: UrgentSupportSource }[] = [
  { label: "Counselor manual", value: "COUNSELOR_MANUAL" },
  { label: "Head Guidance manual", value: "HEAD_GUIDANCE_MANUAL" },
  { label: "Session flag", value: "SESSION_FLAG" },
  { label: "Case flag", value: "CASE_FLAG" },
];
const REVIEW_OPTIONS: readonly { label: string; value: UrgentSupportReviewStatus }[] = [
  { label: "Not reviewed", value: "NOT_REVIEWED" },
  { label: "Reviewed and confirmed", value: "REVIEWED_CONFIRMED" },
  { label: "Reassignment required", value: "REVIEWED_REASSIGNMENT_REQUIRED" },
  { label: "Case collaborator required", value: "REVIEWED_CASE_COLLABORATOR_REQUIRED" },
  { label: "Close allowed", value: "REVIEWED_CLOSE_ALLOWED" },
  { label: "Reviewed and revoked", value: "REVIEWED_REVOKED" },
];
const TRIAGE_MODE_OPTIONS = [
  { label: "On-site", value: "ONSITE" },
  { label: "Online", value: "ONLINE" },
] as const;
const GRANT_TYPE_OPTIONS = [
  { label: "Triage session", value: "TRIAGE_SESSION" },
  { label: "Case review", value: "CASE_REVIEW" },
  { label: "Session review", value: "SESSION_REVIEW" },
  { label: "Documentation only", value: "DOCUMENTATION_ONLY" },
] as const;
const GRANT_PURPOSE_OPTIONS = [
  { label: "Urgent triage", value: "URGENT_TRIAGE" },
  { label: "Head Guidance review", value: "HEAD_GUIDANCE_REVIEW" },
  { label: "Post-action documentation", value: "POST_ACTION_DOCUMENTATION" },
  { label: "Assignment decision", value: "ASSIGNMENT_DECISION" },
] as const;
const CLOSE_REASON_OPTIONS = [
  { label: "Triage completed", value: "TRIAGE_COMPLETED" },
  { label: "Formal assignment completed", value: "FORMAL_ASSIGNMENT_COMPLETED" },
  { label: "Case collaborator added", value: "CASE_COLLABORATOR_ADDED" },
  { label: "No further urgent support needed", value: "NO_FURTHER_URGENT_SUPPORT_NEEDED" },
  { label: "Duplicate or created in error", value: "DUPLICATE_OR_CREATED_IN_ERROR" },
  { label: "Revoked by Head Guidance", value: "REVOKED_BY_HEAD_GUIDANCE" },
] as const;

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function labelForValue(value: string | null | undefined) {
  return value ? value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not provided";
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function detailId(referenceCode: string) {
  return `portal-urgent-support-detail-${referenceCode.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function actionMessage(error: CounselingApiError) {
  switch (error.kind) {
    case "conflict": return "This urgent-support request changed. Refresh the workspace and try again.";
    case "permission": return "This action is not available for this account.";
    case "validation": return "Check the selected values and try again.";
    case "rate_limited": return "Too many attempts. Please wait before trying again.";
    default: return "This urgent-support action is temporarily unavailable. Try again.";
  }
}

function canUrgentAction(action: UrgentAction, request: PortalUrgentSupport, hasCapability: (capability: string) => boolean) {
  const terminal = request.status === "CLOSED" || request.status === "EXPIRED" || request.status === "REVOKED";
  if (action === "triage") return !terminal && ["OPEN", "TRIAGE_ACCESS_GRANTED", "TRIAGE_IN_PROGRESS"].includes(request.status) && (hasCapability(PORTAL_CAPABILITIES.urgentSupportLifecycleManage) || hasCapability(PORTAL_CAPABILITIES.urgentSupportAssign));
  if (action === "review") return !terminal && hasCapability(PORTAL_CAPABILITIES.urgentSupportQueueReview);
  if (action === "close") return !terminal && hasCapability(PORTAL_CAPABILITIES.urgentSupportLifecycleManage);
  if (action === "grant") return !terminal && hasCapability(PORTAL_CAPABILITIES.urgentSupportTemporaryAccessManage);
  return hasCapability(PORTAL_CAPABILITIES.urgentSupportTemporaryAccessManage);
}

function UrgentHeader() {
  return <PortalPageHeader className="portal-counseling__page-header" current="Counseling" description="Review urgent-support requests within your authorized scope." headingId="portal-counseling-urgent-heading" title="Counseling" />;
}

function UrgentFilterPanel({ filters }: { filters: ReturnType<typeof parseUrgentSupportFilters> }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const statuses = form.getAll("status").filter((value): value is string => typeof value === "string" && (URGENT_SUPPORT_STATUSES as readonly string[]).includes(value)) as UrgentSupportStatus[];
    const next = {
      q: String(form.get("q") ?? "").trim().slice(0, 120) || null,
      status: statuses.length ? statuses.join(",") : null,
      statuses,
      urgencyLevel: (URGENT_SUPPORT_URGENCY_LEVELS as readonly string[]).includes(String(form.get("urgency_level") ?? "")) ? String(form.get("urgency_level")) as UrgentSupportUrgency : null,
      sourceType: (URGENT_SUPPORT_SOURCE_TYPES as readonly string[]).includes(String(form.get("source_type") ?? "")) ? String(form.get("source_type")) as UrgentSupportSource : null,
      assignment: (URGENT_SUPPORT_ASSIGNMENTS as readonly string[]).includes(String(form.get("assignment") ?? "all")) ? String(form.get("assignment")) as UrgentSupportAssignment : "all" as const,
      reviewStatus: (URGENT_SUPPORT_REVIEW_STATUSES as readonly string[]).includes(String(form.get("review_status") ?? "")) ? String(form.get("review_status")) as UrgentSupportReviewStatus : null,
      order: (URGENT_SUPPORT_ORDERS as readonly string[]).includes(String(form.get("order") ?? "recent")) ? String(form.get("order")) as UrgentSupportOrder : "recent" as const,
    };
    startTransition(() => router.push(urgentSupportHref(1, next), { scroll: false }));
  };
  return <PortalFilterPanel accessibleLabel="urgent support filters" action="/portal/counseling?section=urgent-support" ariaBusy={isPending} className="portal-counseling__filters" onSubmit={handleSubmit} resetKey={`${filters.q ?? ""}:${filters.status ?? ""}:${filters.urgencyLevel ?? ""}:${filters.sourceType ?? ""}:${filters.assignment}:${filters.reviewStatus ?? ""}:${filters.order}`} summary="Search and narrow the urgent-support requests visible to this account.">
    <div className="portal-counseling__filters-grid">
      <div className="portal-counseling__filter-field portal-counseling__filter-field--search"><Label htmlFor="portal-urgent-search">Search</Label><Input defaultValue={filters.q ?? ""} id="portal-urgent-search" name="q" placeholder="Reference, student name, or student number" /></div>
      <div className="portal-counseling__filter-field"><Label htmlFor="portal-urgent-status">Status</Label><PortalStatusFilter ariaLabel="Urgent-support status filter" id="portal-urgent-status" options={STATUS_OPTIONS} selectedValues={filters.statuses} title="Urgent-support status" /></div>
      <div className="portal-counseling__filter-field"><Label htmlFor="portal-urgent-urgency">Urgency</Label><select defaultValue={filters.urgencyLevel ?? ""} id="portal-urgent-urgency" name="urgency_level"><option value="">All urgency levels</option>{URGENCY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
      <div className="portal-counseling__filter-field"><Label htmlFor="portal-urgent-source">Source</Label><select defaultValue={filters.sourceType ?? ""} id="portal-urgent-source" name="source_type"><option value="">All sources</option>{SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
      <div className="portal-counseling__filter-field"><Label htmlFor="portal-urgent-assignment">Assignment</Label><select defaultValue={filters.assignment} id="portal-urgent-assignment" name="assignment"><option value="all">All assignments</option><option value="mine">Assigned to me</option><option value="unassigned">Unassigned</option></select></div>
      <div className="portal-counseling__filter-field"><Label htmlFor="portal-urgent-review">Review status</Label><select defaultValue={filters.reviewStatus ?? ""} id="portal-urgent-review" name="review_status"><option value="">All review states</option>{REVIEW_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
      <div className="portal-counseling__filter-field"><Label htmlFor="portal-urgent-order">Order</Label><select defaultValue={filters.order} id="portal-urgent-order" name="order"><option value="recent">Recently updated</option><option value="oldest">Oldest updated</option></select></div>
    </div>
    <div className="portal-counseling__filter-actions"><Button disabled={isPending} size="sm" type="submit">Apply filters</Button><a className="portal-counseling__filter-clear" href="/portal/counseling?section=urgent-support">Clear</a></div>
  </PortalFilterPanel>;
}

function UrgentDetail({ detail, onRetry }: { detail: DetailState | undefined; onRetry: () => void }) {
  if (!detail || detail.kind === "loading") return <div className="portal-counseling__detail-state" role="status"><Skeleton as="span" /><Skeleton as="span" /></div>;
  if (detail.kind === "error") return <div className="portal-counseling__detail-state" role="status"><p>Urgent-support details are unavailable right now.</p><Button onClick={onRetry} size="sm" type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button></div>;
  const value = detail.detail;
  const facts = [
    ["Urgency", labelForValue(value.urgency_level)],
    ["Source", labelForValue(value.source_type)],
    ["Status", labelForValue(value.status)],
    ["Review", labelForValue(value.review_status)],
    ["Documentation", labelForValue(value.documentation_status)],
    ["Created", formatTimestamp(value.created_at)],
    ["Updated", formatTimestamp(value.updated_at)],
    ["Reviewed", formatTimestamp(value.reviewed_at)],
    ["Closed", formatTimestamp(value.closed_at)],
    ["Expiry", formatTimestamp(value.expires_at)],
    value.counseling_case_reference ? ["Linked case", value.counseling_case_reference] : null,
    value.originating_session_reference ? ["Originating session", value.originating_session_reference] : null,
    value.documentation_session_reference ? ["Documentation session", value.documentation_session_reference] : null,
  ].filter((fact): fact is [string, string] => Boolean(fact));
  return <div className="portal-counseling__detail-content"><dl>{facts.map(([label, fact]) => <div key={label}><dt>{label}</dt><dd>{fact}</dd></div>)}</dl>{value.active_access_grants.length ? <div className="portal-counseling__urgent-grant-list"><p className="portal-counseling__kicker">Active temporary access</p><ul>{value.active_access_grants.map((grant) => <li key={`${grant.display_name}:${grant.grant_type}:${grant.expires_at}`}><span>{grant.display_name}</span><span>{labelForValue(grant.grant_type)} · expires {formatTimestamp(grant.expires_at)}</span></li>)}</ul></div> : null}</div>;
}

function UrgentActions({ request, hasCapability, onAction }: { request: PortalUrgentSupport; hasCapability: (capability: string) => boolean; onAction: (action: UrgentAction, request: PortalUrgentSupport, grantToken?: string) => void }) {
  const actions: UrgentAction[] = (["triage", "review", "close", "grant"] as UrgentAction[]).filter((action) => canUrgentAction(action, request, hasCapability));
  if (!actions.length) return null;
  return <div aria-label={`Actions for ${request.reference_code}`} className="portal-counseling__row-actions">{actions.map((action) => <Button key={action} onClick={() => onAction(action, request)} size="xs" type="button" variant={action === "close" ? "outline" : "ghost"}>{action === "triage" ? "Create triage session" : action === "review" ? "Review" : action === "close" ? "Close" : "Grant access"}</Button>)}</div>;
}

function UrgentTable({ requests, details, expandedReference, hasCapability, mutation, onAction, onRetryDetail, onToggle }: { requests: PortalUrgentSupport[]; details: Record<string, DetailState>; expandedReference: string | null; hasCapability: (capability: string) => boolean; mutation: MutationState | null; onAction: (action: UrgentAction, request: PortalUrgentSupport, grantToken?: string) => void; onRetryDetail: (request: PortalUrgentSupport) => void; onToggle: (request: PortalUrgentSupport) => void }) {
  return <div className="portal-counseling__table-wrap"><table className="portal-counseling__table"><thead><tr><th scope="col">Student</th><th scope="col">Urgent reference</th><th scope="col">Urgency</th><th scope="col">Status</th><th scope="col">Source</th><th scope="col">Review</th><th scope="col">Latest activity</th><th scope="col">Assignment</th><th scope="col">Details &amp; actions</th></tr></thead><tbody>{requests.map((request) => {
    const expanded = expandedReference === request.reference_code;
    const expandedId = detailId(request.reference_code);
    const rowMutation = mutation?.referenceCode === request.reference_code ? mutation : null;
    const expandedDetail = details[request.reference_code];
    return <Fragment key={request.reference_code}><tr className={expanded ? "is-expanded" : undefined}>
      <td data-label="Student"><span className="portal-counseling__student-name">{request.student_display_name ?? "Student details unavailable"}</span>{request.student_number ? <span className="portal-counseling__student-number">{request.student_number}</span> : null}</td>
      <td data-label="Urgent reference"><span className="portal-counseling__reference">{request.reference_code}</span></td>
      <td data-label="Urgency"><Badge data-tone={request.urgency_level.toLowerCase()} variant="outline">{labelForValue(request.urgency_level)}</Badge></td>
      <td data-label="Status"><Badge data-tone={request.status.toLowerCase()} variant="outline">{labelForValue(request.status)}</Badge></td>
      <td data-label="Source">{labelForValue(request.source_type)}</td>
      <td data-label="Review"><Badge data-tone={request.review_status?.toLowerCase() ?? "neutral"} variant="outline">{labelForValue(request.review_status)}</Badge></td>
      <td data-label="Latest activity">{formatTimestamp(request.updated_at ?? request.created_at)}</td>
      <td data-label="Assignment">{request.assignment_state ?? "Assignment unavailable"}</td>
      <td data-label="Details & actions"><div className="portal-counseling__details-actions"><Button aria-controls={expandedId} aria-expanded={expanded} aria-label={`${expanded ? "Hide" : "Show"} details for ${request.reference_code}`} onClick={() => onToggle(request)} size="xs" type="button" variant="outline">{expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}<span className="sr-only">{expanded ? "Hide" : "Show"} details</span></Button><UrgentActions hasCapability={hasCapability} onAction={onAction} request={request} /></div></td>
    </tr>{expanded ? <tr className="portal-counseling__detail-row"><td colSpan={9} id={expandedId}><UrgentDetail detail={expandedDetail} onRetry={() => onRetryDetail(request)} />{expandedDetail?.kind === "ready" && expandedDetail.detail.active_access_grants.length && hasCapability(PORTAL_CAPABILITIES.urgentSupportTemporaryAccessManage) ? <div className="portal-counseling__urgent-grant-actions">{expandedDetail.detail.active_access_grants.map((grant) => <Button key={grant.selection_token} onClick={() => onAction("revoke", request, grant.selection_token)} size="xs" type="button" variant="outline">Revoke access for {grant.display_name}</Button>)}</div> : null}{rowMutation ? <p className={`portal-counseling__mutation portal-counseling__mutation--${rowMutation.state}`} role={rowMutation.state === "error" ? "alert" : "status"}>{rowMutation.message}</p> : null}</td></tr> : null}</Fragment>;
  })}</tbody></table></div>;
}

function UrgentPagination({ page, filters }: { page: PortalUrgentSupportPage; filters: ReturnType<typeof parseUrgentSupportFilters> }) {
  const totalPages = Math.max(1, Math.ceil(page.total / page.page_size));
  if (totalPages <= 1) return null;
  return <Pagination aria-label="Urgent-support pages" className="portal-counseling__pagination"><PaginationContent><PaginationItem>{page.page > 1 ? <PaginationPrevious href={urgentSupportHref(page.page - 1, filters)} text="Previous" /> : <span aria-hidden="true" className="portal-counseling__pagination-spacer" />}</PaginationItem><PaginationItem className="portal-counseling__pagination-current"><span aria-current="page">Page {page.page} of {totalPages}</span></PaginationItem><PaginationItem>{page.page < totalPages ? <PaginationNext href={urgentSupportHref(page.page + 1, filters)} text="Next" /> : <span aria-hidden="true" className="portal-counseling__pagination-spacer" />}</PaginationItem></PaginationContent></Pagination>;
}

function UrgentLoadingState({ navItems }: { navItems: readonly CounselingNavItem[] }) {
  return <section aria-busy="true" aria-labelledby="portal-counseling-urgent-loading-heading" className="portal-counseling portal-counseling--loading" role="status"><span className="sr-only">Loading urgent support…</span><UrgentHeader /><div className="portal-counseling__workspace"><div aria-hidden="true" className="compass-surface portal-workspace-nav portal-counseling__nav-skeleton" data-tone="subtle">{navItems.map((item) => <Skeleton className="portal-counseling__nav-skeleton-line" key={item.value} />)}</div><div className="portal-counseling__content-skeleton"><PortalFilterPanel action="/portal/counseling?section=urgent-support" ariaBusy className="portal-counseling__filters" resetKey="urgent-loading" summary="Loading filters…"><div aria-hidden="true" className="portal-counseling__filter-skeleton-grid">{Array.from({ length: 7 }, (_, index) => <Skeleton key={index} />)}</div></PortalFilterPanel><PortalCollectionFrame className="portal-counseling__frame"><div aria-hidden="true" className="portal-counseling__table-skeleton">{Array.from({ length: 5 }, (_, row) => <div className="portal-counseling__table-skeleton-row" key={row}>{Array.from({ length: 9 }, (_, cell) => <Skeleton as="span" key={cell} />)}</div>)}</div></PortalCollectionFrame></div></div></section>;
}

function UrgentState({ kind, error, navItems, onRetry }: { kind: "forbidden" | "unavailable"; error?: LoadState["kind"] | "rate_limited" | "validation"; navItems: readonly CounselingNavItem[]; onRetry?: () => void }) {
  const title = kind === "forbidden" ? "This page isn’t available for this account." : error === "rate_limited" ? "Too many urgent-support requests." : error === "validation" ? "The urgent-support filters could not be applied." : "Urgent support is unavailable right now.";
  return <section aria-labelledby="portal-counseling-urgent-state-heading" className="portal-counseling portal-counseling--state" role={kind === "unavailable" ? "alert" : undefined}><UrgentHeader /><div className="portal-counseling__workspace"><PortalWorkspaceNav activeValue="urgent-support" ariaLabel="Counseling sections" items={navItems} /><PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state"><HeartHandshake aria-hidden="true" className="portal-counseling__state-icon" /><h2 id="portal-counseling-urgent-state-heading">{title}</h2><p>{kind === "forbidden" ? "Return to your workspace to continue." : "Try again when the connection is ready."}</p>{onRetry ? <Button onClick={onRetry} type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button> : null}</PortalCollectionFrame></div></section>;
}

export function UrgentSupportView({ hasCapability, navItems }: { hasCapability: (capability: string) => boolean; navItems: readonly CounselingNavItem[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawQuery = searchParams.toString();
  const filters = useMemo(() => parseUrgentSupportFilters(searchParams), [searchParams]);
  const rawPage = Number(searchParams.get("page"));
  const pageNumber = Number.isSafeInteger(rawPage) && rawPage >= 1 && rawPage <= 100_000 ? rawPage : 1;
  const canonicalHref = urgentSupportHref(pageNumber, filters);
  const canonicalQuery = canonicalHref.split("?")[1] ?? "";
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedReference, setExpandedReference] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, DetailState>>({});
  const [options, setOptions] = useState<Record<string, OptionState>>({});
  const [actionIntent, setActionIntent] = useState<ActionIntent | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [mutation, setMutation] = useState<MutationState | null>(null);
  const [reviewStatus, setReviewStatus] = useState<UrgentSupportReviewStatus>("REVIEWED_CONFIRMED");
  const [closureReason, setClosureReason] = useState("");
  const [sessionMode, setSessionMode] = useState("ONSITE");
  const [scheduledStartAt, setScheduledStartAt] = useState("");
  const [scheduledEndAt, setScheduledEndAt] = useState("");
  const [selectedCounselor, setSelectedCounselor] = useState("");
  const [grantType, setGrantType] = useState("TRIAGE_SESSION");
  const [grantPurpose, setGrantPurpose] = useState("URGENT_TRIAGE");
  const [expiresAt, setExpiresAt] = useState("");
  const mutationKeysRef = useRef<Map<string, MutationKeyEntry>>(new Map());

  useEffect(() => {
    if (rawQuery !== canonicalQuery) router.replace(canonicalHref, { scroll: false });
  }, [canonicalHref, canonicalQuery, rawQuery, router]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void Promise.resolve().then(() => {
      if (!active || controller.signal.aborted) return null;
      setLoadState({ kind: "loading" });
      setExpandedReference(null);
      setDetails({});
      return getPortalUrgentSupport(pageNumber, filters, controller.signal);
    }).then((page) => {
      if (page && active && !controller.signal.aborted) setLoadState({ kind: "ready", page });
    }).catch((error: unknown) => {
      if (!active || controller.signal.aborted || isAbortError(error)) return;
      if (error instanceof CounselingApiError && error.kind === "permission") setLoadState({ kind: "forbidden" });
      else setLoadState({ kind: "unavailable", error: error instanceof CounselingApiError && (error.kind === "rate_limited" || error.kind === "validation") ? error.kind : "unavailable" });
    });
    return () => { active = false; controller.abort(); };
  }, [filters, pageNumber, rawQuery, reloadKey]);

  const getMutationKey = (scope: string, fingerprint: string) => {
    const existing = mutationKeysRef.current.get(scope);
    if (existing?.fingerprint === fingerprint) return existing.key;
    const key = createIdempotencyKey();
    mutationKeysRef.current.set(scope, { fingerprint, key });
    return key;
  };

  const loadOptions = (request: PortalUrgentSupport) => {
    if (options[request.reference_code]) return;
    setOptions((current) => ({ ...current, [request.reference_code]: { kind: "loading" } }));
    void getPortalUrgentCounselorOptions(request.reference_code).then((next) => setOptions((current) => ({ ...current, [request.reference_code]: { kind: "ready", options: next } }))).catch((error: unknown) => {
      if (!isAbortError(error)) setOptions((current) => ({ ...current, [request.reference_code]: { kind: "error" } }));
    });
  };

  const openAction = (action: UrgentAction, request: PortalUrgentSupport, grantToken?: string) => {
    setActionIntent({ action, request, grantToken });
    setActionError(null);
    setReviewStatus("REVIEWED_CONFIRMED");
    setClosureReason("");
    setSessionMode("ONSITE");
    setScheduledStartAt("");
    setScheduledEndAt("");
    setSelectedCounselor("");
    setGrantType("TRIAGE_SESSION");
    setGrantPurpose("URGENT_TRIAGE");
    setExpiresAt("");
    if (action === "triage" || action === "grant") loadOptions(request);
  };

  const confirmAction = async () => {
    if (!actionIntent) return;
    const { action, request, grantToken } = actionIntent;
    const selectedOptions = options[request.reference_code];
    if (action === "review" && !reviewStatus) return setActionError("Choose a review status before continuing.");
    if (action === "close" && !closureReason) return setActionError("Choose a closure reason before continuing.");
    if (action === "grant" && (!selectedCounselor || selectedOptions?.kind !== "ready")) return setActionError("Choose an authorized counselor before continuing.");
    if (action === "revoke" && !grantToken) return setActionError("This access grant is no longer available.");
    if (action === "triage" && !sessionMode) return setActionError("Choose a session mode before continuing.");
    const triagePayload = { session_mode: sessionMode, scheduled_start_at: scheduledStartAt || null, scheduled_end_at: scheduledEndAt || null, ...(selectedCounselor ? { counselor_selection_token: selectedCounselor } : {}) };
    const grantPayload = { grantee_selection_token: selectedCounselor, grant_type: grantType, purpose_code: grantPurpose, ...(expiresAt ? { expires_at: new Date(expiresAt).toISOString() } : {}) };
    const payload = action === "triage"
      ? triagePayload
      : action === "grant"
        ? grantPayload
        : action === "review" ? { review_status: reviewStatus } : action === "close" ? { closure_reason_code: closureReason } : { grant_selection_token: grantToken, reason_code: "" };
    const fingerprint = JSON.stringify({ action, referenceCode: request.reference_code, payload });
    const scope = `urgent-support:${action}:${request.reference_code}:${grantToken ?? ""}`;
    const key = getMutationKey(scope, fingerprint);
    setMutation({ referenceCode: request.reference_code, state: "pending", message: "Saving urgent-support change…" });
    try {
      if (action === "triage") await triagePortalUrgentSupport(request.reference_code, triagePayload, key);
      else if (action === "review") await reviewPortalUrgentSupport(request.reference_code, reviewStatus, key);
      else if (action === "close") await closePortalUrgentSupport(request.reference_code, closureReason, key);
      else if (action === "grant") await grantPortalUrgentSupportAccess(request.reference_code, grantPayload, key);
      else await revokePortalUrgentSupportAccess({ grant_selection_token: grantToken, reason_code: "" }, key);
      mutationKeysRef.current.delete(scope);
      setMutation({ referenceCode: request.reference_code, state: "success", message: "Urgent-support request updated." });
      setActionIntent(null);
      setReloadKey((value) => value + 1);
    } catch (error: unknown) {
      const apiError = error instanceof CounselingApiError ? error : new CounselingApiError("unavailable");
      if (apiError.kind !== "unavailable" && apiError.kind !== "rate_limited") mutationKeysRef.current.delete(scope);
      setMutation({ referenceCode: request.reference_code, state: "error", message: actionMessage(apiError) });
    }
  };

  const toggleDetails = (request: PortalUrgentSupport) => {
    const reference = request.reference_code;
    if (expandedReference === reference) return setExpandedReference(null);
    setExpandedReference(reference);
    if (details[reference]) return;
    setDetails((current) => ({ ...current, [reference]: { kind: "loading" } }));
    void getPortalUrgentSupportDetail(reference).then((detail) => setDetails((current) => ({ ...current, [reference]: { kind: "ready", detail } }))).catch((error: unknown) => {
      if (!isAbortError(error)) setDetails((current) => ({ ...current, [reference]: { kind: "error" } }));
    });
  };

  const retryDetail = (request: PortalUrgentSupport) => {
    const reference = request.reference_code;
    setDetails((current) => ({ ...current, [reference]: { kind: "loading" } }));
    void getPortalUrgentSupportDetail(reference).then((detail) => setDetails((current) => ({ ...current, [reference]: { kind: "ready", detail } }))).catch(() => setDetails((current) => ({ ...current, [reference]: { kind: "error" } })));
  };

  if (loadState.kind === "loading") return <UrgentLoadingState navItems={navItems} />;
  if (loadState.kind === "forbidden") return <UrgentState kind="forbidden" navItems={navItems} />;
  if (loadState.kind === "unavailable") return <UrgentState kind="unavailable" error={loadState.error} navItems={navItems} onRetry={() => setReloadKey((value) => value + 1)} />;
  const page = loadState.page;
  const optionState = actionIntent ? options[actionIntent.request.reference_code] : undefined;
  return <section aria-labelledby="portal-counseling-urgent-heading" className="portal-counseling"><UrgentHeader /><div className="portal-counseling__workspace"><PortalWorkspaceNav activeValue="urgent-support" ariaLabel="Counseling sections" items={navItems} /><div className="portal-counseling__active-content"><UrgentFilterPanel filters={filters} /><PortalCollectionFrame aria-labelledby="portal-counseling-urgent-results-heading" className="portal-counseling__frame"><div className="portal-counseling__frame-heading"><div><p className="portal-counseling__kicker">Urgent support</p><h2 id="portal-counseling-urgent-results-heading">Urgent-support requests</h2></div><p className="portal-counseling__result-count">{page.total} {page.total === 1 ? "request" : "requests"}</p></div>{mutation ? <p className={`portal-counseling__mutation portal-counseling__mutation--${mutation.state}`} role={mutation.state === "error" ? "alert" : "status"}>{mutation.message}</p> : null}{page.items.length ? <UrgentTable details={details} expandedReference={expandedReference} hasCapability={hasCapability} mutation={mutation} onAction={openAction} onRetryDetail={retryDetail} onToggle={toggleDetails} requests={page.items} /> : <div className="portal-counseling__empty" role="status"><h2>No urgent-support requests to show.</h2><p>Try changing the filters or check back after more requests are recorded.</p></div>}<UrgentPagination filters={filters} page={page} /></PortalCollectionFrame></div></div>
    <AlertDialog onOpenChange={(open) => { if (!open && mutation?.state !== "pending") { setActionIntent(null); setActionError(null); } }} open={actionIntent !== null}><AlertDialogContent className="portal-counseling__dialog" size="sm"><AlertDialogHeader><AlertDialogTitle>{actionIntent?.action === "triage" ? "Create triage session" : actionIntent?.action === "review" ? "Review urgent support" : actionIntent?.action === "close" ? "Close urgent support" : actionIntent?.action === "grant" ? "Grant temporary access" : "Revoke temporary access"}</AlertDialogTitle><AlertDialogDescription>{actionIntent ? `${actionIntent.request.reference_code} will be updated using the current urgent-support policy.` : "Review this action before continuing."}</AlertDialogDescription></AlertDialogHeader>
      {actionIntent?.action === "triage" ? <div className="portal-counseling__dialog-fields"><div className="portal-counseling__dialog-field"><Label htmlFor="portal-urgent-mode">Session mode</Label><select id="portal-urgent-mode" onChange={(event) => setSessionMode(event.target.value)} value={sessionMode}>{TRIAGE_MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div><div className="portal-counseling__dialog-field"><Label htmlFor="portal-urgent-start">Start (optional)</Label><Input id="portal-urgent-start" onChange={(event) => setScheduledStartAt(event.target.value)} type="datetime-local" value={scheduledStartAt} /></div><div className="portal-counseling__dialog-field"><Label htmlFor="portal-urgent-end">End (optional)</Label><Input id="portal-urgent-end" onChange={(event) => setScheduledEndAt(event.target.value)} type="datetime-local" value={scheduledEndAt} /></div>{optionState?.kind === "ready" && optionState.options.length ? <div className="portal-counseling__dialog-field"><Label htmlFor="portal-urgent-counselor">Counselor (optional)</Label><select id="portal-urgent-counselor" onChange={(event) => setSelectedCounselor(event.target.value)} value={selectedCounselor}><option value="">Assign to me</option>{optionState.options.map((option) => <option key={option.selection_token} value={option.selection_token}>{option.display_name}</option>)}</select></div> : optionState?.kind === "loading" ? <p role="status">Loading counselor options…</p> : optionState?.kind === "error" ? <p className="portal-counseling__dialog-error" role="alert">Counselor options are unavailable. You can still assign this triage session to yourself.</p> : null}</div> : null}
      {actionIntent?.action === "review" ? <div className="portal-counseling__dialog-field"><Label htmlFor="portal-urgent-review-status">Review status</Label><select id="portal-urgent-review-status" onChange={(event) => setReviewStatus(event.target.value as UrgentSupportReviewStatus)} value={reviewStatus}>{REVIEW_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div> : null}
      {actionIntent?.action === "close" ? <div className="portal-counseling__dialog-field"><Label htmlFor="portal-urgent-close-reason">Closure reason</Label><select id="portal-urgent-close-reason" onChange={(event) => setClosureReason(event.target.value)} value={closureReason}><option value="">Choose a reason</option>{CLOSE_REASON_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div> : null}
      {actionIntent?.action === "grant" ? <div className="portal-counseling__dialog-fields"><div className="portal-counseling__dialog-field"><Label htmlFor="portal-urgent-grantee">Counselor</Label>{optionState?.kind === "ready" ? <select id="portal-urgent-grantee" onChange={(event) => setSelectedCounselor(event.target.value)} value={selectedCounselor}><option value="">Choose a counselor</option>{optionState.options.map((option) => <option key={option.selection_token} value={option.selection_token}>{option.display_name}</option>)}</select> : optionState?.kind === "loading" ? <p role="status">Loading counselor options…</p> : <p className="portal-counseling__dialog-error" role="alert">Counselor options are unavailable. Try again.</p>}</div><div className="portal-counseling__dialog-field"><Label htmlFor="portal-urgent-grant-type">Grant type</Label><select id="portal-urgent-grant-type" onChange={(event) => setGrantType(event.target.value)} value={grantType}>{GRANT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div><div className="portal-counseling__dialog-field"><Label htmlFor="portal-urgent-grant-purpose">Purpose</Label><select id="portal-urgent-grant-purpose" onChange={(event) => setGrantPurpose(event.target.value)} value={grantPurpose}>{GRANT_PURPOSE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div><div className="portal-counseling__dialog-field"><Label htmlFor="portal-urgent-expires">Expires (optional, max 24 hours)</Label><Input id="portal-urgent-expires" onChange={(event) => setExpiresAt(event.target.value)} type="datetime-local" value={expiresAt} /></div></div> : null}
      {actionIntent?.action === "revoke" ? <p>Access for this urgent-support request will be revoked.</p> : null}
      {actionError ? <p className="portal-counseling__dialog-error" role="alert">{actionError}</p> : null}<AlertDialogFooter><AlertDialogCancel disabled={mutation?.state === "pending"}>Keep request</AlertDialogCancel><AlertDialogAction disabled={mutation?.state === "pending" || (actionIntent?.action === "grant" && optionState?.kind !== "ready")} onClick={() => void confirmAction()}>{mutation?.state === "pending" ? "Saving…" : "Continue"}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </section>;
}
