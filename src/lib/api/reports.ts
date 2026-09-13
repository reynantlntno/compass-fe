import { cookieSessionMutationOptions, cookieSessionReadOptions } from "@/lib/api/auth";
import {
  reportsExportCreate,
  reportsExportDownload,
  reportsExportGenerate,
  reportsCsmPreview,
  reportsGraduateTracerOptions,
  reportsGraduateTracerPreview,
  reportsProfilingOptions,
  reportsProfilingPreview,
} from "@/lib/api/generated/reports/reports";
import { withIdempotencyKey, createIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";

export const PROFILING_REPORT_KEY = "students_profile" as const;
export const PROFILING_EXPORT_FORMATS = ["csv", "pdf"] as const;
export type ProfilingExportFormat = (typeof PROFILING_EXPORT_FORMATS)[number];

export type ProfilingFilters = {
  academicYear: string | null;
  college: string | null;
  yearLevel: number | null;
  campus: string | null;
};

export type ProfilingContextOption = {
  academic_year: string;
  college: string;
  year_level: number;
  campus: string | null;
};

export type ProfilingOptions = {
  contexts: ProfilingContextOption[];
};

export type ProfilingScalar = string | number | boolean | null;
export type AggregateScalar = ProfilingScalar;

export type AggregateReportChoice = {
  value: string;
  label: string;
};

export type AggregateReportColumn = {
  key: string;
  label: string;
};

export type AggregateReportRow = {
  key: string;
  label: string;
  values: Record<string, AggregateScalar>;
};

export type AggregateReportSection = {
  key: string;
  title: string;
  columns: AggregateReportColumn[];
  rows: AggregateReportRow[];
  suppression_notice: string | null;
};

export type AggregateReportPreview = {
  report_key: string;
  filters: Record<string, AggregateScalar>;
  sections: AggregateReportSection[];
  privacy_controls_enforced: true;
};

export type GraduateTracerReportOptions = {
  graduation_years: AggregateReportChoice[];
  colleges: AggregateReportChoice[];
  programs: AggregateReportChoice[];
  employment_statuses: AggregateReportChoice[];
  present_employment_categories: AggregateReportChoice[];
  presently_employed: AggregateReportChoice[];
  first_job_related: AggregateReportChoice[];
  first_job_search_durations: AggregateReportChoice[];
};

export type GraduateTracerFilters = {
  graduationYear: string | null;
  college: string | null;
  program: string | null;
  employmentStatus: string | null;
  presentEmploymentCategory: string | null;
  presentlyEmployed: string | null;
  firstJobRelated: boolean | null;
  firstJobSearchDuration: string | null;
};

export type ProfilingLabel = {
  key: string;
  label: string;
};

export type ProfilingColumn = ProfilingLabel;

export type ProfilingRow = {
  code: string;
  label: string;
  program_counts: Record<string, ProfilingScalar>;
  total: ProfilingScalar;
  percentage: ProfilingScalar;
  is_total: boolean;
  values: Record<string, ProfilingScalar>;
};

export type ProfilingSection = {
  metric_key: string;
  title: string;
  row_heading: string | null;
  columns: ProfilingColumn[];
  program_columns: ProfilingColumn[];
  rows: ProfilingRow[];
  cohort_total: number;
  suppression_notice: string | null;
};

export type ProfilingReportContext = {
  academic_year: string;
  campus: string | null;
  college: string;
  year_level: number;
  mapping_version: string;
  program_labels: ProfilingLabel[];
  cohort_total: number;
};

export type ProfilingPreview = {
  report_context: ProfilingReportContext;
  sections: ProfilingSection[];
  privacy_controls_enforced: true;
};

export type ReportsApiErrorKind =
  | "conflict"
  | "permission"
  | "rate_limited"
  | "unavailable"
  | "validation";

export class ReportsApiError extends Error {
  readonly kind: ReportsApiErrorKind;

  constructor(kind: ReportsApiErrorKind) {
    super("The profiling report request could not be completed.");
    this.name = "ReportsApiError";
    this.kind = kind;
  }
}

type GeneratedResponse = { data: unknown; status: number };

const MAX_FILTER_LENGTH = 100;
const MAX_TEXT_LENGTH = 160;
const MAX_LIST_LENGTH = 500;
const MAX_YEAR_LEVEL = 100;
const MAX_PURPOSE_LENGTH = 240;
const SAFE_KEY = /^[A-Za-z][A-Za-z0-9_]{0,79}$/;
const FORBIDDEN_KEY = /(email|phone|answer|response|metadata|secret|token|password|id|identifier|control|actor|encrypted|narrative|note)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function boundedString(value: unknown, max: number, required = true): value is string {
  return typeof value === "string" && value.length <= max && (!required || value.trim().length > 0);
}

function nullableString(value: unknown, max: number) {
  return value === null || value === undefined || boundedString(value, max, false);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}

function safeScalar(value: unknown): value is ProfilingScalar {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function safeKey(value: unknown): value is string {
  return boundedString(value, 80) && SAFE_KEY.test(value) && !FORBIDDEN_KEY.test(value);
}

function safeMapping(value: unknown): value is Record<string, ProfilingScalar> {
  if (!isRecord(value) || Object.keys(value).length > MAX_LIST_LENGTH) return false;
  return Object.entries(value).every(([key, item]) => safeKey(key) && safeScalar(item));
}

function parseLabel(value: unknown): ProfilingLabel | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["key", "label"]) || !safeKey(value.key) || !boundedString(value.label, MAX_TEXT_LENGTH)) return null;
  return { key: value.key, label: value.label };
}

function parseOptions(value: unknown): ProfilingOptions | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["contexts"]) || !Array.isArray(value.contexts) || value.contexts.length > MAX_LIST_LENGTH) return null;
  const contexts = value.contexts.flatMap((item) => {
    if (!isRecord(item) || !boundedString(item.academic_year, MAX_FILTER_LENGTH) ||
        !hasOnlyKeys(item, ["academic_year", "college", "year_level", "campus"]) ||
        !boundedString(item.college, MAX_FILTER_LENGTH) ||
        typeof item.year_level !== "number" || !Number.isSafeInteger(item.year_level) ||
        item.year_level < 1 || item.year_level > MAX_YEAR_LEVEL || !nullableString(item.campus, MAX_FILTER_LENGTH)) {
      return [];
    }
    return [{
      academic_year: item.academic_year,
      college: item.college,
      year_level: item.year_level,
      campus: typeof item.campus === "string" && item.campus.trim() ? item.campus : null,
    }];
  });
  return contexts.length === value.contexts.length ? { contexts } : null;
}

function parseColumn(value: unknown): ProfilingColumn | null {
  return parseLabel(value);
}

function parseRow(value: unknown): ProfilingRow | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["code", "label", "program_counts", "total", "percentage", "is_total", "values"]) || !safeKey(value.code) || !boundedString(value.label, MAX_TEXT_LENGTH) ||
      !safeMapping(value.program_counts) || !safeScalar(value.total) || !safeScalar(value.percentage) ||
      typeof value.is_total !== "boolean" || !safeMapping(value.values)) {
    return null;
  }
  return {
    code: value.code,
    label: value.label,
    program_counts: value.program_counts,
    total: value.total,
    percentage: value.percentage,
    is_total: value.is_total,
    values: value.values,
  };
}

function parseSection(value: unknown): ProfilingSection | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["metric_key", "title", "row_heading", "columns", "program_columns", "rows", "cohort_total", "suppression_notice"]) || !safeKey(value.metric_key) || !boundedString(value.title, MAX_TEXT_LENGTH) ||
      !nullableString(value.row_heading, MAX_TEXT_LENGTH) || !Array.isArray(value.columns) ||
      !Array.isArray(value.program_columns) || !Array.isArray(value.rows) ||
      value.columns.length > MAX_LIST_LENGTH || value.program_columns.length > MAX_LIST_LENGTH ||
      value.rows.length > MAX_LIST_LENGTH || typeof value.cohort_total !== "number" ||
      !Number.isSafeInteger(value.cohort_total) || value.cohort_total < 0 ||
      !nullableString(value.suppression_notice, MAX_TEXT_LENGTH)) {
    return null;
  }
  const columns = value.columns.map(parseColumn);
  const programColumns = value.program_columns.map(parseColumn);
  const rows = value.rows.map(parseRow);
  if (columns.some((item) => item === null) || programColumns.some((item) => item === null) || rows.some((item) => item === null)) return null;
  return {
    metric_key: value.metric_key,
    title: value.title,
    row_heading: typeof value.row_heading === "string" ? value.row_heading : null,
    columns: columns as ProfilingColumn[],
    program_columns: programColumns as ProfilingColumn[],
    rows: rows as ProfilingRow[],
    cohort_total: value.cohort_total,
    suppression_notice: typeof value.suppression_notice === "string" ? value.suppression_notice : null,
  };
}

function parsePreview(value: unknown): ProfilingPreview | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["report_context", "sections", "privacy_controls_enforced"]) || !isRecord(value.report_context) ||
      !hasOnlyKeys(value.report_context, ["academic_year", "campus", "college", "year_level", "mapping_version", "program_labels", "cohort_total"]) || !Array.isArray(value.sections) ||
      value.sections.length > MAX_LIST_LENGTH || value.privacy_controls_enforced !== true) return null;
  const context = value.report_context;
  if (!boundedString(context.academic_year, MAX_FILTER_LENGTH) || !nullableString(context.campus, MAX_FILTER_LENGTH) ||
      !boundedString(context.college, MAX_FILTER_LENGTH) || typeof context.year_level !== "number" ||
      !Number.isSafeInteger(context.year_level) || context.year_level < 1 || context.year_level > MAX_YEAR_LEVEL ||
      !boundedString(context.mapping_version, MAX_FILTER_LENGTH) || !Array.isArray(context.program_labels) ||
      context.program_labels.length > MAX_LIST_LENGTH || typeof context.cohort_total !== "number" ||
      !Number.isSafeInteger(context.cohort_total) || context.cohort_total < 0) return null;
  const labels = context.program_labels.map(parseLabel);
  const sections = value.sections.map(parseSection);
  if (labels.some((item) => item === null) || sections.some((item) => item === null)) return null;
  return {
    report_context: {
      academic_year: context.academic_year,
      campus: typeof context.campus === "string" ? context.campus : null,
      college: context.college,
      year_level: context.year_level,
      mapping_version: context.mapping_version,
      program_labels: labels as ProfilingLabel[],
      cohort_total: context.cohort_total,
    },
    sections: sections as ProfilingSection[],
    privacy_controls_enforced: true,
  };
}

function parseChoice(value: unknown): AggregateReportChoice | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["value", "label"]) ||
      !boundedString(value.value, MAX_FILTER_LENGTH) || !boundedString(value.label, MAX_TEXT_LENGTH)) {
    return null;
  }
  return { value: value.value, label: value.label };
}

function parseAggregateOptions(value: unknown): GraduateTracerReportOptions | null {
  const keys = [
    "graduation_years",
    "colleges",
    "programs",
    "employment_statuses",
    "present_employment_categories",
    "presently_employed",
    "first_job_related",
    "first_job_search_durations",
  ] as const;
  if (!isRecord(value) || !hasOnlyKeys(value, keys)) return null;
  const parsed = Object.fromEntries(keys.map((key) => {
    const raw = value[key];
    if (!Array.isArray(raw) || raw.length > MAX_LIST_LENGTH) return [key, null];
    const choices = raw.map(parseChoice);
    return [key, choices.every((choice) => choice !== null) ? choices : null];
  }));
  if (Object.values(parsed).some((item) => item === null)) return null;
  return parsed as GraduateTracerReportOptions;
}

function parseAggregatePreview(value: unknown): AggregateReportPreview | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["report_key", "filters", "sections", "privacy_controls_enforced"]) ||
      !boundedString(value.report_key, MAX_FILTER_LENGTH) || !isRecord(value.filters) ||
      !Array.isArray(value.sections) || value.sections.length > MAX_LIST_LENGTH ||
      value.privacy_controls_enforced !== true) return null;
  if (!Object.entries(value.filters).every(([key, item]) => safeKey(key) && safeScalar(item))) return null;
  const sections = value.sections.map((item) => {
    if (!isRecord(item) || !hasOnlyKeys(item, ["key", "title", "columns", "rows", "suppression_notice"]) ||
        !safeKey(item.key) || !boundedString(item.title, MAX_TEXT_LENGTH) ||
        !Array.isArray(item.columns) || !Array.isArray(item.rows) ||
        item.columns.length > MAX_LIST_LENGTH || item.rows.length > MAX_LIST_LENGTH ||
        !nullableString(item.suppression_notice, MAX_TEXT_LENGTH)) return null;
    const columns = item.columns.map((column) => {
      if (!isRecord(column) || !hasOnlyKeys(column, ["key", "label"]) || !safeKey(column.key) || !boundedString(column.label, MAX_TEXT_LENGTH)) return null;
      return { key: column.key, label: column.label };
    });
    const rows = item.rows.map((row) => {
      if (!isRecord(row) || !hasOnlyKeys(row, ["key", "label", "values"]) || !safeKey(row.key) ||
          !boundedString(row.label, MAX_TEXT_LENGTH) || !safeMapping(row.values)) return null;
      return { key: row.key, label: row.label, values: row.values };
    });
    if (columns.some((column) => column === null) || rows.some((row) => row === null)) return null;
    return {
      key: item.key,
      title: item.title,
      columns: columns as AggregateReportColumn[],
      rows: rows as AggregateReportRow[],
      suppression_notice: typeof item.suppression_notice === "string" ? item.suppression_notice : null,
    };
  });
  if (sections.some((section) => section === null)) return null;
  return {
    report_key: value.report_key,
    filters: value.filters as Record<string, AggregateScalar>,
    sections: sections as AggregateReportSection[],
    privacy_controls_enforced: true,
  };
}

function errorKind(status: number): ReportsApiErrorKind {
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 422) return "validation";
  if (status === 401 || status === 403 || status === 404) return "permission";
  return "unavailable";
}

async function readRequest<T>(request: Promise<GeneratedResponse>, parse: (value: unknown) => T | null): Promise<T> {
  try {
    const response = await request;
    if (response.status >= 200 && response.status < 300) {
      const value = parse(response.data);
      if (value !== null) return value;
    }
    throw new ReportsApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof ReportsApiError) throw error;
    throw new ReportsApiError("unavailable");
  }
}

async function readBlobRequest(request: Promise<GeneratedResponse>) {
  try {
    const response = await request;
    if (response.status === 200 && response.data instanceof Blob) return response.data;
    throw new ReportsApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof ReportsApiError) throw error;
    throw new ReportsApiError("unavailable");
  }
}

function normalizeFilter(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (normalized.length > MAX_FILTER_LENGTH) throw new ReportsApiError("validation");
  return normalized;
}

function parseFilter(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized && normalized.length <= MAX_FILTER_LENGTH ? normalized : null;
}

export function parseProfilingFilters(params: { get: (name: string) => string | null }): ProfilingFilters {
  const academicYear = parseFilter(params.get("academic_year"));
  const college = parseFilter(params.get("college"));
  const campus = parseFilter(params.get("campus"));
  const rawYearLevel = params.get("year_level")?.trim() ?? "";
  if (!rawYearLevel) return { academicYear, college, yearLevel: null, campus: null };
  if (!/^\d{1,3}$/.test(rawYearLevel)) return { academicYear, college, yearLevel: null, campus: null };
  const yearLevel = Number(rawYearLevel);
  return yearLevel >= 1 && yearLevel <= MAX_YEAR_LEVEL
    ? { academicYear, college, yearLevel, campus }
    : { academicYear, college, yearLevel: null, campus: null };
}

function previewParams(filters: ProfilingFilters) {
  const academicYear = normalizeFilter(filters.academicYear);
  const college = normalizeFilter(filters.college);
  if (!academicYear || !college || filters.yearLevel === null) throw new ReportsApiError("validation");
  const campus = normalizeFilter(filters.campus);
  return {
    academic_year: academicYear,
    college,
    year_level: filters.yearLevel,
    ...(campus ? { campus } : {}),
  };
}

export function getPortalProfilingOptions(signal?: AbortSignal) {
  return readRequest(reportsProfilingOptions(cookieSessionReadOptions(signal)), parseOptions);
}

export function getPortalProfilingPreview(filters: ProfilingFilters, signal?: AbortSignal) {
  return readRequest(reportsProfilingPreview(previewParams(filters), cookieSessionReadOptions(signal)), parsePreview);
}

export function getPortalCsmPreview(signal?: AbortSignal) {
  return readRequest(reportsCsmPreview(cookieSessionReadOptions(signal)), parseAggregatePreview);
}

export function createCsmExportIntent(purpose: string): GraduateTracerExportIntent {
  const normalizedPurpose = purpose.trim();
  if (!normalizedPurpose || normalizedPurpose.length > MAX_PURPOSE_LENGTH) throw new ReportsApiError("validation");
  return {
    fingerprint: JSON.stringify({ reportKey: "feedback_csm_aggregate", params: {}, format: "csv", purpose: normalizedPurpose }),
    createKey: createIdempotencyKey(),
    generateKey: createIdempotencyKey(),
  };
}

export async function downloadPortalCsmExport(
  purpose: string,
  intent: GraduateTracerExportIntent,
  signal?: AbortSignal,
) {
  const normalizedPurpose = purpose.trim();
  const fingerprint = JSON.stringify({ reportKey: "feedback_csm_aggregate", params: {}, format: "csv", purpose: normalizedPurpose });
  if (intent.fingerprint !== fingerprint) throw new ReportsApiError("validation");
  try {
    const mutationOptions = await cookieSessionMutationOptions(signal);
    const created = await readRequest(
      reportsExportCreate(
        {
          report_key: "feedback_csm_aggregate",
          export_format: "csv",
          filters: {},
          purpose: normalizedPurpose,
        },
        withIdempotencyKey(intent.createKey, mutationOptions),
      ),
      parseExportIdentifier,
    );
    await mutateExport(
      reportsExportGenerate(
        created,
        withIdempotencyKey(intent.generateKey, await cookieSessionMutationOptions(signal)),
      ),
    );
    return await readBlobRequest(reportsExportDownload(created, cookieSessionReadOptions(signal)));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof ReportsApiError) throw error;
    throw new ReportsApiError("unavailable");
  }
}

export function parseGraduateTracerFilters(params: { get: (name: string) => string | null }): GraduateTracerFilters {
  const rawFirstJobRelated = params.get("first_job_related")?.trim().toLowerCase() ?? "";
  return {
    graduationYear: parseFilter(params.get("graduation_year")),
    college: parseFilter(params.get("college")),
    program: parseFilter(params.get("program")),
    employmentStatus: parseFilter(params.get("employment_status"))?.toUpperCase() ?? null,
    presentEmploymentCategory: parseFilter(params.get("present_employment_category")),
    presentlyEmployed: parseFilter(params.get("presently_employed")),
    firstJobRelated: rawFirstJobRelated === "true" ? true : rawFirstJobRelated === "false" ? false : null,
    firstJobSearchDuration: parseFilter(params.get("first_job_search_duration")),
  };
}

export function getPortalGraduateTracerOptions(signal?: AbortSignal) {
  return readRequest(reportsGraduateTracerOptions(cookieSessionReadOptions(signal)), parseAggregateOptions);
}

function graduateTracerPreviewParams(filters: GraduateTracerFilters) {
  const params: Record<string, string> = {};
  const values: Record<string, string | null> = {
    graduation_year: normalizeFilter(filters.graduationYear),
    college: normalizeFilter(filters.college),
    program: normalizeFilter(filters.program),
    employment_status: normalizeFilter(filters.employmentStatus)?.toUpperCase() ?? null,
    present_employment_category: normalizeFilter(filters.presentEmploymentCategory),
    presently_employed: normalizeFilter(filters.presentlyEmployed),
    first_job_search_duration: normalizeFilter(filters.firstJobSearchDuration),
  };
  Object.entries(values).forEach(([key, value]) => {
    if (value) params[key] = value;
  });
  if (filters.firstJobRelated !== null) params.first_job_related = String(filters.firstJobRelated);
  return params;
}

export function getPortalGraduateTracerPreview(filters: GraduateTracerFilters, signal?: AbortSignal) {
  return readRequest(reportsGraduateTracerPreview(graduateTracerPreviewParams(filters), cookieSessionReadOptions(signal)), parseAggregatePreview);
}

export type ProfilingExportIntent = {
  fingerprint: string;
  createKey: IdempotencyKey;
  generateKey: IdempotencyKey;
};

export function createProfilingExportIntent(
  filters: ProfilingFilters,
  format: ProfilingExportFormat,
  purpose: string,
): ProfilingExportIntent {
  const normalizedPurpose = purpose.trim();
  if (!PROFILING_EXPORT_FORMATS.includes(format) || !normalizedPurpose || normalizedPurpose.length > MAX_PURPOSE_LENGTH) {
    throw new ReportsApiError("validation");
  }
  const params = previewParams(filters);
  return {
    fingerprint: JSON.stringify({ params, format, purpose: normalizedPurpose }),
    createKey: createIdempotencyKey(),
    generateKey: createIdempotencyKey(),
  };
}

function parseExportIdentifier(value: unknown) {
  if (!isRecord(value) || typeof value.id !== "string" || value.id.length < 8 || value.id.length > 80) return null;
  return value.id;
}

async function mutateExport(request: Promise<GeneratedResponse>) {
  const response = await request;
  if (response.status >= 200 && response.status < 300) return;
  throw new ReportsApiError(errorKind(response.status));
}

export async function downloadPortalProfilingExport(
  filters: ProfilingFilters,
  format: ProfilingExportFormat,
  purpose: string,
  intent: ProfilingExportIntent,
  signal?: AbortSignal,
) {
  const normalizedPurpose = purpose.trim();
  const params = previewParams(filters);
  const fingerprint = JSON.stringify({ params, format, purpose: normalizedPurpose });
  if (intent.fingerprint !== fingerprint) throw new ReportsApiError("validation");
  try {
    const mutationOptions = await cookieSessionMutationOptions(signal);
    const created = await readRequest(
      reportsExportCreate(
        {
          report_key: PROFILING_REPORT_KEY,
          export_format: format,
          filters: params,
          purpose: normalizedPurpose,
        },
        withIdempotencyKey(intent.createKey, mutationOptions),
      ),
      parseExportIdentifier,
    );
    await mutateExport(
      reportsExportGenerate(
        created,
        withIdempotencyKey(intent.generateKey, await cookieSessionMutationOptions(signal)),
      ),
    );
    return await readBlobRequest(reportsExportDownload(created, cookieSessionReadOptions(signal)));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof ReportsApiError) throw error;
    throw new ReportsApiError("unavailable");
  }
}

export type GraduateTracerExportIntent = ProfilingExportIntent;

export function createGraduateTracerExportIntent(
  filters: GraduateTracerFilters,
  purpose: string,
): GraduateTracerExportIntent {
  const normalizedPurpose = purpose.trim();
  if (!normalizedPurpose || normalizedPurpose.length > MAX_PURPOSE_LENGTH) throw new ReportsApiError("validation");
  const params = graduateTracerPreviewParams(filters);
  return {
    fingerprint: JSON.stringify({ reportKey: "graduate_tracer_outcomes_summary", params, format: "csv", purpose: normalizedPurpose }),
    createKey: createIdempotencyKey(),
    generateKey: createIdempotencyKey(),
  };
}

export async function downloadPortalGraduateTracerExport(
  filters: GraduateTracerFilters,
  purpose: string,
  intent: GraduateTracerExportIntent,
  signal?: AbortSignal,
) {
  const normalizedPurpose = purpose.trim();
  const params = graduateTracerPreviewParams(filters);
  const fingerprint = JSON.stringify({ reportKey: "graduate_tracer_outcomes_summary", params, format: "csv", purpose: normalizedPurpose });
  if (intent.fingerprint !== fingerprint) throw new ReportsApiError("validation");
  try {
    const mutationOptions = await cookieSessionMutationOptions(signal);
    const created = await readRequest(
      reportsExportCreate(
        {
          report_key: "graduate_tracer_outcomes_summary",
          export_format: "csv",
          filters: params,
          purpose: normalizedPurpose,
        },
        withIdempotencyKey(intent.createKey, mutationOptions),
      ),
      parseExportIdentifier,
    );
    await mutateExport(
      reportsExportGenerate(
        created,
        withIdempotencyKey(intent.generateKey, await cookieSessionMutationOptions(signal)),
      ),
    );
    return await readBlobRequest(reportsExportDownload(created, cookieSessionReadOptions(signal)));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof ReportsApiError) throw error;
    throw new ReportsApiError("unavailable");
  }
}
