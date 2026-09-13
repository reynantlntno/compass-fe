"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp, RefreshCw, UsersRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Fragment,
  useEffect,
  useMemo,
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
  getStudentDirectoryContext,
  getStudentDirectoryOptions,
  getStudentDirectoryPage,
  parseStudentDirectoryFilters,
  STUDENT_DIRECTORY_ORDERS,
  STUDENT_DIRECTORY_STATUSES,
  StudentDirectoryApiError,
  studentDirectoryHref,
  type StudentDirectoryContext,
  type StudentDirectoryFilters,
  type StudentDirectoryOption,
  type StudentDirectoryOptions,
  type StudentDirectoryOrder,
  type StudentDirectoryPage,
  type StudentDirectoryRelatedRecord,
  type StudentDirectoryRelatedWork,
  type StudentDirectoryStatus,
  type StudentDirectoryStudent,
} from "@/lib/api/student-directory";

const MAX_PAGE = 100_000;
const MAX_QUERY_LENGTH = 120;

const LIFECYCLE_LABELS: Record<StudentDirectoryStatus, string> = {
  ACTIVE: "Active",
  GRADUATING: "Graduating",
  GRADUATED: "Graduated",
  ALUMNI: "Alumni",
  TRANSFERRED: "Transferred",
  DROPPED_INACTIVE: "Dropped / inactive",
  SUSPENDED_RESTRICTED: "Suspended / restricted",
  ARCHIVED: "Archived",
};

const RELATED_WORK_LABELS: Record<string, string> = {
  appointments: "Appointments",
  counseling_sessions: "Counseling sessions",
  routine_interviews: "Routine interviews",
  counseling_cases: "Counseling cases",
  urgent_support: "Urgent Support",
  individual_inventory: "Individual Inventory",
  exit_interviews: "Exit Interviews",
  graduate_tracer: "Graduate Tracer",
  assessments: "Assessments",
  support_needs: "Support Needs",
  referrals: "Referrals",
  call_slips: "Call Slips",
};

const RELATED_QUEUE_HREFS: Record<string, string> = {
  appointments: "/portal/appointments",
  counseling_sessions: "/portal/counseling?section=sessions",
  routine_interviews: "/portal/counseling?section=routine-interviews",
  counseling_cases: "/portal/counseling?section=cases",
  urgent_support: "/portal/counseling?section=urgent-support",
  individual_inventory: "/portal/forms?section=inventory",
  exit_interviews: "/portal/forms?section=exit-interviews",
  graduate_tracer: "/portal/forms?section=graduate-tracer",
  assessments: "/portal/assessments",
  support_needs: "/portal/support-needs",
  referrals: "/portal/referrals?section=referrals",
  call_slips: "/portal/referrals?section=call-slips",
};

const RELATED_RECORD_QUEUE_TYPES: Record<string, string> = {
  appointment: "appointments",
  counseling_session: "counseling_sessions",
  routine_interview: "routine_interviews",
  counseling_case: "counseling_cases",
  urgent_support: "urgent_support",
  exit_interview: "exit_interviews",
  graduate_tracer: "graduate_tracer",
  support_need: "support_needs",
  referral: "referrals",
  call_slip: "call_slips",
};

type OptionsState =
  | { kind: "loading" }
  | { kind: "ready"; options: StudentDirectoryOptions }
  | { kind: "error"; error: "permission" | "unavailable" };

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; page: StudentDirectoryPage }
  | { kind: "forbidden" }
  | { kind: "unavailable"; error: "unavailable" | "rate_limited" | "validation" };

type ContextState =
  | { kind: "loading" }
  | { kind: "ready"; context: StudentDirectoryContext }
  | { kind: "error" };

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function parsePage(value: string | null) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1;
}

function labelForLifecycle(value: string) {
  return LIFECYCLE_LABELS[value as StudentDirectoryStatus] ?? value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function labelForValue(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusTone(status: StudentDirectoryStatus) {
  if (status === "ACTIVE" || status === "GRADUATING") return "ok";
  if (status === "SUSPENDED_RESTRICTED") return "attention";
  if (status === "ARCHIVED" || status === "DROPPED_INACTIVE") return "subtle";
  return "neutral";
}

function directoryLoadMessage(error: LoadState["kind"] | "rate_limited" | "validation") {
  if (error === "rate_limited") return "Too many Student Directory requests. Please wait and try again.";
  if (error === "validation") return "The Student Directory filters could not be applied.";
  return "The Student Directory is temporarily unavailable.";
}

function restrictToOptions(filters: StudentDirectoryFilters, options: StudentDirectoryOptions): StudentDirectoryFilters {
  const allowed = (items: StudentDirectoryOption[]) => new Set(items.map((item) => item.value));
  const statusValues = allowed(options.statuses);
  const campusValues = allowed(options.campuses);
  const collegeValues = allowed(options.colleges);
  const departmentValues = allowed(options.departments);
  const programValues = allowed(options.programs);
  const yearLevels = new Set(options.year_levels.map((item) => item.value));
  return {
    ...filters,
    statuses: filters.statuses.filter((status) => statusValues.has(status)),
    campus: filters.campus && campusValues.has(filters.campus) ? filters.campus : null,
    college: filters.college && collegeValues.has(filters.college) ? filters.college : null,
    department: filters.department && departmentValues.has(filters.department) ? filters.department : null,
    program: filters.program && programValues.has(filters.program) ? filters.program : null,
    yearLevel: filters.yearLevel !== null && yearLevels.has(filters.yearLevel) ? filters.yearLevel : null,
  };
}

function DirectoryHeader() {
  return (
    <PortalPageHeader
      className="portal-counseling__page-header"
      current="Student directory"
      description="View authorized student profile context and related operational work within your scope."
      headingId="portal-student-directory-heading"
      title="Student directory"
    />
  );
}

function DirectoryFilterPanel({
  filters,
  options,
}: {
  filters: StudentDirectoryFilters;
  options: StudentDirectoryOptions | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const readOption = (form: FormData, name: string, allowed: StudentDirectoryOption[]) => {
    const value = String(form.get(name) ?? "").trim();
    return value && allowed.some((item) => item.value === value) ? value : null;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const availableOptions = options ?? {
      statuses: [],
      campuses: [],
      colleges: [],
      departments: [],
      programs: [],
      year_levels: [],
    };
    const statuses = [...new Set(form.getAll("status"))]
      .filter((value): value is string => typeof value === "string" && STUDENT_DIRECTORY_STATUSES.includes(value as StudentDirectoryStatus)) as StudentDirectoryStatus[];
    const rawYearLevel = String(form.get("year_level") ?? "").trim();
    const parsedYearLevel = /^\d{1,3}$/.test(rawYearLevel) ? Number(rawYearLevel) : null;
    const rawOrder = String(form.get("order") ?? "name").trim();
    const order = STUDENT_DIRECTORY_ORDERS.includes(rawOrder as StudentDirectoryOrder) ? rawOrder as StudentDirectoryOrder : "name";
    const next: StudentDirectoryFilters = {
      q: String(form.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH) || null,
      statuses: statuses.filter((status) => availableOptions.statuses.some((item) => item.value === status)),
      campus: readOption(form, "campus", availableOptions.campuses),
      college: readOption(form, "college", availableOptions.colleges),
      department: readOption(form, "department", availableOptions.departments),
      program: readOption(form, "program", availableOptions.programs),
      yearLevel: parsedYearLevel !== null && availableOptions.year_levels.some((item) => item.value === parsedYearLevel) ? parsedYearLevel : null,
      order,
    };
    startTransition(() => router.push(studentDirectoryHref(1, next), { scroll: false }));
  };

  return (
    <PortalFilterPanel
      accessibleLabel="Student Directory filters"
      action="/portal/students"
      ariaBusy={isPending}
      className="portal-counseling__filters"
      onSubmit={handleSubmit}
      resetKey={`${filters.q ?? ""}:${filters.statuses.join(",")}:${filters.campus ?? ""}:${filters.college ?? ""}:${filters.department ?? ""}:${filters.program ?? ""}:${filters.yearLevel ?? ""}:${filters.order}`}
      summary="Search and narrow the authorized student records visible to this account."
    >
      <div className="portal-counseling__filters-grid portal-student-directory__filters-grid">
        <div className="portal-counseling__filter-field portal-counseling__filter-field--search">
          <Label htmlFor="portal-student-directory-query">Search</Label>
          <Input
            defaultValue={filters.q ?? ""}
            id="portal-student-directory-query"
            maxLength={MAX_QUERY_LENGTH}
            name="q"
            placeholder="Student name or student number"
          />
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-student-directory-status">Lifecycle</Label>
          <PortalStatusFilter
            ariaLabel="Choose lifecycle statuses"
            id="portal-student-directory-status"
            options={options?.statuses ?? []}
            selectedValues={filters.statuses}
            title="Student lifecycle"
          />
        </div>
        {([
          ["campus", "Campus", "portal-student-directory-campus", options?.campuses ?? [], filters.campus],
          ["college", "College", "portal-student-directory-college", options?.colleges ?? [], filters.college],
          ["department", "Department", "portal-student-directory-department", options?.departments ?? [], filters.department],
          ["program", "Program", "portal-student-directory-program", options?.programs ?? [], filters.program],
        ] as const).map(([name, label, id, items, selected]) => (
          <div className="portal-counseling__filter-field" key={name}>
            <Label htmlFor={id}>{label}</Label>
            <select defaultValue={selected ?? ""} disabled={!options} id={id} name={name}>
              <option value="">All {label.toLowerCase()}s</option>
              {items.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
        ))}
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-student-directory-year-level">Year level</Label>
          <select defaultValue={filters.yearLevel === null ? "" : String(filters.yearLevel)} disabled={!options} id="portal-student-directory-year-level" name="year_level">
            <option value="">All year levels</option>
            {options?.year_levels.map((item) => <option key={item.value} value={String(item.value)}>{item.label}</option>)}
          </select>
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-student-directory-order">Order</Label>
          <select defaultValue={filters.order} id="portal-student-directory-order" name="order">
            <option value="name">A–Z by student name</option>
            <option value="recent">Recently updated</option>
          </select>
        </div>
      </div>
      <div className="portal-counseling__filter-actions">
        <Button disabled={isPending || !options} size="sm" type="submit">Apply filters</Button>
        <Link className="portal-counseling__filter-clear" href="/portal/students">Clear</Link>
      </div>
    </PortalFilterPanel>
  );
}

function ContextDetails({
  state,
  onRetry,
}: {
  state: ContextState | undefined;
  onRetry: () => void;
}) {
  if (!state || state.kind === "loading") {
    return <div className="portal-counseling__detail-state" role="status"><Skeleton as="span" /><Skeleton as="span" /><Skeleton as="span" /></div>;
  }
  if (state.kind === "error") {
    return <div className="portal-counseling__detail-state" role="status"><p>Student context is unavailable right now.</p><Button onClick={onRetry} size="sm" type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button></div>;
  }

  const { profile, related_work: relatedWork } = state.context;
  return (
    <div className="portal-counseling__detail-content portal-student-directory__context-content">
      <dl>
        <div><dt>Student</dt><dd>{profile.display_name}</dd></div>
        <div><dt>Student number</dt><dd>{profile.student_number_masked}</dd></div>
        <div><dt>Lifecycle</dt><dd><Badge data-tone={statusTone(profile.lifecycle_status)} variant="outline">{labelForLifecycle(profile.lifecycle_status)}</Badge></dd></div>
        <div><dt>Campus</dt><dd>{profile.campus || "Not recorded"}</dd></div>
        <div><dt>College</dt><dd>{profile.college || "Not recorded"}</dd></div>
        <div><dt>Department</dt><dd>{profile.department || "Not recorded"}</dd></div>
        <div><dt>Program</dt><dd>{profile.program || "Not recorded"}</dd></div>
        <div><dt>Year level</dt><dd>{profile.year_level === null ? "Not recorded" : `Year ${profile.year_level}`}</dd></div>
        <div><dt>Profile updated</dt><dd>{formatTimestamp(profile.updated_at)}</dd></div>
      </dl>
      <div className="portal-student-directory__related-work">
        <p className="portal-counseling__kicker">Related work</p>
        <div className="portal-student-directory__related-list">
          {relatedWork.map((summary) => <RelatedWorkSummary key={summary.record_type} summary={summary} />)}
        </div>
      </div>
    </div>
  );
}

function recordHref(record: StudentDirectoryRelatedRecord) {
  const queueType = RELATED_RECORD_QUEUE_TYPES[record.record_type] ?? record.record_type;
  if (record.record_type === "counseling_session" && record.reference_code) {
    return `/portal/counseling/sessions/${encodeURIComponent(record.reference_code)}`;
  }
  return RELATED_QUEUE_HREFS[queueType] ?? null;
}

function relatedStatus(summary: StudentDirectoryRelatedWork) {
  return summary.latest_status ? labelForValue(summary.latest_status) : "No authorized status";
}

function RelatedWorkSummary({ summary }: { summary: StudentDirectoryRelatedWork }) {
  const label = RELATED_WORK_LABELS[summary.record_type] ?? "Related work";
  const href = RELATED_QUEUE_HREFS[summary.record_type];
  return (
    <section className="portal-student-directory__related-group">
      <div className="portal-student-directory__related-heading">
        <h3>{label}</h3>
        <Badge variant="outline">{summary.visible_count} {summary.visible_count === 1 ? "record" : "records"}</Badge>
      </div>
      <p>Latest status: {relatedStatus(summary)} · Updated {formatTimestamp(summary.latest_updated_at)}</p>
      {summary.records.length > 0 ? (
        <ul>
          {summary.records.map((record, index) => {
            const target = recordHref(record);
            return (
              <li key={`${record.record_type}:${record.reference_code ?? "record"}:${index}`}>
                {target && record.reference_code ? <Link href={target}>{record.reference_code}</Link> : null}
                <span>{labelForValue(record.status)}</span>
                <span>Updated {formatTimestamp(record.updated_at ?? record.created_at)}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {summary.visible_count > 0 && href ? <Link className="portal-student-directory__queue-link" href={href}>Open {label.toLowerCase()} queue</Link> : null}
    </section>
  );
}

function rowKey(student: StudentDirectoryStudent, index: number) {
  return `${student.display_name}:${student.student_number_masked}:${student.updated_at}:${index}`;
}

function detailId(index: number) {
  return `portal-student-directory-detail-${index}`;
}

function DirectoryTable({
  items,
  expanded,
  contextStates,
  onRetryContext,
  onToggle,
}: {
  items: StudentDirectoryStudent[];
  expanded: StudentDirectoryStudent | null;
  contextStates: Map<StudentDirectoryStudent, ContextState>;
  onRetryContext: (student: StudentDirectoryStudent) => void;
  onToggle: (student: StudentDirectoryStudent) => void;
}) {
  return (
    <div className="portal-counseling__table-wrap">
      <table className="portal-counseling__table portal-student-directory__table">
        <thead>
          <tr>
            <th scope="col">Student</th>
            <th scope="col">Lifecycle</th>
            <th scope="col">Campus</th>
            <th scope="col">College / program</th>
            <th scope="col">Year level</th>
            <th scope="col">Updated</th>
            <th scope="col">Details</th>
          </tr>
        </thead>
        <tbody>
          {items.map((student, index) => {
            const expandedRow = expanded === student;
            const expandedId = detailId(index);
            return (
              <Fragment key={rowKey(student, index)}>
                <tr className={expandedRow ? "is-expanded" : undefined}>
                  <td data-label="Student"><span className="portal-counseling__student-name">{student.display_name}</span><span className="portal-counseling__student-number">{student.student_number_masked}</span></td>
                  <td data-label="Lifecycle"><Badge data-tone={statusTone(student.lifecycle_status)} variant="outline">{labelForLifecycle(student.lifecycle_status)}</Badge></td>
                  <td data-label="Campus">{student.campus || "Not recorded"}</td>
                  <td data-label="College / program"><span>{student.college || "Not recorded"}</span><span className="portal-counseling__student-number">{student.program || "Program not recorded"}</span></td>
                  <td data-label="Year level">{student.year_level === null ? "Not recorded" : `Year ${student.year_level}`}</td>
                  <td data-label="Updated">{formatTimestamp(student.updated_at)}</td>
                  <td data-label="Details">
                    <Button
                      aria-controls={expandedId}
                      aria-expanded={expandedRow}
                      aria-label={`${expandedRow ? "Hide" : "Show"} details for ${student.display_name}`}
                      onClick={() => onToggle(student)}
                      size="xs"
                      type="button"
                      variant="outline"
                    >
                      {expandedRow ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                      <span className="sr-only">{expandedRow ? "Hide" : "Show"} details</span>
                    </Button>
                  </td>
                </tr>
                {expandedRow ? <tr className="portal-counseling__detail-row"><td colSpan={7} id={expandedId}><ContextDetails state={contextStates.get(student)} onRetry={() => onRetryContext(student)} /></td></tr> : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState() {
  return <div className="portal-counseling__empty" role="status"><h2>No students to show.</h2><p>Try changing the filters or check back when an authorized student is within your scope.</p></div>;
}

function DirectoryPagination({ page, filters }: { page: StudentDirectoryPage; filters: StudentDirectoryFilters }) {
  const totalPages = Math.max(1, Math.ceil(page.total / page.page_size));
  if (totalPages <= 1) return null;
  return (
    <Pagination aria-label="Student Directory pages" className="portal-counseling__pagination">
      <PaginationContent>
        <PaginationItem>{page.page > 1 ? <PaginationPrevious href={studentDirectoryHref(page.page - 1, filters)} text="Previous" /> : <span aria-hidden="true" className="portal-counseling__pagination-spacer" />}</PaginationItem>
        <PaginationItem className="portal-counseling__pagination-current"><span aria-current="page">Page {page.page} of {totalPages}</span></PaginationItem>
        <PaginationItem>{page.page < totalPages ? <PaginationNext href={studentDirectoryHref(page.page + 1, filters)} text="Next" /> : <span aria-hidden="true" className="portal-counseling__pagination-spacer" />}</PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

function AccessState({
  kind,
  onRetry,
}: {
  kind: "forbidden" | "unavailable";
  onRetry?: () => void;
}) {
  return (
    <section aria-labelledby="portal-student-directory-heading" className="portal-counseling portal-student-directory portal-counseling--state" role={kind === "unavailable" ? "alert" : undefined}>
      <DirectoryHeader />
      <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state">
        <UsersRound aria-hidden="true" className="portal-counseling__state-icon" />
        <h2>{kind === "forbidden" ? "This page isn’t available for this account." : "The Student Directory is temporarily unavailable."}</h2>
        <p>{kind === "forbidden" ? "Return to your workspace to continue." : "Try again when the connection is ready."}</p>
        {onRetry ? <Button onClick={onRetry} type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button> : null}
      </PortalCollectionFrame>
    </section>
  );
}

export function PortalStudentDirectoryLoading() {
  return (
    <section aria-busy="true" aria-labelledby="portal-student-directory-loading-heading" className="portal-counseling portal-student-directory portal-counseling--loading" role="status">
      <span className="sr-only">Loading Student Directory…</span>
      <DirectoryHeader />
      <PortalFilterPanel action="/portal/students" ariaBusy className="portal-counseling__filters" resetKey="student-directory-loading" summary={<Skeleton as="span" aria-hidden="true" className="portal-counseling__skeleton-summary" />}>
        <div aria-hidden="true" className="portal-counseling__filter-skeleton-grid">{Array.from({ length: 8 }, (_, index) => <Skeleton as="span" key={index} />)}</div>
      </PortalFilterPanel>
      <PortalCollectionFrame className="portal-counseling__frame"><div aria-hidden="true" className="portal-counseling__table-skeleton">{Array.from({ length: 5 }, (_, row) => <div className="portal-counseling__table-skeleton-row" key={row}>{Array.from({ length: 7 }, (_, cell) => <Skeleton as="span" key={cell} />)}</div>)}</div></PortalCollectionFrame>
    </section>
  );
}

export function PortalStudentDirectoryPage() {
  const { hasCapability, refreshAccess, status: accessStatus } = usePortalAccess();
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawQuery = searchParams.toString();
  const parsedFilters = useMemo(() => parseStudentDirectoryFilters(searchParams), [searchParams]);
  const pageNumber = parsePage(searchParams.get("page"));
  const [optionsState, setOptionsState] = useState<OptionsState>({ kind: "loading" });
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [expanded, setExpanded] = useState<StudentDirectoryStudent | null>(null);
  const [contextStates, setContextStates] = useState<Map<StudentDirectoryStudent, ContextState>>(new Map());

  const canQueue = accessStatus === "ready" && hasCapability(PORTAL_CAPABILITIES.studentRecordsViewScoped);
  const options = optionsState.kind === "ready" ? optionsState.options : null;
  const filters = useMemo(() => options ? restrictToOptions(parsedFilters, options) : parsedFilters, [options, parsedFilters]);
  const canonicalHref = studentDirectoryHref(pageNumber, filters);
  const currentHref = rawQuery ? `/portal/students?${rawQuery}` : "/portal/students";

  useEffect(() => {
    if (!canQueue) return;
    const controller = new AbortController();
    void getStudentDirectoryOptions(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setOptionsState({ kind: "ready", options: value });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && !isAbortError(error)) {
          setOptionsState({
            kind: "error",
            error: error instanceof StudentDirectoryApiError && error.kind === "permission" ? "permission" : "unavailable",
          });
        }
      });
    return () => controller.abort();
  }, [canQueue, refreshAccess, reloadKey]);

  const retryOptions = () => {
    setOptionsState({ kind: "loading" });
    setReloadKey((value) => value + 1);
  };

  useEffect(() => {
    if (!canQueue || optionsState.kind !== "ready") return;
    if (currentHref !== canonicalHref) router.replace(canonicalHref, { scroll: false });
  }, [canQueue, canonicalHref, currentHref, optionsState.kind, router]);

  useEffect(() => {
    if (!canQueue || optionsState.kind !== "ready") return;
    const controller = new AbortController();
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!active || controller.signal.aborted) return null;
        setLoadState({ kind: "loading" });
        setExpanded(null);
        setContextStates(new Map());
        return getStudentDirectoryPage(pageNumber, filters, controller.signal);
      })
      .then((page) => {
        if (page && active && !controller.signal.aborted) setLoadState({ kind: "ready", page });
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted || isAbortError(error)) return;
        if (error instanceof StudentDirectoryApiError && error.kind === "permission") setLoadState({ kind: "forbidden" });
        else setLoadState({ kind: "unavailable", error: error instanceof StudentDirectoryApiError && (error.kind === "rate_limited" || error.kind === "validation") ? error.kind : "unavailable" });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [canQueue, filters, optionsState.kind, pageNumber, reloadKey]);

  const loadContext = (student: StudentDirectoryStudent) => {
    setContextStates((current) => new Map(current).set(student, { kind: "loading" }));
    void getStudentDirectoryContext(student)
      .then((context) => setContextStates((current) => new Map(current).set(student, { kind: "ready", context })))
      .catch((error: unknown) => {
        if (!isAbortError(error)) setContextStates((current) => new Map(current).set(student, { kind: "error" }));
      });
  };

  const toggleExpanded = (student: StudentDirectoryStudent) => {
    if (expanded === student) {
      setExpanded(null);
      return;
    }
    setExpanded(student);
    if (!contextStates.has(student)) loadContext(student);
  };

  if (accessStatus === "loading") return <PortalStudentDirectoryLoading />;
  if (accessStatus === "unavailable") return <AccessState kind="unavailable" onRetry={() => void refreshAccess()} />;
  if (!canQueue) return <AccessState kind="forbidden" />;
  if (optionsState.kind === "error") return <AccessState kind={optionsState.error === "permission" ? "forbidden" : "unavailable"} onRetry={optionsState.error === "permission" ? undefined : retryOptions} />;
  if (loadState.kind === "loading" || optionsState.kind === "loading") return <PortalStudentDirectoryLoading />;
  if (loadState.kind === "forbidden") return <AccessState kind="forbidden" />;
  if (loadState.kind === "unavailable") {
    return (
      <section aria-labelledby="portal-student-directory-heading" className="portal-counseling portal-student-directory portal-counseling--state">
        <DirectoryHeader />
        <DirectoryFilterPanel filters={filters} options={options} />
        <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state">
          <h2>{directoryLoadMessage(loadState.error)}</h2>
          <p>Try again when the connection is ready.</p>
          <Button onClick={retryOptions} type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button>
        </PortalCollectionFrame>
      </section>
    );
  }

  const page = loadState.page;
  return (
    <section aria-labelledby="portal-student-directory-heading" className="portal-counseling portal-student-directory">
      <DirectoryHeader />
      <DirectoryFilterPanel filters={filters} options={options} />
      <PortalCollectionFrame aria-labelledby="portal-student-directory-results-heading" className="portal-counseling__frame">
        <div className="portal-counseling__frame-heading">
          <div><p className="portal-counseling__kicker">Directory</p><h2 id="portal-student-directory-results-heading">Authorized students</h2></div>
          <p className="portal-counseling__result-count">{page.total} {page.total === 1 ? "student" : "students"}</p>
        </div>
        {page.items.length ? <DirectoryTable contextStates={contextStates} expanded={expanded} items={page.items} onRetryContext={loadContext} onToggle={toggleExpanded} /> : <EmptyState />}
        <DirectoryPagination filters={filters} page={page} />
      </PortalCollectionFrame>
    </section>
  );
}
