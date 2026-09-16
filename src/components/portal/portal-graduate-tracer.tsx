"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import {
  Fragment,
  useEffect,
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
import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
import { PortalFilterPanel } from "@/components/portal/portal-filter-panel";
import { PORTAL_CAPABILITIES } from "@/components/portal/portal-navigation";
import { PortalStatusFilter } from "@/components/portal/portal-status-filter";
import {
  archivePortalGraduateTracer,
  downloadPortalGraduateTracerDocument,
  generatePortalGraduateTracerDocument,
  getPortalGraduateTracerQueue,
  getPortalGraduateTracerQueueDetail,
  getPortalGraduateTracerSubmittedAnswers,
  GraduateTracerApiError,
  GRADUATE_TRACER_EMPLOYMENT_STATUSES,
  previewPortalGraduateTracerDocument,
  reopenPortalGraduateTracer,
  voidPortalGraduateTracer,
  type PortalGraduateTracerDetail,
  type PortalGraduateTracerQueueItem,
} from "@/lib/api/graduate-tracer";
import { formsHref, type FormsListFilters } from "@/lib/api/forms";
import { createIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";
import { downloadPortalBlob, previewPortalBlob } from "@/lib/api/browser-download";

const STATUS_OPTIONS = [
  { label: "Submitted", value: "SUBMITTED" },
  { label: "Reopened for correction", value: "REOPENED_FOR_CORRECTION" },
  { label: "Voided", value: "VOIDED" },
  { label: "Archived", value: "ARCHIVED" },
] as const;

const EMPLOYMENT_OPTIONS = [
  ["EMPLOYED", "Employed"],
  ["UNEMPLOYED", "Unemployed"],
  ["NEVER_EMPLOYED", "Never employed"],
  ["SELF_EMPLOYED", "Self-employed"],
] as const;

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; page: { items: PortalGraduateTracerQueueItem[]; page: number; page_size: number; total: number } }
  | { kind: "forbidden" }
  | { kind: "unavailable"; error: "unavailable" | "rate_limited" | "validation" };

type SensitiveState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; detail: PortalGraduateTracerDetail };

type DetailState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; detail: PortalGraduateTracerDetail; sensitive?: SensitiveState };

type Action = "reopen" | "void" | "archive";
type ActionIntent = { action: Action; item: PortalGraduateTracerQueueItem };
type MutationState = { scope: string; state: "pending" | "success" | "error"; message: string };
type MutationKeyEntry = { fingerprint: string; key: IdempotencyKey };
type DocumentState = { state: "pending" | "success" | "error"; message: string };

const MAX_QUERY_LENGTH = 120;
const MAX_FILTER_LENGTH = 100;

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

function safeAnswerValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "No response recorded";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).slice(0, 2_000);
  try {
    return JSON.stringify(value).slice(0, 2_000);
  } catch {
    return "Recorded response";
  }
}

function mutationMessage(error: GraduateTracerApiError) {
  switch (error.kind) {
    case "conflict": return "This submission changed. Refresh the workspace and try again.";
    case "permission": return "This action is not available for this account.";
    case "validation": return "Check the submission details and try again.";
    case "rate_limited": return "Too many attempts. Please wait before trying again.";
    default: return "This submission action is temporarily unavailable. Try again.";
  }
}

function loadMessage(error: LoadState["kind"] | "rate_limited" | "validation") {
  if (error === "rate_limited") return "Too many Graduate Tracer requests. Please wait and try again.";
  if (error === "validation") return "The Graduate Tracer filters could not be applied.";
  return "Graduate Tracer submissions are unavailable right now.";
}

function GraduateTracerFilterPanel({ filters }: { filters: FormsListFilters }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const statuses = [...new Set(form.getAll("status"))]
      .filter((value): value is string => typeof value === "string" && STATUS_OPTIONS.some((option) => option.value === value));
    const employmentStatus = String(form.get("employment_status") ?? "").trim().toUpperCase();
    const next: FormsListFilters = {
      q: String(form.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH) || null,
      status: statuses.length ? statuses.join(",") : null,
      statuses,
      academicYear: null,
      graduationYear: String(form.get("graduation_year") ?? "").trim().slice(0, MAX_FILTER_LENGTH) || null,
      revision: String(form.get("revision") ?? "").trim().slice(0, MAX_FILTER_LENGTH) || null,
      employmentStatus: GRADUATE_TRACER_EMPLOYMENT_STATUSES.some((value) => value === employmentStatus) ? employmentStatus : null,
      order: form.get("order") === "oldest" ? "oldest" : "recent",
    };
    startTransition(() => {
      router.push(formsHref("graduate-tracer", 1, next), { scroll: false });
    });
  };

  return (
    <PortalFilterPanel
      accessibleLabel="Graduate Tracer filters"
      action="/portal/forms?section=graduate-tracer"
      ariaBusy={isPending}
      className="portal-counseling__filters"
      onSubmit={handleSubmit}
      resetKey={`graduate-tracer:${filters.q ?? ""}:${filters.status ?? ""}:${filters.graduationYear ?? ""}:${filters.revision ?? ""}:${filters.employmentStatus ?? ""}:${filters.order}`}
      summary="Search and narrow the Graduate Tracer submissions visible to this account."
    >
      <div className="portal-counseling__filters-grid">
        <div className="portal-counseling__filter-field portal-counseling__filter-field--search">
          <Label htmlFor="portal-graduate-tracer-query">Search</Label>
          <Input defaultValue={filters.q ?? ""} id="portal-graduate-tracer-query" maxLength={MAX_QUERY_LENGTH} name="q" placeholder="Reference, student name, or student number" />
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-graduate-tracer-status">Status</Label>
          <PortalStatusFilter ariaLabel="Choose Graduate Tracer statuses" id="portal-graduate-tracer-status" options={STATUS_OPTIONS} selectedValues={filters.statuses} title="Submission status" />
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-graduate-tracer-graduation-year">Graduation year</Label>
          <Input defaultValue={filters.graduationYear ?? ""} id="portal-graduate-tracer-graduation-year" maxLength={MAX_FILTER_LENGTH} name="graduation_year" placeholder="e.g. 2025" />
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-graduate-tracer-revision">Form revision</Label>
          <Input defaultValue={filters.revision ?? ""} id="portal-graduate-tracer-revision" maxLength={MAX_FILTER_LENGTH} name="revision" placeholder="Code or revision" />
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-graduate-tracer-employment">Employment</Label>
          <select defaultValue={filters.employmentStatus ?? ""} id="portal-graduate-tracer-employment" name="employment_status">
            <option value="">All employment statuses</option>
            {EMPLOYMENT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-graduate-tracer-order">Order</Label>
          <select defaultValue={filters.order} id="portal-graduate-tracer-order" name="order">
            <option value="recent">Recently updated</option>
            <option value="oldest">Oldest updated first</option>
          </select>
        </div>
      </div>
      <div className="portal-counseling__filter-actions">
        <Button disabled={isPending} size="sm" type="submit">Apply filters</Button>
        <Link className="portal-counseling__filter-clear" href="/portal/forms?section=graduate-tracer">Clear</Link>
      </div>
    </PortalFilterPanel>
  );
}

function AnswerSections({ sections }: { sections: PortalGraduateTracerDetail["answer_sections"] }) {
  if (!sections?.length) return <p>No displayable submitted answers are available.</p>;
  return (
    <div className="portal-counseling__routine-sensitive">
      <p className="portal-counseling__kicker">Authorized submitted answers</p>
      {sections.map((section) => (
        <section key={section.label}>
          <h3>{section.label}</h3>
          <dl>
            {section.fields.map((field, index) => <div key={`${field.label}-${index}`}><dt>{field.label}</dt><dd>{safeAnswerValue(field.value)}</dd></div>)}
          </dl>
        </section>
      ))}
    </div>
  );
}

function GraduateTracerDetails({
  state,
  documentState,
  onDocument,
  onRetry,
  onSensitive,
  onSensitiveRetry,
}: {
  state: DetailState | undefined;
  documentState: DocumentState | undefined;
  onDocument: (action: "preview" | "generate" | "download") => void;
  onRetry: () => void;
  onSensitive: () => void;
  onSensitiveRetry: () => void;
}) {
  if (!state || state.kind === "loading") return <div className="portal-counseling__detail-state" role="status"><Skeleton as="span" /><Skeleton as="span" /></div>;
  if (state.kind === "error") return <div className="portal-counseling__detail-state" role="status"><p>Graduate Tracer details are unavailable right now.</p><Button onClick={onRetry} size="sm" type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button></div>;
  const detail = state.detail;
  const documentsEligible = detail.status === "SUBMITTED" || detail.status === "ARCHIVED";
  const facts = [
    ["Graduation year", detail.graduation_year || "Not recorded"],
    ["Program", detail.program_snapshot || "Not recorded"],
    ["College", detail.college_snapshot || "Not recorded"],
    ["Form", `${detail.form_title} · ${detail.form_code} · ${detail.form_revision}`],
    ["Status", labelForValue(detail.status)],
    ["Employment", detail.employment_status ? labelForValue(detail.employment_status) : "Not recorded"],
    ["Submitted", formatTimestamp(detail.submitted_at)],
    ["Reopened", formatTimestamp(detail.reopened_at)],
    ["Latest update", formatTimestamp(detail.updated_at)],
  ];
  return (
    <div className="portal-counseling__detail-content">
      <dl>{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {documentsEligible ? <div className="portal-counseling__details-actions">
        {detail.document_available ? <Button onClick={() => onDocument("preview")} size="xs" type="button" variant="outline">Preview document</Button> : null}
        <Button onClick={() => onDocument("generate")} size="xs" type="button" variant="outline">{detail.document_available ? "Refresh document" : "Generate document"}</Button>
        {detail.document_available ? <Button onClick={() => onDocument("download")} size="xs" type="button" variant="ghost">Download document</Button> : null}
      </div> : null}
      {documentState ? <p className={`portal-counseling__mutation portal-counseling__mutation--${documentState.state}`} role={documentState.state === "error" ? "alert" : "status"}>{documentState.message}</p> : null}
      {detail.status === "SUBMITTED" && !state.sensitive ? <Button onClick={onSensitive} size="sm" type="button" variant="outline">View submitted answers</Button> : null}
      {state.sensitive?.kind === "loading" ? <div className="portal-counseling__detail-state" role="status"><Skeleton as="span" /><Skeleton as="span" /></div> : null}
      {state.sensitive?.kind === "error" ? <div className="portal-counseling__detail-state" role="status"><p>Submitted answers are unavailable right now.</p><Button onClick={onSensitiveRetry} size="sm" type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button></div> : null}
      {state.sensitive?.kind === "ready" ? <AnswerSections sections={state.sensitive.detail.answer_sections} /> : null}
    </div>
  );
}

function graduateTracerActions(item: PortalGraduateTracerQueueItem, hasCapability: (capability: string) => boolean): Action[] {
  const actions: Action[] = [];
  if (item.status === "SUBMITTED" && hasCapability(PORTAL_CAPABILITIES.graduateTracerReopen)) actions.push("reopen");
  if (["SUBMITTED", "REOPENED_FOR_CORRECTION"].includes(item.status) && hasCapability(PORTAL_CAPABILITIES.graduateTracerVoid)) actions.push("void");
  if (item.status === "SUBMITTED" && hasCapability(PORTAL_CAPABILITIES.graduateTracerArchive)) actions.push("archive");
  return actions;
}

function GraduateTracerTable({
  details,
  documentStates,
  expandedReference,
  hasCapability,
  mutation,
  onAction,
  onDocument,
  onRetryDetail,
  onSensitive,
  onSensitiveRetry,
  onToggle,
  items,
}: {
  details: Map<string, DetailState>;
  documentStates: Map<string, DocumentState>;
  expandedReference: string | null;
  hasCapability: (capability: string) => boolean;
  mutation: MutationState | null;
  onAction: (action: Action, item: PortalGraduateTracerQueueItem) => void;
  onDocument: (action: "preview" | "generate" | "download", item: PortalGraduateTracerQueueItem) => void;
  onRetryDetail: (item: PortalGraduateTracerQueueItem) => void;
  onSensitive: (item: PortalGraduateTracerQueueItem) => void;
  onSensitiveRetry: (item: PortalGraduateTracerQueueItem) => void;
  onToggle: (item: PortalGraduateTracerQueueItem) => void;
  items: PortalGraduateTracerQueueItem[];
}) {
  return (
    <div className="portal-counseling__table-wrap">
      <table className="portal-counseling__table">
        <thead><tr><th scope="col">Student</th><th scope="col">Graduation year</th><th scope="col">Form revision</th><th scope="col">Status</th><th scope="col">Employment</th><th scope="col">Submitted/updated</th><th scope="col">Details &amp; actions</th></tr></thead>
        <tbody>
          {items.map((item) => {
            const expanded = expandedReference === item.reference_code;
            const expandedId = `portal-graduate-tracer-detail-${item.reference_code.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
            const scope = `graduate-tracer-${item.reference_code}`;
            const actions = graduateTracerActions(item, hasCapability);
            const rowMutation = mutation?.scope === scope ? mutation : null;
            return <Fragment key={item.reference_code}>
              <tr className={expanded ? "is-expanded" : undefined}>
                <td data-label="Student"><span className="portal-counseling__student-name">{item.student_display_name}</span>{item.student_number ? <span className="portal-counseling__student-number">{item.student_number}</span> : null}</td>
                <td data-label="Graduation year">{item.graduation_year || "Not recorded"}</td>
                <td data-label="Form revision"><span className="portal-counseling__reference">{item.form_code} · {item.form_revision}</span></td>
                <td data-label="Status"><Badge data-tone={item.status.toLowerCase()} variant="outline">{labelForValue(item.status)}</Badge></td>
                <td data-label="Employment">{item.employment_status ? labelForValue(item.employment_status) : "Not recorded"}</td>
                <td data-label="Submitted/updated"><span>{formatTimestamp(item.submitted_at)}</span><span className="portal-counseling__student-number">Updated {formatTimestamp(item.updated_at)}</span></td>
                <td data-label="Details & actions"><div className="portal-counseling__details-actions"><Button aria-controls={expandedId} aria-expanded={expanded} aria-label={`${expanded ? "Hide" : "Show"} Graduate Tracer details`} onClick={() => onToggle(item)} size="xs" type="button" variant="outline">{expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}<span className="sr-only">{expanded ? "Hide" : "Show"} details</span></Button>{actions.map((action) => <Button key={action} onClick={() => onAction(action, item)} size="xs" type="button" variant={action === "void" ? "outline" : "ghost"}>{action === "reopen" ? "Reopen" : action === "void" ? "Void" : "Archive"}</Button>)}</div></td>
              </tr>
              {expanded ? <tr className="portal-counseling__detail-row"><td colSpan={7} id={expandedId}><GraduateTracerDetails documentState={documentStates.get(item.reference_code)} onDocument={(action) => onDocument(action, item)} onRetry={() => onRetryDetail(item)} onSensitive={() => onSensitive(item)} onSensitiveRetry={() => onSensitiveRetry(item)} state={details.get(item.reference_code)} />{rowMutation ? <p className={`portal-counseling__mutation portal-counseling__mutation--${rowMutation.state}`} role={rowMutation.state === "error" ? "alert" : "status"}>{rowMutation.message}</p> : null}</td></tr> : null}
            </Fragment>;
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState() {
  return <div className="portal-counseling__empty" role="status"><h2>No Graduate Tracer submissions to show.</h2><p>Try changing the filters or check back after more submissions are recorded.</p></div>;
}

function PaginationForGraduateTracer({ filters, page }: { filters: FormsListFilters; page: { page: number; page_size: number; total: number } }) {
  const totalPages = Math.max(1, Math.ceil(page.total / page.page_size));
  if (totalPages <= 1) return null;
  return <Pagination aria-label="Graduate Tracer pages" className="portal-counseling__pagination"><PaginationContent><PaginationItem>{page.page > 1 ? <PaginationPrevious href={formsHref("graduate-tracer", page.page - 1, filters)} text="Previous" /> : <span aria-hidden="true" className="portal-counseling__pagination-spacer" />}</PaginationItem><PaginationItem className="portal-counseling__pagination-current"><span aria-current="page">Page {page.page} of {totalPages}</span></PaginationItem><PaginationItem>{page.page < totalPages ? <PaginationNext href={formsHref("graduate-tracer", page.page + 1, filters)} text="Next" /> : <span aria-hidden="true" className="portal-counseling__pagination-spacer" />}</PaginationItem></PaginationContent></Pagination>;
}

export function PortalGraduateTracerSection({ filters, hasCapability, pageNumber }: { filters: FormsListFilters; hasCapability: (capability: string) => boolean; pageNumber: number }) {
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedReference, setExpandedReference] = useState<string | null>(null);
  const [details, setDetails] = useState<Map<string, DetailState>>(new Map());
  const [documentStates, setDocumentStates] = useState<Map<string, DocumentState>>(new Map());
  const [actionIntent, setActionIntent] = useState<ActionIntent | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [mutation, setMutation] = useState<MutationState | null>(null);
  const mutationKeysRef = useRef<Map<string, MutationKeyEntry>>(new Map());

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void Promise.resolve().then(() => {
      if (!active || controller.signal.aborted) return null;
      setLoadState({ kind: "loading" });
      setExpandedReference(null);
      setDetails(new Map());
      setDocumentStates(new Map());
      setMutation(null);
      return getPortalGraduateTracerQueue(pageNumber, filters, controller.signal);
    }).then((page) => {
      if (page && active && !controller.signal.aborted) setLoadState({ kind: "ready", page });
    }).catch((error: unknown) => {
      if (!active || controller.signal.aborted || isAbortError(error)) return;
      setLoadState(error instanceof GraduateTracerApiError && error.kind === "permission"
        ? { kind: "forbidden" }
        : { kind: "unavailable", error: error instanceof GraduateTracerApiError && (error.kind === "rate_limited" || error.kind === "validation") ? error.kind : "unavailable" });
    });
    return () => { active = false; controller.abort(); };
  }, [filters, pageNumber, reloadKey]);

  const loadDetail = (item: PortalGraduateTracerQueueItem) => {
    setDetails((current) => new Map(current).set(item.reference_code, { kind: "loading" }));
    void getPortalGraduateTracerQueueDetail(item.reference_code).then((detail) => {
      setDetails((current) => new Map(current).set(item.reference_code, { kind: "ready", detail }));
    }).catch((error: unknown) => {
      if (!isAbortError(error)) setDetails((current) => new Map(current).set(item.reference_code, { kind: "error" }));
    });
  };

  const loadSensitive = (item: PortalGraduateTracerQueueItem) => {
    setDetails((current) => {
      const next = new Map(current);
      const existing = next.get(item.reference_code);
      if (existing?.kind === "ready") next.set(item.reference_code, { ...existing, sensitive: { kind: "loading" } });
      return next;
    });
    void getPortalGraduateTracerSubmittedAnswers(item.reference_code).then((detail) => {
      setDetails((current) => {
        const next = new Map(current);
        const existing = next.get(item.reference_code);
        if (existing?.kind === "ready") next.set(item.reference_code, { ...existing, sensitive: { kind: "ready", detail } });
        return next;
      });
    }).catch((error: unknown) => {
      if (!isAbortError(error)) setDetails((current) => {
        const next = new Map(current);
        const existing = next.get(item.reference_code);
        if (existing?.kind === "ready") next.set(item.reference_code, { ...existing, sensitive: { kind: "error" } });
        return next;
      });
    });
  };

  const toggleDetails = (item: PortalGraduateTracerQueueItem) => {
    if (expandedReference === item.reference_code) {
      setExpandedReference(null);
      return;
    }
    setExpandedReference(item.reference_code);
    if (!details.has(item.reference_code)) loadDetail(item);
  };

  const getMutationKey = (scope: string, fingerprint: string) => {
    const existing = mutationKeysRef.current.get(scope);
    if (existing?.fingerprint === fingerprint) return existing.key;
    const key = createIdempotencyKey();
    mutationKeysRef.current.set(scope, { fingerprint, key });
    return key;
  };

  const clearMutationKey = (scope: string) => mutationKeysRef.current.delete(scope);

  const openAction = (action: Action, item: PortalGraduateTracerQueueItem) => {
    setActionIntent({ action, item });
    setActionReason("");
    setActionError(null);
  };

  const confirmAction = async () => {
    if (!actionIntent) return;
    const { action, item } = actionIntent;
    const reason = actionReason.trim();
    if ((action === "reopen" || action === "void") && !reason) {
      setActionError("A bounded reason is required.");
      return;
    }
    const scope = `graduate-tracer-${item.reference_code}`;
    const fingerprint = `${action}:${reason}:${item.resource_version ?? ""}`;
    const key = getMutationKey(scope, fingerprint);
    setMutation({ scope, state: "pending", message: "Saving change…" });
    setActionError(null);
    try {
      if (action === "reopen") await reopenPortalGraduateTracer(item.reference_code, reason, item.resource_version, key);
      else if (action === "void") await voidPortalGraduateTracer(item.reference_code, reason, item.resource_version, key);
      else await archivePortalGraduateTracer(item.reference_code, item.resource_version, key);
      clearMutationKey(scope);
      setMutation({ scope, state: "success", message: "Change saved." });
      setActionIntent(null);
      setActionReason("");
      setReloadKey((value) => value + 1);
    } catch (error) {
      const message = error instanceof GraduateTracerApiError ? mutationMessage(error) : "This action is temporarily unavailable. Try again.";
      setMutation({ scope, state: "error", message });
      setActionError(message);
    }
  };

  const documentAction = async (action: "preview" | "generate" | "download", item: PortalGraduateTracerQueueItem) => {
    const scope = `graduate-tracer-document-${item.reference_code}`;
    setDocumentStates((current) => new Map(current).set(item.reference_code, { state: "pending", message: action === "generate" ? "Preparing document…" : "Loading document…" }));
    try {
      if (action === "preview") {
        const opened = previewPortalBlob(await previewPortalGraduateTracerDocument(item.reference_code));
        if (!opened) throw new GraduateTracerApiError("unavailable");
      } else if (action === "download") {
        downloadPortalBlob(await downloadPortalGraduateTracerDocument(item.reference_code), `graduate-tracer-${item.reference_code}.pdf`);
      } else {
        const key = getMutationKey(scope, `generate:${item.resource_version ?? ""}`);
        await generatePortalGraduateTracerDocument(item.reference_code, item.resource_version, key);
        clearMutationKey(scope);
        setReloadKey((value) => value + 1);
      }
      setDocumentStates((current) => new Map(current).set(item.reference_code, { state: "success", message: action === "generate" ? "Document refreshed." : "Document ready." }));
    } catch (error) {
      const message = error instanceof GraduateTracerApiError ? mutationMessage(error) : "The document is temporarily unavailable. Try again.";
      setDocumentStates((current) => new Map(current).set(item.reference_code, { state: "error", message }));
    }
  };

  const clearActionDialog = (open: boolean) => {
    if (!open && mutation?.state !== "pending") {
      if (actionIntent) clearMutationKey(`graduate-tracer-${actionIntent.item.reference_code}`);
      setActionIntent(null);
      setActionReason("");
      setActionError(null);
    }
  };

  return (
    <div className="portal-counseling__active-content">
      <GraduateTracerFilterPanel filters={filters} />
      {loadState.kind === "loading" ? <PortalCollectionFrame className="portal-counseling__frame"><div aria-hidden="true" className="portal-counseling__table-skeleton">{Array.from({ length: 5 }, (_, row) => <div className="portal-counseling__table-skeleton-row" key={row}>{Array.from({ length: 7 }, (_, cell) => <Skeleton as="span" key={cell} />)}</div>)}</div></PortalCollectionFrame> : null}
      {loadState.kind === "forbidden" ? <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state"><h2>This page isn’t available for this account.</h2><p>Return to your workspace to continue.</p></PortalCollectionFrame> : null}
      {loadState.kind === "unavailable" ? <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state"><h2>{loadMessage(loadState.error)}</h2><p>Try again when the connection is ready.</p><Button onClick={() => setReloadKey((value) => value + 1)} type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button></PortalCollectionFrame> : null}
      {loadState.kind === "ready" ? <PortalCollectionFrame aria-labelledby="portal-graduate-tracer-results-heading" className="portal-counseling__frame"><div className="portal-counseling__frame-heading"><div><p className="portal-counseling__kicker">Graduate Tracer</p><h2 id="portal-graduate-tracer-results-heading">Graduate Tracer submissions</h2></div><p className="portal-counseling__result-count">{loadState.page.total} {loadState.page.total === 1 ? "submission" : "submissions"}</p></div>{mutation ? <p className={`portal-counseling__mutation portal-counseling__mutation--${mutation.state}`} role={mutation.state === "error" ? "alert" : "status"}>{mutation.message}</p> : null}{loadState.page.items.length === 0 ? <EmptyState /> : <GraduateTracerTable details={details} documentStates={documentStates} expandedReference={expandedReference} hasCapability={hasCapability} items={loadState.page.items} mutation={mutation} onAction={openAction} onDocument={documentAction} onRetryDetail={loadDetail} onSensitive={loadSensitive} onSensitiveRetry={loadSensitive} onToggle={toggleDetails} />}<PaginationForGraduateTracer filters={filters} page={loadState.page} /></PortalCollectionFrame> : null}
      <AlertDialog onOpenChange={clearActionDialog} open={actionIntent !== null}>
        <AlertDialogContent className="portal-counseling__dialog" size="sm">
          <AlertDialogHeader><AlertDialogTitle>{actionIntent ? `${labelForValue(actionIntent.action)} Graduate Tracer submission` : "Submission action"}</AlertDialogTitle><AlertDialogDescription>{actionIntent ? `${actionIntent.item.reference_code} will be updated using the current submission state.` : "Review this submission action before continuing."}</AlertDialogDescription></AlertDialogHeader>
          {actionIntent && (actionIntent.action === "reopen" || actionIntent.action === "void") ? <div className="portal-counseling__dialog-field"><Label htmlFor="portal-graduate-tracer-action-reason">Reason</Label><Textarea id="portal-graduate-tracer-action-reason" maxLength={500} onChange={(event) => setActionReason(event.target.value)} value={actionReason} /></div> : null}
          {actionError ? <p className="portal-counseling__dialog-error" role="alert">{actionError}</p> : null}
          <AlertDialogFooter><AlertDialogCancel disabled={mutation?.state === "pending"}>Keep submission</AlertDialogCancel><AlertDialogAction disabled={mutation?.state === "pending"} onClick={() => void confirmAction()}>{mutation?.state === "pending" ? "Saving…" : "Continue"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
