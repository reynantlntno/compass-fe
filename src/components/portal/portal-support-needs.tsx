"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp, LifeBuoy, RefreshCw } from "lucide-react";
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
import {
  SUPPORT_NEED_CATEGORIES,
  SUPPORT_NEED_ORDERS,
  SUPPORT_NEED_SOURCES,
  SUPPORT_NEED_STATUSES,
  SupportNeedsApiError,
  archivePortalSupportNeed,
  createPortalSupportNeed,
  deactivatePortalSupportNeed,
  disputePortalSupportNeed,
  getPortalSupportNeedDetail,
  getPortalSupportNeedReasonCodes,
  getPortalSupportNeedStudentOptions,
  getPortalSupportNeedTypes,
  getPortalSupportNeeds,
  markPortalSupportNeedForReview,
  parseSupportNeedFilters,
  supportNeedHref,
  updatePortalSupportNeed,
  verifyPortalSupportNeed,
  type PortalSupportNeed,
  type PortalSupportNeedPage,
  type PortalSupportNeedReasonCode,
  type PortalSupportNeedStudentOption,
  type PortalSupportNeedType,
  type SupportNeedCategory,
  type SupportNeedListFilters,
  type SupportNeedOrder,
  type SupportNeedSource,
  type SupportNeedStatus,
} from "@/lib/api/support-needs";
import { createIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; page: PortalSupportNeedPage }
  | { kind: "forbidden" }
  | { kind: "unavailable"; error: "unavailable" | "rate_limited" | "validation" };

type DetailState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; detail: PortalSupportNeed };

type MutationState = {
  state: "pending" | "success" | "error";
  message: string;
};

type SupportNeedAction = "verify" | "review" | "dispute" | "deactivate" | "archive" | "edit";
type ActionIntent = { action: SupportNeedAction; item: PortalSupportNeed } | null;
type MutationKeyEntry = { fingerprint: string; key: IdempotencyKey };
type ReasonState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; items: PortalSupportNeedReasonCode[] };

const MAX_QUERY_LENGTH = 120;
const MAX_FILTER_LENGTH = 100;
const MAX_PAGE = 100_000;
const TYPE_KEY_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,99})$/;

const STATUS_OPTIONS: readonly { label: string; value: SupportNeedStatus }[] = [
  { label: "Candidate", value: "draft" },
  { label: "Active", value: "active" },
  { label: "Needs review", value: "needs_review" },
  { label: "Verified", value: "verified" },
  { label: "Disputed", value: "disputed" },
  { label: "Inactive", value: "inactive" },
  { label: "Archived", value: "archived" },
];

const CATEGORY_OPTIONS: readonly { label: string; value: SupportNeedCategory }[] = [
  { label: "Household support", value: "household_support" },
  { label: "Disability support", value: "disability_support" },
  { label: "Family context", value: "family_context" },
  { label: "Employment context", value: "employment_context" },
  { label: "Financial context", value: "financial_context" },
  { label: "Living condition", value: "living_condition" },
  { label: "Educational support", value: "educational_support" },
  { label: "Office-approved other", value: "office_approved_other" },
];

const SOURCE_OPTIONS: readonly { label: string; value: SupportNeedSource }[] = [
  { label: "Student provided", value: "student_provided" },
  { label: "Counselor/staff verification", value: "counselor_staff_verification" },
  { label: "Official document presented", value: "official_document_presented" },
  { label: "Manual office validation", value: "manual_office_validation" },
  { label: "Imported official list (future)", value: "imported_official_list_future" },
];

const MANUAL_SOURCE_OPTIONS = SOURCE_OPTIONS.filter(
  (option) => option.value !== "imported_official_list_future",
);

const ACTION_LABELS: Record<SupportNeedAction, string> = {
  verify: "Verify",
  review: "Mark for review",
  dispute: "Mark disputed",
  deactivate: "Deactivate",
  archive: "Archive",
  edit: "Edit details",
};

function labelForValue(value: string) {
  const labels: Record<string, string> = {
    active: "Active",
    archived: "Archived",
    archived_record: "Archived record",
    counselor_staff_verification: "Counselor/staff verification",
    deactivated: "Deactivated record",
    disability_support: "Disability support",
    disputed: "Disputed",
    educational_support: "Educational support",
    employment_context: "Employment context",
    expired: "Expired support need",
    financial_context: "Financial context",
    family_context: "Family context",
    household_support: "Household support",
    imported_official_list_future: "Imported official list (future)",
    inactive: "Inactive",
    incorrect: "Incorrect information",
    incorrect_entry: "Incorrect entry",
    inventory_reopened: "Inventory reopened",
    living_condition: "Living condition",
    manual_office_validation: "Manual office validation",
    needs_review: "Needs review",
    obsolete_data: "Obsolete data",
    official_document_presented: "Official document presented",
    office_approved_other: "Office-approved other",
    reopened: "Reopened",
    retired: "Retired support need",
    routine_review: "Routine review",
    source_response_changed: "Source response changed",
    stale: "Stale information",
    student_disputed: "Student disputed",
    student_provided: "Student provided",
    verified: "Verified",
    draft: "Candidate",
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

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function parsePage(value: string | null) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function statusTone(status: SupportNeedStatus) {
  if (status === "verified" || status === "active") return "ok";
  if (status === "needs_review" || status === "disputed") return "attention";
  if (status === "inactive" || status === "archived") return "subtle";
  return "neutral";
}

function loadMessage(error: LoadState["kind"] | "rate_limited" | "validation") {
  if (error === "rate_limited") return "Too many Support Needs requests. Please wait and try again.";
  if (error === "validation") return "The Support Needs filters could not be applied.";
  return "Support Needs are temporarily unavailable.";
}

function mutationMessage(error: unknown) {
  if (!(error instanceof SupportNeedsApiError)) return "This Support Needs action is temporarily unavailable. Try again.";
  switch (error.kind) {
    case "permission": return "This action is not available for this account or record.";
    case "validation": return "Check the Support Needs details and try again.";
    case "conflict": return "This record changed. Refresh the workspace and try again.";
    case "rate_limited": return "Too many attempts. Please wait before trying again.";
    default: return "This Support Needs action is temporarily unavailable. Try again.";
  }
}

function detailId(index: number) {
  return `portal-support-need-detail-${index}`;
}

function actionList(item: PortalSupportNeed, hasCapability: (capability: string) => boolean): SupportNeedAction[] {
  const actions: SupportNeedAction[] = [];
  if (["draft", "active", "needs_review"].includes(item.status) && hasCapability(PORTAL_CAPABILITIES.supportNeedsVerify)) actions.push("verify");
  if (!(["inactive", "archived"].includes(item.status)) && hasCapability(PORTAL_CAPABILITIES.supportNeedsDispute)) actions.push("review");
  if (!(["inactive", "archived"].includes(item.status)) && hasCapability(PORTAL_CAPABILITIES.supportNeedsDispute)) actions.push("dispute");
  if (item.status !== "archived") actions.push("deactivate");
  if (item.status !== "archived" && hasCapability(PORTAL_CAPABILITIES.supportNeedsArchive)) actions.push("archive");
  if (item.status !== "archived") actions.unshift("edit");
  return actions;
}

function SupportNeedsHeader() {
  return (
    <PortalPageHeader
      className="portal-counseling__page-header"
      current="Support needs"
      description="Review and maintain authorized student support needs within your workspace scope."
      headingId="portal-support-needs-heading"
      title="Support needs"
    />
  );
}

function SupportNeedsFilterPanel({ filters }: { filters: SupportNeedListFilters }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const statuses = [...new Set(form.getAll("status"))]
      .filter((value): value is string => typeof value === "string" && SUPPORT_NEED_STATUSES.includes(value as SupportNeedStatus)) as SupportNeedStatus[];
    const typeKey = String(form.get("type_key") ?? "").trim().toLowerCase();
    const category = String(form.get("category") ?? "").trim().toLowerCase();
    const sourceType = String(form.get("source_type") ?? "").trim().toLowerCase();
    const order = String(form.get("order") ?? "recent").trim().toLowerCase();
    const next: SupportNeedListFilters = {
      q: String(form.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH) || null,
      status: statuses.length ? statuses.join(",") : null,
      statuses,
      typeKey: TYPE_KEY_PATTERN.test(typeKey) ? typeKey : null,
      category: SUPPORT_NEED_CATEGORIES.includes(category as SupportNeedCategory) ? category as SupportNeedCategory : null,
      sourceType: SUPPORT_NEED_SOURCES.includes(sourceType as SupportNeedSource) ? sourceType as SupportNeedSource : null,
      order: SUPPORT_NEED_ORDERS.includes(order as SupportNeedOrder) ? order as SupportNeedOrder : "recent",
    };
    startTransition(() => router.push(supportNeedHref(1, next), { scroll: false }));
  };

  return (
    <PortalFilterPanel
      accessibleLabel="Support Needs filters"
      action="/portal/support-needs"
      ariaBusy={isPending}
      className="portal-counseling__filters"
      onSubmit={handleSubmit}
      resetKey={`${filters.q ?? ""}:${filters.status ?? ""}:${filters.typeKey ?? ""}:${filters.category ?? ""}:${filters.sourceType ?? ""}:${filters.order}`}
      summary="Search and narrow the support needs visible to this account."
    >
      <div className="portal-counseling__filters-grid">
        <div className="portal-counseling__filter-field portal-counseling__filter-field--search">
          <Label htmlFor="portal-support-needs-query">Search</Label>
          <Input
            defaultValue={filters.q ?? ""}
            id="portal-support-needs-query"
            maxLength={MAX_QUERY_LENGTH}
            name="q"
            placeholder="Student name or student number"
          />
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-support-needs-status">Status</Label>
          <PortalStatusFilter
            ariaLabel="Choose Support Needs statuses"
            id="portal-support-needs-status"
            options={STATUS_OPTIONS}
            selectedValues={filters.statuses}
            title="Support Need status"
          />
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-support-needs-type">Support-need type</Label>
          <Input
            defaultValue={filters.typeKey ?? ""}
            id="portal-support-needs-type"
            maxLength={MAX_FILTER_LENGTH}
            name="type_key"
            placeholder="Optional type key"
          />
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-support-needs-category">Category</Label>
          <select defaultValue={filters.category ?? ""} id="portal-support-needs-category" name="category">
            <option value="">All categories</option>
            {CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-support-needs-source">Source</Label>
          <select defaultValue={filters.sourceType ?? ""} id="portal-support-needs-source" name="source_type">
            <option value="">All sources</option>
            {SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-support-needs-order">Order</Label>
          <select defaultValue={filters.order} id="portal-support-needs-order" name="order">
            <option value="recent">Recently updated</option>
            <option value="oldest">Oldest updated first</option>
          </select>
        </div>
      </div>
      <div className="portal-counseling__filter-actions">
        <Button disabled={isPending} size="sm" type="submit">Apply filters</Button>
        <Link className="portal-counseling__filter-clear" href="/portal/support-needs">Clear</Link>
      </div>
    </PortalFilterPanel>
  );
}

function SupportNeedDetails({
  state,
  onRetry,
}: {
  state: DetailState | undefined;
  onRetry: () => void;
}) {
  if (!state || state.kind === "loading") {
    return <div className="portal-counseling__detail-state" role="status"><Skeleton as="span" /><Skeleton as="span" /><Skeleton as="span" /></div>;
  }
  if (state.kind === "error") {
    return <div className="portal-counseling__detail-state" role="status"><p>Support Need details are unavailable right now.</p><Button onClick={onRetry} size="sm" type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button></div>;
  }
  const detail = state.detail;
  const facts: Array<[string, string | React.ReactNode]> = [
    ["Support need", detail.type_label],
    ["Category", labelForValue(detail.type_category)],
    ["Status", <Badge data-tone={statusTone(detail.status)} key="status">{labelForValue(detail.status)}</Badge>],
    ["Source", labelForValue(detail.source_type)],
    ["Source label", detail.source_snapshot_label || "Not recorded"],
    ["Effective from", formatDate(detail.effective_from)],
    ["Effective until", formatDate(detail.effective_until)],
    ["Review due", formatTimestamp(detail.review_due_at)],
    ["Created", formatTimestamp(detail.created_at)],
    ["Latest update", formatTimestamp(detail.updated_at)],
    ["Verified", formatTimestamp(detail.verified_at)],
    ["Reviewed", formatTimestamp(detail.reviewed_at)],
    ["Disputed", formatTimestamp(detail.disputed_at)],
    ["Archived", formatTimestamp(detail.archived_at)],
  ];
  return (
    <div className="portal-counseling__detail-content">
      <dl>{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <p className="portal-counseling__dialog-hint">Only operational metadata is shown here. Source evidence and internal record metadata remain protected.</p>
    </div>
  );
}

function SupportNeedsTable({
  items,
  details,
  expanded,
  mutations,
  hasCapability,
  onAction,
  onRetry,
  onToggle,
}: {
  items: PortalSupportNeed[];
  details: Map<PortalSupportNeed, DetailState>;
  expanded: PortalSupportNeed | null;
  mutations: Map<PortalSupportNeed, MutationState>;
  hasCapability: (capability: string) => boolean;
  onAction: (action: SupportNeedAction, item: PortalSupportNeed) => void;
  onRetry: (item: PortalSupportNeed) => void;
  onToggle: (item: PortalSupportNeed) => void;
}) {
  return (
    <div className="portal-counseling__table-wrap">
      <table className="portal-counseling__table">
        <thead>
          <tr><th scope="col">Student</th><th scope="col">Support need</th><th scope="col">Category</th><th scope="col">Status</th><th scope="col">Source</th><th scope="col">Effective/review dates</th><th scope="col">Updated</th><th scope="col">Details &amp; actions</th></tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const isExpanded = expanded === item;
            const expandedId = detailId(index);
            const actions = actionList(item, hasCapability);
            return (
              <Fragment key={`${item.student_display_name}-${item.type_key}-${index}`}>
                <tr className={isExpanded ? "is-expanded" : undefined}>
                  <td data-label="Student"><span className="portal-counseling__student-name">{item.student_display_name}</span>{item.student_number ? <span className="portal-counseling__student-number">{item.student_number}</span> : null}</td>
                  <td data-label="Support need"><span className="portal-counseling__reference">{item.type_label}</span></td>
                  <td data-label="Category">{labelForValue(item.type_category)}</td>
                  <td data-label="Status"><Badge data-tone={statusTone(item.status)} variant="outline">{labelForValue(item.status)}</Badge></td>
                  <td data-label="Source">{labelForValue(item.source_type)}</td>
                  <td data-label="Effective/review dates"><span>{formatDate(item.effective_from)} – {formatDate(item.effective_until)}</span><span className="portal-counseling__student-number">Review {formatTimestamp(item.review_due_at)}</span></td>
                  <td data-label="Updated">{formatTimestamp(item.updated_at)}</td>
                  <td data-label="Details & actions">
                    <div className="portal-counseling__details-actions">
                      <Button aria-controls={expandedId} aria-expanded={isExpanded} aria-label={`${isExpanded ? "Hide" : "Show"} Support Need details`} onClick={() => onToggle(item)} size="xs" type="button" variant="outline">
                        {isExpanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}<span className="sr-only">{isExpanded ? "Hide" : "Show"} details</span>
                      </Button>
                      {actions.map((action) => <Button key={action} onClick={() => onAction(action, item)} size="xs" type="button" variant={action === "archive" || action === "deactivate" ? "outline" : "ghost"}>{ACTION_LABELS[action]}</Button>)}
                    </div>
                  </td>
                </tr>
                {isExpanded ? (
                  <tr className="portal-counseling__detail-row">
                    <td colSpan={8} id={expandedId}>
                      <SupportNeedDetails state={details.get(item)} onRetry={() => onRetry(item)} />
                      {mutations.get(item) ? <p className={`portal-counseling__mutation portal-counseling__mutation--${mutations.get(item)?.state}`} role={mutations.get(item)?.state === "error" ? "alert" : "status"}>{mutations.get(item)?.message}</p> : null}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState() {
  return <div className="portal-counseling__empty" role="status"><h2>No Support Needs to show.</h2><p>Try changing the filters or check back after support needs are recorded.</p></div>;
}

function SupportNeedsPagination({ page, filters }: { page: PortalSupportNeedPage; filters: SupportNeedListFilters }) {
  const totalPages = Math.max(1, Math.ceil(page.total / page.page_size));
  if (totalPages <= 1) return null;
  return (
    <Pagination aria-label="Support Needs pages" className="portal-counseling__pagination">
      <PaginationContent>
        <PaginationItem>{page.page > 1 ? <PaginationPrevious href={supportNeedHref(page.page - 1, filters)} text="Previous" /> : <span aria-hidden="true" className="portal-counseling__pagination-spacer" />}</PaginationItem>
        <PaginationItem className="portal-counseling__pagination-current"><span aria-current="page">Page {page.page} of {totalPages}</span></PaginationItem>
        <PaginationItem>{page.page < totalPages ? <PaginationNext href={supportNeedHref(page.page + 1, filters)} text="Next" /> : <span aria-hidden="true" className="portal-counseling__pagination-spacer" />}</PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

export function PortalSupportNeedsLoading() {
  return (
    <section aria-busy="true" aria-labelledby="portal-support-needs-loading-heading" className="portal-counseling portal-support-needs portal-counseling--loading" role="status">
      <span className="sr-only">Loading Support Needs…</span>
      <SupportNeedsHeader />
      <PortalFilterPanel action="/portal/support-needs" ariaBusy className="portal-counseling__filters" resetKey="support-needs-loading" summary={<Skeleton as="span" aria-hidden="true" className="portal-counseling__skeleton-summary" />}>
        <div aria-hidden="true" className="portal-counseling__filter-skeleton-grid">{Array.from({ length: 6 }, (_, index) => <Skeleton as="span" key={index} />)}</div>
      </PortalFilterPanel>
      <PortalCollectionFrame className="portal-counseling__frame"><div aria-hidden="true" className="portal-counseling__table-skeleton">{Array.from({ length: 5 }, (_, row) => <div className="portal-counseling__table-skeleton-row" key={row}>{Array.from({ length: 8 }, (_, cell) => <Skeleton as="span" key={cell} />)}</div>)}</div></PortalCollectionFrame>
    </section>
  );
}

export function PortalSupportNeedsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasCapability, status: accessStatus } = usePortalAccess();
  const queryString = searchParams.toString();
  const filters = useMemo(() => parseSupportNeedFilters(searchParams), [searchParams]);
  const pageNumber = parsePage(searchParams.get("page"));
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [expanded, setExpanded] = useState<PortalSupportNeed | null>(null);
  const [details, setDetails] = useState<Map<PortalSupportNeed, DetailState>>(new Map());
  const [mutations, setMutations] = useState<Map<PortalSupportNeed, MutationState>>(new Map());
  const [actionIntent, setActionIntent] = useState<ActionIntent>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [reasonState, setReasonState] = useState<ReasonState | null>(null);
  const [editValues, setEditValues] = useState({ effectiveFrom: "", effectiveUntil: "", reviewDueAt: "", sourceLabel: "" });
  const mutationKeysRef = useRef<Map<string, MutationKeyEntry>>(new Map());

  const [createOpen, setCreateOpen] = useState(false);
  const [createQuery, setCreateQuery] = useState("");
  const [createOptions, setCreateOptions] = useState<PortalSupportNeedStudentOption[]>([]);
  const [createOptionIndex, setCreateOptionIndex] = useState("");
  const [createToken, setCreateToken] = useState("");
  const [createTypes, setCreateTypes] = useState<PortalSupportNeedType[]>([]);
  const [createTypeKey, setCreateTypeKey] = useState("");
  const [createSource, setCreateSource] = useState<SupportNeedSource | "">("");
  const [createSourceLabel, setCreateSourceLabel] = useState("");
  const [createEffectiveFrom, setCreateEffectiveFrom] = useState("");
  const [createEffectiveUntil, setCreateEffectiveUntil] = useState("");
  const [createReviewDueAt, setCreateReviewDueAt] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const createKeyRef = useRef<{ fingerprint: string; key: IdempotencyKey } | null>(null);

  const canQueue = accessStatus === "ready" && hasCapability(PORTAL_CAPABILITIES.supportNeedsQueueView);

  useEffect(() => {
    if (!canQueue) return;
    const canonical = supportNeedHref(pageNumber, filters);
    const current = queryString ? `/portal/support-needs?${queryString}` : "/portal/support-needs";
    if (canonical !== current) router.replace(canonical, { scroll: false });
  }, [canQueue, filters, pageNumber, queryString, router]);

  useEffect(() => {
    if (!canQueue) return;
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return null;
      setLoadState({ kind: "loading" });
      return getPortalSupportNeeds(pageNumber, filters, controller.signal);
    }).then((page) => {
      if (!page || controller.signal.aborted) return;
      setLoadState({ kind: "ready", page });
      setExpanded(null);
      setDetails(new Map());
      setMutations(new Map());
    }).catch((error: unknown) => {
      if (controller.signal.aborted || isAbortError(error)) return;
      if (error instanceof SupportNeedsApiError && error.kind === "permission") setLoadState({ kind: "forbidden" });
      else setLoadState({ kind: "unavailable", error: error instanceof SupportNeedsApiError && (error.kind === "rate_limited" || error.kind === "validation") ? error.kind : "unavailable" });
    });
    return () => controller.abort();
  }, [canQueue, filters, pageNumber, reloadKey]);

  const loadDetail = (item: PortalSupportNeed) => {
    setDetails((current) => new Map(current).set(item, { kind: "loading" }));
    getPortalSupportNeedDetail(item.reference_code).then((detail) => setDetails((current) => new Map(current).set(item, { kind: "ready", detail }))).catch((error: unknown) => {
      if (!isAbortError(error)) setDetails((current) => new Map(current).set(item, { kind: "error" }));
    });
  };

  const toggleExpanded = (item: PortalSupportNeed) => {
    if (expanded === item) {
      setExpanded(null);
      return;
    }
    setExpanded(item);
    if (!details.has(item)) loadDetail(item);
  };

  const getMutationKey = (scope: string, fingerprint: string) => {
    const existing = mutationKeysRef.current.get(scope);
    if (existing?.fingerprint === fingerprint) return existing.key;
    const key = createIdempotencyKey();
    mutationKeysRef.current.set(scope, { fingerprint, key });
    return key;
  };

  const openAction = (action: SupportNeedAction, item: PortalSupportNeed) => {
    setActionIntent({ action, item });
    setActionReason("");
    setActionError(null);
    setReasonState(null);
    setEditValues({ effectiveFrom: item.effective_from?.slice(0, 10) ?? "", effectiveUntil: item.effective_until?.slice(0, 10) ?? "", reviewDueAt: item.review_due_at ? item.review_due_at.slice(0, 16) : "", sourceLabel: item.source_snapshot_label ?? "" });
  };

  useEffect(() => {
    if (!actionIntent || actionIntent.action === "edit") return;
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return null;
      setReasonState({ kind: "loading" });
      return getPortalSupportNeedReasonCodes(controller.signal);
    }).then((items) => {
      if (!items || controller.signal.aborted) return;
      if (!controller.signal.aborted) setReasonState({ kind: "ready", items });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted && !isAbortError(error)) setReasonState({ kind: "error" });
    });
    return () => controller.abort();
  }, [actionIntent]);

  const closeAction = () => {
    setActionIntent(null);
    setActionReason("");
    setActionError(null);
    setReasonState(null);
    mutationKeysRef.current.clear();
  };

  const submitAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!actionIntent) return;
    const { action, item } = actionIntent;
    const scope = item.reference_code;
    let fingerprint = `${action}:${item.updated_at}`;
    if (action === "edit") fingerprint += `:${JSON.stringify(editValues)}`;
    else fingerprint += `:${actionReason}`;
    if (action !== "edit" && !actionReason) {
      setActionError("Choose an approved reason for this action.");
      return;
    }
    const key = getMutationKey(scope, fingerprint);
    setMutations((current) => new Map(current).set(item, { state: "pending", message: "Saving change…" }));
    setActionError(null);
    try {
      if (action === "edit") {
        await updatePortalSupportNeed(item.reference_code, {
          effective_from: editValues.effectiveFrom || null,
          effective_until: editValues.effectiveUntil || null,
          review_due_at: editValues.reviewDueAt ? new Date(editValues.reviewDueAt).toISOString() : null,
          source_snapshot_label: editValues.sourceLabel,
        }, key);
      } else if (action === "verify") {
        await verifyPortalSupportNeed(item.reference_code, actionReason, key);
      } else if (action === "review") {
        await markPortalSupportNeedForReview(item.reference_code, actionReason, key);
      } else if (action === "dispute") {
        await disputePortalSupportNeed(item.reference_code, actionReason, key);
      } else if (action === "deactivate") {
        await deactivatePortalSupportNeed(item.reference_code, actionReason, key);
      } else {
        await archivePortalSupportNeed(item.reference_code, actionReason, key);
      }
      setMutations((current) => new Map(current).set(item, { state: "success", message: "Change saved." }));
      closeAction();
      setReloadKey((value) => value + 1);
    } catch (error) {
      const message = mutationMessage(error);
      setMutations((current) => new Map(current).set(item, { state: "error", message }));
      setActionError(message);
    }
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateQuery("");
    setCreateOptions([]);
    setCreateOptionIndex("");
    setCreateToken("");
    setCreateTypes([]);
    setCreateTypeKey("");
    setCreateSource("");
    setCreateSourceLabel("");
    setCreateEffectiveFrom("");
    setCreateEffectiveUntil("");
    setCreateReviewDueAt("");
    setCreateError(null);
    setCreateLoading(false);
    createKeyRef.current = null;
  };

  const openCreate = () => {
    setCreateOpen(true);
    setCreateError(null);
    setCreateLoading(true);
    createKeyRef.current = null;
    Promise.all([getPortalSupportNeedStudentOptions(""), getPortalSupportNeedTypes()]).then(([students, types]) => {
      setCreateOptions(students);
      setCreateTypes(types.filter((item) => item.is_active));
    }).catch((error: unknown) => setCreateError(mutationMessage(error))).finally(() => setCreateLoading(false));
  };

  const searchCreateStudents = () => {
    setCreateLoading(true);
    setCreateError(null);
    getPortalSupportNeedStudentOptions(createQuery).then((students) => {
      setCreateOptions(students);
      setCreateOptionIndex("");
      setCreateToken("");
      createKeyRef.current = null;
    }).catch((error: unknown) => setCreateError(mutationMessage(error))).finally(() => setCreateLoading(false));
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createToken || !createTypeKey || !createSource) {
      setCreateError("Choose a student, support-need type, and source.");
      return;
    }
    const fingerprint = JSON.stringify({ createToken, createTypeKey, createSource, createSourceLabel, createEffectiveFrom, createEffectiveUntil, createReviewDueAt });
    if (!createKeyRef.current || createKeyRef.current.fingerprint !== fingerprint) createKeyRef.current = { fingerprint, key: createIdempotencyKey() };
    setCreateLoading(true);
    setCreateError(null);
    try {
      await createPortalSupportNeed({
        student_selection_token: createToken,
        support_need_type_key: createTypeKey,
        source_type: createSource,
        ...(createSourceLabel.trim() ? { source_snapshot_label: createSourceLabel } : {}),
        ...(createEffectiveFrom ? { effective_from: createEffectiveFrom } : {}),
        ...(createEffectiveUntil ? { effective_until: createEffectiveUntil } : {}),
        ...(createReviewDueAt ? { review_due_at: new Date(createReviewDueAt).toISOString() } : {}),
      }, createKeyRef.current.key);
      closeCreate();
      setReloadKey((value) => value + 1);
    } catch (error) {
      setCreateError(mutationMessage(error));
    } finally {
      setCreateLoading(false);
    }
  };

  if (accessStatus === "loading") return <PortalSupportNeedsLoading />;
  if (!canQueue) {
    return (
      <section aria-labelledby="portal-support-needs-access-heading" className="portal-counseling portal-support-needs portal-counseling--state">
        <SupportNeedsHeader />
        <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state"><LifeBuoy aria-hidden="true" className="portal-counseling__state-icon" /><h2 id="portal-support-needs-access-heading">Support Needs aren’t available for this account.</h2><p>Return to your workspace to continue.</p></PortalCollectionFrame>
      </section>
    );
  }

  const page = loadState.kind === "ready" ? loadState.page : null;
  return (
    <section aria-labelledby="portal-support-needs-heading" className="portal-counseling portal-support-needs">
      <SupportNeedsHeader />
      <SupportNeedsFilterPanel filters={filters} />
      {loadState.kind === "loading" ? <PortalCollectionFrame className="portal-counseling__frame"><div aria-hidden="true" className="portal-counseling__table-skeleton">{Array.from({ length: 5 }, (_, row) => <div className="portal-counseling__table-skeleton-row" key={row}>{Array.from({ length: 8 }, (_, cell) => <Skeleton as="span" key={cell} />)}</div>)}</div></PortalCollectionFrame> : null}
      {loadState.kind === "forbidden" ? <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state"><h2>This page isn’t available for this account.</h2><p>Return to your workspace to continue.</p></PortalCollectionFrame> : null}
      {loadState.kind === "unavailable" ? <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state"><h2>{loadMessage(loadState.error)}</h2><p>Try again when the connection is ready.</p><Button onClick={() => setReloadKey((value) => value + 1)} type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button></PortalCollectionFrame> : null}
      {page ? (
        <PortalCollectionFrame aria-labelledby="portal-support-needs-results-heading" className="portal-counseling__frame">
          <div className="portal-counseling__frame-heading">
            <div><p className="portal-counseling__kicker">Support needs</p><h2 id="portal-support-needs-results-heading">Support Need records</h2></div>
            <div className="portal-counseling__frame-actions"><p className="portal-counseling__result-count">{page.total} {page.total === 1 ? "record" : "records"}</p><Button onClick={openCreate} size="sm" type="button">New support need</Button></div>
          </div>
          {page.items.length === 0 ? <EmptyState /> : <SupportNeedsTable details={details} expanded={expanded} hasCapability={hasCapability} items={page.items} mutations={mutations} onAction={openAction} onRetry={loadDetail} onToggle={toggleExpanded} />}
          <SupportNeedsPagination filters={filters} page={page} />
        </PortalCollectionFrame>
      ) : null}

      <AlertDialog open={createOpen} onOpenChange={(open) => { if (!open) closeCreate(); }}>
        <AlertDialogContent className="portal-counseling__dialog portal-counseling__walk-in-dialog">
          <AlertDialogHeader><AlertDialogTitle>New support need</AlertDialogTitle><AlertDialogDescription>Create a candidate record using bounded operational fields for a student in your authorized scope.</AlertDialogDescription></AlertDialogHeader>
          <form onSubmit={submitCreate}>
            <div className="portal-counseling__dialog-field"><Label htmlFor="portal-support-needs-student-search">Find student</Label><div className="portal-assessments__inline-field"><Input id="portal-support-needs-student-search" maxLength={MAX_QUERY_LENGTH} onChange={(event) => { setCreateQuery(event.target.value); createKeyRef.current = null; }} placeholder="Student name or student number" value={createQuery} /><Button disabled={createLoading} onClick={searchCreateStudents} size="sm" type="button" variant="outline">Search</Button></div></div>
            <div className="portal-counseling__dialog-field"><Label htmlFor="portal-support-needs-student">Student</Label><select id="portal-support-needs-student" onChange={(event) => { const index = Number.parseInt(event.target.value, 10); const option = Number.isSafeInteger(index) && index >= 0 ? createOptions[index] : undefined; setCreateOptionIndex(event.target.value); setCreateToken(option?.selection_token ?? ""); createKeyRef.current = null; }} value={createOptionIndex}><option value="">Choose a student</option>{createOptions.map((option, index) => <option key={index} value={String(index)}>{option.label}</option>)}</select></div>
            <div className="portal-counseling__dialog-field"><Label htmlFor="portal-support-needs-type">Support-need type</Label><select id="portal-support-needs-type" onChange={(event) => { setCreateTypeKey(event.target.value); createKeyRef.current = null; }} value={createTypeKey}><option value="">Choose a support-need type</option>{createTypes.map((item) => <option key={item.key} value={item.key}>{item.label} · {labelForValue(item.category)}</option>)}</select></div>
            <div className="portal-counseling__dialog-field"><Label htmlFor="portal-support-needs-source">Source</Label><select id="portal-support-needs-source" onChange={(event) => { setCreateSource(event.target.value as SupportNeedSource | ""); createKeyRef.current = null; }} value={createSource}><option value="">Choose a source</option>{MANUAL_SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
            <div className="portal-counseling__dialog-field"><Label htmlFor="portal-support-needs-source-label">Source label <span>(optional)</span></Label><Input id="portal-support-needs-source-label" maxLength={100} onChange={(event) => { setCreateSourceLabel(event.target.value); createKeyRef.current = null; }} placeholder="Bounded label, if needed" value={createSourceLabel} /></div>
            <div className="portal-counseling__dialog-fields"><div className="portal-counseling__dialog-field"><Label htmlFor="portal-support-needs-effective-from">Effective from <span>(optional)</span></Label><Input id="portal-support-needs-effective-from" onChange={(event) => { setCreateEffectiveFrom(event.target.value); createKeyRef.current = null; }} type="date" value={createEffectiveFrom} /></div><div className="portal-counseling__dialog-field"><Label htmlFor="portal-support-needs-effective-until">Effective until <span>(optional)</span></Label><Input id="portal-support-needs-effective-until" onChange={(event) => { setCreateEffectiveUntil(event.target.value); createKeyRef.current = null; }} type="date" value={createEffectiveUntil} /></div></div>
            <div className="portal-counseling__dialog-field"><Label htmlFor="portal-support-needs-review-due">Review due <span>(optional)</span></Label><Input id="portal-support-needs-review-due" onChange={(event) => { setCreateReviewDueAt(event.target.value); createKeyRef.current = null; }} type="datetime-local" value={createReviewDueAt} /></div>
            {createLoading ? <p className="portal-counseling__detail-state" role="status">Loading Support Needs options…</p> : null}
            {createError ? <p className="portal-counseling__dialog-error" role="alert">{createError}</p> : null}
            <AlertDialogFooter><AlertDialogCancel disabled={createLoading}>Cancel</AlertDialogCancel><AlertDialogAction disabled={createLoading} type="submit">Create candidate</AlertDialogAction></AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(actionIntent)} onOpenChange={(open) => { if (!open) closeAction(); }}>
        <AlertDialogContent className="portal-counseling__dialog">
          <AlertDialogHeader><AlertDialogTitle>{actionIntent ? ACTION_LABELS[actionIntent.action] : "Support Need action"}</AlertDialogTitle><AlertDialogDescription>{actionIntent?.action === "edit" ? "Update only the bounded operational details allowed for this record." : "Choose an approved reason. The backend will enforce the record’s current status and authorization."}</AlertDialogDescription></AlertDialogHeader>
          {actionIntent?.action === "edit" ? (
            <form onSubmit={submitAction}>
              <div className="portal-counseling__dialog-fields"><div className="portal-counseling__dialog-field"><Label htmlFor="portal-support-needs-edit-from">Effective from</Label><Input id="portal-support-needs-edit-from" onChange={(event) => setEditValues((value) => ({ ...value, effectiveFrom: event.target.value }))} type="date" value={editValues.effectiveFrom} /></div><div className="portal-counseling__dialog-field"><Label htmlFor="portal-support-needs-edit-until">Effective until</Label><Input id="portal-support-needs-edit-until" onChange={(event) => setEditValues((value) => ({ ...value, effectiveUntil: event.target.value }))} type="date" value={editValues.effectiveUntil} /></div></div>
              <div className="portal-counseling__dialog-field"><Label htmlFor="portal-support-needs-edit-review">Review due</Label><Input id="portal-support-needs-edit-review" onChange={(event) => setEditValues((value) => ({ ...value, reviewDueAt: event.target.value }))} type="datetime-local" value={editValues.reviewDueAt} /></div>
              <div className="portal-counseling__dialog-field"><Label htmlFor="portal-support-needs-edit-source">Source label</Label><Input id="portal-support-needs-edit-source" maxLength={100} onChange={(event) => setEditValues((value) => ({ ...value, sourceLabel: event.target.value }))} value={editValues.sourceLabel} /></div>
              {actionError ? <p className="portal-counseling__dialog-error" role="alert">{actionError}</p> : null}
              <AlertDialogFooter><AlertDialogCancel disabled={mutations.get(actionIntent.item)?.state === "pending"}>Cancel</AlertDialogCancel><AlertDialogAction disabled={mutations.get(actionIntent.item)?.state === "pending"} type="submit">Save details</AlertDialogAction></AlertDialogFooter>
            </form>
          ) : (
            <form onSubmit={submitAction}>
              <div className="portal-counseling__dialog-field"><Label htmlFor="portal-support-needs-reason">Reason code</Label>{reasonState?.kind === "loading" ? <p className="portal-counseling__dialog-hint" role="status">Loading approved reasons…</p> : null}<select disabled={reasonState?.kind !== "ready"} id="portal-support-needs-reason" onChange={(event) => setActionReason(event.target.value)} value={actionReason}><option value="">Choose a reason</option>{reasonState?.kind === "ready" ? reasonState.items.map((item) => <option key={item.value} value={item.value}>{item.label}</option>) : null}</select>{reasonState?.kind === "error" ? <p className="portal-counseling__dialog-error" role="alert">Approved reasons are unavailable right now. Close this dialog and try again.</p> : null}</div>
              {actionError ? <p className="portal-counseling__dialog-error" role="alert">{actionError}</p> : null}
              <AlertDialogFooter><AlertDialogCancel disabled={mutations.get(actionIntent?.item ?? ({} as PortalSupportNeed))?.state === "pending"}>Cancel</AlertDialogCancel><AlertDialogAction disabled={reasonState?.kind !== "ready" || mutations.get(actionIntent?.item ?? ({} as PortalSupportNeed))?.state === "pending"} type="submit">{actionIntent ? ACTION_LABELS[actionIntent.action] : "Continue"}</AlertDialogAction></AlertDialogFooter>
            </form>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
