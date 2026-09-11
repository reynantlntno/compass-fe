"use client";

import Link from "next/link";
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
import { COUNSELING_NAV_ITEMS, type CounselingNavItem } from "@/components/portal/portal-counseling-navigation";
import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
import { PortalFilterPanel } from "@/components/portal/portal-filter-panel";
import { PortalPageHeader } from "@/components/portal/portal-page-header";
import { PORTAL_CAPABILITIES } from "@/components/portal/portal-navigation";
import { PortalStatusFilter } from "@/components/portal/portal-status-filter";
import { PortalWorkspaceNav } from "@/components/portal/portal-workspace-nav";
import { CounselingApiError } from "@/lib/api/counseling";
import {
  counselingCaseHref,
  COUNSELING_CASE_ASSIGNMENTS,
  COUNSELING_CASE_CATEGORIES,
  COUNSELING_CASE_ORDERS,
  COUNSELING_CASE_PRIORITIES,
  COUNSELING_CASE_STATUSES,
  getPortalCounselingCaseDetail,
  getPortalCounselingCases,
  holdPortalCounselingCase,
  closePortalCounselingCase,
  parseCounselingCaseFilters,
  reopenPortalCounselingCase,
  resolvePortalCounselingCase,
  resumePortalCounselingCase,
  transitionCounselingCaseToFollowUp,
  transitionCounselingCaseToMonitoring,
  type CounselingCaseAction,
  type CounselingCaseListFilters,
  type CounselingCaseStatus,
  type PortalCounselingCase,
  type PortalCounselingCaseDetail,
  type PortalCounselingCasePage,
} from "@/lib/api/counseling-cases";
import { createIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; page: PortalCounselingCasePage }
  | { kind: "unavailable"; error: "unavailable" | "rate_limited" | "validation" }
  | { kind: "forbidden" };

type DetailState =
  | { kind: "loading" }
  | { kind: "ready"; detail: PortalCounselingCaseDetail }
  | { kind: "error" };

type MutationState = { referenceCode: string; state: "pending" | "success" | "error"; message: string };
type MutationKeyEntry = { fingerprint: string; key: IdempotencyKey };
type ActionIntent = { action: CounselingCaseAction; counselingCase: PortalCounselingCase };

const STATUS_OPTIONS = COUNSELING_CASE_STATUSES.map((value) => ({ label: labelForValue(value), value }));
const CATEGORY_OPTIONS = COUNSELING_CASE_CATEGORIES.map((value) => ({ label: labelForValue(value), value }));
const PRIORITY_OPTIONS = COUNSELING_CASE_PRIORITIES.map((value) => ({ label: labelForValue(value), value }));
const ASSIGNMENT_OPTIONS = [
  { label: "All assignments", value: "all" },
  { label: "Assigned to me", value: "mine" },
  { label: "Unassigned", value: "unassigned" },
] as const;
const REASON_OPTIONS = [
  ["FOLLOW_UP_NEEDED", "Follow-up needed"],
  ["ONGOING_MONITORING", "Ongoing monitoring"],
  ["STUDENT_TRANSFERRED", "Student transferred or inactive"],
  ["CONCERN_RESOLVED", "Concern resolved"],
  ["NO_FURTHER_ACTION", "No further action"],
  ["REFERRED_TO_OTHER_SERVICE", "Referred to another service"],
  ["REOPENED_NEW_INFORMATION", "Reopened due to new information"],
  ["REOPENED_RECURRING_CONCERN", "Reopened due to recurring concern"],
  ["OTHER", "Other"],
] as const;
const MAX_QUERY_LENGTH = 120;

function labelForValue(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function detailId(referenceCode: string) {
  return `portal-counseling-case-detail-${referenceCode.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function actionLabel(action: CounselingCaseAction) {
  switch (action) {
    case "monitoring": return "Move to monitoring";
    case "follow-up": return "Move to follow-up";
    case "hold": return "Put on hold";
    case "resolve": return "Resolve case";
    case "close": return "Close case";
    case "resume": return "Resume case";
    default: return "Reopen case";
  }
}

function statusTone(value: CounselingCaseStatus) {
  if (value === "CLOSED" || value === "RESOLVED") return "ok";
  if (value === "ON_HOLD") return "warning";
  if (value === "REOPENED") return "attention";
  return value.toLowerCase();
}

function priorityTone(value: string | null) {
  if (value === "URGENT" || value === "HIGH") return "attention";
  if (value === "LOW") return "subtle";
  return "neutral";
}

function canAction(action: CounselingCaseAction, counselingCase: PortalCounselingCase, hasCapability: (capability: string) => boolean) {
  const assignedOrWorkflow = counselingCase.assignment_state === "Assigned to you" || hasCapability(PORTAL_CAPABILITIES.counselingCasesClose);
  if (action === "reopen") return ["RESOLVED", "CLOSED"].includes(counselingCase.status) && hasCapability(PORTAL_CAPABILITIES.counselingCasesReopen);
  if (action === "close") return ["OPEN", "MONITORING", "FOLLOW_UP_PENDING", "ON_HOLD", "RESOLVED", "REOPENED"].includes(counselingCase.status) && hasCapability(PORTAL_CAPABILITIES.counselingCasesClose);
  if (!assignedOrWorkflow) return false;
  if (action === "monitoring") return ["OPEN", "REOPENED"].includes(counselingCase.status);
  if (action === "follow-up") return ["OPEN", "MONITORING", "FOLLOW_UP_PENDING", "REOPENED"].includes(counselingCase.status);
  if (action === "hold") return ["OPEN", "MONITORING", "FOLLOW_UP_PENDING", "REOPENED"].includes(counselingCase.status);
  if (action === "resolve") return ["OPEN", "MONITORING", "FOLLOW_UP_PENDING", "ON_HOLD", "REOPENED"].includes(counselingCase.status);
  return counselingCase.status === "ON_HOLD";
}

function mutationMessage(error: CounselingApiError) {
  switch (error.kind) {
    case "conflict": return "This case changed. Refresh the workspace and try again.";
    case "permission": return "This action is not available for this account.";
    case "validation": return "Check the case details and try again.";
    case "rate_limited": return "Too many attempts. Please wait before trying again.";
    default: return "This case action is temporarily unavailable. Try again.";
  }
}

function CaseFilterPanel({ filters }: { filters: CounselingCaseListFilters }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const statuses = form.getAll("status").filter((value): value is string => typeof value === "string");
    const next: CounselingCaseListFilters = {
      q: String(form.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH) || null,
      status: statuses.length ? statuses.join(",") : null,
      statuses: statuses.filter((value): value is CounselingCaseStatus => COUNSELING_CASE_STATUSES.includes(value as CounselingCaseStatus)),
      concernCategory: COUNSELING_CASE_CATEGORIES.includes(String(form.get("concern_category") ?? "") as typeof COUNSELING_CASE_CATEGORIES[number]) ? String(form.get("concern_category")) as CounselingCaseListFilters["concernCategory"] : null,
      priority: COUNSELING_CASE_PRIORITIES.includes(String(form.get("priority") ?? "") as typeof COUNSELING_CASE_PRIORITIES[number]) ? String(form.get("priority")) as CounselingCaseListFilters["priority"] : null,
      assignment: COUNSELING_CASE_ASSIGNMENTS.includes(String(form.get("assignment") ?? "all") as typeof COUNSELING_CASE_ASSIGNMENTS[number]) ? String(form.get("assignment")) as CounselingCaseListFilters["assignment"] : "all",
      order: COUNSELING_CASE_ORDERS.includes(String(form.get("order") ?? "recent") as typeof COUNSELING_CASE_ORDERS[number]) ? String(form.get("order")) as CounselingCaseListFilters["order"] : "recent",
    };
    next.status = next.statuses.length ? next.statuses.join(",") : null;
    startTransition(() => router.push(counselingCaseHref(1, next), { scroll: false }));
  };
  return (
    <PortalFilterPanel
      accessibleLabel="counseling case filters"
      action="/portal/counseling?section=cases"
      ariaBusy={isPending}
      className="portal-counseling__filters"
      onSubmit={handleSubmit}
      resetKey={`${filters.q ?? ""}:${filters.status ?? ""}:${filters.concernCategory ?? ""}:${filters.priority ?? ""}:${filters.assignment}:${filters.order}`}
      summary="Search and narrow the cases visible to this account."
    >
      <div className="portal-counseling__filters-grid">
        <div className="portal-counseling__filter-field portal-counseling__filter-field--search"><Label htmlFor="portal-counseling-case-query">Search</Label><Input defaultValue={filters.q ?? ""} id="portal-counseling-case-query" maxLength={MAX_QUERY_LENGTH} name="q" placeholder="Case reference, student name, or student number" /></div>
        <div className="portal-counseling__filter-field"><Label htmlFor="portal-counseling-case-status">Status</Label><PortalStatusFilter ariaLabel="Choose counseling case statuses" id="portal-counseling-case-status" options={STATUS_OPTIONS} selectedValues={filters.statuses} title="Case status" /></div>
        <div className="portal-counseling__filter-field"><Label htmlFor="portal-counseling-case-category">Concern category</Label><select defaultValue={filters.concernCategory ?? ""} id="portal-counseling-case-category" name="concern_category"><option value="">All concern categories</option>{CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
        <div className="portal-counseling__filter-field"><Label htmlFor="portal-counseling-case-priority">Priority</Label><select defaultValue={filters.priority ?? ""} id="portal-counseling-case-priority" name="priority"><option value="">All priorities</option>{PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
        <div className="portal-counseling__filter-field"><Label htmlFor="portal-counseling-case-assignment">Assignment</Label><select defaultValue={filters.assignment} id="portal-counseling-case-assignment" name="assignment">{ASSIGNMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
        <div className="portal-counseling__filter-field"><Label htmlFor="portal-counseling-case-order">Order</Label><select defaultValue={filters.order} id="portal-counseling-case-order" name="order"><option value="recent">Recently updated</option><option value="oldest">Oldest updated</option></select></div>
      </div>
      <div className="portal-counseling__filter-actions"><Button disabled={isPending} size="sm" type="submit">Apply filters</Button><Link className="portal-counseling__filter-clear" href="/portal/counseling?section=cases">Clear</Link></div>
    </PortalFilterPanel>
  );
}

function CaseDetails({ assignmentState, detail, onRetry }: { assignmentState: PortalCounselingCase["assignment_state"]; detail: DetailState | undefined; onRetry: () => void }) {
  if (!detail || detail.kind === "loading") return <div className="portal-counseling__detail-state" role="status"><Skeleton as="span" /><Skeleton as="span" /></div>;
  if (detail.kind === "error") return <div className="portal-counseling__detail-state" role="status"><p>Case details are unavailable right now.</p><Button onClick={onRetry} size="sm" type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button></div>;
  const value = detail.detail;
  const facts = [
    ["Concern", value.concern_category ? labelForValue(value.concern_category) : "Not recorded"],
    ["Priority", value.priority ? labelForValue(value.priority) : "Not recorded"],
    ["Status", labelForValue(value.status)],
    ["Assignment", assignmentState ?? "Assignment unavailable"],
    ["Created", formatTimestamp(value.created_at)],
    ["Updated", formatTimestamp(value.updated_at)],
    ["Resolved", formatTimestamp(value.resolved_at)],
    ["Closed", formatTimestamp(value.closed_at)],
    ["Reopened", formatTimestamp(value.reopened_at)],
  ];
  return <div className="portal-counseling__detail-content"><dl>{facts.map(([label, fact]) => <div key={label}><dt>{label}</dt><dd>{fact}</dd></div>)}</dl></div>;
}

function CaseActions({ counselingCase, hasCapability, onAction }: { counselingCase: PortalCounselingCase; hasCapability: (capability: string) => boolean; onAction: (action: CounselingCaseAction, counselingCase: PortalCounselingCase) => void }) {
  const actions = (["monitoring", "follow-up", "hold", "resolve", "close", "resume", "reopen"] as CounselingCaseAction[]).filter((action) => canAction(action, counselingCase, hasCapability));
  if (!actions.length) return null;
  return <div aria-label={`Actions for ${counselingCase.reference_code}`} className="portal-counseling__row-actions">{actions.map((action) => <Button key={action} onClick={() => onAction(action, counselingCase)} size="xs" type="button" variant={action === "close" || action === "hold" || action === "reopen" ? "outline" : "ghost"}>{actionLabel(action)}</Button>)}</div>;
}

function CasesTable({ cases, details, expandedReference, hasCapability, mutation, onAction, onRetryDetail, onToggle }: { cases: PortalCounselingCase[]; details: Record<string, DetailState>; expandedReference: string | null; hasCapability: (capability: string) => boolean; mutation: MutationState | null; onAction: (action: CounselingCaseAction, counselingCase: PortalCounselingCase) => void; onRetryDetail: (counselingCase: PortalCounselingCase) => void; onToggle: (counselingCase: PortalCounselingCase) => void }) {
  return <div className="portal-counseling__table-wrap"><table className="portal-counseling__table portal-counseling__case-table"><thead><tr><th scope="col">Student</th><th scope="col">Case reference</th><th scope="col">Concern</th><th scope="col">Priority</th><th scope="col">Status</th><th scope="col">Latest activity</th><th scope="col">Assignment</th><th scope="col">Details &amp; actions</th></tr></thead><tbody>{cases.map((counselingCase) => {
    const expanded = expandedReference === counselingCase.reference_code;
    const rowMutation = mutation?.referenceCode === counselingCase.reference_code ? mutation : null;
    const expandedId = detailId(counselingCase.reference_code);
    return <Fragment key={counselingCase.reference_code}><tr className={expanded ? "is-expanded" : undefined}>
      <td data-label="Student"><span className="portal-counseling__student-name">{counselingCase.student_display_name ?? "Student details unavailable"}</span>{counselingCase.student_number ? <span className="portal-counseling__student-number">{counselingCase.student_number}</span> : null}</td>
      <td data-label="Case reference"><span className="portal-counseling__reference">{counselingCase.reference_code}</span></td>
      <td data-label="Concern">{counselingCase.concern_category ? labelForValue(counselingCase.concern_category) : "Not recorded"}</td>
      <td data-label="Priority">{counselingCase.priority ? <Badge data-tone={priorityTone(counselingCase.priority)} variant="outline">{labelForValue(counselingCase.priority)}</Badge> : "Not recorded"}</td>
      <td data-label="Status"><Badge data-tone={statusTone(counselingCase.status)} variant="outline">{labelForValue(counselingCase.status)}</Badge></td>
      <td data-label="Latest activity">{formatTimestamp(counselingCase.updated_at)}</td>
      <td data-label="Assignment">{counselingCase.assignment_state ?? "Assignment unavailable"}</td>
      <td data-label="Details & actions"><div className="portal-counseling__details-actions"><Button aria-controls={expandedId} aria-expanded={expanded} aria-label={`${expanded ? "Hide" : "Show"} details for ${counselingCase.reference_code}`} onClick={() => onToggle(counselingCase)} size="xs" type="button" variant="outline">{expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}<span className="sr-only">{expanded ? "Hide" : "Show"} details</span></Button><CaseActions counselingCase={counselingCase} hasCapability={hasCapability} onAction={onAction} /></div></td>
    </tr>{expanded ? <tr className="portal-counseling__detail-row"><td colSpan={8} id={expandedId}><CaseDetails assignmentState={counselingCase.assignment_state} detail={details[counselingCase.reference_code]} onRetry={() => onRetryDetail(counselingCase)} />{rowMutation ? <p className={`portal-counseling__mutation portal-counseling__mutation--${rowMutation.state}`} role={rowMutation.state === "error" ? "alert" : "status"}>{rowMutation.message}</p> : null}</td></tr> : null}</Fragment>;
  })}</tbody></table></div>;
}

function CasesPagination({ page, filters }: { page: PortalCounselingCasePage; filters: CounselingCaseListFilters }) {
  const totalPages = Math.max(1, Math.ceil(page.total / page.page_size));
  if (totalPages <= 1) return null;
  return <Pagination aria-label="Counseling case pages" className="portal-counseling__pagination"><PaginationContent><PaginationItem>{page.page > 1 ? <PaginationPrevious href={counselingCaseHref(page.page - 1, filters)} text="Previous" /> : <span aria-hidden="true" className="portal-counseling__pagination-spacer" />}</PaginationItem><PaginationItem className="portal-counseling__pagination-current"><span aria-current="page">Page {page.page} of {totalPages}</span></PaginationItem><PaginationItem>{page.page < totalPages ? <PaginationNext href={counselingCaseHref(page.page + 1, filters)} text="Next" /> : <span aria-hidden="true" className="portal-counseling__pagination-spacer" />}</PaginationItem></PaginationContent></Pagination>;
}

function CasesLoadingState({ navItems = COUNSELING_NAV_ITEMS }: { navItems?: readonly CounselingNavItem[] }) {
  return <section aria-busy="true" aria-labelledby="portal-counseling-cases-loading-heading" className="portal-counseling portal-counseling--loading" role="status"><span className="sr-only">Loading counseling cases…</span><PortalPageHeader className="portal-counseling__page-header" current="Counseling" description="Review case metadata within your authorized scope." headingId="portal-counseling-cases-loading-heading" title="Counseling" /><div className="portal-counseling__workspace"><div aria-hidden="true" className="compass-surface portal-workspace-nav portal-counseling__nav-skeleton" data-tone="subtle">{navItems.map((item) => <Skeleton className="portal-counseling__nav-skeleton-line" key={item.value} />)}</div><div className="portal-counseling__content-skeleton"><PortalFilterPanel action="/portal/counseling?section=cases" ariaBusy className="portal-counseling__filters" resetKey="case-loading" summary="Loading filters…"><div aria-hidden="true" className="portal-counseling__filter-skeleton-grid">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} />)}</div></PortalFilterPanel><PortalCollectionFrame className="portal-counseling__frame"><div aria-hidden="true" className="portal-counseling__table-skeleton">{Array.from({ length: 5 }, (_, row) => <div className="portal-counseling__table-skeleton-row" key={row}>{Array.from({ length: 8 }, (_, cell) => <Skeleton as="span" key={cell} />)}</div>)}</div></PortalCollectionFrame></div></div></section>;
}

function CasesState({ kind, error, navItems = COUNSELING_NAV_ITEMS, onRetry }: { kind: "forbidden" | "unavailable"; error?: LoadState["kind"] | "rate_limited" | "validation"; navItems?: readonly CounselingNavItem[]; onRetry?: () => void }) {
  const title = kind === "forbidden" ? "This page isn’t available for this account." : error === "rate_limited" ? "Too many case requests." : error === "validation" ? "The case filters could not be applied." : "Counseling cases are unavailable right now.";
  return <section aria-labelledby="portal-counseling-cases-state-heading" className="portal-counseling portal-counseling--state" role={kind === "unavailable" ? "alert" : undefined}><PortalPageHeader className="portal-counseling__page-header" current="Counseling" description="Review case metadata within your authorized scope." headingId="portal-counseling-cases-state-heading" title="Counseling" /><div className="portal-counseling__workspace"><PortalWorkspaceNav activeValue="cases" ariaLabel="Counseling sections" items={navItems} /><PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state"><HeartHandshake aria-hidden="true" className="portal-counseling__state-icon" /><h2>{title}</h2><p>{kind === "forbidden" ? "Return to your workspace to continue." : "Try again when the connection is ready."}</p>{onRetry ? <Button onClick={onRetry} type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button> : null}</PortalCollectionFrame></div></section>;
}

export function CounselingCasesView({ hasCapability, navItems = COUNSELING_NAV_ITEMS }: { hasCapability: (capability: string) => boolean; navItems?: readonly CounselingNavItem[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const filters = useMemo(() => parseCounselingCaseFilters(searchParams), [searchParams]);
  const rawQuery = searchParams.toString();
  const rawPage = Number(searchParams.get("page"));
  const pageNumber = Number.isSafeInteger(rawPage) && rawPage >= 1 && rawPage <= 100_000 ? rawPage : 1;
  const canonicalHref = counselingCaseHref(pageNumber, filters);
  const canonicalQuery = canonicalHref.split("?")[1] ?? "";
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedReference, setExpandedReference] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, DetailState>>({});
  const [actionIntent, setActionIntent] = useState<ActionIntent | null>(null);
  const [reasonCode, setReasonCode] = useState("");
  const [resumeTarget, setResumeTarget] = useState<CounselingCaseStatus>("OPEN");
  const [actionError, setActionError] = useState<string | null>(null);
  const [mutation, setMutation] = useState<MutationState | null>(null);
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
      return getPortalCounselingCases(pageNumber, filters, controller.signal);
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

  const openAction = (action: CounselingCaseAction, counselingCase: PortalCounselingCase) => {
    setActionIntent({ action, counselingCase });
    setReasonCode("");
    setResumeTarget("OPEN");
    setActionError(null);
  };

  const confirmAction = async () => {
    if (!actionIntent) return;
    const { action, counselingCase } = actionIntent;
    const needsReason = action === "hold" || action === "close" || action === "reopen";
    if (needsReason && !reasonCode) {
      setActionError("Choose a reason before continuing.");
      return;
    }
    const fingerprint = JSON.stringify({ action, referenceCode: counselingCase.reference_code, reasonCode, resumeTarget });
    const scope = `counseling-case:${action}:${counselingCase.reference_code}`;
    const key = getMutationKey(scope, fingerprint);
    setMutation({ referenceCode: counselingCase.reference_code, state: "pending", message: "Saving case change…" });
    try {
      if (action === "monitoring") await transitionCounselingCaseToMonitoring(counselingCase.reference_code, key);
      else if (action === "follow-up") await transitionCounselingCaseToFollowUp(counselingCase.reference_code, key);
      else if (action === "hold") await holdPortalCounselingCase(counselingCase.reference_code, reasonCode, key);
      else if (action === "resolve") await resolvePortalCounselingCase(counselingCase.reference_code, key);
      else if (action === "close") await closePortalCounselingCase(counselingCase.reference_code, reasonCode, key);
      else if (action === "resume") await resumePortalCounselingCase(counselingCase.reference_code, resumeTarget, key);
      else await reopenPortalCounselingCase(counselingCase.reference_code, reasonCode, key);
      mutationKeysRef.current.delete(scope);
      setMutation({ referenceCode: counselingCase.reference_code, state: "success", message: "Case updated." });
      setActionIntent(null);
      setReloadKey((value) => value + 1);
    } catch (error: unknown) {
      const apiError = error instanceof CounselingApiError ? error : new CounselingApiError("unavailable");
      if (apiError.kind !== "unavailable" && apiError.kind !== "rate_limited") mutationKeysRef.current.delete(scope);
      setMutation({ referenceCode: counselingCase.reference_code, state: "error", message: mutationMessage(apiError) });
    }
  };

  const toggleDetails = (counselingCase: PortalCounselingCase) => {
    const reference = counselingCase.reference_code;
    if (expandedReference === reference) {
      setExpandedReference(null);
      return;
    }
    setExpandedReference(reference);
    if (details[reference]) return;
    setDetails((current) => ({ ...current, [reference]: { kind: "loading" } }));
    void getPortalCounselingCaseDetail(reference).then((detail) => setDetails((current) => ({ ...current, [reference]: { kind: "ready", detail } }))).catch((error: unknown) => {
      if (!isAbortError(error)) setDetails((current) => ({ ...current, [reference]: { kind: "error" } }));
    });
  };

  const retryDetail = (counselingCase: PortalCounselingCase) => {
    const reference = counselingCase.reference_code;
    setDetails((current) => ({ ...current, [reference]: { kind: "loading" } }));
    void getPortalCounselingCaseDetail(reference).then((detail) => setDetails((current) => ({ ...current, [reference]: { kind: "ready", detail } }))).catch(() => setDetails((current) => ({ ...current, [reference]: { kind: "error" } })));
  };

  if (loadState.kind === "loading") return <CasesLoadingState navItems={navItems} />;
  if (loadState.kind === "forbidden") return <CasesState kind="forbidden" navItems={navItems} />;
  if (loadState.kind === "unavailable") return <CasesState kind="unavailable" error={loadState.error} navItems={navItems} onRetry={() => setReloadKey((value) => value + 1)} />;
  const page = loadState.page;
  return <section aria-labelledby="portal-counseling-cases-heading" className="portal-counseling"><PortalPageHeader className="portal-counseling__page-header" current="Counseling" description="Review case metadata within your authorized scope." headingId="portal-counseling-cases-heading" title="Counseling" /><div className="portal-counseling__workspace"><PortalWorkspaceNav activeValue="cases" ariaLabel="Counseling sections" items={navItems} /><div className="portal-counseling__active-content"><CaseFilterPanel filters={filters} /><PortalCollectionFrame aria-labelledby="portal-counseling-cases-results-heading" className="portal-counseling__frame"><div className="portal-counseling__frame-heading"><div><p className="portal-counseling__kicker">Cases</p><h2 id="portal-counseling-cases-results-heading">Counseling cases</h2></div><p className="portal-counseling__result-count">{page.total} {page.total === 1 ? "case" : "cases"}</p></div>{mutation ? <p className={`portal-counseling__mutation portal-counseling__mutation--${mutation.state}`} role={mutation.state === "error" ? "alert" : "status"}>{mutation.message}</p> : null}{page.items.length ? <CasesTable cases={page.items} details={details} expandedReference={expandedReference} hasCapability={hasCapability} mutation={mutation} onAction={openAction} onRetryDetail={retryDetail} onToggle={toggleDetails} /> : <div className="portal-counseling__empty" role="status"><h2>No counseling cases to show.</h2><p>Try changing the filters or check back after more cases are recorded.</p></div>}<CasesPagination filters={filters} page={page} /></PortalCollectionFrame></div></div><AlertDialog onOpenChange={(open) => { if (!open && mutation?.state !== "pending") { setActionIntent(null); setActionError(null); } }} open={actionIntent !== null}><AlertDialogContent className="portal-counseling__dialog" size="sm"><AlertDialogHeader><AlertDialogTitle>{actionIntent ? actionLabel(actionIntent.action) : "Case action"}</AlertDialogTitle><AlertDialogDescription>{actionIntent ? `${actionIntent.counselingCase.reference_code} will be updated using the current case state.` : "Review this case action before continuing."}</AlertDialogDescription></AlertDialogHeader>{actionIntent && (actionIntent.action === "hold" || actionIntent.action === "close" || actionIntent.action === "reopen") ? <div className="portal-counseling__dialog-field"><Label htmlFor="portal-counseling-case-reason">Reason</Label><select id="portal-counseling-case-reason" onChange={(event) => setReasonCode(event.target.value)} value={reasonCode}><option value="">Choose a reason</option>{REASON_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div> : null}{actionIntent?.action === "resume" ? <div className="portal-counseling__dialog-field"><Label htmlFor="portal-counseling-case-resume-target">Resume as</Label><select id="portal-counseling-case-resume-target" onChange={(event) => setResumeTarget(event.target.value as CounselingCaseStatus)} value={resumeTarget}><option value="OPEN">Open</option><option value="MONITORING">Monitoring</option><option value="FOLLOW_UP_PENDING">Follow-up pending</option></select></div> : null}{actionError ? <p className="portal-counseling__dialog-error" role="alert">{actionError}</p> : null}<AlertDialogFooter><AlertDialogCancel disabled={mutation?.state === "pending"}>Keep case</AlertDialogCancel><AlertDialogAction disabled={mutation?.state === "pending"} onClick={() => void confirmAction()}>{mutation?.state === "pending" ? "Saving…" : "Continue"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></section>;
}

export type { CounselingCaseAction } from "@/lib/api/counseling-cases";
