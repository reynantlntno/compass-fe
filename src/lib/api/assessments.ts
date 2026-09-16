import {
  assessmentsArchive,
  assessmentsCreate,
  assessmentsDetail,
  assessmentsFileAttach,
  assessmentsFileDownload,
  assessmentsFileMetadata,
  assessmentsInstruments,
  assessmentsInterpretation,
  assessmentsList,
  assessmentsRecord,
  assessmentsRelease,
  assessmentsReplacementOptions,
  assessmentsReview,
  assessmentsSubmitReview,
  assessmentsSupersede,
  assessmentsUpdate,
  assessmentsVoid,
} from "@/lib/api/generated/assessments/assessments";
import { profilesStaffStudents } from "@/lib/api/generated/profiles/profiles";
import type {
  AssessmentsListParams,
  AssessmentsReplacementOptionsParams,
  CreateSchema,
  RecordSchema,
  ReviewSchema,
  UpdateSchema,
} from "@/lib/api/generated/model";
import { cookieSessionMutationOptions, cookieSessionReadOptions } from "@/lib/api/auth";
import { withIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";
import { isOptionalResourceVersion } from "@/lib/api/resource-version";

export const ASSESSMENTS_PAGE_SIZE = 20;

export const ASSESSMENT_STATUSES = [
  "draft",
  "recorded",
  "under_review",
  "reviewed",
  "released_to_student",
  "superseded",
  "voided",
  "archived",
] as const;
export const ASSESSMENT_CATEGORIES = [
  "academic",
  "career",
  "guidance",
  "wellness_screening_non_diagnostic",
  "office_approved_other",
] as const;
export const ASSESSMENT_ORDERS = ["recent", "oldest"] as const;
export const ASSESSMENT_VISIBILITIES = [
  "counselor_only",
  "head_guidance_review",
  "released_to_student_safe_summary",
] as const;

export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];
export type AssessmentCategory = (typeof ASSESSMENT_CATEGORIES)[number];
export type AssessmentOrder = (typeof ASSESSMENT_ORDERS)[number];
export type AssessmentVisibility = (typeof ASSESSMENT_VISIBILITIES)[number];

export type AssessmentListFilters = {
  q: string | null;
  status: string | null;
  statuses: AssessmentStatus[];
  category: AssessmentCategory | null;
  instrument: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  order: AssessmentOrder;
};

export type PortalAssessmentInstrument = {
  key: string;
  title: string;
  category: AssessmentCategory;
  allows_scores: boolean;
  allows_interpretation: boolean;
  active: boolean;
};

export type PortalAssessment = {
  student_display_name: string;
  student_number: string | null;
  instrument: PortalAssessmentInstrument;
  status: AssessmentStatus;
  administered_at: string | null;
  updated_at: string | null;
  resource_version: string | null;
  reviewed_at: string | null;
  released_to_student: boolean;
  released_at: string | null;
  interpretation_visibility: AssessmentVisibility;
  has_protected_file: boolean;
};

export type PortalAssessmentSensitive = PortalAssessment & {
  raw_score: string | null;
  scaled_score: string | null;
  score_label: string | null;
  interpretation: string;
};

export type PortalAssessmentPage = {
  items: PortalAssessment[];
  page: number;
  page_size: number;
  total: number;
};

export type PortalAssessmentFileMetadata = {
  filename: string | null;
  content_type: string;
  size_bytes: number;
  classification: string;
  purpose: string;
  status: string;
};

export type PortalAssessmentStudentOption = {
  label: string;
  selection_token: string;
};

export type PortalAssessmentCreateInput = {
  student_selection_token: string;
  instrument_key: string;
  administered_at?: string | null;
  source_form_reference?: string | null;
};

export type PortalAssessmentInstrumentOption = PortalAssessmentInstrument;

export type AssessmentsApiErrorKind =
  | "conflict"
  | "permission"
  | "rate_limited"
  | "unavailable"
  | "validation";

export class AssessmentsApiError extends Error {
  readonly kind: AssessmentsApiErrorKind;

  constructor(kind: AssessmentsApiErrorKind) {
    super("The assessments workspace request could not be completed.");
    this.name = "AssessmentsApiError";
    this.kind = kind;
  }
}

type GeneratedResponse = { data: unknown; status: number };
const MAX_PAGE = 100_000;
const MAX_QUERY_LENGTH = 120;
const MAX_FILTER_LENGTH = 100;
const MAX_TEXT_LENGTH = 10_000;
const STATUS_SET = new Set<string>(ASSESSMENT_STATUSES);
const CATEGORY_SET = new Set<string>(ASSESSMENT_CATEGORIES);
const ORDER_SET = new Set<string>(ASSESSMENT_ORDERS);
const recordKeys = new WeakMap<PortalAssessment, number>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function boundedString(value: unknown, max: number, allowEmpty = false): value is string {
  return typeof value === "string" && value.length <= max && (allowEmpty || value.trim().length > 0);
}

function optionalString(value: unknown, max: number): value is string | null | undefined {
  return value === null || value === undefined || boundedString(value, max, true);
}

function optionalTimestamp(value: unknown): value is string | null | undefined {
  return value === null || value === undefined || (
    typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value))
  );
}

function safePage(value: number) {
  return Number.isSafeInteger(value) && value >= 1 && value <= MAX_PAGE ? value : 1;
}

function safeRecordKey(value: number | undefined) {
  if (!value || !Number.isSafeInteger(value) || value < 1) throw new AssessmentsApiError("validation");
  return value;
}

function safeText(value: string | null | undefined, max: number) {
  const normalized = value?.trim() ?? "";
  if (normalized.length > max) throw new AssessmentsApiError("validation");
  return normalized || null;
}

function safeSelectionToken(value: string) {
  if (!boundedString(value, 4096)) throw new AssessmentsApiError("validation");
  return value;
}

function safeInstrumentKey(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9_-]{0,99})$/.test(normalized)) throw new AssessmentsApiError("validation");
  return normalized;
}

function isEnum<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

function errorKind(status: number): AssessmentsApiErrorKind {
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 422) return "validation";
  if (status === 401 || status === 403 || status === 404) return "permission";
  return "unavailable";
}

async function readRequest<T>(request: Promise<GeneratedResponse>, parse: (value: unknown) => T | null) {
  try {
    const response = await request;
    if (response.status >= 200 && response.status < 300) {
      const value = parse(response.data);
      if (value !== null) return value;
    }
    throw new AssessmentsApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof AssessmentsApiError) throw error;
    throw new AssessmentsApiError("unavailable");
  }
}

async function readBlobRequest(request: Promise<GeneratedResponse>) {
  try {
    const response = await request;
    if (response.status === 200 && response.data instanceof Blob) return response.data;
    throw new AssessmentsApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof AssessmentsApiError) throw error;
    throw new AssessmentsApiError("unavailable");
  }
}

function parseInstrument(value: unknown): PortalAssessmentInstrument | null {
  if (!isRecord(value) || !boundedString(value.key, MAX_FILTER_LENGTH) || !boundedString(value.title, 200)) return null;
  if (!isEnum(value.category, ASSESSMENT_CATEGORIES) || typeof value.allows_scores !== "boolean" || typeof value.allows_interpretation !== "boolean" || typeof value.active !== "boolean") return null;
  return {
    key: value.key,
    title: value.title,
    category: value.category,
    allows_scores: value.allows_scores,
    allows_interpretation: value.allows_interpretation,
    active: value.active,
  };
}

function parseProjection(value: unknown): PortalAssessment | null {
  if (!isRecord(value) || typeof value.id !== "number" || !Number.isSafeInteger(value.id) || value.id < 1) return null;
  if (!boundedString(value.student_display_name, 160) || !optionalString(value.student_number, 50) || !isEnum(value.status, ASSESSMENT_STATUSES)) return null;
  if (!optionalTimestamp(value.administered_at) || !optionalTimestamp(value.updated_at) || !isOptionalResourceVersion(value.resource_version) || !optionalTimestamp(value.reviewed_at) || !optionalTimestamp(value.released_at)) return null;
  if (!isEnum(value.interpretation_visibility, ASSESSMENT_VISIBILITIES) || typeof value.released_to_student !== "boolean" || typeof value.has_protected_file !== "boolean") return null;
  const instrument = parseInstrument(value.instrument);
  if (!instrument) return null;
  const item: PortalAssessment = {
    student_display_name: value.student_display_name,
    student_number: value.student_number ?? null,
    instrument,
    status: value.status,
    administered_at: value.administered_at ?? null,
    updated_at: value.updated_at ?? null,
    resource_version: value.resource_version ?? null,
    reviewed_at: value.reviewed_at ?? null,
    released_to_student: value.released_to_student,
    released_at: value.released_at ?? null,
    interpretation_visibility: value.interpretation_visibility,
    has_protected_file: value.has_protected_file,
  };
  recordKeys.set(item, value.id);
  return item;
}

function isPage(value: unknown): value is { items: unknown[]; page: number; page_size: number; total: number } {
  return isRecord(value) && Array.isArray(value.items) && typeof value.page === "number" && Number.isSafeInteger(value.page) && value.page >= 1 && value.page <= MAX_PAGE && typeof value.page_size === "number" && value.page_size === ASSESSMENTS_PAGE_SIZE && typeof value.total === "number" && Number.isSafeInteger(value.total) && value.total >= 0 && value.items.length <= value.page_size;
}

function parsePage(value: unknown): PortalAssessmentPage | null {
  if (!isPage(value)) return null;
  const items = value.items.map(parseProjection);
  if (items.some((item) => item === null)) return null;
  return {
    items: items as PortalAssessment[],
    page: value.page,
    page_size: value.page_size,
    total: value.total,
  };
}

function parseSensitive(value: unknown): PortalAssessmentSensitive | null {
  const projection = parseProjection(value);
  if (!projection || !isRecord(value)) return null;
  if (!optionalString(value.raw_score, 200) || !optionalString(value.scaled_score, 200) || !optionalString(value.score_label, 200) || !boundedString(value.interpretation, MAX_TEXT_LENGTH, true)) return null;
  return {
    ...projection,
    raw_score: value.raw_score ?? null,
    scaled_score: value.scaled_score ?? null,
    score_label: value.score_label ?? null,
    interpretation: value.interpretation,
  };
}

function parseFileMetadata(value: unknown): PortalAssessmentFileMetadata | null {
  if (!isRecord(value) || !optionalString(value.filename, 255) || !boundedString(value.content_type, 120) || typeof value.size_bytes !== "number" || !Number.isSafeInteger(value.size_bytes) || value.size_bytes < 0 || !boundedString(value.classification, 80) || !boundedString(value.purpose, 100) || !boundedString(value.status, 50)) return null;
  return {
    filename: value.filename ?? null,
    content_type: value.content_type,
    size_bytes: value.size_bytes,
    classification: value.classification,
    purpose: value.purpose,
    status: value.status,
  };
}

function parseOptions(value: unknown): PortalAssessmentStudentOption[] | null {
  if (!isRecord(value) || !Array.isArray(value.items) || value.items.length > ASSESSMENTS_PAGE_SIZE) return null;
  const options = value.items.map((item) => {
    if (!isRecord(item) || !boundedString(item.label, 240) || !boundedString(item.selection_token, 4096)) return null;
    return { label: item.label, selection_token: item.selection_token };
  });
  if (options.some((item) => item === null)) return null;
  if (new Set(options.map((item) => item?.selection_token)).size !== options.length) return null;
  return options as PortalAssessmentStudentOption[];
}

function parseInstrumentPage(value: unknown): PortalAssessmentInstrumentOption[] | null {
  if (!isRecord(value) || !Array.isArray(value.items) || value.items.length > 100) return null;
  const instruments = value.items.map(parseInstrument);
  if (instruments.some((item) => item === null)) return null;
  return instruments as PortalAssessmentInstrumentOption[];
}

function normalizeStatuses(value: string | null | undefined, strict: boolean) {
  if (!value) return [] as AssessmentStatus[];
  const values = [...new Set(value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean))];
  if (values.length > ASSESSMENT_STATUSES.length || values.some((item) => !STATUS_SET.has(item))) {
    if (!strict) return [] as AssessmentStatus[];
    throw new AssessmentsApiError("validation");
  }
  return values as AssessmentStatus[];
}

function normalizeDate(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(Date.parse(`${normalized}T00:00:00Z`))) return null;
  return normalized;
}

export function parseAssessmentFilters(params: { get: (name: string) => string | null }): AssessmentListFilters {
  const statuses = normalizeStatuses(params.get("status"), false);
  const q = params.get("q")?.trim() ?? "";
  const category = params.get("category")?.trim().toLowerCase() ?? "";
  const instrumentValue = params.get("instrument")?.trim().toLowerCase() ?? "";
  const instrument = instrumentValue && /^[a-z0-9](?:[a-z0-9_-]{0,99})$/.test(instrumentValue) ? instrumentValue : "";
  const dateFrom = normalizeDate(params.get("date_from"));
  const dateTo = normalizeDate(params.get("date_to"));
  return {
    q: q && q.length <= MAX_QUERY_LENGTH ? q : null,
    status: statuses.length ? statuses.join(",") : null,
    statuses,
    category: category && CATEGORY_SET.has(category) ? category as AssessmentCategory : null,
    instrument: instrument && instrument.length <= MAX_FILTER_LENGTH ? instrument : null,
    dateFrom: dateFrom && (!dateTo || dateFrom <= dateTo) ? dateFrom : null,
    dateTo: dateTo && (!dateFrom || dateFrom <= dateTo) ? dateTo : null,
    order: params.get("order") && ORDER_SET.has(params.get("order")!.trim().toLowerCase()) ? params.get("order")!.trim().toLowerCase() as AssessmentOrder : "recent",
  };
}

export function assessmentHref(page = 1, filters: AssessmentListFilters) {
  const params = new URLSearchParams();
  if (filters.statuses.length) params.set("status", filters.statuses.join(","));
  if (filters.q?.trim()) params.set("q", filters.q.trim().slice(0, MAX_QUERY_LENGTH));
  if (filters.category) params.set("category", filters.category);
  if (filters.instrument) params.set("instrument", filters.instrument.slice(0, MAX_FILTER_LENGTH));
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  if (filters.order !== "recent") params.set("order", filters.order);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/portal/assessments?${query}` : "/portal/assessments";
}

function listParams(page: number, filters: AssessmentListFilters): AssessmentsListParams {
  return {
    page: safePage(page),
    page_size: ASSESSMENTS_PAGE_SIZE,
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.instrument ? { instrument: filters.instrument } : {}),
    ...(filters.dateFrom ? { date_from: filters.dateFrom } : {}),
    ...(filters.dateTo ? { date_to: filters.dateTo } : {}),
    ...(filters.order !== "recent" ? { order: filters.order } : {}),
  };
}

function recordKey(item: PortalAssessment) {
  return safeRecordKey(recordKeys.get(item));
}

async function runMutation<T>(request: (options: RequestInit) => Promise<GeneratedResponse>, key: IdempotencyKey, parse: (value: unknown) => T | null, signal?: AbortSignal) {
  const options = withIdempotencyKey(key, await cookieSessionMutationOptions(signal));
  return readRequest(request(options), parse);
}

export function getPortalAssessments(page: number, filters: AssessmentListFilters, signal?: AbortSignal) {
  return readRequest(assessmentsList(listParams(page, filters), cookieSessionReadOptions(signal)), parsePage);
}

export function getPortalAssessmentDetail(item: PortalAssessment, signal?: AbortSignal) {
  return readRequest(assessmentsDetail(recordKey(item), cookieSessionReadOptions(signal)), parseProjection);
}

export function getPortalAssessmentInterpretation(item: PortalAssessment, signal?: AbortSignal) {
  return readRequest(assessmentsInterpretation(recordKey(item), cookieSessionReadOptions(signal)), parseSensitive);
}

export function getPortalAssessmentFileMetadata(item: PortalAssessment, signal?: AbortSignal) {
  return readRequest(assessmentsFileMetadata(recordKey(item), cookieSessionReadOptions(signal)), parseFileMetadata);
}

export function downloadPortalAssessmentFile(item: PortalAssessment, signal?: AbortSignal) {
  return readBlobRequest(assessmentsFileDownload(recordKey(item), cookieSessionReadOptions(signal)));
}

export function getPortalAssessmentReplacementOptions(item: PortalAssessment, signal?: AbortSignal) {
  const params: AssessmentsReplacementOptionsParams = { page: 1, page_size: ASSESSMENTS_PAGE_SIZE };
  return readRequest(assessmentsReplacementOptions(recordKey(item), params, cookieSessionReadOptions(signal)), parsePage);
}

export function getPortalAssessmentStudentOptions(query: string, signal?: AbortSignal) {
  return readRequest(profilesStaffStudents({ q: query.trim().slice(0, MAX_QUERY_LENGTH), page: 1, page_size: ASSESSMENTS_PAGE_SIZE, workflow: "assessment" }, cookieSessionReadOptions(signal)), parseOptions);
}

export function getPortalAssessmentInstruments(signal?: AbortSignal) {
  return readRequest(assessmentsInstruments({ page: 1, page_size: 100 }, cookieSessionReadOptions(signal)), parseInstrumentPage);
}

export function createPortalAssessment(payload: PortalAssessmentCreateInput, key: IdempotencyKey, signal?: AbortSignal) {
  const studentSelectionToken = safeSelectionToken(payload.student_selection_token);
  const instrumentKey = safeInstrumentKey(payload.instrument_key);
  if (payload.administered_at !== undefined && payload.administered_at !== null && (!optionalTimestamp(payload.administered_at) || payload.administered_at.length > 40)) throw new AssessmentsApiError("validation");
  const sourceFormReference = safeText(payload.source_form_reference, 100);
  const createPayload: CreateSchema = {
    student_selection_token: studentSelectionToken,
    instrument_key: instrumentKey,
    ...(payload.administered_at ? { administered_at: payload.administered_at } : {}),
    ...(sourceFormReference ? { source_form_reference: sourceFormReference } : {}),
  };
  return runMutation((options) => assessmentsCreate(createPayload, options), key, parseProjection, signal);
}

export function updatePortalAssessment(item: PortalAssessment, payload: UpdateSchema, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => assessmentsUpdate(recordKey(item), payload, options), key, parseProjection, signal);
}

export function recordPortalAssessment(item: PortalAssessment, payload: RecordSchema, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => assessmentsRecord(recordKey(item), payload, options), key, parseProjection, signal);
}

export function submitPortalAssessmentForReview(item: PortalAssessment, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => assessmentsSubmitReview(recordKey(item), { expected_resource_version: item.resource_version }, options), key, parseProjection, signal);
}

export function reviewPortalAssessment(item: PortalAssessment, notes: string | null, key: IdempotencyKey, signal?: AbortSignal) {
  const payload: ReviewSchema = { expected_resource_version: item.resource_version, ...(notes?.trim() ? { notes: notes.trim().slice(0, 1000) } : {}) };
  return runMutation((options) => assessmentsReview(recordKey(item), payload, options), key, parseProjection, signal);
}

export function releasePortalAssessment(item: PortalAssessment, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => assessmentsRelease(recordKey(item), { expected_resource_version: item.resource_version }, options), key, parseProjection, signal);
}

export function voidPortalAssessment(item: PortalAssessment, reasonCode: string, key: IdempotencyKey, signal?: AbortSignal) {
  const reason = safeText(reasonCode, 160);
  if (!reason) throw new AssessmentsApiError("validation");
  return runMutation((options) => assessmentsVoid(recordKey(item), { reason_code: reason, expected_resource_version: item.resource_version }, options), key, parseProjection, signal);
}

export function supersedePortalAssessment(item: PortalAssessment, replacement: PortalAssessment, reasonCode: string, key: IdempotencyKey, signal?: AbortSignal) {
  const reason = safeText(reasonCode, 160);
  if (!reason) throw new AssessmentsApiError("validation");
  return runMutation((options) => {
    return assessmentsSupersede(recordKey(item), { replacement_record_id: recordKey(replacement), reason_code: reason, expected_resource_version: item.resource_version }, options);
  }, key, parseProjection, signal);
}

export function archivePortalAssessment(item: PortalAssessment, reasonCode: string, key: IdempotencyKey, signal?: AbortSignal) {
  const reason = safeText(reasonCode, 160);
  if (!reason) throw new AssessmentsApiError("validation");
  return runMutation((options) => assessmentsArchive(recordKey(item), { reason_code: reason, expected_resource_version: item.resource_version }, options), key, parseProjection, signal);
}

export function attachPortalAssessmentFile(item: PortalAssessment, file: File, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => assessmentsFileAttach(recordKey(item), { file }, options), key, parseProjection, signal);
}
