"use client";

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
import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
import { PortalFilterPanel } from "@/components/portal/portal-filter-panel";
import { PortalPageHeader } from "@/components/portal/portal-page-header";
import { PORTAL_CAPABILITIES } from "@/components/portal/portal-navigation";
import { PortalStatusFilter } from "@/components/portal/portal-status-filter";
import { PortalWorkspaceNav } from "@/components/portal/portal-workspace-nav";
import { CounselingApiError } from "@/lib/api/counseling";
import {
  getPortalRoutineInterviewDetail,
  getPortalRoutineInterviewSensitiveDetail,
  getPortalRoutineInterviews,
  lockPortalRoutineInterview,
  completePortalRoutineInterview,
  finalizePortalRoutineInterview,
  reopenPortalRoutineInterview,
  savePortalRoutineEvaluation,
  type PortalRoutineInterview,
  type PortalRoutineInterviewDetail,
  type PortalRoutineInterviewPage,
  type PortalRoutineInterviewSensitiveDetail,
  type RoutineInterviewStatus,
  routineInterviewHref,
  parseRoutineInterviewStatuses,
} from "@/lib/api/routine-interviews";
import { createIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";

const NAV_ITEMS = [
  { href: "/portal/counseling?section=sessions", label: "Sessions", value: "sessions" },
  { href: "/portal/counseling?section=routine-interviews", label: "Routine interviews", value: "routine-interviews" },
] as const;

const STATUS_OPTIONS: readonly { label: string; value: RoutineInterviewStatus }[] = [
  { label: "Not started", value: "NOT_STARTED" },
  { label: "Intake draft", value: "INTAKE_DRAFT" },
  { label: "Intake submitted", value: "INTAKE_SUBMITTED" },
  { label: "Evaluation draft", value: "EVALUATION_DRAFT" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Finalized", value: "FINALIZED" },
  { label: "Locked", value: "LOCKED" },
  { label: "Reopened for correction", value: "REOPENED_FOR_CORRECTION" },
];

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; page: PortalRoutineInterviewPage }
  | { kind: "unavailable"; error: "unavailable" | "rate_limited" | "validation" }
  | { kind: "forbidden" };

type SensitiveState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; detail: PortalRoutineInterviewSensitiveDetail };

type DetailState =
  | { kind: "loading" }
  | { kind: "error" }
  | {
      kind: "ready";
      detail: PortalRoutineInterviewDetail;
      sensitive?: SensitiveState;
    };

type RoutineAction = "save" | "complete" | "finalize" | "lock" | "reopen";
type ActionIntent = { action: RoutineAction; interview: PortalRoutineInterview };
type MutationState = { referenceCode: string; state: "pending" | "success" | "error"; message: string };
type MutationKeyEntry = { fingerprint: string; key: IdempotencyKey };

type EvaluationValues = {
  rating_emotionally: string;
  rating_academically: string;
  rating_physically: string;
  rating_socially: string;
  rating_spiritually: string;
  rating_financially: string;
  rating_others_label: string;
  rating_others: string;
  special_concern: string;
  recommendations: string;
};

const EMPTY_EVALUATION: EvaluationValues = {
  rating_emotionally: "",
  rating_academically: "",
  rating_physically: "",
  rating_socially: "",
  rating_spiritually: "",
  rating_financially: "",
  rating_others_label: "",
  rating_others: "",
  special_concern: "",
  recommendations: "",
};

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function labelForValue(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatInterviewDate(interview: Pick<PortalRoutineInterview, "visit_date" | "visit_time" | "duration_minutes">) {
  if (!interview.visit_date) return "Interview date not set";
  const date = new Date(`${interview.visit_date}T${interview.visit_time ?? "00:00"}`);
  if (Number.isNaN(date.getTime())) return interview.visit_date;
  const formatted = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: interview.visit_time ? "short" : undefined }).format(date);
  return interview.duration_minutes ? `${formatted} · ${interview.duration_minutes} min` : formatted;
}

function detailId(referenceCode: string) {
  return `portal-routine-interview-detail-${referenceCode.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function actionLabel(action: RoutineAction) {
  switch (action) {
    case "save": return "Save evaluation";
    case "complete": return "Complete interview";
    case "finalize": return "Finalize interview";
    case "lock": return "Lock interview";
    default: return "Reopen for correction";
  }
}

function mutationMessage(error: CounselingApiError) {
  switch (error.kind) {
    case "conflict": return "This interview changed. Refresh the workspace and try again.";
    case "permission": return "This action is not available for this account.";
    case "validation": return "Check the interview details and try again.";
    case "rate_limited": return "Too many attempts. Please wait before trying again.";
    default: return "This interview action is temporarily unavailable. Try again.";
  }
}

function canAction(action: RoutineAction, interview: PortalRoutineInterview, hasCapability: (capability: string) => boolean) {
  if (action === "save") return ["INTAKE_SUBMITTED", "EVALUATION_DRAFT", "REOPENED_FOR_CORRECTION"].includes(interview.status);
  if (action === "complete") return ["INTAKE_SUBMITTED", "EVALUATION_DRAFT"].includes(interview.status);
  if (action === "finalize") return interview.status === "COMPLETED";
  if (action === "lock") return interview.status === "FINALIZED" && hasCapability(PORTAL_CAPABILITIES.counselingSessionLock);
  return ["FINALIZED", "LOCKED"].includes(interview.status) && hasCapability(PORTAL_CAPABILITIES.counselingRoutineReopen);
}

function RoutineFilterPanel({ statuses }: { statuses: RoutineInterviewStatus[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selected = form.getAll("status").filter((value): value is string => typeof value === "string");
    const nextStatuses = parseRoutineInterviewStatuses(selected.join(","));
    startTransition(() => router.push(routineInterviewHref(1, nextStatuses), { scroll: false }));
  };
  return (
    <PortalFilterPanel
      accessibleLabel="routine interview filters"
      action="/portal/counseling?section=routine-interviews"
      ariaBusy={isPending}
      className="portal-counseling__filters"
      onSubmit={handleSubmit}
      resetKey={statuses.join(",")}
      summary="Narrow routine interviews by workflow status."
    >
      <div className="portal-counseling__filters-grid portal-counseling__routine-filters-grid">
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-routine-status">Status</Label>
          <PortalStatusFilter
            ariaLabel="Choose routine interview statuses"
            id="portal-routine-status"
            options={STATUS_OPTIONS}
            selectedValues={statuses}
            title="Routine interview status"
          />
        </div>
      </div>
      <div className="portal-counseling__filter-actions">
        <Button disabled={isPending} size="sm" type="submit">Apply filters</Button>
        <a className="portal-counseling__filter-clear" href="/portal/counseling?section=routine-interviews">Clear</a>
      </div>
    </PortalFilterPanel>
  );
}

function SafeDetails({ detail, onRetry, onSensitive, sensitive }: { detail: PortalRoutineInterviewDetail; onRetry: () => void; onSensitive: () => void; sensitive?: SensitiveState }) {
  const facts = [
    ["Interview date", formatInterviewDate(detail)],
    ["Status", labelForValue(detail.status)],
    ["Submitted", formatTimestamp(detail.submitted_at)],
    ["Latest evaluation", formatTimestamp(detail.evaluated_at)],
  ];
  return (
    <div className="portal-counseling__detail-content">
      <dl>{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {!sensitive ? <Button onClick={onSensitive} size="sm" type="button" variant="outline">View intake and evaluation details</Button> : null}
      {sensitive?.kind === "loading" ? <div className="portal-counseling__detail-state" role="status"><Skeleton as="span" /><Skeleton as="span" /></div> : null}
      {sensitive?.kind === "error" ? <div className="portal-counseling__detail-state" role="status"><p>Additional interview details are unavailable right now.</p><Button onClick={onRetry} size="sm" type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button></div> : null}
      {sensitive?.kind === "ready" ? <SensitiveDetails detail={sensitive.detail} /> : null}
    </div>
  );
}

function SensitiveDetails({ detail }: { detail: PortalRoutineInterviewSensitiveDetail }) {
  const facts: [string, string][] = [];
  const add = (label: string, value: string | number | null | undefined) => {
    if (value !== null && value !== undefined && String(value).trim()) facts.push([label, String(value)]);
  };
  add("Nature of visit", detail.nature_of_visit);
  add("Reason for coming", detail.reason_for_coming);
  add("Concerns explanation", detail.concerns_explanation);
  add("Coping challenges", detail.coping_challenges);
  add("Coping remarks", detail.coping_remarks);
  add("Special concern", detail.special_concern);
  add("Recommendations", detail.recommendations);
  add("Evaluation date", detail.evaluation_date);
  [
    ["Emotional rating", detail.rating_emotionally],
    ["Academic rating", detail.rating_academically],
    ["Physical rating", detail.rating_physically],
    ["Social rating", detail.rating_socially],
    ["Spiritual rating", detail.rating_spiritually],
    ["Financial rating", detail.rating_financially],
    [detail.rating_others_label || "Other rating", detail.rating_others],
  ].forEach(([label, value]) => add(String(label), value));
  const concerns = [
    ["Academic", detail.concern_academic], ["Friends", detail.concern_friends], ["Classmates", detail.concern_classmates],
    ["Vices", detail.concern_vices], ["Love life", detail.concern_love_life], ["Sleep", detail.concern_sleeping_problems],
    ["Family", detail.concern_family], ["Financial", detail.concern_financial], ["Suicidal thoughts", detail.concern_suicidal_thought],
    ["Dorm or boarding house", detail.concern_dorm_boarding_house], ["Past painful experience", detail.concern_past_painful_experience], ["Other", detail.concern_others],
  ].filter(([, value]) => value).map(([label]) => String(label));
  if (concerns.length) facts.push(["Selected concerns", concerns.join(", ")]);
  return <div className="portal-counseling__routine-sensitive"><p className="portal-counseling__kicker">Authorized intake and evaluation details</p>{facts.length ? <dl>{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : <p>No additional details are available.</p>}</div>;
}

function RoutineDetail({ detailState, onRetry, onSensitive }: { detailState: DetailState | undefined; onRetry: () => void; onSensitive: () => void }) {
  if (!detailState || detailState.kind === "loading") return <div className="portal-counseling__detail-state" role="status"><Skeleton as="span" /><Skeleton as="span" /></div>;
  if (detailState.kind === "error") return <div className="portal-counseling__detail-state" role="status"><p>Interview details are unavailable right now.</p><Button onClick={onRetry} size="sm" type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button></div>;
  return <SafeDetails detail={detailState.detail} onRetry={onRetry} onSensitive={onSensitive} sensitive={detailState.sensitive} />;
}

function RoutineActions({ interview, hasCapability, onAction }: { interview: PortalRoutineInterview; hasCapability: (capability: string) => boolean; onAction: (action: RoutineAction, interview: PortalRoutineInterview) => void }) {
  const actions = (["save", "complete", "finalize", "lock", "reopen"] as RoutineAction[]).filter((action) => canAction(action, interview, hasCapability));
  if (!actions.length) return null;
  return <div aria-label={`Actions for ${interview.session_reference_code}`} className="portal-counseling__row-actions">{actions.map((action) => <Button key={action} onClick={() => onAction(action, interview)} size="xs" type="button" variant={action === "lock" || action === "reopen" ? "outline" : "ghost"}>{actionLabel(action)}</Button>)}</div>;
}

function RoutineTable({ interviews, details, expandedReference, hasCapability, mutation, onAction, onRetryDetail, onSensitive, onToggle }: { interviews: PortalRoutineInterview[]; details: Record<string, DetailState>; expandedReference: string | null; hasCapability: (capability: string) => boolean; mutation: MutationState | null; onAction: (action: RoutineAction, interview: PortalRoutineInterview) => void; onRetryDetail: (interview: PortalRoutineInterview) => void; onSensitive: (interview: PortalRoutineInterview) => void; onToggle: (interview: PortalRoutineInterview) => void }) {
  return <div className="portal-counseling__table-wrap"><table className="portal-counseling__table portal-counseling__routine-table"><thead><tr><th scope="col">Student</th><th scope="col">Session reference</th><th scope="col">Status</th><th scope="col">Interview date</th><th scope="col">Latest activity</th><th scope="col">Details &amp; actions</th></tr></thead><tbody>{interviews.map((interview) => {
    const expanded = expandedReference === interview.session_reference_code;
    const rowMutation = mutation?.referenceCode === interview.session_reference_code ? mutation : null;
    return <Fragment key={interview.session_reference_code}><tr className={expanded ? "is-expanded" : undefined}>
      <td data-label="Student"><span className="portal-counseling__student-name">{interview.student_display_name ?? "Student details unavailable"}</span>{interview.student_number ? <span className="portal-counseling__student-number">{interview.student_number}</span> : null}</td>
      <td data-label="Session reference"><span className="portal-counseling__reference">{interview.session_reference_code}</span></td>
      <td data-label="Status"><Badge data-tone={interview.status.toLowerCase()} variant="outline">{labelForValue(interview.status)}</Badge></td>
      <td data-label="Interview date">{formatInterviewDate(interview)}</td>
      <td data-label="Latest activity">{formatTimestamp(interview.updated_at)}</td>
      <td data-label="Details & actions"><div className="portal-counseling__details-actions"><Button aria-controls={detailId(interview.session_reference_code)} aria-expanded={expanded} aria-label={`${expanded ? "Hide" : "Show"} details for ${interview.session_reference_code}`} onClick={() => onToggle(interview)} size="xs" type="button" variant="outline">{expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}<span className="sr-only">{expanded ? "Hide" : "Show"} details</span></Button><RoutineActions hasCapability={hasCapability} interview={interview} onAction={onAction} /></div></td>
    </tr>{expanded ? <tr className="portal-counseling__detail-row"><td colSpan={6} id={detailId(interview.session_reference_code)}><RoutineDetail detailState={details[interview.session_reference_code]} onRetry={() => onRetryDetail(interview)} onSensitive={() => onSensitive(interview)} />{rowMutation ? <p className={`portal-counseling__mutation portal-counseling__mutation--${rowMutation.state}`} role={rowMutation.state === "error" ? "alert" : "status"}>{rowMutation.message}</p> : null}</td></tr> : null}</Fragment>;
  })}</tbody></table></div>;
}

function EmptyState() {
  return <div className="portal-counseling__empty" role="status"><h2>No routine interviews to show.</h2><p>Try changing the status filter or check back after more interviews are recorded.</p></div>;
}

function LoadMessage({ error }: { error: LoadState["kind"] | "rate_limited" | "validation" }) {
  if (error === "rate_limited") return <>Too many routine interview requests. Please wait and try again.</>;
  if (error === "validation") return <>The routine interview filter could not be applied.</>;
  return <>Routine interviews are unavailable right now.</>;
}

function RoutinePagination({ page, statuses }: { page: PortalRoutineInterviewPage; statuses: RoutineInterviewStatus[] }) {
  const totalPages = Math.max(1, Math.ceil(page.total / page.page_size));
  if (totalPages <= 1) return null;
  return <Pagination aria-label="Routine interview pages" className="portal-counseling__pagination"><PaginationContent><PaginationItem>{page.page > 1 ? <PaginationPrevious href={routineInterviewHref(page.page - 1, statuses)} text="Previous" /> : <span aria-hidden="true" className="portal-counseling__pagination-spacer" />}</PaginationItem><PaginationItem className="portal-counseling__pagination-current"><span aria-current="page">Page {page.page} of {totalPages}</span></PaginationItem><PaginationItem>{page.page < totalPages ? <PaginationNext href={routineInterviewHref(page.page + 1, statuses)} text="Next" /> : <span aria-hidden="true" className="portal-counseling__pagination-spacer" />}</PaginationItem></PaginationContent></Pagination>;
}

export function RoutineInterviewsLoadingState() {
  return <section aria-busy="true" aria-labelledby="portal-counseling-routine-loading-heading" className="portal-counseling portal-counseling--loading" role="status"><span className="sr-only">Loading routine interviews…</span><PortalPageHeader className="portal-counseling__page-header" current="Counseling" description="Review routine interviews within your authorized scope." headingId="portal-counseling-routine-loading-heading" title="Counseling" /><div className="portal-counseling__workspace"><div aria-hidden="true" className="compass-surface portal-workspace-nav portal-counseling__nav-skeleton" data-tone="subtle"><Skeleton className="portal-counseling__nav-skeleton-line" /><Skeleton className="portal-counseling__nav-skeleton-line" /></div><div className="portal-counseling__content-skeleton"><PortalFilterPanel action="/portal/counseling?section=routine-interviews" ariaBusy className="portal-counseling__filters" resetKey="routine-loading" summary="Loading filters…"><div aria-hidden="true" className="portal-counseling__filter-skeleton-grid"><Skeleton /><Skeleton /></div></PortalFilterPanel><PortalCollectionFrame className="portal-counseling__frame"><div aria-hidden="true" className="portal-counseling__table-skeleton">{Array.from({ length: 5 }, (_, row) => <div className="portal-counseling__table-skeleton-row portal-counseling__routine-table-skeleton-row" key={row}>{Array.from({ length: 6 }, (_, cell) => <Skeleton as="span" key={cell} />)}</div>)}</div></PortalCollectionFrame></div></div></section>;
}

export function RoutineInterviewsView({ hasCapability }: { hasCapability: (capability: string) => boolean }) {
  const searchParams = useSearchParams();
  const statuses = useMemo(() => parseRoutineInterviewStatuses(searchParams.get("status")), [searchParams]);
  const pageNumber = Number(searchParams.get("page"));
  const page = Number.isSafeInteger(pageNumber) && pageNumber > 0 && pageNumber <= 100_000 ? pageNumber : 1;
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedReference, setExpandedReference] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, DetailState>>({});
  const [actionIntent, setActionIntent] = useState<ActionIntent | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [correctionTarget, setCorrectionTarget] = useState("EVALUATION");
  const [evaluation, setEvaluation] = useState<EvaluationValues>(EMPTY_EVALUATION);
  const [mutation, setMutation] = useState<MutationState | null>(null);
  const mutationKeysRef = useRef<Map<string, MutationKeyEntry>>(new Map());

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return null;
      setLoadState({ kind: "loading" });
      setExpandedReference(null);
      setDetails({});
      return getPortalRoutineInterviews(page, statuses.join(","), controller.signal);
    }).then((nextPage) => {
      if (nextPage && active && !controller.signal.aborted) setLoadState({ kind: "ready", page: nextPage });
    }).catch((error: unknown) => {
      if (!active || controller.signal.aborted || isAbortError(error)) return;
      if (error instanceof CounselingApiError && error.kind === "permission") setLoadState({ kind: "forbidden" });
      else setLoadState({ kind: "unavailable", error: error instanceof CounselingApiError && (error.kind === "rate_limited" || error.kind === "validation") ? error.kind : "unavailable" });
    });
    return () => { active = false; controller.abort(); };
  }, [page, reloadKey, statuses]);

  const getMutationKey = (scope: string, fingerprint: string) => {
    const existing = mutationKeysRef.current.get(scope);
    if (existing?.fingerprint === fingerprint) return existing.key;
    const key = createIdempotencyKey();
    mutationKeysRef.current.set(scope, { fingerprint, key });
    return key;
  };

  const openAction = (action: RoutineAction, interview: PortalRoutineInterview) => {
    setActionIntent({ action, interview });
    setActionError(null);
    setActionReason("");
    setCorrectionTarget("EVALUATION");
    setEvaluation(EMPTY_EVALUATION);
  };

  const confirmAction = async () => {
    if (!actionIntent) return;
    const { action, interview } = actionIntent;
    if (action === "reopen" && !actionReason.trim()) {
      setActionError("Add a short reason before reopening this interview.");
      return;
    }
    const reopenPayload = { reason: actionReason.trim(), correction_target: correctionTarget };
    const fingerprint = JSON.stringify({ action, referenceCode: interview.session_reference_code, payload: action === "save" ? evaluation : action === "reopen" ? reopenPayload : null });
    const scope = `routine-interview:${action}:${interview.session_reference_code}`;
    const key = getMutationKey(scope, fingerprint);
    setMutation({ referenceCode: interview.session_reference_code, state: "pending", message: "Saving interview change…" });
    try {
      if (action === "save") await savePortalRoutineEvaluation(interview.session_reference_code, evaluation, key);
      else if (action === "complete") await completePortalRoutineInterview(interview.session_reference_code, key);
      else if (action === "finalize") await finalizePortalRoutineInterview(interview.session_reference_code, key);
      else if (action === "lock") await lockPortalRoutineInterview(interview.session_reference_code, key);
      else await reopenPortalRoutineInterview(interview.session_reference_code, reopenPayload, key);
      mutationKeysRef.current.delete(scope);
      setMutation({ referenceCode: interview.session_reference_code, state: "success", message: "Interview updated." });
      setActionIntent(null);
      setReloadKey((value) => value + 1);
    } catch (error: unknown) {
      const apiError = error instanceof CounselingApiError ? error : new CounselingApiError("unavailable");
      if (apiError.kind !== "unavailable" && apiError.kind !== "rate_limited") mutationKeysRef.current.delete(scope);
      setMutation({ referenceCode: interview.session_reference_code, state: "error", message: mutationMessage(apiError) });
    }
  };

  const toggleDetails = (interview: PortalRoutineInterview) => {
    const reference = interview.session_reference_code;
    if (expandedReference === reference) {
      setExpandedReference(null);
      return;
    }
    setExpandedReference(reference);
    if (details[reference]) return;
    setDetails((current) => ({ ...current, [reference]: { kind: "loading" } }));
    void getPortalRoutineInterviewDetail(reference).then((detail) => setDetails((current) => ({ ...current, [reference]: { kind: "ready", detail } }))).catch((error: unknown) => {
      if (!isAbortError(error)) setDetails((current) => ({ ...current, [reference]: { kind: "error" } }));
    });
  };

  const retryDetail = (interview: PortalRoutineInterview) => {
    const reference = interview.session_reference_code;
    setDetails((current) => ({ ...current, [reference]: { kind: "loading" } }));
    void getPortalRoutineInterviewDetail(reference).then((detail) => setDetails((current) => ({ ...current, [reference]: { kind: "ready", detail } }))).catch(() => setDetails((current) => ({ ...current, [reference]: { kind: "error" } })));
  };

  const loadSensitive = (interview: PortalRoutineInterview) => {
    const reference = interview.session_reference_code;
    const current = details[reference];
    if (!current || current.kind !== "ready") return;
    setDetails((state) => ({ ...state, [reference]: { ...current, sensitive: { kind: "loading" } } }));
    void getPortalRoutineInterviewSensitiveDetail(reference).then((detail) => setDetails((state) => ({ ...state, [reference]: current.kind === "ready" ? { ...current, sensitive: { kind: "ready", detail } } : current }))).catch(() => setDetails((state) => ({ ...state, [reference]: current.kind === "ready" ? { ...current, sensitive: { kind: "error" } } : current })));
  };

  const retrySensitive = (interview: PortalRoutineInterview) => loadSensitive(interview);

  if (loadState.kind === "loading") return <RoutineInterviewsLoadingState />;
  if (loadState.kind === "forbidden") return <RoutineInterviewsState kind="forbidden" />;
  if (loadState.kind === "unavailable") return <RoutineInterviewsState kind="unavailable" onRetry={() => setReloadKey((value) => value + 1)} error={loadState.error} />;
  const resultPage = loadState.page;
  return <section aria-labelledby="portal-counseling-heading" className="portal-counseling"><PortalPageHeader className="portal-counseling__page-header" current="Counseling" description="Review routine interviews within your authorized scope." headingId="portal-counseling-heading" title="Counseling" /><div className="portal-counseling__workspace"><PortalWorkspaceNav activeValue="routine-interviews" ariaLabel="Counseling sections" items={NAV_ITEMS} /><div className="portal-counseling__active-content"><RoutineFilterPanel statuses={statuses} /><PortalCollectionFrame aria-labelledby="portal-counseling-routine-results-heading" className="portal-counseling__frame"><div className="portal-counseling__frame-heading"><div><p className="portal-counseling__kicker">Routine interviews</p><h2 id="portal-counseling-routine-results-heading">Routine interviews</h2></div><p className="portal-counseling__result-count">{resultPage.total} {resultPage.total === 1 ? "interview" : "interviews"}</p></div>{mutation ? <p className={`portal-counseling__mutation portal-counseling__mutation--${mutation.state}`} role={mutation.state === "error" ? "alert" : "status"}>{mutation.message}</p> : null}{resultPage.items.length ? <RoutineTable details={details} expandedReference={expandedReference} hasCapability={hasCapability} interviews={resultPage.items} mutation={mutation} onAction={openAction} onRetryDetail={retryDetail} onSensitive={retrySensitive} onToggle={toggleDetails} /> : <EmptyState />}<RoutinePagination page={resultPage} statuses={statuses} /></PortalCollectionFrame></div></div><AlertDialog onOpenChange={(open) => { if (!open && mutation?.state !== "pending") { setActionIntent(null); setActionError(null); } }} open={actionIntent !== null}><AlertDialogContent className="portal-counseling__dialog" size="sm"><AlertDialogHeader><AlertDialogTitle>{actionIntent ? actionLabel(actionIntent.action) : "Interview action"}</AlertDialogTitle><AlertDialogDescription>{actionIntent ? `${actionIntent.interview.session_reference_code} will be updated using the current interview state.` : "Review this interview action before continuing."}</AlertDialogDescription></AlertDialogHeader>{actionIntent?.action === "reopen" ? <div className="portal-counseling__dialog-field"><Label htmlFor="portal-routine-reopen-reason">Reason</Label><Textarea id="portal-routine-reopen-reason" maxLength={2_000} onChange={(event) => setActionReason(event.target.value)} value={actionReason} /><Label htmlFor="portal-routine-correction-target">Correction target</Label><select id="portal-routine-correction-target" onChange={(event) => setCorrectionTarget(event.target.value)} value={correctionTarget}><option value="INTAKE">Intake</option><option value="EVALUATION">Evaluation</option></select></div> : null}{actionIntent?.action === "save" ? <div className="portal-counseling__note-fields"><div className="portal-counseling__dialog-field"><Label htmlFor="portal-routine-special-concern">Special concern</Label><Textarea id="portal-routine-special-concern" maxLength={4_000} onChange={(event) => setEvaluation((current) => ({ ...current, special_concern: event.target.value }))} value={evaluation.special_concern} /></div><div className="portal-counseling__dialog-field"><Label htmlFor="portal-routine-recommendations">Recommendations</Label><Textarea id="portal-routine-recommendations" maxLength={4_000} onChange={(event) => setEvaluation((current) => ({ ...current, recommendations: event.target.value }))} value={evaluation.recommendations} /></div></div> : null}{actionError ? <p className="portal-counseling__dialog-error" role="alert">{actionError}</p> : null}<AlertDialogFooter><AlertDialogCancel disabled={mutation?.state === "pending"}>Keep interview</AlertDialogCancel><AlertDialogAction disabled={mutation?.state === "pending"} onClick={() => void confirmAction()}>{mutation?.state === "pending" ? "Saving…" : "Continue"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></section>;
}

function RoutineInterviewsState({ kind, error, onRetry }: { kind: "forbidden" | "unavailable"; error?: LoadState["kind"] | "rate_limited" | "validation"; onRetry?: () => void }) {
  return <section aria-labelledby="portal-counseling-routine-state-heading" className="portal-counseling portal-counseling--state" role={kind === "unavailable" ? "alert" : undefined}><PortalPageHeader className="portal-counseling__page-header" current="Counseling" description="Review routine interviews within your authorized scope." headingId="portal-counseling-routine-state-heading" title="Counseling" /><div className="portal-counseling__workspace"><PortalWorkspaceNav activeValue="routine-interviews" ariaLabel="Counseling sections" items={NAV_ITEMS} /><PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state"><HeartHandshake aria-hidden="true" className="portal-counseling__state-icon" /><h2>{kind === "forbidden" ? "This page isn’t available for this account." : <LoadMessage error={error ?? "unavailable"} />}</h2><p>{kind === "forbidden" ? "Return to your workspace to continue." : "Try again when the connection is ready."}</p>{onRetry ? <Button onClick={onRetry} type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button> : null}</PortalCollectionFrame></div></section>;
}
