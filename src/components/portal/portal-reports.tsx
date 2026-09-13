"use client";

import { BarChart3, Download, RefreshCw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";

import { usePortalAccess } from "@/components/portal/portal-access-provider";
import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
import { PortalFilterPanel } from "@/components/portal/portal-filter-panel";
import { PortalPageHeader } from "@/components/portal/portal-page-header";
import { PORTAL_CAPABILITIES } from "@/components/portal/portal-navigation";
import { PortalWorkspaceNav } from "@/components/portal/portal-workspace-nav";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  createProfilingExportIntent,
  createCsmExportIntent,
  createGraduateTracerExportIntent,
  downloadPortalCsmExport,
  downloadPortalProfilingExport,
  downloadPortalGraduateTracerExport,
  getPortalCsmPreview,
  getPortalGraduateTracerOptions,
  getPortalGraduateTracerPreview,
  getPortalProfilingOptions,
  getPortalProfilingPreview,
  parseGraduateTracerFilters,
  parseProfilingFilters,
  PROFILING_EXPORT_FORMATS,
  ReportsApiError,
  type ProfilingExportFormat,
  type ProfilingExportIntent,
  type ProfilingFilters,
  type ProfilingOptions,
  type ProfilingPreview,
  type ProfilingScalar,
  type AggregateReportPreview,
  type AggregateReportSection,
  type GraduateTracerExportIntent,
  type GraduateTracerFilters,
  type GraduateTracerReportOptions,
} from "@/lib/api/reports";

const REPORTS_NAV_ITEMS = [
  { href: "/portal/reports?section=profiling", label: "Profiling", value: "profiling" },
  { href: "/portal/reports?section=csm-feedback", label: "CSM / Service Feedback", value: "csm-feedback" },
  { href: "/portal/reports?section=graduate-tracer", label: "Graduate Tracer summaries", value: "graduate-tracer" },
] as const;

const MAX_PURPOSE_LENGTH = 240;
const REPORTS_NAV = REPORTS_NAV_ITEMS;
type ReportsSection = (typeof REPORTS_NAV_ITEMS)[number]["value"];
type ReportsNavItem = (typeof REPORTS_NAV_ITEMS)[number];

type ReportsLoadState<T> =
  | { kind: "loading" }
  | { kind: "ready"; value: T }
  | { kind: "forbidden" }
  | { kind: "unavailable"; error: "unavailable" | "rate_limited" | "validation" };

type KeyedReportsLoadState<T> = {
  key: string;
  state: ReportsLoadState<T>;
};

type PreviewState =
  | { kind: "idle"; fingerprint: string }
  | { kind: "loading"; fingerprint: string }
  | { kind: "ready"; fingerprint: string; preview: ProfilingPreview }
  | { kind: "forbidden"; fingerprint: string }
  | { kind: "unavailable"; error: "unavailable" | "rate_limited" | "validation"; fingerprint: string };

type ExportState =
  | { kind: "idle" }
  | { kind: "pending"; format: ProfilingExportFormat }
  | { kind: "success" }
  | { kind: "error"; message: string };

function ReportsHeader() {
  return (
    <PortalPageHeader
      className="portal-counseling__page-header"
      current="Reports & profiling"
      description="Review privacy-protected aggregate reports within your authorized scope."
      headingId="portal-reports-heading"
      title="Reports & profiling"
    />
  );
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function reportsLoadMessage(error: ReportsLoadState<unknown>["kind"] | PreviewState["kind"] | "rate_limited" | "validation") {
  if (error === "rate_limited") return "Too many profiling requests. Please wait and try again.";
  if (error === "validation") return "The profiling context could not be applied.";
  return "Profiling is temporarily unavailable.";
}

function exportErrorMessage(error: unknown, format: ProfilingExportFormat) {
  if (!(error instanceof ReportsApiError)) {
    return format === "pdf"
      ? "The PDF export is unavailable right now. Try again or choose CSV."
      : "The CSV export is unavailable right now. Try again.";
  }
  switch (error.kind) {
    case "permission":
      return "This export is not available for this account or context.";
    case "validation":
      return "Check the business purpose and selected cohort, then try again.";
    case "conflict":
      return "The report context changed. Refresh the report and try again.";
    case "rate_limited":
      return "Too many export attempts. Please wait before trying again.";
    default:
      return format === "pdf"
        ? "The PDF export is unavailable right now. Try again or choose CSV."
        : "The CSV export is unavailable right now. Try again.";
  }
}

function formatYearLevel(value: number) {
  const suffix = value % 100 >= 11 && value % 100 <= 13
    ? "th"
    : value % 10 === 1
      ? "st"
      : value % 10 === 2
        ? "nd"
        : value % 10 === 3
          ? "rd"
          : "th";
  return `${value}${suffix} year`;
}

function uniqueValues(values: Iterable<string>) {
  return [...new Set([...values].filter((value) => value.trim()))].sort((left, right) => left.localeCompare(right));
}

function contextForFilters(options: ProfilingOptions, filters: ProfilingFilters) {
  return options.contexts.find((context) =>
    context.academic_year === filters.academicYear &&
    context.college === filters.college &&
    context.year_level === filters.yearLevel,
  );
}

function canonicalizeProfilingFilters(
  filters: ProfilingFilters,
  options: ProfilingOptions | null,
): ProfilingFilters {
  if (!options) return filters;

  const academicYear = options.contexts.some((context) => context.academic_year === filters.academicYear)
    ? filters.academicYear
    : null;
  const college = academicYear && options.contexts.some((context) => context.academic_year === academicYear && context.college === filters.college)
    ? filters.college
    : null;
  const yearLevel = academicYear && college && options.contexts.some((context) =>
    context.academic_year === academicYear && context.college === college && context.year_level === filters.yearLevel,
  )
    ? filters.yearLevel
    : null;
  const context = yearLevel === null || !academicYear || !college
    ? undefined
    : options.contexts.find((item) =>
      item.academic_year === academicYear && item.college === college && item.year_level === yearLevel,
    );
  const campus = context?.campus && filters.campus === context.campus ? filters.campus : null;

  return { academicYear, college, yearLevel, campus };
}

function reportsHref(filters: ProfilingFilters) {
  const params = new URLSearchParams({ section: "profiling" });
  if (filters.academicYear) params.set("academic_year", filters.academicYear);
  if (filters.college) params.set("college", filters.college);
  if (filters.yearLevel !== null) params.set("year_level", String(filters.yearLevel));
  if (filters.campus) params.set("campus", filters.campus);
  return `/portal/reports?${params.toString()}`;
}

function ProfilingFilterPanel({
  filters,
  options,
}: {
  filters: ProfilingFilters;
  options: ProfilingOptions | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<ProfilingFilters>(filters);
  const [filterError, setFilterError] = useState<string | null>(null);

  const academicYears = useMemo(
    () => uniqueValues(options?.contexts.map((context) => context.academic_year) ?? []),
    [options],
  );
  const colleges = useMemo(
    () => uniqueValues(options?.contexts
      .filter((context) => context.academic_year === draft.academicYear)
      .map((context) => context.college) ?? []),
    [draft.academicYear, options],
  );
  const yearLevels = useMemo(
    () => [...new Set(options?.contexts
      .filter((context) => context.academic_year === draft.academicYear && context.college === draft.college)
      .map((context) => context.year_level) ?? [])].sort((left, right) => left - right),
    [draft.academicYear, draft.college, options],
  );
  const selectedContext = options ? contextForFilters(options, draft) : undefined;
  const campusOptions = selectedContext?.campus ? [selectedContext.campus] : [];

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.academicYear || !draft.college || draft.yearLevel === null) {
      setFilterError("Select an academic year, college, and year level before viewing the report.");
      return;
    }
    if (!options || !contextForFilters(options, draft)) {
      setFilterError("That profiling context is not available in your authorized report scope.");
      return;
    }
    setFilterError(null);
    startTransition(() => router.push(reportsHref(draft), { scroll: false }));
  };

  const resetKey = `${filters.academicYear ?? ""}:${filters.college ?? ""}:${filters.yearLevel ?? ""}:${filters.campus ?? ""}`;

  return (
    <PortalFilterPanel
      accessibleLabel="profiling filters"
      action="/portal/reports?section=profiling"
      ariaBusy={isPending || options === null}
      className="portal-counseling__filters portal-reports__filters"
      onSubmit={handleSubmit}
      resetKey={resetKey}
      summary="Select one complete authorized historical cohort context."
    >
      <div className="portal-counseling__filters-grid portal-reports__filters-grid">
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-reports-academic-year">Academic year</Label>
          <select
            disabled={!options}
            id="portal-reports-academic-year"
            onChange={(event) => setDraft({ academicYear: event.target.value || null, college: null, yearLevel: null, campus: null })}
            value={draft.academicYear ?? ""}
          >
            <option value="">Choose academic year</option>
            {academicYears.map((academicYear) => <option key={academicYear} value={academicYear}>{academicYear}</option>)}
          </select>
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-reports-college">College</Label>
          <select
            disabled={!options || !draft.academicYear}
            id="portal-reports-college"
            onChange={(event) => setDraft((current) => ({ ...current, college: event.target.value || null, yearLevel: null, campus: null }))}
            value={draft.college ?? ""}
          >
            <option value="">Choose college</option>
            {colleges.map((college) => <option key={college} value={college}>{college}</option>)}
          </select>
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-reports-year-level">Year level</Label>
          <select
            disabled={!options || !draft.college}
            id="portal-reports-year-level"
            onChange={(event) => setDraft((current) => ({ ...current, yearLevel: event.target.value ? Number(event.target.value) : null, campus: null }))}
            value={draft.yearLevel === null ? "" : String(draft.yearLevel)}
          >
            <option value="">Choose year level</option>
            {yearLevels.map((yearLevel) => <option key={yearLevel} value={String(yearLevel)}>{formatYearLevel(yearLevel)}</option>)}
          </select>
        </div>
        <div className="portal-counseling__filter-field">
          <Label htmlFor="portal-reports-campus">Campus (context only)</Label>
          <select
            disabled={!options || !selectedContext || campusOptions.length === 0}
            id="portal-reports-campus"
            onChange={(event) => setDraft((current) => ({ ...current, campus: event.target.value || null }))}
            value={draft.campus ?? ""}
          >
            <option value="">No campus context</option>
            {campusOptions.map((campus) => <option key={campus} value={campus}>{campus}</option>)}
          </select>
          <p className="portal-reports__field-hint">Campus confirms the cohort context; it does not narrow the report.</p>
        </div>
      </div>
      {filterError ? <p className="portal-counseling__filter-error" role="alert">{filterError}</p> : null}
      <div className="portal-counseling__filter-actions">
        <Button disabled={isPending || !options} size="sm" type="submit">Apply filters</Button>
        <a className="portal-counseling__filter-clear" href="/portal/reports?section=profiling">Clear</a>
      </div>
    </PortalFilterPanel>
  );
}

function formatProfilingValue(value: ProfilingScalar | undefined) {
  if (value === "Suppressed for privacy") return value;
  if (value === null || value === undefined || value === "") return "Not reported";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function aggregateValue(value: string | number | boolean | null | undefined) {
  if (value === "Suppressed for privacy") return value;
  if (value === null || value === undefined || value === "") return "Not reported";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function humanizeAggregateKey(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function AggregateMatrix({ section }: { section: AggregateReportSection }) {
  return (
    <section className="portal-reports__matrix-section">
      <div className="portal-reports__matrix-heading">
        <div>
          <p className="portal-counseling__kicker">Aggregate section</p>
          <h3>{section.title}</h3>
        </div>
      </div>
      {section.suppression_notice ? (
        <p className="portal-reports__suppression-notice" role="status">{section.suppression_notice}</p>
      ) : null}
      <div className="portal-reports__matrix-wrap">
        <table className="portal-reports__matrix">
          <caption className="sr-only">{section.title}</caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              {section.columns.map((column) => <th key={column.key} scope="col">{column.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                {section.columns.map((column) => (
                  <td key={column.key}>{aggregateValue(row.values[column.key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProfilingMatrix({
  section,
}: {
  section: ProfilingPreview["sections"][number];
}) {
  return (
    <section className="portal-reports__matrix-section">
      <div className="portal-reports__matrix-heading">
        <div>
          <p className="portal-counseling__kicker">Aggregate section</p>
          <h3>{section.title}</h3>
        </div>
        <p className="portal-counseling__result-count">{section.cohort_total} cohort records</p>
      </div>
      {section.suppression_notice ? (
        <p className="portal-reports__suppression-notice" role="status">Some values in this section are suppressed for privacy.</p>
      ) : null}
      <div className="portal-reports__matrix-wrap">
        <table className="portal-reports__matrix">
          <caption className="sr-only">{section.title}</caption>
          <thead>
            <tr>
              <th scope="col">{section.row_heading ?? "Category"}</th>
              {section.columns.map((column) => <th key={column.key} scope="col">{column.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row) => (
              <tr className={row.is_total ? "is-total" : undefined} key={row.code}>
                <th scope="row">{row.label}</th>
                {section.columns.map((column) => (
                  <td key={column.key}>{formatProfilingValue(row.values[column.key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProfilingResult({
  onExport,
  preview,
}: {
  onExport: (format: ProfilingExportFormat) => void;
  preview: ProfilingPreview;
}) {
  const context = preview.report_context;
  return (
    <PortalCollectionFrame aria-labelledby="portal-reports-results-heading" className="portal-counseling__frame portal-reports__result-frame">
      <div className="portal-counseling__frame-heading portal-reports__result-heading">
        <div>
          <p className="portal-counseling__kicker">Profiling</p>
          <h2 id="portal-reports-results-heading">Student profile</h2>
        </div>
        <div className="portal-reports__result-actions">
          <p className="portal-counseling__result-count">{context.cohort_total} cohort records</p>
          {PROFILING_EXPORT_FORMATS.map((format) => (
            <Button key={format} onClick={() => onExport(format)} size="sm" type="button" variant="outline">
              <Download aria-hidden="true" />Download {format.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>
      <div className="portal-reports__context-summary">
        <dl>
          <div><dt>Academic year</dt><dd>{context.academic_year}</dd></div>
          <div><dt>College</dt><dd>{context.college}</dd></div>
          <div><dt>Year level</dt><dd>{formatYearLevel(context.year_level)}</dd></div>
          <div><dt>Campus</dt><dd>{context.campus || "Context-wide"}</dd></div>
        </dl>
        <div className="portal-reports__cohort-total">
          <span>Cohort total</span>
          <Badge variant="outline">{context.cohort_total}</Badge>
        </div>
      </div>
      <p className="portal-reports__privacy-notice" role="status">Privacy controls are enforced for this aggregate report.</p>
      {preview.sections.length === 0 ? (
        <div className="portal-counseling__empty" role="status">
          <h2>No profiling sections are available.</h2>
          <p>The selected authorized cohort does not have reportable aggregate sections yet.</p>
        </div>
      ) : (
        <div className="portal-reports__matrices">
          {preview.sections.map((section) => <ProfilingMatrix key={section.metric_key} section={section} />)}
        </div>
      )}
    </PortalCollectionFrame>
  );
}

function PreviewStateFrame({
  error,
  onRetry,
  state,
}: {
  error?: PreviewState["kind"] | "rate_limited" | "validation";
  onRetry?: () => void;
  state: "empty" | "loading" | "forbidden" | "unavailable";
}) {
  if (state === "loading") {
    return (
      <PortalCollectionFrame aria-busy="true" className="portal-counseling__frame portal-counseling__frame--state" role="status">
        <Skeleton aria-hidden="true" className="portal-reports__state-skeleton" />
        <Skeleton aria-hidden="true" className="portal-reports__state-skeleton portal-reports__state-skeleton--short" />
      </PortalCollectionFrame>
    );
  }
  if (state === "empty") {
    return (
      <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state">
        <h2>Select a cohort context to begin.</h2>
        <p>Choose an academic year, college, and year level, then apply the filters to view the authorized aggregate profile.</p>
      </PortalCollectionFrame>
    );
  }
  if (state === "forbidden") {
    return (
      <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state">
        <h2>This profiling report is not available for this account.</h2>
        <p>Return to your workspace to continue.</p>
      </PortalCollectionFrame>
    );
  }
  return (
    <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state">
      <h2>{reportsLoadMessage(error ?? "unavailable")}</h2>
      <p>Try again when the connection is ready.</p>
      {onRetry ? <Button onClick={onRetry} type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button> : null}
    </PortalCollectionFrame>
  );
}

function saveBlob(blob: Blob, format: ProfilingExportFormat) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `profiling-report.${format}`;
  anchor.rel = "noopener";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function graduateTracerHref(filters: GraduateTracerFilters) {
  const params = new URLSearchParams({ section: "graduate-tracer" });
  if (filters.graduationYear) params.set("graduation_year", filters.graduationYear);
  if (filters.college) params.set("college", filters.college);
  if (filters.program) params.set("program", filters.program);
  if (filters.employmentStatus) params.set("employment_status", filters.employmentStatus);
  if (filters.presentEmploymentCategory) params.set("present_employment_category", filters.presentEmploymentCategory);
  if (filters.presentlyEmployed) params.set("presently_employed", filters.presentlyEmployed);
  if (filters.firstJobRelated !== null) params.set("first_job_related", String(filters.firstJobRelated));
  if (filters.firstJobSearchDuration) params.set("first_job_search_duration", filters.firstJobSearchDuration);
  return `/portal/reports?${params.toString()}`;
}

function graduateTracerFilterOptionValues(options: GraduateTracerReportOptions | null, key: keyof GraduateTracerReportOptions) {
  return new Set((options?.[key] ?? []).map((option) => option.value));
}

function canonicalizeGraduateTracerFilters(
  filters: GraduateTracerFilters,
  options: GraduateTracerReportOptions | null,
): GraduateTracerFilters {
  if (!options) return filters;
  const valid = (key: keyof GraduateTracerReportOptions, value: string | null) => (
    value && graduateTracerFilterOptionValues(options, key).has(value) ? value : null
  );
  const firstJobRelated = filters.firstJobRelated === null
    ? null
    : graduateTracerFilterOptionValues(options, "first_job_related").has(String(filters.firstJobRelated))
      ? filters.firstJobRelated
      : null;
  return {
    graduationYear: valid("graduation_years", filters.graduationYear),
    college: valid("colleges", filters.college),
    program: valid("programs", filters.program),
    employmentStatus: valid("employment_statuses", filters.employmentStatus),
    presentEmploymentCategory: valid("present_employment_categories", filters.presentEmploymentCategory),
    presentlyEmployed: valid("presently_employed", filters.presentlyEmployed),
    firstJobRelated,
    firstJobSearchDuration: valid("first_job_search_durations", filters.firstJobSearchDuration),
  };
}

function GraduateTracerFilterPanel({
  filters,
  options,
}: {
  filters: GraduateTracerFilters;
  options: GraduateTracerReportOptions | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<GraduateTracerFilters>(filters);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(() => router.push(graduateTracerHref(draft), { scroll: false }));
  };

  const select = (
    id: string,
    label: string,
    value: string,
    optionsKey: keyof GraduateTracerReportOptions,
    onChange: (value: string) => void,
  ) => (
    <div className="portal-counseling__filter-field">
      <Label htmlFor={id}>{label}</Label>
      <select disabled={!options} id={id} onChange={(event) => onChange(event.target.value)} value={value}>
        <option value="">All {label.toLowerCase()}</option>
        {(options?.[optionsKey] ?? []).map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );

  return (
    <PortalFilterPanel
      accessibleLabel="Graduate Tracer summary filters"
      action="/portal/reports?section=graduate-tracer"
      ariaBusy={isPending || !options}
      className="portal-counseling__filters portal-reports__filters"
      onSubmit={submit}
      resetKey={JSON.stringify(filters)}
      summary="Use governed dimensions to narrow this privacy-protected aggregate summary."
    >
      <div className="portal-counseling__filters-grid portal-reports__filters-grid">
        {select("portal-reports-graduation-year", "Graduation year", draft.graduationYear ?? "", "graduation_years", (value) => setDraft((current) => ({ ...current, graduationYear: value || null })))}
        {select("portal-reports-gt-college", "College", draft.college ?? "", "colleges", (value) => setDraft((current) => ({ ...current, college: value || null })))}
        {select("portal-reports-gt-program", "Program", draft.program ?? "", "programs", (value) => setDraft((current) => ({ ...current, program: value || null })))}
        {select("portal-reports-employment-status", "Employment status", draft.employmentStatus ?? "", "employment_statuses", (value) => setDraft((current) => ({ ...current, employmentStatus: value || null })))}
        {select("portal-reports-present-employment-category", "Present employment category", draft.presentEmploymentCategory ?? "", "present_employment_categories", (value) => setDraft((current) => ({ ...current, presentEmploymentCategory: value || null })))}
        {select("portal-reports-presently-employed", "Currently employed", draft.presentlyEmployed ?? "", "presently_employed", (value) => setDraft((current) => ({ ...current, presentlyEmployed: value || null })))}
        {select("portal-reports-first-job-related", "First-job relation", draft.firstJobRelated === null ? "" : String(draft.firstJobRelated), "first_job_related", (value) => setDraft((current) => ({ ...current, firstJobRelated: value ? value === "true" : null })))}
        {select("portal-reports-first-job-search-duration", "First-job search duration", draft.firstJobSearchDuration ?? "", "first_job_search_durations", (value) => setDraft((current) => ({ ...current, firstJobSearchDuration: value || null })))}
      </div>
      <div className="portal-counseling__filter-actions">
        <Button disabled={isPending || !options} size="sm" type="submit">Apply filters</Button>
        <a className="portal-counseling__filter-clear" href="/portal/reports?section=graduate-tracer">Clear</a>
      </div>
    </PortalFilterPanel>
  );
}

function AggregateReportResult({
  onExport,
  preview,
  section,
}: {
  onExport: () => void;
  preview: AggregateReportPreview;
  section: Exclude<ReportsSection, "profiling">;
}) {
  const title = section === "csm-feedback" ? "CSM / Service Feedback" : "Graduate Tracer summary";
  return (
    <PortalCollectionFrame aria-labelledby="portal-reports-aggregate-results-heading" className="portal-counseling__frame portal-reports__result-frame">
      <div className="portal-counseling__frame-heading portal-reports__result-heading">
        <div>
          <p className="portal-counseling__kicker">Aggregate report</p>
          <h2 id="portal-reports-aggregate-results-heading">{title}</h2>
        </div>
        <Button onClick={onExport} size="sm" type="button" variant="outline"><Download aria-hidden="true" />Download CSV</Button>
      </div>
      {Object.keys(preview.filters).length > 0 ? (
        <div className="portal-reports__context-summary">
          <dl>
            {Object.entries(preview.filters).map(([key, value]) => (
              <div key={key}><dt>{humanizeAggregateKey(key)}</dt><dd>{aggregateValue(value)}</dd></div>
            ))}
          </dl>
        </div>
      ) : null}
      <p className="portal-reports__privacy-notice" role="status">Privacy controls are enforced for this aggregate report. No student rows or raw responses are included.</p>
      {preview.sections.length === 0 ? (
        <div className="portal-counseling__empty" role="status">
          <h2>No aggregate sections are available.</h2>
          <p>There are no reportable values in the current authorized scope.</p>
        </div>
      ) : (
        <div className="portal-reports__matrices">
          {preview.sections.map((item) => <AggregateMatrix key={item.key} section={item} />)}
        </div>
      )}
    </PortalCollectionFrame>
  );
}

function AggregateReportsPage({
  navItems,
  section,
}: {
  navItems: readonly ReportsNavItem[];
  section: Exclude<ReportsSection, "profiling">;
}) {
  const { hasCapability, status: accessStatus } = usePortalAccess();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isCsm = section === "csm-feedback";
  const rawQuery = searchParams.toString();
  const rawFilters = useMemo(() => parseGraduateTracerFilters(searchParams), [searchParams]);
  const [reloadKey, setReloadKey] = useState(0);
  const optionsRequestKey = `${isCsm ? "csm" : "graduate-tracer"}:${reloadKey}`;
  const [optionsSnapshot, setOptionsSnapshot] = useState<KeyedReportsLoadState<GraduateTracerReportOptions>>({
    key: "",
    state: { kind: "loading" },
  });
  const optionsState: ReportsLoadState<GraduateTracerReportOptions | null> = isCsm
    ? { kind: "ready", value: null }
    : optionsSnapshot.key === optionsRequestKey
      ? optionsSnapshot.state
      : { kind: "loading" };
  const options = optionsState.kind === "ready" ? optionsState.value : null;
  const effectiveFilters = useMemo(
    () => isCsm ? rawFilters : canonicalizeGraduateTracerFilters(rawFilters, options),
    [isCsm, options, rawFilters],
  );
  const canonicalHref = isCsm
    ? "/portal/reports?section=csm-feedback"
    : graduateTracerHref(effectiveFilters);
  const canonicalQuery = canonicalHref.split("?")[1] ?? "";
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPurpose, setExportPurpose] = useState("");
  const [exportState, setExportState] = useState<ExportState>({ kind: "idle" });
  const exportIntentRef = useRef<GraduateTracerExportIntent | null>(null);
  const exportControllerRef = useRef<AbortController | null>(null);
  const canAccess = accessStatus === "ready" && hasCapability(
    isCsm ? PORTAL_CAPABILITIES.reportsCsmView : PORTAL_CAPABILITIES.reportsGraduateTracerView,
  );
  const previewFingerprint = JSON.stringify({ section, filters: effectiveFilters, reloadKey });
  const [previewSnapshot, setPreviewSnapshot] = useState<KeyedReportsLoadState<AggregateReportPreview>>({
    key: "",
    state: { kind: "loading" },
  });
  const previewState = previewSnapshot.key === previewFingerprint
    ? previewSnapshot.state
    : { kind: "loading" as const };

  useEffect(() => {
    if (rawQuery !== canonicalQuery) router.replace(canonicalHref, { scroll: false });
  }, [canonicalHref, canonicalQuery, rawQuery, router]);

  useEffect(() => {
    if (!canAccess || isCsm) return;
    const controller = new AbortController();
    let active = true;
    void getPortalGraduateTracerOptions(controller.signal)
      .then((value) => {
        if (active && !controller.signal.aborted) setOptionsSnapshot({ key: optionsRequestKey, state: { kind: "ready", value } });
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted || isAbortError(error)) return;
        setOptionsSnapshot({
          key: optionsRequestKey,
          state: error instanceof ReportsApiError && error.kind === "permission"
            ? { kind: "forbidden" }
            : { kind: "unavailable", error: error instanceof ReportsApiError && (error.kind === "rate_limited" || error.kind === "validation") ? error.kind : "unavailable" },
        });
      });
    return () => { active = false; controller.abort(); };
  }, [canAccess, isCsm, optionsRequestKey]);

  useEffect(() => {
    if (!canAccess || (!isCsm && optionsState.kind !== "ready")) return;
    const controller = new AbortController();
    let active = true;
    const request = isCsm
      ? getPortalCsmPreview(controller.signal)
      : getPortalGraduateTracerPreview(effectiveFilters, controller.signal);
    void request
      .then((value) => {
        if (active && !controller.signal.aborted) setPreviewSnapshot({ key: previewFingerprint, state: { kind: "ready", value } });
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted || isAbortError(error)) return;
        setPreviewSnapshot({
          key: previewFingerprint,
          state: error instanceof ReportsApiError && error.kind === "permission"
            ? { kind: "forbidden" }
            : { kind: "unavailable", error: error instanceof ReportsApiError && (error.kind === "rate_limited" || error.kind === "validation") ? error.kind : "unavailable" },
        });
      });
    return () => { active = false; controller.abort(); };
  }, [canAccess, effectiveFilters, isCsm, optionsState.kind, previewFingerprint]);

  const closeExport = () => {
    exportControllerRef.current?.abort();
    exportControllerRef.current = null;
    exportIntentRef.current = null;
    setExportOpen(false);
    setExportPurpose("");
    setExportState({ kind: "idle" });
  };

  const submitExport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const purpose = exportPurpose.trim();
    if (!purpose || purpose.length > MAX_PURPOSE_LENGTH) {
      setExportState({ kind: "error", message: "Enter a business purpose of up to 240 characters." });
      return;
    }
    let candidate: GraduateTracerExportIntent;
    try {
      candidate = isCsm
        ? createCsmExportIntent(purpose)
        : createGraduateTracerExportIntent(effectiveFilters, purpose);
    } catch (error) {
      setExportState({ kind: "error", message: exportErrorMessage(error, "csv") });
      return;
    }
    if (!exportIntentRef.current || exportIntentRef.current.fingerprint !== candidate.fingerprint) exportIntentRef.current = candidate;
    const intent = exportIntentRef.current;
    const controller = new AbortController();
    exportControllerRef.current = controller;
    setExportState({ kind: "pending", format: "csv" });
    try {
      const blob = isCsm
        ? await downloadPortalCsmExport(purpose, intent, controller.signal)
        : await downloadPortalGraduateTracerExport(effectiveFilters, purpose, intent, controller.signal);
      if (controller.signal.aborted) return;
      saveBlob(blob, "csv");
      exportIntentRef.current = null;
      setExportState({ kind: "success" });
    } catch (error) {
      if (isAbortError(error)) return;
      setExportState({ kind: "error", message: exportErrorMessage(error, "csv") });
    } finally {
      if (exportControllerRef.current === controller) exportControllerRef.current = null;
    }
  };

  const previewContent = !canAccess
    ? <PreviewStateFrame state="forbidden" />
    : !isCsm && optionsState.kind === "loading"
      ? <PreviewStateFrame state="loading" />
      : !isCsm && optionsState.kind === "forbidden"
        ? <PreviewStateFrame state="forbidden" />
        : !isCsm && optionsState.kind === "unavailable"
          ? <PreviewStateFrame error={optionsState.error} onRetry={() => setReloadKey((value) => value + 1)} state="unavailable" />
          : previewState.kind === "loading"
            ? <PreviewStateFrame state="loading" />
            : previewState.kind === "forbidden"
              ? <PreviewStateFrame state="forbidden" />
              : previewState.kind === "unavailable"
                ? <PreviewStateFrame error={previewState.error} onRetry={() => setReloadKey((value) => value + 1)} state="unavailable" />
                : <AggregateReportResult onExport={() => { setExportOpen(true); setExportPurpose(""); setExportState({ kind: "idle" }); exportIntentRef.current = null; }} preview={previewState.value} section={section} />;

  return (
    <section aria-labelledby="portal-reports-heading" className="portal-counseling portal-reports">
      <ReportsHeader />
      <div className="portal-counseling__workspace">
        <PortalWorkspaceNav activeValue={section} ariaLabel="Reports and profiling sections" items={navItems} />
        <div className="portal-counseling__active-content">
          {!isCsm ? <GraduateTracerFilterPanel key={JSON.stringify(effectiveFilters)} filters={effectiveFilters} options={options} /> : (
            <PortalFilterPanel action="/portal/reports?section=csm-feedback" accessibleLabel="CSM report scope" className="portal-counseling__filters portal-reports__filters" resetKey="csm-feedback" summary="This fixed CSM disclosure set uses your authorized reporting scope and does not accept user-controlled filters.">
              <p className="portal-reports__field-hint">The report is aggregate-only and privacy suppression is enforced by the server.</p>
            </PortalFilterPanel>
          )}
          {previewContent}
        </div>
      </div>
      <AlertDialog open={exportOpen} onOpenChange={(open) => { if (!open) closeExport(); }}>
        <AlertDialogContent className="portal-counseling__dialog portal-reports__export-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Download CSV report</AlertDialogTitle>
            <AlertDialogDescription>Enter a bounded business purpose. The report stays aggregate-only and the server will re-check scope, privacy suppression, and file access.</AlertDialogDescription>
          </AlertDialogHeader>
          {exportState.kind === "success" ? (
            <div className="portal-reports__export-success" role="status"><p>Your download is ready.</p><AlertDialogFooter><AlertDialogCancel>Close</AlertDialogCancel></AlertDialogFooter></div>
          ) : (
            <form onSubmit={submitExport}>
              <div className="portal-counseling__dialog-field">
                <Label htmlFor="portal-reports-aggregate-export-purpose">Business purpose</Label>
                <Input autoFocus id="portal-reports-aggregate-export-purpose" maxLength={MAX_PURPOSE_LENGTH} onChange={(event) => { setExportPurpose(event.target.value); exportIntentRef.current = null; if (exportState.kind === "error") setExportState({ kind: "idle" }); }} placeholder="e.g. Annual guidance planning" value={exportPurpose} />
              </div>
              {exportState.kind === "error" ? <p className="portal-counseling__dialog-error" role="alert">{exportState.message}</p> : null}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={exportState.kind === "pending"}>Cancel</AlertDialogCancel>
                <AlertDialogAction disabled={exportState.kind === "pending" || !exportPurpose.trim()} type="submit">{exportState.kind === "pending" ? "Preparing download…" : "Download CSV"}</AlertDialogAction>
              </AlertDialogFooter>
            </form>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export function PortalReportsLoading() {
  return (
    <section aria-busy="true" aria-labelledby="portal-reports-loading-heading" className="portal-counseling portal-reports portal-counseling--loading" role="status">
      <span className="sr-only" id="portal-reports-loading-heading">Loading reports and profiling</span>
      <ReportsHeader />
      <div className="portal-counseling__workspace">
        <div aria-hidden="true" className="compass-surface portal-workspace-nav portal-counseling__nav-skeleton" data-tone="subtle">
          {REPORTS_NAV.map((item) => <Skeleton className="portal-counseling__nav-skeleton-line" key={item.value} />)}
        </div>
        <div className="portal-counseling__active-content">
          <PortalFilterPanel action="/portal/reports?section=profiling" ariaBusy className="portal-counseling__filters" resetKey="reports-loading" summary={<Skeleton aria-hidden="true" as="span" className="portal-counseling__skeleton-summary" />}>
            <div aria-hidden="true" className="portal-counseling__filter-skeleton-grid">{Array.from({ length: 4 }, (_, index) => <Skeleton as="span" key={index} />)}</div>
          </PortalFilterPanel>
          <PortalCollectionFrame className="portal-counseling__frame">
            <div aria-hidden="true" className="portal-counseling__table-skeleton">{Array.from({ length: 6 }, (_, row) => <div className="portal-counseling__table-skeleton-row" key={row}>{Array.from({ length: 5 }, (_, cell) => <Skeleton as="span" key={cell} />)}</div>)}</div>
          </PortalCollectionFrame>
        </div>
      </div>
    </section>
  );
}

function ProfilingReportsPage({ navItems }: { navItems: readonly ReportsNavItem[] }) {
  const { hasCapability, status: accessStatus } = usePortalAccess();
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawQuery = searchParams.toString();
  const requested = "profiling";
  const visibleNavItems = navItems;
  const filters = useMemo(() => parseProfilingFilters(searchParams), [searchParams]);
  const [optionsState, setOptionsState] = useState<ReportsLoadState<ProfilingOptions>>({ kind: "loading" });
  const options = optionsState.kind === "ready" ? optionsState.value : null;
  const effectiveFilters = useMemo(() => canonicalizeProfilingFilters(filters, options), [filters, options]);
  const canonicalHref = reportsHref(effectiveFilters);
  const canonicalQuery = canonicalHref.split("?")[1] ?? "";
  const [previewState, setPreviewState] = useState<PreviewState>({ kind: "idle", fingerprint: "" });
  const [reloadKey, setReloadKey] = useState(0);
  const [exportFormat, setExportFormat] = useState<ProfilingExportFormat | null>(null);
  const [exportPurpose, setExportPurpose] = useState("");
  const [exportState, setExportState] = useState<ExportState>({ kind: "idle" });
  const exportIntentRef = useRef<ProfilingExportIntent | null>(null);
  const exportControllerRef = useRef<AbortController | null>(null);
  const canAccess = accessStatus === "ready" && hasCapability(PORTAL_CAPABILITIES.reportsProfilingView);
  const hasCompleteContext = Boolean(effectiveFilters.academicYear && effectiveFilters.college && effectiveFilters.yearLevel !== null);
  const previewFingerprint = JSON.stringify(effectiveFilters);

  useEffect(() => {
    if (rawQuery !== canonicalQuery) router.replace(canonicalHref, { scroll: false });
  }, [canonicalHref, canonicalQuery, rawQuery, router]);

  useEffect(() => {
    if (!canAccess) return;
    const controller = new AbortController();
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!active || controller.signal.aborted) return null;
        setOptionsState({ kind: "loading" });
        return getPortalProfilingOptions(controller.signal);
      })
      .then((value) => {
        if (value && active && !controller.signal.aborted) setOptionsState({ kind: "ready", value });
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted || isAbortError(error)) return;
        if (error instanceof ReportsApiError && error.kind === "permission") {
          setOptionsState({ kind: "forbidden" });
        } else {
          setOptionsState({
            kind: "unavailable",
            error: error instanceof ReportsApiError && (error.kind === "rate_limited" || error.kind === "validation") ? error.kind : "unavailable",
          });
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [canAccess, reloadKey]);

  useEffect(() => {
    if (!canAccess || optionsState.kind !== "ready" || !hasCompleteContext) {
      const controller = new AbortController();
      let active = true;
      void Promise.resolve().then(() => {
        if (active && !controller.signal.aborted) setPreviewState({ kind: "idle", fingerprint: previewFingerprint });
      });
      return () => {
        active = false;
        controller.abort();
      };
    }
    const controller = new AbortController();
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!active || controller.signal.aborted) return null;
        setPreviewState({ kind: "loading", fingerprint: previewFingerprint });
        return getPortalProfilingPreview(effectiveFilters, controller.signal);
      })
      .then((preview) => {
        if (preview && active && !controller.signal.aborted) setPreviewState({ kind: "ready", fingerprint: previewFingerprint, preview });
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted || isAbortError(error)) return;
        if (error instanceof ReportsApiError && error.kind === "permission") {
          setPreviewState({ kind: "forbidden", fingerprint: previewFingerprint });
        } else {
          setPreviewState({
            kind: "unavailable",
            error: error instanceof ReportsApiError && (error.kind === "rate_limited" || error.kind === "validation") ? error.kind : "unavailable",
            fingerprint: previewFingerprint,
          });
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [canAccess, effectiveFilters, hasCompleteContext, optionsState, previewFingerprint, reloadKey]);

  const openExport = (format: ProfilingExportFormat) => {
    setExportFormat(format);
    setExportPurpose("");
    setExportState({ kind: "idle" });
    exportIntentRef.current = null;
  };

  const closeExport = () => {
    exportControllerRef.current?.abort();
    exportControllerRef.current = null;
    exportIntentRef.current = null;
    setExportFormat(null);
    setExportPurpose("");
    setExportState({ kind: "idle" });
  };

  const submitExport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!exportFormat || !hasCompleteContext) return;
    const purpose = exportPurpose.trim();
    if (!purpose || purpose.length > MAX_PURPOSE_LENGTH) {
      setExportState({ kind: "error", message: "Enter a business purpose of up to 240 characters." });
      return;
    }
    let candidate: ProfilingExportIntent;
    try {
      candidate = createProfilingExportIntent(effectiveFilters, exportFormat, purpose);
    } catch (error) {
      setExportState({ kind: "error", message: exportErrorMessage(error, exportFormat) });
      return;
    }
    if (!exportIntentRef.current || exportIntentRef.current.fingerprint !== candidate.fingerprint) {
      exportIntentRef.current = candidate;
    }
    const intent = exportIntentRef.current;
    const controller = new AbortController();
    exportControllerRef.current = controller;
    setExportState({ kind: "pending", format: exportFormat });
    try {
      const blob = await downloadPortalProfilingExport(effectiveFilters, exportFormat, purpose, intent, controller.signal);
      if (controller.signal.aborted) return;
      saveBlob(blob, exportFormat);
      exportIntentRef.current = null;
      setExportState({ kind: "success" });
    } catch (error) {
      if (isAbortError(error)) return;
      setExportState({ kind: "error", message: exportErrorMessage(error, exportFormat) });
    } finally {
      if (exportControllerRef.current === controller) exportControllerRef.current = null;
    }
  };

  if (accessStatus === "loading") return <PortalReportsLoading />;
  if (accessStatus !== "ready") {
    return (
      <section aria-labelledby="portal-reports-access-heading" className="portal-counseling portal-reports portal-counseling--state">
        <ReportsHeader />
        <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state">
          <BarChart3 aria-hidden="true" className="portal-counseling__state-icon" />
          <h2 id="portal-reports-access-heading">Reports and profiling are temporarily unavailable.</h2>
          <p>Return to your workspace when the connection is ready.</p>
        </PortalCollectionFrame>
      </section>
    );
  }
  if (!canAccess) {
    return (
      <section aria-labelledby="portal-reports-access-heading" className="portal-counseling portal-reports portal-counseling--state">
        <ReportsHeader />
        <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state">
          <BarChart3 aria-hidden="true" className="portal-counseling__state-icon" />
          <h2 id="portal-reports-access-heading">Reports and profiling aren’t available for this account.</h2>
          <p>Return to your workspace to continue.</p>
        </PortalCollectionFrame>
      </section>
    );
  }

  const currentPreviewState = previewState.fingerprint === previewFingerprint ? previewState : { kind: "loading" as const, fingerprint: previewFingerprint };
  const previewContent: ReactNode = optionsState.kind === "loading"
    ? <PreviewStateFrame state="loading" />
    : optionsState.kind === "forbidden"
      ? <PreviewStateFrame state="forbidden" />
      : optionsState.kind === "unavailable"
        ? <PreviewStateFrame error={optionsState.error} onRetry={() => setReloadKey((value) => value + 1)} state="unavailable" />
        : !hasCompleteContext || currentPreviewState.kind === "idle"
          ? <PreviewStateFrame state="empty" />
          : currentPreviewState.kind === "loading"
            ? <PreviewStateFrame state="loading" />
            : currentPreviewState.kind === "forbidden"
              ? <PreviewStateFrame state="forbidden" />
              : currentPreviewState.kind === "unavailable"
                ? <PreviewStateFrame error={currentPreviewState.error} onRetry={() => setReloadKey((value) => value + 1)} state="unavailable" />
                : <ProfilingResult onExport={openExport} preview={currentPreviewState.preview} />;

  return (
    <section aria-labelledby="portal-reports-heading" className="portal-counseling portal-reports">
      <ReportsHeader />
      <div className="portal-counseling__workspace">
        <PortalWorkspaceNav activeValue={requested} ariaLabel="Reports and profiling sections" items={visibleNavItems} />
        <div className="portal-counseling__active-content">
          <ProfilingFilterPanel key={previewFingerprint} filters={effectiveFilters} options={options} />
          {previewContent}
        </div>
      </div>
      <AlertDialog open={exportFormat !== null} onOpenChange={(open) => { if (!open) closeExport(); }}>
        <AlertDialogContent className="portal-counseling__dialog portal-reports__export-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Download {exportFormat?.toUpperCase()} report</AlertDialogTitle>
            <AlertDialogDescription>Enter a bounded business purpose. The report stays aggregate-only and the server will re-check scope, privacy suppression, and file access.</AlertDialogDescription>
          </AlertDialogHeader>
          {exportState.kind === "success" ? (
            <div className="portal-reports__export-success" role="status">
              <p>Your download is ready.</p>
              <AlertDialogFooter><AlertDialogCancel>Close</AlertDialogCancel></AlertDialogFooter>
            </div>
          ) : (
            <form onSubmit={submitExport}>
              <div className="portal-counseling__dialog-field">
                <Label htmlFor="portal-reports-export-purpose">Business purpose</Label>
                <Input
                  autoFocus
                  id="portal-reports-export-purpose"
                  maxLength={MAX_PURPOSE_LENGTH}
                  onChange={(event) => {
                    setExportPurpose(event.target.value);
                    exportIntentRef.current = null;
                    if (exportState.kind === "error") setExportState({ kind: "idle" });
                  }}
                  placeholder="e.g. Annual guidance planning"
                  value={exportPurpose}
                />
              </div>
              {exportState.kind === "error" ? <p className="portal-counseling__dialog-error" role="alert">{exportState.message}</p> : null}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={exportState.kind === "pending"}>Cancel</AlertDialogCancel>
                <AlertDialogAction disabled={exportState.kind === "pending" || !exportPurpose.trim()} type="submit">
                  {exportState.kind === "pending" ? "Preparing download…" : `Download ${exportFormat?.toUpperCase()}`}
                </AlertDialogAction>
              </AlertDialogFooter>
            </form>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export function PortalReportsPage() {
  const { hasCapability, status: accessStatus } = usePortalAccess();
  const searchParams = useSearchParams();
  const router = useRouter();
  const requestedSection = (searchParams.get("section") ?? "profiling") as ReportsSection;
  const authorizedNavItems = useMemo(() => REPORTS_NAV_ITEMS.filter((item) => {
    if (item.value === "profiling") return hasCapability(PORTAL_CAPABILITIES.reportsProfilingView);
    if (item.value === "csm-feedback") return hasCapability(PORTAL_CAPABILITIES.reportsCsmView);
    return hasCapability(PORTAL_CAPABILITIES.reportsGraduateTracerView);
  }), [hasCapability]);
  const firstAuthorized = authorizedNavItems[0];
  const activeSection = authorizedNavItems.some((item) => item.value === requestedSection)
    ? requestedSection
    : firstAuthorized?.value;

  useEffect(() => {
    if (accessStatus !== "ready" || !firstAuthorized || activeSection === requestedSection) return;
    router.replace(firstAuthorized.href, { scroll: false });
  }, [accessStatus, activeSection, firstAuthorized, requestedSection, router]);

  if (accessStatus === "loading") return <PortalReportsLoading />;
  if (accessStatus !== "ready") {
    return (
      <section aria-labelledby="portal-reports-access-heading" className="portal-counseling portal-reports portal-counseling--state">
        <ReportsHeader />
        <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state">
          <BarChart3 aria-hidden="true" className="portal-counseling__state-icon" />
          <h2 id="portal-reports-access-heading">Reports are temporarily unavailable.</h2>
          <p>Return to your workspace when the connection is ready.</p>
        </PortalCollectionFrame>
      </section>
    );
  }
  if (!firstAuthorized || !activeSection) {
    return (
      <section aria-labelledby="portal-reports-access-heading" className="portal-counseling portal-reports portal-counseling--state">
        <ReportsHeader />
        <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state">
          <BarChart3 aria-hidden="true" className="portal-counseling__state-icon" />
          <h2 id="portal-reports-access-heading">Reports aren’t available for this account.</h2>
          <p>Return to your workspace to continue.</p>
        </PortalCollectionFrame>
      </section>
    );
  }
  if (activeSection === "profiling") return <ProfilingReportsPage navItems={authorizedNavItems} />;
  return <AggregateReportsPage navItems={authorizedNavItems} section={activeSection} />;
}
