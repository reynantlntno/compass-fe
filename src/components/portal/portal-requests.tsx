"use client";

import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
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
import {
  GOOD_MORAL_DRY_SEAL_STATUSES,
  GOOD_MORAL_OSSD_STATUSES,
  GOOD_MORAL_RECEIPT_STATUSES,
  GOOD_MORAL_REQUEST_TYPES,
  GOOD_MORAL_STATUSES,
  GoodMoralApiError,
  archivePortalGoodMoral,
  assignPortalGoodMoralReviewer,
  approvePortalGoodMoral,
  cancelPortalGoodMoral,
  confirmPortalGoodMoralDrySeal,
  createPortalGoodMoral,
  downloadPortalGoodMoralDocument,
  encodePortalGoodMoralReceipt,
  generatePortalGoodMoral,
  getPortalGoodMoralDetail,
  getPortalGoodMoralOptions,
  getPortalGoodMoralQueue,
  getPortalGoodMoralReviewerOptions,
  getPortalGoodMoralStudents,
  holdPortalGoodMoral,
  parseGoodMoralFilters,
  printPortalGoodMoral,
  rejectPortalGoodMoral,
  releasePortalGoodMoral,
  startPortalGoodMoralReview,
  supersedePortalGoodMoral,
  updatePortalGoodMoralOssd,
  verifyPortalGoodMoralReceipt,
  voidPortalGoodMoral,
  type GoodMoralFilters,
  type PortalGoodMoral,
  type PortalGoodMoralOptions,
  type PortalGoodMoralOption,
  type PortalGoodMoralPage,
  type PortalGoodMoralReviewerOption,
  type PortalGoodMoralStudentOption,
} from "@/lib/api/good-moral";
import { createIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";

const REQUESTS_NAV_ITEMS = [
  {
    href: "/portal/requests?section=good-moral",
    label: "Good Moral Certificate",
    value: "good-moral",
  },
] as const;

function humanLabel(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const STATUS_OPTIONS = GOOD_MORAL_STATUSES.map((value) => ({ value, label: humanLabel(value) }));
const REQUEST_TYPE_OPTIONS = GOOD_MORAL_REQUEST_TYPES.map((value) => ({ value, label: value === "STUDENT" ? "Student" : "Graduate" }));
const RECEIPT_OPTIONS = GOOD_MORAL_RECEIPT_STATUSES.map((value) => ({ value, label: humanLabel(value) }));
const OSSD_OPTIONS = GOOD_MORAL_OSSD_STATUSES.map((value) => ({ value, label: humanLabel(value) }));
const DRY_SEAL_OPTIONS = GOOD_MORAL_DRY_SEAL_STATUSES.map((value) => ({ value, label: humanLabel(value) }));

type QueueState =
  | { kind: "loading" }
  | { kind: "ready"; page: PortalGoodMoralPage }
  | { kind: "forbidden" }
  | { kind: "unavailable"; error: GoodMoralApiError["kind"] };

type DetailState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; item: PortalGoodMoral };

type ActionKind =
  | "receipt-encode"
  | "receipt-verify"
  | "start-review"
  | "assign-reviewer"
  | "ossd"
  | "hold"
  | "reject"
  | "approve"
  | "generate"
  | "print"
  | "dry-seal"
  | "release"
  | "cancel"
  | "void"
  | "supersede"
  | "archive";

type ActionIntent = { kind: ActionKind; item: PortalGoodMoral };
type MutationState = { state: "pending" | "success" | "error"; message: string };
type MutationKeyEntry = { fingerprint: string; key: IdempotencyKey };

const ACTION_LABELS: Record<ActionKind, string> = {
  "receipt-encode": "Encode receipt",
  "receipt-verify": "Verify receipt",
  "start-review": "Start review",
  "assign-reviewer": "Assign reviewer",
  ossd: "Update OSSD verification",
  hold: "Place on hold",
  reject: "Reject request",
  approve: "Approve request",
  generate: "Generate certificate",
  print: "Mark printed",
  "dry-seal": "Confirm external dry seal",
  release: "Release certificate",
  cancel: "Cancel request",
  void: "Void certificate",
  supersede: "Supersede certificate",
  archive: "Archive request",
};

const REASON_ACTIONS = new Set<ActionKind>(["hold", "reject", "cancel", "void", "archive"]);

function labelForValue(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const explicit: Record<string, string> = {
    APPROVED_FOR_GENERATION: "Approved for generation",
    FOR_RECORD_CHECKING: "For record checking",
    GENERATING: "Generating",
    NOT_REQUIRED: "Not required",
    ON_HOLD_FOR_REVIEW: "On hold for review",
    PAYMENT_ENCODED: "Payment encoded",
    PENDING_MANUAL_OSSD_VERIFICATION: "Pending OSSD verification",
    REJECTED: "Rejected",
    SUBMITTED: "Submitted",
    VOIDED: "Voided",
  };
  return explicit[value] ?? humanLabel(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function parsePage(value: string | null) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

function statusOptions(options: PortalGoodMoralOption[] | undefined, fallback: readonly { value: string; label: string }[]) {
  return options?.length ? options : fallback;
}

function loadErrorMessage(error: QueueState["kind"] | GoodMoralApiError["kind"]) {
  if (error === "permission" || error === "forbidden") return "This queue is not available for this account.";
  if (error === "rate_limited") return "Too many requests. Please wait and try again.";
  if (error === "validation") return "The queue filters could not be applied.";
  return "Requests & Certificates is unavailable right now.";
}

function mutationMessage(error: unknown) {
  if (error instanceof GoodMoralApiError) {
    if (error.kind === "conflict") return "This request changed. Refresh the queue and try again.";
    if (error.kind === "permission") return "This action is not available for this account.";
    if (error.kind === "validation") return "The request details are not valid for this action.";
    if (error.kind === "rate_limited") return "Too many attempts. Please wait before trying again.";
  }
  return "This request action is temporarily unavailable. Try again.";
}

function actionAllowed(item: PortalGoodMoral, kind: ActionKind, hasCapability: (capability: string) => boolean) {
  const status = item.status;
  const inStatuses = (...values: string[]) => values.includes(status);
  const receiptVerified = item.receipt_status === "VERIFIED";
  switch (kind) {
    case "receipt-encode": return hasCapability(PORTAL_CAPABILITIES.goodMoralReceiptEncode) && inStatuses("SUBMITTED", "FOR_PAYMENT");
    case "receipt-verify": return hasCapability(PORTAL_CAPABILITIES.goodMoralReceiptVerify) && item.receipt_status === "ENCODED" && inStatuses("PAYMENT_ENCODED", "FOR_RECORD_CHECKING");
    case "start-review": return hasCapability(PORTAL_CAPABILITIES.goodMoralReview) && receiptVerified && inStatuses("FOR_RECORD_CHECKING", "PENDING_MANUAL_OSSD_VERIFICATION", "ON_HOLD_FOR_REVIEW");
    case "assign-reviewer": return hasCapability(PORTAL_CAPABILITIES.goodMoralReview) && receiptVerified && !item.reviewer_assigned && inStatuses("FOR_RECORD_CHECKING", "PENDING_MANUAL_OSSD_VERIFICATION", "ON_HOLD_FOR_REVIEW");
    case "ossd": return hasCapability(PORTAL_CAPABILITIES.goodMoralReview) && receiptVerified && inStatuses("FOR_RECORD_CHECKING", "PENDING_MANUAL_OSSD_VERIFICATION");
    case "hold": return hasCapability(PORTAL_CAPABILITIES.goodMoralReview) && receiptVerified && inStatuses("FOR_RECORD_CHECKING", "PENDING_MANUAL_OSSD_VERIFICATION", "FOR_APPROVAL");
    case "reject": return hasCapability(PORTAL_CAPABILITIES.goodMoralReject) && !["DRAFT", "REJECTED", "CANCELLED", "VOIDED", "ARCHIVED"].includes(status);
    case "approve": return hasCapability(PORTAL_CAPABILITIES.goodMoralApprove) && receiptVerified && inStatuses("FOR_RECORD_CHECKING", "ON_HOLD_FOR_REVIEW", "FOR_APPROVAL");
    case "generate": return hasCapability(PORTAL_CAPABILITIES.goodMoralDocumentGenerate) && inStatuses("APPROVED_FOR_GENERATION", "GENERATING", "FAILED");
    case "print": return hasCapability(PORTAL_CAPABILITIES.goodMoralPrint) && inStatuses("GENERATED");
    case "dry-seal": return hasCapability(PORTAL_CAPABILITIES.goodMoralRegistrarSealConfirm) && inStatuses("PRINTED");
    case "release": return hasCapability(PORTAL_CAPABILITIES.goodMoralRelease) && inStatuses("PRINTED");
    case "cancel": return hasCapability(PORTAL_CAPABILITIES.goodMoralCancel) && inStatuses("SUBMITTED", "FOR_PAYMENT", "PAYMENT_ENCODED", "FOR_RECORD_CHECKING", "PENDING_MANUAL_OSSD_VERIFICATION", "ON_HOLD_FOR_REVIEW");
    case "void": return hasCapability(PORTAL_CAPABILITIES.goodMoralVoid) && inStatuses("GENERATED", "PRINTED", "RELEASED");
    case "supersede": return hasCapability(PORTAL_CAPABILITIES.goodMoralSupersede) && inStatuses("RELEASED");
    case "archive": return hasCapability(PORTAL_CAPABILITIES.goodMoralArchive) && inStatuses("REJECTED", "CANCELLED", "VOIDED", "RELEASED");
  }
}

function GoodMoralHeader() {
  return (
    <PortalPageHeader
      className="portal-counseling__page-header"
      current="Requests & Certificates"
      description="Manage authorized Good Moral Certificate requests within the existing operational workflow."
      headingId="portal-requests-heading"
      title="Requests & Certificates"
    />
  );
}

function Filters({ filters, options, onSubmit }: { filters: GoodMoralFilters; options: PortalGoodMoralOptions | null; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const selectOptions = (items: PortalGoodMoralOption[] | undefined) => items ?? [];
  const optionKey: Record<string, keyof PortalGoodMoralOptions> = {
    academic_year: "academic_years",
    campus: "campuses",
    college: "colleges",
    department: "departments",
    program: "programs",
  };
  return (
    <PortalFilterPanel
      action="/portal/requests?section=good-moral"
      className="portal-counseling__filters"
      onSubmit={onSubmit}
      resetKey={JSON.stringify(filters)}
      summary={filters.q || filters.statuses.length || filters.requestTypes.length || filters.receiptStatuses.length || filters.ossdStatuses.length || filters.drySealStatuses.length || filters.academicYear || filters.campus || filters.college || filters.department || filters.program ? "Filtered Good Moral requests" : "All authorized Good Moral requests"}
    >
      <div className="portal-counseling__filters-grid">
        <div className="portal-counseling__dialog-field">
          <Label htmlFor="portal-requests-q">Search</Label>
          <Input defaultValue={filters.q ?? ""} id="portal-requests-q" name="q" placeholder="Reference, student name, or number" />
        </div>
        <div className="portal-counseling__dialog-field">
          <Label htmlFor="portal-requests-order">Order</Label>
          <select defaultValue={filters.order} id="portal-requests-order" name="order">
            <option value="recent">Recently updated</option>
            <option value="oldest">Oldest updated</option>
          </select>
        </div>
        <PortalStatusFilter ariaLabel="Good Moral lifecycle status filter" id="portal-requests-status" options={STATUS_OPTIONS} selectedValues={filters.statuses} title="Lifecycle status" />
        <PortalStatusFilter ariaLabel="Good Moral request type filter" id="portal-requests-request-type" name="request_type" options={REQUEST_TYPE_OPTIONS} selectedValues={filters.requestTypes} title="Request type" />
        <PortalStatusFilter ariaLabel="Good Moral receipt status filter" id="portal-requests-receipt-status" name="receipt_status" options={statusOptions(options?.receipt_statuses, RECEIPT_OPTIONS)} selectedValues={filters.receiptStatuses} title="Receipt status" />
        <PortalStatusFilter ariaLabel="Good Moral OSSD status filter" id="portal-requests-ossd-status" name="ossd_status" options={statusOptions(options?.ossd_statuses, OSSD_OPTIONS)} selectedValues={filters.ossdStatuses} title="OSSD status" />
        <PortalStatusFilter ariaLabel="Good Moral dry seal status filter" id="portal-requests-dry-seal-status" name="dry_seal_status" options={statusOptions(options?.dry_seal_statuses, DRY_SEAL_OPTIONS)} selectedValues={filters.drySealStatuses} title="Dry-seal status" />
        {(["academic_year", "campus", "college", "department", "program"] as const).map((name) => {
          const value = filters[name === "academic_year" ? "academicYear" : name];
          const items = selectOptions(options?.[optionKey[name]]);
          const label = name === "academic_year" ? "Academic year" : labelForValue(name);
          return (
            <div className="portal-counseling__dialog-field" key={name}>
              <Label htmlFor={`portal-requests-${name}`}>{label}</Label>
              <select defaultValue={value ?? ""} id={`portal-requests-${name}`} name={name}>
                <option value="">All</option>
                {items.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
          );
        })}
      </div>
      <div className="portal-counseling__filter-actions">
        <Button type="submit">Apply filters</Button>
      </div>
    </PortalFilterPanel>
  );
}

function QueueTable({
  items,
  expandedReference,
  details,
  detailStates,
  hasCapability,
  onAction,
  onDownload,
  onRetryDetail,
  onToggle,
}: {
  items: PortalGoodMoral[];
  expandedReference: string | null;
  details: Map<string, PortalGoodMoral>;
  detailStates: Map<string, DetailState>;
  hasCapability: (capability: string) => boolean;
  onAction: (kind: ActionKind, item: PortalGoodMoral) => void;
  onDownload: (item: PortalGoodMoral) => void;
  onRetryDetail: (item: PortalGoodMoral) => void;
  onToggle: (item: PortalGoodMoral) => void;
}) {
  return (
    <div className="portal-counseling__table-wrap">
      <table className="portal-counseling__table">
        <thead>
          <tr><th scope="col">Student</th><th scope="col">Request</th><th scope="col">Receipt / OSSD</th><th scope="col">Dry seal</th><th scope="col">Academic context</th><th scope="col">Updated</th><th scope="col">Details &amp; actions</th></tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const expanded = expandedReference === item.reference_code;
            const detailId = `good-moral-detail-${item.reference_code.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
            const actions = (Object.keys(ACTION_LABELS) as ActionKind[]).filter((kind) => actionAllowed(item, kind, hasCapability));
            const detailState = detailStates.get(item.reference_code);
            return (
              <FragmentRow
                detailId={detailId}
                detailState={detailState}
                expanded={expanded}
                item={details.get(item.reference_code) ?? item}
                key={item.reference_code}
                actions={actions}
                onAction={onAction}
                onDownload={onDownload}
                onRetryDetail={() => onRetryDetail(item)}
                onToggle={() => onToggle(item)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FragmentRow({ detailId, detailState, expanded, item, actions, onAction, onDownload, onRetryDetail, onToggle }: { detailId: string; detailState: DetailState | undefined; expanded: boolean; item: PortalGoodMoral; actions: ActionKind[]; onAction: (kind: ActionKind, item: PortalGoodMoral) => void; onDownload: (item: PortalGoodMoral) => void; onRetryDetail: () => void; onToggle: () => void }) {
  return (
    <>
      <tr>
        <td data-label="Student"><strong>{item.student_display_name}</strong><span className="portal-counseling__table-subtext">{item.student_number_masked}</span></td>
        <td data-label="Request"><Badge>{labelForValue(item.status)}</Badge><span className="portal-counseling__table-subtext">{labelForValue(item.request_type)} · {item.reference_code}</span></td>
        <td data-label="Receipt / OSSD"><span>{labelForValue(item.receipt_status)}</span><span className="portal-counseling__table-subtext">{labelForValue(item.ossd_verification_status)}</span></td>
        <td data-label="Dry seal"><Badge variant="outline">{labelForValue(item.dry_seal_status)}</Badge></td>
        <td data-label="Academic context"><span>{item.applicant_academic_year}</span><span className="portal-counseling__table-subtext">{[item.applicant_college, item.applicant_program_degree].filter(Boolean).join(" · ") || "Organization not recorded"}</span></td>
        <td data-label="Updated">{formatDate(item.updated_at)}</td>
        <td data-label="Details & actions"><div className="portal-counseling__details-actions"><Button aria-controls={detailId} aria-expanded={expanded} aria-label={`${expanded ? "Hide" : "Show"} Good Moral details`} onClick={onToggle} size="xs" type="button" variant="outline">{expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}<span className="sr-only">{expanded ? "Hide" : "Show"} details</span></Button>{actions.slice(0, 3).map((kind) => <Button key={kind} onClick={() => onAction(kind, item)} size="xs" type="button" variant={kind === "void" || kind === "reject" ? "outline" : "ghost"}>{ACTION_LABELS[kind]}</Button>)}{item.document_available ? <Button onClick={() => onDownload(item)} size="xs" type="button" variant="link">Certificate</Button> : null}</div></td>
      </tr>
      {expanded ? <tr className="portal-counseling__detail-row"><td colSpan={7} id={detailId}><GoodMoralDetails detailState={detailState} item={item} actions={actions} onAction={onAction} onDownload={onDownload} onRetry={onRetryDetail} /></td></tr> : null}
    </>
  );
}

function GoodMoralDetails({ detailState, item, actions, onAction, onDownload, onRetry }: { detailState: DetailState | undefined; item: PortalGoodMoral; actions: ActionKind[]; onAction: (kind: ActionKind, item: PortalGoodMoral) => void; onDownload: (item: PortalGoodMoral) => void; onRetry: () => void }) {
  if (!detailState || detailState.kind === "loading") return <div className="portal-counseling__detail-state" role="status"><Skeleton as="span" /><Skeleton as="span" /></div>;
  if (detailState.kind === "error") return <div className="portal-counseling__detail-state" role="status"><p>Good Moral details are unavailable right now.</p><Button onClick={onRetry} size="sm" type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button></div>;
  return (
    <div className="portal-counseling__detail-content">
      <p className="portal-counseling__kicker">Safe request metadata</p>
      <dl className="portal-counseling__metadata">
        <div><dt>Lifecycle</dt><dd>{labelForValue(item.status)}</dd></div>
        <div><dt>Applicant</dt><dd>{labelForValue(item.applicant_lifecycle_status)}</dd></div>
        <div><dt>Academic year</dt><dd>{item.applicant_academic_year}</dd></div>
        <div><dt>Graduation date</dt><dd>{item.applicant_graduation_date ?? "Not recorded"}</dd></div>
        <div><dt>Organization</dt><dd>{[item.applicant_campus, item.applicant_college, item.applicant_department, item.applicant_program_degree].filter(Boolean).join(" · ") || "Not recorded"}</dd></div>
        <div><dt>Document</dt><dd>{item.document_available ? labelForValue(item.document_status) : "Not available"}</dd></div>
        <div><dt>Created</dt><dd>{formatDate(item.created_at)}</dd></div>
        <div><dt>Updated</dt><dd>{formatDate(item.updated_at)}</dd></div>
      </dl>
      <div className="portal-counseling__details-actions">
        {actions.map((kind) => <Button key={kind} onClick={() => onAction(kind, item)} size="xs" type="button" variant={kind === "void" || kind === "reject" ? "outline" : "ghost"}>{ACTION_LABELS[kind]}</Button>)}
        {item.document_available ? <Button onClick={() => onDownload(item)} size="xs" type="button" variant="outline">Preview / download certificate</Button> : null}
      </div>
    </div>
  );
}

export function PortalGoodMoralLoading() {
  return (
    <section aria-busy="true" aria-labelledby="portal-requests-heading" className="portal-counseling portal-counseling--loading" role="status">
      <span className="sr-only">Loading Requests &amp; Certificates…</span>
      <GoodMoralHeader />
      <div className="portal-counseling__workspace"><div aria-hidden="true" className="compass-surface portal-workspace-nav portal-counseling__nav-skeleton" data-tone="subtle"><Skeleton className="portal-counseling__nav-skeleton-line" /></div><div className="portal-counseling__active-content"><PortalFilterPanel action="/portal/requests?section=good-moral" ariaBusy resetKey="requests-loading" summary={<Skeleton as="span" aria-hidden="true" className="portal-counseling__skeleton-summary" />}><div aria-hidden="true" className="portal-counseling__filter-skeleton-grid">{Array.from({ length: 6 }, (_, index) => <Skeleton as="span" key={index} />)}</div></PortalFilterPanel><PortalCollectionFrame className="portal-counseling__frame"><div aria-hidden="true" className="portal-counseling__table-skeleton">{Array.from({ length: 5 }, (_, row) => <div className="portal-counseling__table-skeleton-row" key={row}>{Array.from({ length: 7 }, (_, cell) => <Skeleton as="span" key={cell} />)}</div>)}</div></PortalCollectionFrame></div></div>
    </section>
  );
}

export function PortalGoodMoralPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasCapability, status: accessStatus } = usePortalAccess();
  const canQueue = hasCapability(PORTAL_CAPABILITIES.goodMoralQueueView);
  const section = searchParams.get("section");
  const filters = useMemo(() => parseGoodMoralFilters(searchParams), [searchParams]);
  const pageNumber = parsePage(searchParams.get("page"));
  const [, startTransition] = useTransition();
  const [queueState, setQueueState] = useState<QueueState>({ kind: "loading" });
  const [options, setOptions] = useState<PortalGoodMoralOptions | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedReference, setExpandedReference] = useState<string | null>(null);
  const [details, setDetails] = useState<Map<string, PortalGoodMoral>>(new Map());
  const [detailStates, setDetailStates] = useState<Map<string, DetailState>>(new Map());
  const [mutation, setMutation] = useState<MutationState | null>(null);
  const [actionIntent, setActionIntent] = useState<ActionIntent | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [ossdStatus, setOssdStatus] = useState("VERIFIED");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [receiptDate, setReceiptDate] = useState("");
  const [receiptAmount, setReceiptAmount] = useState("");
  const [receiptApproved, setReceiptApproved] = useState("true");
  const [rejectionCode, setRejectionCode] = useState("");
  const [signatoryName, setSignatoryName] = useState("");
  const [signatoryTitle, setSignatoryTitle] = useState("");
  const [reviewerOptions, setReviewerOptions] = useState<PortalGoodMoralReviewerOption[]>([]);
  const [reviewerToken, setReviewerToken] = useState("");
  const [reviewerLoading, setReviewerLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [studentQuery, setStudentQuery] = useState("");
  const [studentOptions, setStudentOptions] = useState<PortalGoodMoralStudentOption[]>([]);
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentToken, setStudentToken] = useState("");
  const [studentLabel, setStudentLabel] = useState("");
  const [purposeText, setPurposeText] = useState("");
  const [graduationDate, setGraduationDate] = useState("");
  const mutationKeys = useRef<Map<string, MutationKeyEntry>>(new Map());
  const filterKey = JSON.stringify(filters);

  useEffect(() => {
  if (section !== "good-moral") router.replace("/portal/requests?section=good-moral");
  }, [router, section]);

  useEffect(() => {
    if (!canQueue || accessStatus !== "ready") return;
    const controller = new AbortController();
    void getPortalGoodMoralOptions(controller.signal).then(setOptions).catch(() => undefined);
    return () => controller.abort();
  }, [accessStatus, canQueue]);

  useEffect(() => {
    if (!canQueue || accessStatus !== "ready" || section !== "good-moral") return;
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) setQueueState({ kind: "loading" });
    });
    void getPortalGoodMoralQueue(filters, pageNumber, controller.signal)
      .then((page) => setQueueState({ kind: "ready", page }))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        if (error instanceof GoodMoralApiError) setQueueState(error.kind === "permission" ? { kind: "forbidden" } : { kind: "unavailable", error: error.kind });
        else setQueueState({ kind: "unavailable", error: "unavailable" });
      });
    return () => controller.abort();
  }, [accessStatus, canQueue, filterKey, filters, pageNumber, reloadKey, section]);

  useEffect(() => {
    if (!createOpen) return;
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) setStudentLoading(true);
    });
    void getPortalGoodMoralStudents(studentQuery, controller.signal)
      .then(setStudentOptions)
      .catch((error: unknown) => { if (!(error instanceof Error && error.name === "AbortError")) setStudentOptions([]); })
      .finally(() => { if (!controller.signal.aborted) setStudentLoading(false); });
    return () => controller.abort();
  }, [createOpen, studentQuery]);

  useEffect(() => {
    if (actionIntent?.kind !== "assign-reviewer") return;
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        setReviewerLoading(true);
        setReviewerOptions([]);
      }
    });
    void getPortalGoodMoralReviewerOptions(actionIntent.item.reference_code, controller.signal)
      .then((items) => { setReviewerOptions(items); setReviewerToken(items[0]?.selection_token ?? ""); })
      .catch(() => { if (!controller.signal.aborted) setActionError("Reviewer options are unavailable right now."); })
      .finally(() => { if (!controller.signal.aborted) setReviewerLoading(false); });
    return () => controller.abort();
  }, [actionIntent]);

  const navigateWithFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams(searchParams.toString());
    next.set("section", "good-moral");
    ["q", "status", "request_type", "receipt_status", "ossd_status", "dry_seal_status", "academic_year", "campus", "college", "department", "program", "order", "page"].forEach((key) => next.delete(key));
    const add = (key: string, value: FormDataEntryValue | null) => { if (typeof value === "string" && value.trim()) next.set(key, value.trim()); };
    add("q", form.get("q"));
    add("order", form.get("order"));
    for (const key of ["status", "request_type", "receipt_status", "ossd_status", "dry_seal_status"]) {
      const values = form.getAll(key).filter((value): value is string => typeof value === "string" && value.length > 0);
      if (values.length) next.set(key, [...new Set(values)].join(","));
    }
    for (const key of ["academic_year", "campus", "college", "department", "program"]) add(key, form.get(key));
    startTransition(() => router.push(`/portal/requests?${next.toString()}`));
  };

  const page = queueState.kind === "ready" ? queueState.page : null;

  const loadDetail = (item: PortalGoodMoral) => {
    setDetailStates((previous) => new Map(previous).set(item.reference_code, { kind: "loading" }));
    const controller = new AbortController();
    void getPortalGoodMoralDetail(item.reference_code, controller.signal)
      .then((detail) => { setDetails((previous) => new Map(previous).set(item.reference_code, detail)); setDetailStates((previous) => new Map(previous).set(item.reference_code, { kind: "ready", item: detail })); })
      .catch(() => setDetailStates((previous) => new Map(previous).set(item.reference_code, { kind: "error" })));
  };

  const toggleDetails = (item: PortalGoodMoral) => {
    if (expandedReference === item.reference_code) { setExpandedReference(null); return; }
    setExpandedReference(item.reference_code);
    if (!details.has(item.reference_code)) loadDetail(item);
  };

  const openAction = (kind: ActionKind, item: PortalGoodMoral) => {
    setActionIntent({ kind, item });
    setActionError(null);
    setActionReason("");
    setReceiptNumber(""); setReceiptDate(""); setReceiptAmount(""); setReceiptApproved("true"); setRejectionCode("");
    setSignatoryName(""); setSignatoryTitle(""); setReviewerToken(""); setOssdStatus("VERIFIED");
  };

  const closeAction = () => {
    if (mutation?.state === "pending") return;
    if (actionIntent) mutationKeys.current.delete(`action:${actionIntent.item.reference_code}:${actionIntent.kind}`);
    setActionIntent(null); setActionError(null); setActionReason(""); setReviewerOptions([]); setReviewerToken("");
  };

  const mutationKey = (scope: string, fingerprint: string) => {
    const existing = mutationKeys.current.get(scope);
    if (existing?.fingerprint === fingerprint) return existing.key;
    const key = createIdempotencyKey();
    mutationKeys.current.set(scope, { fingerprint, key });
    return key;
  };

  const confirmAction = async () => {
    if (!actionIntent) return;
    const { kind, item } = actionIntent;
    if (REASON_ACTIONS.has(kind) && !actionReason.trim()) { setActionError("Enter the controlled reason code to continue."); return; }
    if (kind === "assign-reviewer" && !reviewerToken) { setActionError("Choose an eligible reviewer to continue."); return; }
    if (kind === "receipt-encode" && (!receiptNumber.trim() || !receiptDate || !receiptAmount.trim())) { setActionError("Enter the receipt number, date, and amount."); return; }
    if (kind === "approve" && (!signatoryName.trim() || !signatoryTitle.trim())) { setActionError("Enter the approval signatory details."); return; }
    const payload = JSON.stringify({ kind, resourceVersion: item.resource_version, reason: actionReason, receiptNumber, receiptDate, receiptAmount, receiptApproved, rejectionCode, signatoryName, signatoryTitle, reviewerToken, ossdStatus });
    const key = mutationKey(`action:${item.reference_code}:${kind}`, payload);
    setMutation({ state: "pending", message: `${ACTION_LABELS[kind]}…` });
    setActionError(null);
    try {
      if (kind === "receipt-encode") await encodePortalGoodMoralReceipt(item.reference_code, { receipt_number: receiptNumber.trim(), receipt_date: receiptDate, receipt_amount: receiptAmount.trim() }, key);
      else if (kind === "receipt-verify") await verifyPortalGoodMoralReceipt(item.reference_code, { approved: receiptApproved === "true", ...(rejectionCode.trim() ? { rejection_code: rejectionCode.trim() } : {}) }, key);
      else if (kind === "start-review") await startPortalGoodMoralReview(item.reference_code, key);
      else if (kind === "assign-reviewer") await assignPortalGoodMoralReviewer(item.reference_code, reviewerToken, key);
      else if (kind === "ossd") await updatePortalGoodMoralOssd(item.reference_code, { status: ossdStatus }, key);
      else if (kind === "hold") await holdPortalGoodMoral(item.reference_code, actionReason, "", key);
      else if (kind === "reject") await rejectPortalGoodMoral(item.reference_code, actionReason, "", key);
      else if (kind === "approve") await approvePortalGoodMoral(item.reference_code, { signatory_name: signatoryName.trim(), signatory_title: signatoryTitle.trim() }, key);
      else if (kind === "generate") await generatePortalGoodMoral(item.reference_code, key);
      else if (kind === "print") await printPortalGoodMoral(item.reference_code, key);
      else if (kind === "dry-seal") await confirmPortalGoodMoralDrySeal(item.reference_code, key);
      else if (kind === "release") await releasePortalGoodMoral(item.reference_code, key);
      else if (kind === "cancel") await cancelPortalGoodMoral(item.reference_code, actionReason, key);
      else if (kind === "void") await voidPortalGoodMoral(item.reference_code, actionReason, key);
      else if (kind === "supersede") await supersedePortalGoodMoral(item.reference_code, key);
      else if (kind === "archive") await archivePortalGoodMoral(item.reference_code, actionReason, key);
      mutationKeys.current.delete(`action:${item.reference_code}:${kind}`);
      setMutation({ state: "success", message: `${ACTION_LABELS[kind]} completed.` });
      setActionIntent(null); setActionError(null); setReloadKey((value) => value + 1);
    } catch (error) {
      setMutation({ state: "error", message: mutationMessage(error) });
      setActionError(mutationMessage(error));
    }
  };

  const openCertificate = async (item: PortalGoodMoral) => {
    try {
      const blob = await downloadPortalGoodMoralDocument(item.reference_code);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `${item.reference_code}.pdf`; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      setMutation({ state: "error", message: mutationMessage(error) });
    }
  };

  const closeCreate = () => {
    if (createLoading) return;
    mutationKeys.current.delete("create");
    setCreateOpen(false); setCreateError(null); setStudentQuery(""); setStudentOptions([]); setStudentToken(""); setStudentLabel(""); setPurposeText(""); setGraduationDate("");
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!studentToken || !purposeText.trim()) { setCreateError("Choose a student and enter the bounded purpose."); return; }
    const fingerprint = JSON.stringify({ studentToken, purposeText: purposeText.trim(), graduationDate });
    const key = mutationKey("create", fingerprint);
    setCreateLoading(true); setCreateError(null);
    try {
      const item = await createPortalGoodMoral({ student_selection_token: studentToken, purpose_text: purposeText, graduation_date: graduationDate || null }, key);
      mutationKeys.current.delete("create");
      setCreateOpen(false); setCreateLoading(false); setMutation({ state: "success", message: "Good Moral request created and submitted." }); setReloadKey((value) => value + 1); setExpandedReference(item.reference_code); setDetails((previous) => new Map(previous).set(item.reference_code, item)); setDetailStates((previous) => new Map(previous).set(item.reference_code, { kind: "ready", item }));
    } catch (error) {
      setCreateLoading(false); setCreateError(mutationMessage(error));
    }
  };

  if (accessStatus === "loading") return <PortalGoodMoralLoading />;
  if (!canQueue) return <section aria-labelledby="portal-requests-access-heading" className="portal-counseling portal-counseling--state"><GoodMoralHeader /><PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state"><h2 id="portal-requests-access-heading">Requests &amp; Certificates isn’t available for this account.</h2><p>Return to your workspace to continue.</p></PortalCollectionFrame></section>;

  return (
    <section aria-labelledby="portal-requests-heading" className="portal-counseling portal-requests">
      <GoodMoralHeader />
      <div className="portal-counseling__workspace">
        <PortalWorkspaceNav activeValue="good-moral" ariaLabel="Requests and Certificates sections" items={REQUESTS_NAV_ITEMS} />
        <div className="portal-counseling__active-content">
          <Filters filters={filters} onSubmit={navigateWithFilters} options={options} />
          {queueState.kind === "loading" ? <PortalCollectionFrame className="portal-counseling__frame"><div aria-hidden="true" className="portal-counseling__table-skeleton">{Array.from({ length: 5 }, (_, row) => <div className="portal-counseling__table-skeleton-row" key={row}>{Array.from({ length: 7 }, (_, cell) => <Skeleton as="span" key={cell} />)}</div>)}</div></PortalCollectionFrame> : null}
          {queueState.kind === "forbidden" ? <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state"><h2>This queue isn’t available for this account.</h2><p>Return to your workspace to continue.</p></PortalCollectionFrame> : null}
          {queueState.kind === "unavailable" ? <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state"><h2>{loadErrorMessage(queueState.error)}</h2><p>Try again when the connection is ready.</p><Button onClick={() => setReloadKey((value) => value + 1)} type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button></PortalCollectionFrame> : null}
          {queueState.kind === "ready" && page ? <PortalCollectionFrame aria-labelledby="portal-requests-results-heading" className="portal-counseling__frame"><div className="portal-counseling__frame-heading"><div><p className="portal-counseling__kicker">Good Moral Certificate</p><h2 id="portal-requests-results-heading">Requests</h2></div><div className="portal-counseling__details-actions"><p className="portal-counseling__result-count">{page.total} {page.total === 1 ? "request" : "requests"}</p><Button onClick={() => setCreateOpen(true)} type="button">New Good Moral request</Button></div></div>{mutation ? <p className={`portal-counseling__mutation portal-counseling__mutation--${mutation.state}`} role={mutation.state === "error" ? "alert" : "status"}>{mutation.message}</p> : null}{page.items.length ? <QueueTable details={details} detailStates={detailStates} expandedReference={expandedReference} hasCapability={hasCapability} items={page.items} onAction={openAction} onDownload={openCertificate} onRetryDetail={loadDetail} onToggle={toggleDetails} /> : <div className="portal-counseling__empty" role="status"><h2>No Good Moral requests to show.</h2><p>Try changing the filters or check back when an authorized request is recorded.</p></div>}{page.total > page.page_size ? <Pagination><PaginationContent><PaginationItem><PaginationPrevious aria-disabled={page.page <= 1} href={page.page <= 1 ? undefined : `/portal/requests?${new URLSearchParams({ ...Object.fromEntries(searchParams.entries()), page: String(page.page - 1), section: "good-moral" }).toString()}`} /></PaginationItem><PaginationItem><span className="portal-counseling__pagination-label">Page {page.page}</span></PaginationItem><PaginationItem><PaginationNext aria-disabled={page.page >= Math.ceil(page.total / page.page_size)} href={page.page >= Math.ceil(page.total / page.page_size) ? undefined : `/portal/requests?${new URLSearchParams({ ...Object.fromEntries(searchParams.entries()), page: String(page.page + 1), section: "good-moral" }).toString()}`} /></PaginationItem></PaginationContent></Pagination> : null}</PortalCollectionFrame> : null}
        </div>
      </div>
      <AlertDialog onOpenChange={(open) => { if (!open) closeAction(); }} open={actionIntent !== null}>
        <AlertDialogContent className="portal-counseling__dialog" size="sm">
          <AlertDialogHeader><AlertDialogTitle>{actionIntent ? ACTION_LABELS[actionIntent.kind] : "Request action"}</AlertDialogTitle><AlertDialogDescription>{actionIntent ? `${actionIntent.item.reference_code} will be updated through the existing Good Moral workflow.` : "Review this request action before continuing."}</AlertDialogDescription></AlertDialogHeader>
          {actionIntent && REASON_ACTIONS.has(actionIntent.kind) ? <div className="portal-counseling__dialog-field"><Label htmlFor="portal-requests-reason">Reason code</Label><Input id="portal-requests-reason" maxLength={64} onChange={(event) => { setActionReason(event.target.value); if (actionIntent) mutationKeys.current.delete(`action:${actionIntent.item.reference_code}:${actionIntent.kind}`); }} value={actionReason} /></div> : null}
          {actionIntent?.kind === "receipt-encode" ? <div className="portal-counseling__dialog-fields"><div className="portal-counseling__dialog-field"><Label htmlFor="portal-requests-receipt-number">Receipt number</Label><Input id="portal-requests-receipt-number" onChange={(event) => setReceiptNumber(event.target.value)} value={receiptNumber} /></div><div className="portal-counseling__dialog-field"><Label htmlFor="portal-requests-receipt-date">Receipt date</Label><Input id="portal-requests-receipt-date" onChange={(event) => setReceiptDate(event.target.value)} type="date" value={receiptDate} /></div><div className="portal-counseling__dialog-field"><Label htmlFor="portal-requests-receipt-amount">Receipt amount</Label><Input id="portal-requests-receipt-amount" inputMode="decimal" onChange={(event) => setReceiptAmount(event.target.value)} value={receiptAmount} /></div></div> : null}
          {actionIntent?.kind === "receipt-verify" ? <div className="portal-counseling__dialog-field"><Label htmlFor="portal-requests-receipt-approved">Receipt decision</Label><select id="portal-requests-receipt-approved" onChange={(event) => setReceiptApproved(event.target.value)} value={receiptApproved}><option value="true">Approved</option><option value="false">Rejected</option></select>{receiptApproved === "false" ? <><Label htmlFor="portal-requests-rejection-code">Rejection code</Label><Input id="portal-requests-rejection-code" maxLength={64} onChange={(event) => setRejectionCode(event.target.value)} value={rejectionCode} /></> : null}</div> : null}
          {actionIntent?.kind === "assign-reviewer" ? <div className="portal-counseling__dialog-field"><Label htmlFor="portal-requests-reviewer">Reviewer</Label>{reviewerLoading ? <p role="status">Loading eligible reviewers…</p> : <select id="portal-requests-reviewer" onChange={(event) => setReviewerToken(reviewerOptions[Number(event.target.value)]?.selection_token ?? "")} value={reviewerToken ? String(reviewerOptions.findIndex((option) => option.selection_token === reviewerToken)) : ""}><option value="">Choose a reviewer</option>{reviewerOptions.map((option, index) => <option key={`${option.label}-${index}`} value={index}>{option.label}</option>)}</select>}</div> : null}
          {actionIntent?.kind === "ossd" ? <div className="portal-counseling__dialog-field"><Label htmlFor="portal-requests-ossd">OSSD verification</Label><select id="portal-requests-ossd" onChange={(event) => setOssdStatus(event.target.value)} value={ossdStatus}><option value="VERIFIED">Verified</option><option value="NOT_REQUIRED">Not required</option><option value="PENDING">Pending</option></select></div> : null}
          {actionIntent?.kind === "approve" ? <div className="portal-counseling__dialog-fields"><div className="portal-counseling__dialog-field"><Label htmlFor="portal-requests-signatory-name">Signatory name</Label><Input id="portal-requests-signatory-name" maxLength={160} onChange={(event) => setSignatoryName(event.target.value)} value={signatoryName} /></div><div className="portal-counseling__dialog-field"><Label htmlFor="portal-requests-signatory-title">Signatory title</Label><Input id="portal-requests-signatory-title" maxLength={160} onChange={(event) => setSignatoryTitle(event.target.value)} value={signatoryTitle} /></div></div> : null}
          {actionError ? <p className="portal-counseling__dialog-error" role="alert">{actionError}</p> : null}
          <AlertDialogFooter><AlertDialogCancel disabled={mutation?.state === "pending"}>Keep request</AlertDialogCancel><AlertDialogAction disabled={mutation?.state === "pending" || reviewerLoading} onClick={() => void confirmAction()}>{mutation?.state === "pending" ? "Saving…" : "Continue"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog onOpenChange={(open) => { if (!open) closeCreate(); }} open={createOpen}>
        <AlertDialogContent className="portal-counseling__dialog" size="sm">
          <AlertDialogHeader><AlertDialogTitle>New Good Moral request</AlertDialogTitle><AlertDialogDescription>Choose an authorized student. The backend will derive the request variant and submit the request atomically.</AlertDialogDescription></AlertDialogHeader>
          <form onSubmit={submitCreate}><div className="portal-counseling__dialog-fields"><div className="portal-counseling__dialog-field"><Label htmlFor="portal-requests-student-search">Student search</Label><Input id="portal-requests-student-search" onChange={(event) => { setStudentQuery(event.target.value); setStudentToken(""); setStudentLabel(""); mutationKeys.current.delete("create"); }} placeholder="Name or student number" value={studentQuery} /></div><div className="portal-counseling__dialog-field"><Label htmlFor="portal-requests-student">Student</Label>{studentLoading ? <p role="status">Loading students…</p> : <select id="portal-requests-student" onChange={(event) => { const option = studentOptions[Number(event.target.value)]; setStudentToken(option?.selection_token ?? ""); setStudentLabel(option?.label ?? ""); mutationKeys.current.delete("create"); }} value={studentLabel ? String(studentOptions.findIndex((option) => option.label === studentLabel)) : ""}><option value="">Choose a student</option>{studentOptions.map((option, index) => <option key={`${option.label}-${index}`} value={index}>{option.label}</option>)}</select>}</div><div className="portal-counseling__dialog-field"><Label htmlFor="portal-requests-purpose">Purpose</Label><Textarea id="portal-requests-purpose" maxLength={500} onChange={(event) => { setPurposeText(event.target.value); mutationKeys.current.delete("create"); }} value={purposeText} /></div><div className="portal-counseling__dialog-field"><Label htmlFor="portal-requests-graduation-date">Graduation date (optional)</Label><Input id="portal-requests-graduation-date" onChange={(event) => { setGraduationDate(event.target.value); mutationKeys.current.delete("create"); }} type="date" value={graduationDate} /></div></div>{createError ? <p className="portal-counseling__dialog-error" role="alert">{createError}</p> : null}<AlertDialogFooter><AlertDialogCancel disabled={createLoading}>Cancel</AlertDialogCancel><AlertDialogAction disabled={createLoading || !studentToken || !purposeText.trim()} type="submit">{createLoading ? "Submitting…" : "Create and submit"}</AlertDialogAction></AlertDialogFooter></form>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
