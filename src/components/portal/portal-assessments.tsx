"use client";

import {
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
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

import { usePortalAccess } from "@/components/portal/portal-access-provider";
import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
import { PortalFilterPanel } from "@/components/portal/portal-filter-panel";
import { PortalPageHeader } from "@/components/portal/portal-page-header";
import { PORTAL_CAPABILITIES } from "@/components/portal/portal-navigation";
import { PortalStatusFilter } from "@/components/portal/portal-status-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  ASSESSMENT_CATEGORIES,
  ASSESSMENT_ORDERS,
  ASSESSMENT_STATUSES,
  ASSESSMENT_VISIBILITIES,
  AssessmentsApiError,
  assessmentHref,
  archivePortalAssessment,
  attachPortalAssessmentFile,
  createPortalAssessment,
  downloadPortalAssessmentFile,
  getPortalAssessmentDetail,
  getPortalAssessmentFileMetadata,
  getPortalAssessmentInstruments,
  getPortalAssessmentInterpretation,
  getPortalAssessmentReplacementOptions,
  getPortalAssessments,
  getPortalAssessmentStudentOptions,
  parseAssessmentFilters,
  recordPortalAssessment,
  releasePortalAssessment,
  reviewPortalAssessment,
  submitPortalAssessmentForReview,
  supersedePortalAssessment,
  updatePortalAssessment,
  voidPortalAssessment,
  type AssessmentCategory,
  type PortalAssessmentCreateInput,
  type AssessmentListFilters,
  type AssessmentOrder,
  type AssessmentStatus,
  type AssessmentVisibility,
  type PortalAssessment,
  type PortalAssessmentFileMetadata,
  type PortalAssessmentInstrumentOption,
  type PortalAssessmentPage,
  type PortalAssessmentSensitive,
  type PortalAssessmentStudentOption,
} from "@/lib/api/assessments";
import { createIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; page: PortalAssessmentPage }
  | { kind: "unavailable"; error: "unavailable" | "rate_limited" | "validation" }
  | { kind: "forbidden" };

type DetailState =
  | { kind: "loading" }
  | { kind: "ready"; detail: PortalAssessment }
  | { kind: "error" };

type SensitiveState =
  | { kind: "loading" }
  | { kind: "ready"; detail: PortalAssessmentSensitive }
  | { kind: "error" };

type FileState =
  | { kind: "loading" }
  | { kind: "ready"; metadata: PortalAssessmentFileMetadata }
  | { kind: "error" };

type MutationState = { state: "pending" | "success" | "error"; message: string };

type DialogIntent =
  | { kind: "save"; item: PortalAssessment }
  | { kind: "result"; item: PortalAssessment }
  | { kind: "review"; item: PortalAssessment }
  | { kind: "release"; item: PortalAssessment }
  | { kind: "void"; item: PortalAssessment }
  | { kind: "supersede"; item: PortalAssessment }
  | { kind: "archive"; item: PortalAssessment }
  | { kind: "file"; item: PortalAssessment }
  | null;

const STATUS_OPTIONS = ASSESSMENT_STATUSES.map((value) => ({ label: labelForValue(value), value }));
const CATEGORY_OPTIONS = ASSESSMENT_CATEGORIES.map((value) => ({ label: labelForValue(value), value }));
const VISIBILITY_OPTIONS = ASSESSMENT_VISIBILITIES.map((value) => ({ label: labelForValue(value), value }));
const MAX_QUERY_LENGTH = 120;
const MAX_REASON_LENGTH = 80;
const MAX_TEXT_LENGTH = 10_000;
const MAX_SOURCE_REFERENCE_LENGTH = 100;

function labelForValue(value: string) {
  const labels: Record<string, string> = {
    academic: "Academic",
    archived: "Archived",
    career: "Career",
    counselor_only: "Counselor only",
    draft: "Draft",
    guidance: "Guidance",
    head_guidance_review: "Head Guidance review",
    office_approved_other: "Office-approved other",
    recorded: "Recorded",
    released_to_student: "Released to student",
    released_to_student_safe_summary: "Released to student safe summary",
    reviewed: "Reviewed",
    superseded: "Superseded",
    under_review: "Under review",
    voided: "Voided",
    wellness_screening_non_diagnostic: "Wellness screening (non-diagnostic)",
  };
  return labels[value] ?? value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatFileSize(value: number) {
  if (value < 1024) return `${value} bytes`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function parsePage(value: string | null) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 && page <= 100_000 ? page : 1;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function statusTone(status: AssessmentStatus) {
  if (status === "released_to_student") return "ok";
  if (status === "under_review") return "attention";
  if (status === "voided" || status === "archived") return "subtle";
  return "neutral";
}

function errorMessage(error: unknown) {
  if (!(error instanceof AssessmentsApiError)) return "This assessment action is temporarily unavailable. Try again.";
  switch (error.kind) {
    case "permission": return "This action is not available for this account or assessment.";
    case "validation": return "Check the assessment details and try again.";
    case "conflict": return "This assessment changed. Refresh the workspace and try again.";
    case "rate_limited": return "Too many attempts. Please wait before trying again.";
    default: return "This assessment action is temporarily unavailable. Try again.";
  }
}

function assessmentActions(item: PortalAssessment, hasCapability: (capability: string) => boolean) {
  const actions: Array<"save" | "result" | "submit" | "review" | "release" | "void" | "supersede" | "archive" | "file"> = [];
  if (item.status === "draft") actions.push("save", "result", "file");
  if (item.status === "recorded") actions.push("save", "file", "submit");
  if (item.status === "under_review" && hasCapability(PORTAL_CAPABILITIES.assessmentsReview)) actions.push("review");
  if (item.status === "under_review" && hasCapability(PORTAL_CAPABILITIES.assessmentsLifecycleManage)) actions.push("void");
  if (item.status === "reviewed" && hasCapability(PORTAL_CAPABILITIES.assessmentsRelease)) actions.push("release");
  if (["reviewed", "released_to_student"].includes(item.status) && hasCapability(PORTAL_CAPABILITIES.assessmentsLifecycleManage)) actions.push("supersede", "void");
  if (item.status === "released_to_student" && hasCapability(PORTAL_CAPABILITIES.assessmentsLifecycleManage)) actions.push("archive");
  return [...new Set(actions)];
}

function actionLabel(action: ReturnType<typeof assessmentActions>[number], item?: PortalAssessment) {
  switch (action) {
    case "save": return item?.status === "draft" ? "Save draft" : "Save changes";
    case "result": return "Record result";
    case "submit": return "Submit for review";
    case "review": return "Review";
    case "release": return "Release to student";
    case "void": return "Void";
    case "supersede": return "Supersede";
    case "archive": return "Archive";
    default: return "Attach file";
  }
}

function AssessmentFilterPanel({ filters }: { filters: AssessmentListFilters }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const statuses = form.getAll("status").filter((value): value is string => typeof value === "string" && ASSESSMENT_STATUSES.includes(value as AssessmentStatus)) as AssessmentStatus[];
    const category = String(form.get("category") ?? "");
    const order = String(form.get("order") ?? "recent");
    const next: AssessmentListFilters = {
      q: String(form.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH) || null,
      status: statuses.length ? statuses.join(",") : null,
      statuses,
      category: ASSESSMENT_CATEGORIES.includes(category as AssessmentCategory) ? category as AssessmentCategory : null,
      instrument: String(form.get("instrument") ?? "").trim().slice(0, 100) || null,
      dateFrom: String(form.get("date_from") ?? "").trim() || null,
      dateTo: String(form.get("date_to") ?? "").trim() || null,
      order: ASSESSMENT_ORDERS.includes(order as AssessmentOrder) ? order as AssessmentOrder : "recent",
    };
    startTransition(() => router.push(assessmentHref(1, next), { scroll: false }));
  };

  return (
    <PortalFilterPanel
      accessibleLabel="assessment filters"
      action="/portal/assessments"
      ariaBusy={isPending}
      className="portal-counseling__filters"
      onSubmit={handleSubmit}
      resetKey={`${filters.q ?? ""}:${filters.status ?? ""}:${filters.category ?? ""}:${filters.instrument ?? ""}:${filters.dateFrom ?? ""}:${filters.dateTo ?? ""}:${filters.order}`}
      summary="Search and narrow the assessments visible to this account."
    >
      <div className="portal-counseling__filters-grid">
        <div className="portal-counseling__filter-field portal-counseling__filter-field--search">
          <Label htmlFor="portal-assessments-query">Search</Label>
          <Input defaultValue={filters.q ?? ""} id="portal-assessments-query" maxLength={MAX_QUERY_LENGTH} name="q" placeholder="Student name or student number" />
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-assessments-status">Status</Label>
          <PortalStatusFilter ariaLabel="Choose assessment statuses" id="portal-assessments-status" options={STATUS_OPTIONS} selectedValues={filters.statuses} title="Assessment status" />
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-assessments-category">Category</Label>
          <select defaultValue={filters.category ?? ""} id="portal-assessments-category" name="category">
            <option value="">All categories</option>
            {CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-assessments-instrument">Instrument key</Label>
          <Input defaultValue={filters.instrument ?? ""} id="portal-assessments-instrument" maxLength={100} name="instrument" placeholder="Optional instrument key" />
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-assessments-date-from">Administered from</Label>
          <Input defaultValue={filters.dateFrom ?? ""} id="portal-assessments-date-from" name="date_from" type="date" />
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-assessments-date-to">Administered to</Label>
          <Input defaultValue={filters.dateTo ?? ""} id="portal-assessments-date-to" name="date_to" type="date" />
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-assessments-order">Order</Label>
          <select defaultValue={filters.order} id="portal-assessments-order" name="order">
            <option value="recent">Recently administered</option>
            <option value="oldest">Oldest administered first</option>
          </select>
        </div>
      </div>
      <div className="portal-counseling__filter-actions">
        <Button disabled={isPending} size="sm" type="submit">Apply filters</Button>
        <a className="portal-counseling__filter-clear" href="/portal/assessments">Clear</a>
      </div>
    </PortalFilterPanel>
  );
}

function AssessmentDetails({
  detail,
  file,
  sensitive,
  onFile,
  onSensitive,
  onRetry,
  onSensitiveRetry,
  onDownload,
}: {
  detail: DetailState | undefined;
  file: FileState | undefined;
  sensitive: SensitiveState | undefined;
  onFile: () => void;
  onSensitive: () => void;
  onRetry: () => void;
  onSensitiveRetry: () => void;
  onDownload: () => void;
}) {
  if (!detail || detail.kind === "loading") {
    return <div className="portal-counseling__detail-state" role="status"><Skeleton as="span" /><Skeleton as="span" /><Skeleton as="span" /></div>;
  }
  if (detail.kind === "error") {
    return <div className="portal-counseling__detail-state" role="status"><p>Assessment details are unavailable right now.</p><Button onClick={onRetry} size="sm" type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button></div>;
  }
  const value = detail.detail;
  return (
    <div className="portal-counseling__detail-content">
      <dl>
        <div><dt>Instrument</dt><dd>{value.instrument.title}</dd></div>
        <div><dt>Status</dt><dd><Badge data-tone={statusTone(value.status)}>{labelForValue(value.status)}</Badge></dd></div>
        <div><dt>Interpretation visibility</dt><dd>{labelForValue(value.interpretation_visibility)}</dd></div>
        <div><dt>Administered</dt><dd>{formatTimestamp(value.administered_at)}</dd></div>
        <div><dt>Last updated</dt><dd>{formatTimestamp(value.updated_at)}</dd></div>
        <div><dt>Reviewed</dt><dd>{formatTimestamp(value.reviewed_at)}</dd></div>
        <div><dt>Released</dt><dd>{formatTimestamp(value.released_at)}</dd></div>
      </dl>
      <div className="portal-counseling__row-actions">
        {value.status !== "voided" && value.status !== "archived" ? <Button onClick={onSensitive} size="xs" type="button" variant="outline">View interpretation</Button> : null}
        {value.has_protected_file ? <Button onClick={onFile} size="xs" type="button" variant="outline">View attached file</Button> : null}
      </div>
      {sensitive?.kind === "loading" ? <p className="portal-counseling__detail-state" role="status">Loading authorized interpretation…</p> : null}
      {sensitive?.kind === "error" ? <div className="portal-counseling__detail-state" role="status"><p>The interpretation is unavailable right now.</p><Button onClick={onSensitiveRetry} size="xs" type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button></div> : null}
      {sensitive?.kind === "ready" ? <div className="portal-assessments__sensitive"><p className="portal-counseling__kicker">Authorized interpretation</p><dl><div><dt>Raw score</dt><dd>{sensitive.detail.raw_score || "Not recorded"}</dd></div><div><dt>Scaled score</dt><dd>{sensitive.detail.scaled_score || "Not recorded"}</dd></div><div><dt>Score label</dt><dd>{sensitive.detail.score_label || "Not recorded"}</dd></div><div><dt>Interpretation</dt><dd className="portal-assessments__long-value">{sensitive.detail.interpretation || "No interpretation recorded."}</dd></div></dl></div> : null}
      {file?.kind === "loading" ? <p className="portal-counseling__detail-state" role="status">Loading file details…</p> : null}
      {file?.kind === "error" ? <p className="portal-counseling__detail-state" role="status">The attached file is unavailable right now.</p> : null}
      {file?.kind === "ready" ? <div className="portal-assessments__file"><p className="portal-counseling__kicker">Attached file</p><p>{file.metadata.filename || "Assessment file"} · {formatFileSize(file.metadata.size_bytes)}</p><Button onClick={onDownload} size="xs" type="button" variant="outline"><Download aria-hidden="true" />Download file</Button></div> : null}
    </div>
  );
}

function AssessmentTable({
  details,
  files,
  items,
  mutations,
  sensitive,
  expanded,
  hasCapability,
  onAction,
  onFile,
  onRetry,
  onSensitive,
  onSensitiveRetry,
  onToggle,
  onDownload,
}: {
  details: Map<PortalAssessment, DetailState>;
  files: Map<PortalAssessment, FileState>;
  items: PortalAssessment[];
  mutations: Map<PortalAssessment, MutationState>;
  sensitive: Map<PortalAssessment, SensitiveState>;
  expanded: PortalAssessment | null;
  hasCapability: (capability: string) => boolean;
  onAction: (action: ReturnType<typeof assessmentActions>[number], item: PortalAssessment) => void;
  onFile: (item: PortalAssessment) => void;
  onRetry: (item: PortalAssessment) => void;
  onSensitive: (item: PortalAssessment) => void;
  onSensitiveRetry: (item: PortalAssessment) => void;
  onToggle: (item: PortalAssessment) => void;
  onDownload: (item: PortalAssessment) => void;
}) {
  return (
    <div className="portal-counseling__table-wrap">
      <table className="portal-counseling__table">
        <thead><tr><th scope="col">Student</th><th scope="col">Assessment</th><th scope="col">Category</th><th scope="col">Status</th><th scope="col">Administered</th><th scope="col">Review/release</th><th scope="col">File</th><th scope="col">Details & actions</th></tr></thead>
        <tbody>
          {items.map((item, index) => {
            const isExpanded = expanded === item;
            const detailId = `portal-assessment-detail-${item.instrument.key}-${item.administered_at ?? "record"}-${index}`.replace(/[^a-zA-Z0-9_-]/g, "-");
            const actions = assessmentActions(item, hasCapability);
            return (
              <Fragment key={`${item.student_display_name}-${item.instrument.key}-${item.administered_at ?? "record"}-${index}`}>
                <tr>
                  <td data-label="Student"><span className="portal-counseling__student-name">{item.student_display_name}</span>{item.student_number ? <span className="portal-counseling__student-number">{item.student_number}</span> : null}</td>
                  <td data-label="Assessment"><span className="portal-counseling__reference">{item.instrument.title}</span><span className="portal-counseling__student-number">{item.instrument.key}</span></td>
                  <td data-label="Category">{labelForValue(item.instrument.category)}</td>
                  <td data-label="Status"><Badge data-tone={statusTone(item.status)}>{labelForValue(item.status)}</Badge></td>
                  <td data-label="Administered">{formatTimestamp(item.administered_at)}</td>
                  <td data-label="Review/release"><span>{formatTimestamp(item.reviewed_at)}</span><span className="portal-counseling__student-number">{item.released_to_student ? `Released ${formatTimestamp(item.released_at)}` : "Not released"}</span></td>
                  <td data-label="File">{item.has_protected_file ? <Badge data-tone="subtle">Attached</Badge> : "None"}</td>
                  <td data-label="Details & actions"><div className="portal-counseling__details-actions"><Button aria-controls={detailId} aria-expanded={isExpanded} aria-label={`${isExpanded ? "Hide" : "Show"} assessment details`} onClick={() => onToggle(item)} size="xs" type="button" variant="outline">{isExpanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}<span className="sr-only">{isExpanded ? "Hide" : "Show"} details</span></Button>{actions.map((action) => <Button key={action} onClick={() => onAction(action, item)} size="xs" type="button" variant={action === "void" ? "outline" : "ghost"}>{actionLabel(action, item)}</Button>)}</div></td>
                </tr>
                {isExpanded ? <tr className="portal-counseling__detail-row"><td colSpan={8} id={detailId}><AssessmentDetails detail={details.get(item)} file={files.get(item)} sensitive={sensitive.get(item)} onFile={() => onFile(item)} onRetry={() => onRetry(item)} onSensitive={() => onSensitive(item)} onSensitiveRetry={() => onSensitiveRetry(item)} onDownload={() => onDownload(item)} />{mutations.get(item) ? <p className={`portal-counseling__mutation portal-counseling__mutation--${mutations.get(item)?.state}`} role={mutations.get(item)?.state === "error" ? "alert" : "status"}>{mutations.get(item)?.message}</p> : null}</td></tr> : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState() {
  return <div className="portal-counseling__empty" role="status"><h2>No assessments to show.</h2><p>Try changing the filters or check back after assessment records are added.</p></div>;
}

function AssessmentPagination({ filters, page }: { filters: AssessmentListFilters; page: PortalAssessmentPage }) {
  const totalPages = Math.max(1, Math.ceil(page.total / page.page_size));
  if (totalPages <= 1) return null;
  return <Pagination aria-label="Assessment pages" className="portal-counseling__pagination"><PaginationContent><PaginationItem>{page.page > 1 ? <PaginationPrevious href={assessmentHref(page.page - 1, filters)} text="Previous" /> : <span aria-hidden="true" className="portal-counseling__pagination-spacer" />}</PaginationItem><PaginationItem className="portal-counseling__pagination-current"><span aria-current="page">Page {page.page} of {totalPages}</span></PaginationItem><PaginationItem>{page.page < totalPages ? <PaginationNext href={assessmentHref(page.page + 1, filters)} text="Next" /> : <span aria-hidden="true" className="portal-counseling__pagination-spacer" />}</PaginationItem></PaginationContent></Pagination>;
}

function AssessmentsHeader() {
  return <PortalPageHeader className="portal-counseling__page-header" current="Assessments" description="Record and review authorized assessment results within your counseling scope." headingId="portal-assessments-heading" title="Assessments" />;
}

export function PortalAssessmentsLoading() {
  return <section aria-busy="true" aria-labelledby="portal-assessments-loading-heading" className="portal-counseling portal-assessments portal-counseling--loading" role="status"><span className="sr-only">Loading assessments…</span><PortalPageHeader className="portal-counseling__page-header" current="Assessments" description={<Skeleton as="span" />} headingId="portal-assessments-loading-heading" title={<Skeleton as="span" />} /><PortalFilterPanel action="/portal/assessments" ariaBusy className="portal-counseling__filters" resetKey="assessments-loading" summary={<Skeleton as="span" />}><div className="portal-counseling__filter-skeleton-grid">{Array.from({ length: 6 }, (_, index) => <Skeleton as="span" key={index} />)}</div></PortalFilterPanel><PortalCollectionFrame className="portal-counseling__frame"><div aria-hidden="true" className="portal-counseling__table-skeleton">{Array.from({ length: 5 }, (_, row) => <div className="portal-counseling__table-skeleton-row" key={row}>{Array.from({ length: 8 }, (_, cell) => <Skeleton as="span" key={cell} />)}</div>)}</div></PortalCollectionFrame></section>;
}

export function PortalAssessmentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasCapability, status: accessStatus } = usePortalAccess();
  const queryString = searchParams.toString();
  const filters = useMemo(() => parseAssessmentFilters(searchParams), [searchParams]);
  const pageNumber = parsePage(searchParams.get("page"));
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [expanded, setExpanded] = useState<PortalAssessment | null>(null);
  const [details, setDetails] = useState<Map<PortalAssessment, DetailState>>(new Map());
  const [sensitive, setSensitive] = useState<Map<PortalAssessment, SensitiveState>>(new Map());
  const [files, setFiles] = useState<Map<PortalAssessment, FileState>>(new Map());
  const [mutations, setMutations] = useState<Map<PortalAssessment, MutationState>>(new Map());
  const [dialogIntent, setDialogIntent] = useState<DialogIntent>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultFields, setResultFields] = useState({ rawScore: "", scaledScore: "", scoreLabel: "", interpretation: "", visibility: "counselor_only" as AssessmentVisibility });
  const [reviewNotes, setReviewNotes] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [replacementOptions, setReplacementOptions] = useState<PortalAssessment[]>([]);
  const [replacementIndex, setReplacementIndex] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createOptions, setCreateOptions] = useState<PortalAssessmentStudentOption[]>([]);
  const [createInstruments, setCreateInstruments] = useState<PortalAssessmentInstrumentOption[]>([]);
  const [createQuery, setCreateQuery] = useState("");
  const [createToken, setCreateToken] = useState("");
  const [createOptionIndex, setCreateOptionIndex] = useState("");
  const [createLabel, setCreateLabel] = useState("");
  const [createInstrument, setCreateInstrument] = useState("");
  const [createDate, setCreateDate] = useState("");
  const [createSource, setCreateSource] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const createKey = useRef<{ fingerprint: string; key: IdempotencyKey } | null>(null);
  const mutationKeys = useRef(new WeakMap<PortalAssessment, Map<string, { fingerprint: string; key: IdempotencyKey }>>());

  useEffect(() => {
    if (accessStatus !== "ready" || !hasCapability(PORTAL_CAPABILITIES.assessmentsQueueView)) return;
    const canonical = assessmentHref(pageNumber, filters);
    const current = queryString ? `/portal/assessments?${queryString}` : "/portal/assessments";
    if (canonical !== current) router.replace(canonical, { scroll: false });
  }, [accessStatus, filters, hasCapability, pageNumber, queryString, router]);

  useEffect(() => {
    if (accessStatus !== "ready" || !hasCapability(PORTAL_CAPABILITIES.assessmentsQueueView)) return;
    const controller = new AbortController();
    setLoadState({ kind: "loading" });
    getPortalAssessments(pageNumber, filters, controller.signal).then((page) => {
      setLoadState({ kind: "ready", page });
      setExpanded(null);
      setDetails(new Map());
      setSensitive(new Map());
      setFiles(new Map());
      setMutations(new Map());
    }).catch((error: unknown) => {
      if (isAbortError(error)) return;
      if (error instanceof AssessmentsApiError && error.kind === "permission") {
        setLoadState({ kind: "forbidden" });
      } else {
        const loadError = error instanceof AssessmentsApiError && (error.kind === "rate_limited" || error.kind === "validation") ? error.kind : "unavailable";
        setLoadState({ kind: "unavailable", error: loadError });
      }
    });
    return () => controller.abort();
  }, [accessStatus, filters, hasCapability, pageNumber, reloadKey]);

  const loadDetail = (item: PortalAssessment) => {
    setDetails((current) => new Map(current).set(item, { kind: "loading" }));
    getPortalAssessmentDetail(item).then((detail) => setDetails((current) => new Map(current).set(item, { kind: "ready", detail }))).catch(() => setDetails((current) => new Map(current).set(item, { kind: "error" })));
  };

  const toggleExpanded = (item: PortalAssessment) => {
    if (expanded === item) {
      setExpanded(null);
      return;
    }
    setExpanded(item);
    if (!details.has(item)) loadDetail(item);
  };

  const loadSensitive = (item: PortalAssessment) => {
    setSensitive((current) => new Map(current).set(item, { kind: "loading" }));
    getPortalAssessmentInterpretation(item).then((detail) => setSensitive((current) => new Map(current).set(item, { kind: "ready", detail }))).catch(() => setSensitive((current) => new Map(current).set(item, { kind: "error" })));
  };

  const loadFile = (item: PortalAssessment) => {
    setFiles((current) => new Map(current).set(item, { kind: "loading" }));
    getPortalAssessmentFileMetadata(item).then((metadata) => setFiles((current) => new Map(current).set(item, { kind: "ready", metadata }))).catch(() => setFiles((current) => new Map(current).set(item, { kind: "error" })));
  };

  const downloadFile = async (item: PortalAssessment) => {
    try {
      const blob = await downloadPortalAssessmentFile(item);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const fileState = files.get(item);
      anchor.download = fileState?.kind === "ready" && fileState.metadata.filename ? fileState.metadata.filename : "assessment-file";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      setMutations((current) => new Map(current).set(item, { state: "error", message: errorMessage(error) }));
    }
  };

  const openAction = (action: ReturnType<typeof assessmentActions>[number], item: PortalAssessment) => {
    setDialogError(null);
    setReasonCode("");
    setReviewNotes("");
    setFile(null);
    setReplacementOptions([]);
    setReplacementIndex("");
    if (action === "submit") {
      const fingerprint = `submit:${item.status}:${item.updated_at ?? ""}`;
      let itemKeys = mutationKeys.current.get(item);
      if (!itemKeys) {
        itemKeys = new Map();
        mutationKeys.current.set(item, itemKeys);
      }
      let entry = itemKeys.get("submit");
      if (!entry || entry.fingerprint !== fingerprint) entry = { fingerprint, key: createIdempotencyKey() };
      itemKeys.set("submit", entry);
      setIsSubmitting(true);
      submitPortalAssessmentForReview(item, entry.key).then(() => {
        itemKeys?.delete("submit");
        setReloadKey((value) => value + 1);
      }).catch((error) => setMutations((current) => new Map(current).set(item, { state: "error", message: errorMessage(error) }))).finally(() => setIsSubmitting(false));
      return;
    }
    if (action === "save") setDialogIntent({ kind: "save", item });
    else if (action === "file") setDialogIntent({ kind: "file", item });
    else if (action === "result") setDialogIntent({ kind: "result", item });
    else if (action === "review") setDialogIntent({ kind: "review", item });
    else if (action === "release") setDialogIntent({ kind: "release", item });
    else if (action === "void") setDialogIntent({ kind: "void", item });
    else if (action === "archive") setDialogIntent({ kind: "archive", item });
    else setDialogIntent({ kind: "supersede", item });
  };

  useEffect(() => {
    if (!dialogIntent || !["result", "save"].includes(dialogIntent.kind)) return;
    setResultFields({ rawScore: "", scaledScore: "", scoreLabel: "", interpretation: "", visibility: dialogIntent.item.interpretation_visibility });
    getPortalAssessmentInterpretation(dialogIntent.item).then((detail) => setResultFields({ rawScore: detail.raw_score ?? "", scaledScore: detail.scaled_score ?? "", scoreLabel: detail.score_label ?? "", interpretation: detail.interpretation, visibility: detail.interpretation_visibility })).catch(() => setDialogError("Existing result details are unavailable. Try again."));
  }, [dialogIntent]);

  useEffect(() => {
    if (!dialogIntent || dialogIntent.kind !== "supersede") return;
    getPortalAssessmentReplacementOptions(dialogIntent.item).then((page) => setReplacementOptions(page.items)).catch((error) => setDialogError(errorMessage(error)));
  }, [dialogIntent]);

  const closeDialog = () => {
    setDialogIntent(null);
    setDialogError(null);
    setIsSubmitting(false);
    setFile(null);
    setReplacementOptions([]);
    setReplacementIndex("");
    mutationKeys.current = new WeakMap();
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateToken("");
    setCreateOptionIndex("");
    setCreateLabel("");
    setCreateOptions([]);
    setCreateInstruments([]);
    setCreateQuery("");
    setCreateError(null);
    setCreateLoading(false);
    createKey.current = null;
  };

  const submitAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dialogIntent) return;
    const item = dialogIntent.item;
    let fingerprint = `${dialogIntent.kind}:${item.status}:${item.updated_at ?? ""}`;
    if (dialogIntent.kind === "result" || dialogIntent.kind === "save") fingerprint += `:${JSON.stringify(resultFields)}`;
    if (dialogIntent.kind === "review") fingerprint += `:${reviewNotes}`;
    if (dialogIntent.kind === "void" || dialogIntent.kind === "archive") fingerprint += `:${reasonCode}`;
    if (dialogIntent.kind === "supersede") fingerprint += `:${replacementIndex}:${reasonCode}`;
    if (dialogIntent.kind === "file") fingerprint += `:${file?.name ?? ""}:${file?.size ?? ""}`;
    let itemKeys = mutationKeys.current.get(item);
    if (!itemKeys) {
      itemKeys = new Map();
      mutationKeys.current.set(item, itemKeys);
    }
    let entry = itemKeys.get(dialogIntent.kind);
    if (!entry || entry.fingerprint !== fingerprint) entry = { fingerprint, key: createIdempotencyKey() };
    itemKeys.set(dialogIntent.kind, entry);
    setIsSubmitting(true);
    try {
      let updated: PortalAssessment;
      if (dialogIntent.kind === "result" || dialogIntent.kind === "save") {
        const common = { expected_updated_at: item.updated_at, ...(item.instrument.allows_scores ? { raw_score: resultFields.rawScore || null, scaled_score: resultFields.scaledScore || null, score_label: resultFields.scoreLabel || null } : {}), ...(item.instrument.allows_interpretation ? { interpretation_text: resultFields.interpretation || null, interpretation_visibility: resultFields.visibility } : {}) };
        updated = dialogIntent.kind === "result" && item.status === "draft" ? await recordPortalAssessment(item, common, entry.key) : await updatePortalAssessment(item, common, entry.key);
      } else if (dialogIntent.kind === "review") updated = await reviewPortalAssessment(item, reviewNotes, entry.key);
      else if (dialogIntent.kind === "release") updated = await releasePortalAssessment(item, entry.key);
      else if (dialogIntent.kind === "void") updated = await voidPortalAssessment(item, reasonCode, entry.key);
      else if (dialogIntent.kind === "archive") updated = await archivePortalAssessment(item, reasonCode, entry.key);
      else if (dialogIntent.kind === "supersede") {
        const replacement = replacementOptions[Number.parseInt(replacementIndex, 10)];
        if (!replacement) throw new AssessmentsApiError("validation");
        updated = await supersedePortalAssessment(item, replacement, reasonCode, entry.key);
      } else {
        if (!file) throw new AssessmentsApiError("validation");
        updated = await attachPortalAssessmentFile(item, file, entry.key);
      }
      void updated;
      closeDialog();
      setReloadKey((value) => value + 1);
    } catch (error) {
      setDialogError(errorMessage(error));
      setIsSubmitting(false);
    }
  };

  const openCreate = () => {
    setCreateOpen(true);
    setCreateError(null);
    setCreateQuery("");
    setCreateToken("");
    setCreateOptionIndex("");
    setCreateLabel("");
    setCreateInstrument("");
    setCreateDate("");
    setCreateSource("");
    createKey.current = null;
    setCreateLoading(true);
    Promise.all([getPortalAssessmentStudentOptions(""), getPortalAssessmentInstruments()]).then(([students, instruments]) => {
      setCreateOptions(students);
      setCreateInstruments(instruments);
    }).catch((error) => setCreateError(errorMessage(error))).finally(() => setCreateLoading(false));
  };

  const searchCreateStudents = () => {
    setCreateLoading(true);
    setCreateError(null);
    getPortalAssessmentStudentOptions(createQuery).then((options) => {
      setCreateOptions(options);
      setCreateToken("");
      setCreateOptionIndex("");
      setCreateLabel("");
      createKey.current = null;
    }).catch((error) => setCreateError(errorMessage(error))).finally(() => setCreateLoading(false));
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createToken || !createInstrument) {
      setCreateError("Choose a student and an assessment instrument.");
      return;
    }
    const fingerprint = JSON.stringify({ createToken, createInstrument, createDate, createSource });
    if (!createKey.current || createKey.current.fingerprint !== fingerprint) createKey.current = { fingerprint, key: createIdempotencyKey() };
    setCreateLoading(true);
    setCreateError(null);
    try {
      const createInput: PortalAssessmentCreateInput = { student_selection_token: createToken, instrument_key: createInstrument, ...(createDate ? { administered_at: `${createDate}T00:00:00Z` } : {}), ...(createSource.trim() ? { source_form_reference: createSource.trim().slice(0, MAX_SOURCE_REFERENCE_LENGTH) } : {}) };
      await createPortalAssessment(createInput, createKey.current.key);
      createKey.current = null;
      closeCreate();
      setReloadKey((value) => value + 1);
    } catch (error) {
      setCreateError(errorMessage(error));
    } finally {
      setCreateLoading(false);
    }
  };

  if (accessStatus === "loading") return <PortalAssessmentsLoading />;
  if (accessStatus !== "ready" || !hasCapability(PORTAL_CAPABILITIES.assessmentsQueueView)) {
    return <section aria-labelledby="portal-assessments-access-heading" className="portal-counseling portal-assessments portal-counseling--state"><AssessmentsHeader /><PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state"><ShieldCheck aria-hidden="true" className="portal-counseling__state-icon" /><h2 id="portal-assessments-access-heading">Assessments aren’t available for this account.</h2><p>Return to your workspace to continue.</p></PortalCollectionFrame></section>;
  }

  const page = loadState.kind === "ready" ? loadState.page : null;
  return (
    <section aria-labelledby="portal-assessments-heading" className="portal-counseling portal-assessments">
      <AssessmentsHeader />
      <AssessmentFilterPanel filters={filters} />
      {loadState.kind === "loading" ? <PortalCollectionFrame className="portal-counseling__frame"><div aria-hidden="true" className="portal-counseling__table-skeleton">{Array.from({ length: 5 }, (_, row) => <div className="portal-counseling__table-skeleton-row" key={row}>{Array.from({ length: 8 }, (_, cell) => <Skeleton as="span" key={cell} />)}</div>)}</div></PortalCollectionFrame> : null}
      {loadState.kind === "forbidden" ? <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state"><h2>This page isn’t available for this account.</h2><p>Return to your workspace to continue.</p></PortalCollectionFrame> : null}
      {loadState.kind === "unavailable" ? <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state"><h2>Assessments are temporarily unavailable.</h2><p>Try again when the connection is ready.</p><Button onClick={() => setReloadKey((value) => value + 1)} type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button></PortalCollectionFrame> : null}
      {page ? <PortalCollectionFrame aria-labelledby="portal-assessments-results-heading" className="portal-counseling__frame"><div className="portal-counseling__frame-heading"><div><p className="portal-counseling__kicker">Assessments</p><h2 id="portal-assessments-results-heading">Assessment records</h2></div><div className="portal-counseling__frame-actions"><p className="portal-counseling__result-count">{page.total} {page.total === 1 ? "record" : "records"}</p><Button onClick={openCreate} size="sm" type="button">New assessment</Button></div></div>{page.items.length === 0 ? <EmptyState /> : <AssessmentTable details={details} files={files} hasCapability={hasCapability} items={page.items} mutations={mutations} sensitive={sensitive} expanded={expanded} onAction={openAction} onFile={loadFile} onRetry={loadDetail} onSensitive={loadSensitive} onSensitiveRetry={loadSensitive} onToggle={toggleExpanded} onDownload={downloadFile} />}<AssessmentPagination filters={filters} page={page} /></PortalCollectionFrame> : null}

      <AlertDialog open={createOpen} onOpenChange={(open) => { if (!open) closeCreate(); }}>
        <AlertDialogContent className="portal-counseling__dialog">
          <AlertDialogHeader><AlertDialogTitle>New assessment</AlertDialogTitle><AlertDialogDescription>Create a draft assessment record for a student in your authorized counseling scope.</AlertDialogDescription></AlertDialogHeader>
          <form onSubmit={submitCreate}>
            <div className="portal-counseling__dialog-field"><Label htmlFor="portal-assessments-student-search">Find student</Label><div className="portal-assessments__inline-field"><Input id="portal-assessments-student-search" maxLength={MAX_QUERY_LENGTH} onChange={(event) => { setCreateQuery(event.target.value); createKey.current = null; }} placeholder="Student name or student number" value={createQuery} /><Button onClick={searchCreateStudents} size="sm" type="button" variant="outline">Search</Button></div></div>
            <div className="portal-counseling__dialog-field"><Label htmlFor="portal-assessments-student">Student</Label><select id="portal-assessments-student" onChange={(event) => { const index = Number.parseInt(event.target.value, 10); const option = Number.isSafeInteger(index) && index >= 0 ? createOptions[index] : undefined; setCreateOptionIndex(event.target.value); setCreateToken(option?.selection_token ?? ""); setCreateLabel(option?.label ?? ""); createKey.current = null; }} value={createOptionIndex}><option value="">Choose a student</option>{createOptions.map((option, index) => <option key={index} value={String(index)}>{option.label}</option>)}</select>{createLabel ? <p className="portal-counseling__dialog-hint">Selected: {createLabel}</p> : null}</div>
            <div className="portal-counseling__dialog-field"><Label htmlFor="portal-assessments-instrument">Assessment instrument</Label><select id="portal-assessments-instrument" onChange={(event) => { setCreateInstrument(event.target.value); createKey.current = null; }} value={createInstrument}><option value="">Choose an instrument</option>{createInstruments.filter((item) => item.active).map((item) => <option key={item.key} value={item.key}>{item.title} · {labelForValue(item.category)}</option>)}</select></div>
            <div className="portal-counseling__dialog-field"><Label htmlFor="portal-assessments-administered">Administered date <span>(optional)</span></Label><Input id="portal-assessments-administered" onChange={(event) => { setCreateDate(event.target.value); createKey.current = null; }} type="date" value={createDate} /></div>
            <div className="portal-counseling__dialog-field"><Label htmlFor="portal-assessments-source">Source/reference <span>(optional)</span></Label><Input id="portal-assessments-source" maxLength={MAX_SOURCE_REFERENCE_LENGTH} onChange={(event) => { setCreateSource(event.target.value); createKey.current = null; }} value={createSource} /></div>
            {createLoading ? <p className="portal-counseling__detail-state" role="status">Loading assessment options…</p> : null}
            {createError ? <p className="portal-counseling__dialog-error" role="alert">{createError}</p> : null}
            <AlertDialogFooter><AlertDialogCancel disabled={createLoading}>Cancel</AlertDialogCancel><AlertDialogAction disabled={createLoading} type="submit">Create draft</AlertDialogAction></AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(dialogIntent)} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <AlertDialogContent className="portal-counseling__dialog">
          <AlertDialogHeader><AlertDialogTitle>{dialogIntent ? actionLabel(dialogIntent.kind === "result" ? "result" : dialogIntent.kind, dialogIntent.item) : "Assessment action"}</AlertDialogTitle><AlertDialogDescription>{dialogIntent?.kind === "result" || dialogIntent?.kind === "save" ? "Enter the governed result fields. The backend will enforce the instrument’s scoring and interpretation rules." : dialogIntent?.kind === "review" ? "Review this assessment within your authorized workflow scope." : dialogIntent?.kind === "release" ? "Release the approved safe summary to the student." : "Confirm this assessment action using the bounded fields below."}</AlertDialogDescription></AlertDialogHeader>
          {dialogIntent?.kind === "result" || dialogIntent?.kind === "save" ? <form onSubmit={submitAction}><div className="portal-counseling__dialog-fields">{dialogIntent.item.instrument.allows_scores ? <><div className="portal-counseling__dialog-field"><Label htmlFor="portal-assessments-raw-score">Raw score</Label><Input id="portal-assessments-raw-score" onChange={(event) => setResultFields((value) => ({ ...value, rawScore: event.target.value }))} value={resultFields.rawScore} /></div><div className="portal-counseling__dialog-field"><Label htmlFor="portal-assessments-scaled-score">Scaled score</Label><Input id="portal-assessments-scaled-score" onChange={(event) => setResultFields((value) => ({ ...value, scaledScore: event.target.value }))} value={resultFields.scaledScore} /></div><div className="portal-counseling__dialog-field"><Label htmlFor="portal-assessments-score-label">Score label</Label><Input id="portal-assessments-score-label" onChange={(event) => setResultFields((value) => ({ ...value, scoreLabel: event.target.value }))} value={resultFields.scoreLabel} /></div></> : null}{dialogIntent.item.instrument.allows_interpretation ? <><div className="portal-counseling__dialog-field"><Label htmlFor="portal-assessments-visibility">Interpretation visibility</Label><select id="portal-assessments-visibility" onChange={(event) => setResultFields((value) => ({ ...value, visibility: event.target.value as AssessmentVisibility }))} value={resultFields.visibility}>{VISIBILITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div><div className="portal-counseling__dialog-field"><Label htmlFor="portal-assessments-interpretation">Interpretation</Label><Textarea id="portal-assessments-interpretation" maxLength={MAX_TEXT_LENGTH} onChange={(event) => setResultFields((value) => ({ ...value, interpretation: event.target.value }))} value={resultFields.interpretation} /></div></> : null}</div>{dialogError ? <p className="portal-counseling__dialog-error" role="alert">{dialogError}</p> : null}<AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel><AlertDialogAction disabled={isSubmitting} type="submit">{dialogIntent.kind === "save" ? "Save draft" : dialogIntent.item.status === "draft" ? "Record result" : "Save changes"}</AlertDialogAction></AlertDialogFooter></form> : null}
          {dialogIntent?.kind === "review" ? <form onSubmit={submitAction}><div className="portal-counseling__dialog-field"><Label htmlFor="portal-assessments-review-notes">Reviewer note <span>(optional audit note)</span></Label><Textarea id="portal-assessments-review-notes" maxLength={1000} onChange={(event) => setReviewNotes(event.target.value)} value={reviewNotes} /></div>{dialogError ? <p className="portal-counseling__dialog-error" role="alert">{dialogError}</p> : null}<AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel><AlertDialogAction disabled={isSubmitting} type="submit">Review assessment</AlertDialogAction></AlertDialogFooter></form> : null}
          {dialogIntent?.kind === "release" ? <form onSubmit={submitAction}>{dialogError ? <p className="portal-counseling__dialog-error" role="alert">{dialogError}</p> : null}<AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel><AlertDialogAction disabled={isSubmitting} type="submit">Release to student</AlertDialogAction></AlertDialogFooter></form> : null}
          {dialogIntent?.kind === "file" ? <form onSubmit={submitAction}><div className="portal-counseling__dialog-field"><Label htmlFor="portal-assessments-file">Assessment file</Label><Input id="portal-assessments-file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} type="file" /></div>{dialogError ? <p className="portal-counseling__dialog-error" role="alert">{dialogError}</p> : null}<AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel><AlertDialogAction disabled={isSubmitting || !file} type="submit">Attach file</AlertDialogAction></AlertDialogFooter></form> : null}
          {dialogIntent && ["void", "archive", "supersede"].includes(dialogIntent.kind) ? <form onSubmit={submitAction}>{dialogIntent.kind === "supersede" ? <div className="portal-counseling__dialog-field"><Label htmlFor="portal-assessments-replacement">Replacement assessment</Label><select id="portal-assessments-replacement" onChange={(event) => setReplacementIndex(event.target.value)} value={replacementIndex}><option value="">Choose a same-student assessment</option>{replacementOptions.map((item, index) => <option key={`${item.instrument.key}-${index}`} value={String(index)}>{item.instrument.title} · {labelForValue(item.status)} · {formatTimestamp(item.administered_at)}</option>)}</select></div> : null}<div className="portal-counseling__dialog-field"><Label htmlFor="portal-assessments-reason">Reason code</Label><Input id="portal-assessments-reason" maxLength={MAX_REASON_LENGTH} onChange={(event) => setReasonCode(event.target.value)} value={reasonCode} /></div>{dialogError ? <p className="portal-counseling__dialog-error" role="alert">{dialogError}</p> : null}<AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel><AlertDialogAction disabled={isSubmitting} type="submit">{dialogIntent.kind === "void" ? "Void assessment" : dialogIntent.kind === "archive" ? "Archive assessment" : "Supersede assessment"}</AlertDialogAction></AlertDialogFooter></form> : null}
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
