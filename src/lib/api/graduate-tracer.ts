import {
  graduateTracerReviewQueueArchive,
  graduateTracerReviewQueueDetail,
  graduateTracerReviewQueueDocumentDownload,
  graduateTracerReviewQueueDocumentGenerate,
  graduateTracerReviewQueueDocumentPreview,
  graduateTracerReviewQueueList,
  graduateTracerReviewQueueReopen,
  graduateTracerReviewQueueSensitiveDetail,
  graduateTracerReviewQueueVoid,
} from "@/lib/api/generated/graduate-tracer/graduate-tracer";
import type {
  DocumentGenerateSchema,
  GraduateTracerReviewLifecycleSchema,
  GraduateTracerReviewQueueItemSchema,
} from "@/lib/api/generated/model";
import { cookieSessionMutationOptions, cookieSessionReadOptions } from "@/lib/api/auth";
import { withIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";
import {
  FORMS_PAGE_SIZE,
  FORMS_QUEUE_ORDERS,
  type FormsListFilters,
  type FormsQueueOrder,
  type PortalFormsPage,
} from "@/lib/api/forms";

export const GRADUATE_TRACER_QUEUE_STATUSES = [
  "SUBMITTED",
  "REOPENED_FOR_CORRECTION",
  "VOIDED",
  "ARCHIVED",
] as const;

export const GRADUATE_TRACER_EMPLOYMENT_STATUSES = [
  "EMPLOYED",
  "UNEMPLOYED",
  "NEVER_EMPLOYED",
  "SELF_EMPLOYED",
] as const;

export type GraduateTracerQueueStatus = (typeof GRADUATE_TRACER_QUEUE_STATUSES)[number];
export type GraduateTracerEmploymentStatus = (typeof GRADUATE_TRACER_EMPLOYMENT_STATUSES)[number];

export type PortalGraduateTracerAnswerField = {
  label: string;
  value: unknown;
};

export type PortalGraduateTracerAnswerSection = {
  label: string;
  fields: PortalGraduateTracerAnswerField[];
};

export type PortalGraduateTracerQueueItem = {
  reference_code: string;
  student_display_name: string;
  student_number: string | null;
  graduation_year: string;
  program_snapshot: string;
  college_snapshot: string;
  form_code: string;
  form_revision: string;
  form_schema_version: string;
  form_title: string;
  status: GraduateTracerQueueStatus;
  employment_status: string;
  submitted_at: string | null;
  reopened_at: string | null;
  updated_at: string | null;
  review_state: string;
  document_available: boolean;
};

export type PortalGraduateTracerDetail = PortalGraduateTracerQueueItem & {
  answer_sections: PortalGraduateTracerAnswerSection[] | null;
};

export type PortalGraduateTracerPage = PortalFormsPage<PortalGraduateTracerQueueItem>;

export type PortalGraduateTracerDocument = {
  content_type: string;
  document_status: string;
  generated_at: string | null;
  output_format: string;
  reference_code: string;
  released_at: string | null;
  template_key: string;
  template_version: string;
};

export type GraduateTracerApiErrorKind =
  | "conflict"
  | "permission"
  | "rate_limited"
  | "unavailable"
  | "validation";

export class GraduateTracerApiError extends Error {
  readonly kind: GraduateTracerApiErrorKind;

  constructor(kind: GraduateTracerApiErrorKind) {
    super("The Graduate Tracer workspace request could not be completed.");
    this.name = "GraduateTracerApiError";
    this.kind = kind;
  }
}

type GeneratedResponse = { data: unknown; status: number };

const MAX_PAGE = 100_000;
const MAX_QUERY_LENGTH = 120;
const MAX_FILTER_LENGTH = 100;
const MAX_REFERENCE_LENGTH = 50;
const MAX_DISPLAY_NAME_LENGTH = 160;
const MAX_STUDENT_NUMBER_LENGTH = 50;
const MAX_TEXT_LENGTH = 240;
const STATUS_SET = new Set<string>(GRADUATE_TRACER_QUEUE_STATUSES);
const EMPLOYMENT_STATUS_SET = new Set<string>(GRADUATE_TRACER_EMPLOYMENT_STATUSES);
const ORDER_SET = new Set<string>(FORMS_QUEUE_ORDERS);

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

function normalizeQuery(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (normalized.length > MAX_QUERY_LENGTH) throw new GraduateTracerApiError("validation");
  return normalized;
}

function normalizeFilter(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (normalized.length > MAX_FILTER_LENGTH) throw new GraduateTracerApiError("validation");
  return normalized;
}

function normalizeStatuses(value: string | null | undefined, strict = true) {
  if (!value) return [] as GraduateTracerQueueStatus[];
  const values = [...new Set(value.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean))];
  if (values.some((item) => !STATUS_SET.has(item))) {
    if (!strict) return [];
    throw new GraduateTracerApiError("validation");
  }
  return values as GraduateTracerQueueStatus[];
}

function normalizeOrder(value: string | null | undefined): FormsQueueOrder {
  if (!value) return "recent";
  if (!ORDER_SET.has(value)) throw new GraduateTracerApiError("validation");
  return value as FormsQueueOrder;
}

function errorKind(status: number): GraduateTracerApiErrorKind {
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 422) return "validation";
  if (status === 401 || status === 403 || status === 404) return "permission";
  return "unavailable";
}

async function readRequest<T>(
  request: Promise<GeneratedResponse>,
  parse: (value: unknown) => T | null,
) {
  try {
    const response = await request;
    if (response.status >= 200 && response.status < 300) {
      const value = parse(response.data);
      if (value) return value;
    }
    throw new GraduateTracerApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof GraduateTracerApiError) throw error;
    throw new GraduateTracerApiError("unavailable");
  }
}

async function readBlobRequest(request: Promise<GeneratedResponse>) {
  try {
    const response = await request;
    if (response.status === 200 && response.data instanceof Blob) return response.data;
    throw new GraduateTracerApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof GraduateTracerApiError) throw error;
    throw new GraduateTracerApiError("unavailable");
  }
}

function isQueueItem(value: unknown): value is GraduateTracerReviewQueueItemSchema {
  if (!isRecord(value)) return false;
  return (
    boundedString(value.reference_code, MAX_REFERENCE_LENGTH) &&
    boundedString(value.student_display_name, MAX_DISPLAY_NAME_LENGTH) &&
    optionalString(value.student_number, MAX_STUDENT_NUMBER_LENGTH) &&
    boundedString(value.graduation_year, MAX_FILTER_LENGTH, true) &&
    boundedString(value.program_snapshot, MAX_TEXT_LENGTH, true) &&
    boundedString(value.college_snapshot, MAX_TEXT_LENGTH, true) &&
    boundedString(value.form_code, MAX_TEXT_LENGTH) &&
    boundedString(value.form_revision, MAX_FILTER_LENGTH) &&
    boundedString(value.form_schema_version, MAX_FILTER_LENGTH) &&
    boundedString(value.form_title, MAX_TEXT_LENGTH) &&
    typeof value.status === "string" && STATUS_SET.has(value.status) &&
    boundedString(value.employment_status, MAX_FILTER_LENGTH, true) &&
    optionalTimestamp(value.submitted_at) && optionalTimestamp(value.reopened_at) && optionalTimestamp(value.updated_at) &&
    boundedString(value.review_state, MAX_TEXT_LENGTH) &&
    typeof value.document_available === "boolean"
  );
}

function parseQueueItem(value: unknown): PortalGraduateTracerQueueItem | null {
  if (!isQueueItem(value)) return null;
  return {
    reference_code: value.reference_code,
    student_display_name: value.student_display_name,
    student_number: value.student_number ?? null,
    graduation_year: value.graduation_year,
    program_snapshot: value.program_snapshot,
    college_snapshot: value.college_snapshot,
    form_code: value.form_code,
    form_revision: value.form_revision,
    form_schema_version: value.form_schema_version,
    form_title: value.form_title,
    status: value.status as GraduateTracerQueueStatus,
    employment_status: value.employment_status,
    submitted_at: value.submitted_at ?? null,
    reopened_at: value.reopened_at ?? null,
    updated_at: value.updated_at ?? null,
    review_state: value.review_state,
    document_available: value.document_available,
  };
}

function parsePage(value: unknown): PortalGraduateTracerPage | null {
  if (!isRecord(value) || !Array.isArray(value.items) ||
      typeof value.page !== "number" || !Number.isSafeInteger(value.page) || value.page < 1 || value.page > MAX_PAGE ||
      typeof value.page_size !== "number" || value.page_size !== FORMS_PAGE_SIZE ||
      typeof value.total !== "number" || !Number.isSafeInteger(value.total) || value.total < 0 || value.items.length > value.page_size) {
    return null;
  }
  return {
    items: value.items.map(parseQueueItem).filter((item): item is PortalGraduateTracerQueueItem => item !== null),
    page: value.page,
    page_size: value.page_size,
    total: value.total,
  };
}

function parseAnswerSections(value: unknown): PortalGraduateTracerAnswerSection[] | null {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return null;
  const sections: PortalGraduateTracerAnswerSection[] = [];
  for (const section of value.slice(0, 40)) {
    if (!isRecord(section) || !boundedString(section.label, MAX_TEXT_LENGTH)) continue;
    if (!Array.isArray(section.fields)) continue;
    const fields = section.fields.slice(0, 120).flatMap((field) => {
      if (!isRecord(field) || !boundedString(field.label, MAX_TEXT_LENGTH)) return [];
      return [{ label: field.label, value: field.value }];
    });
    sections.push({ label: section.label, fields });
  }
  return sections;
}

function parseDetail(value: unknown): PortalGraduateTracerDetail | null {
  const item = parseQueueItem(value);
  if (!item || !isRecord(value)) return null;
  return { ...item, answer_sections: parseAnswerSections(value.answer_sections) };
}

function parseDocument(value: unknown): PortalGraduateTracerDocument | null {
  if (!isRecord(value) ||
      !boundedString(value.content_type, 120) || !boundedString(value.document_status, MAX_TEXT_LENGTH) ||
      !optionalTimestamp(value.generated_at) || !boundedString(value.output_format, 40) ||
      !boundedString(value.reference_code, MAX_REFERENCE_LENGTH) || !optionalTimestamp(value.released_at) ||
      !boundedString(value.template_key, 120) || !boundedString(value.template_version, 80)) return null;
  return {
    content_type: value.content_type,
    document_status: value.document_status,
    generated_at: value.generated_at ?? null,
    output_format: value.output_format,
    reference_code: value.reference_code,
    released_at: value.released_at ?? null,
    template_key: value.template_key,
    template_version: value.template_version,
  };
}

function safeReference(value: string) {
  const reference = value.trim().slice(0, MAX_REFERENCE_LENGTH);
  if (!reference) throw new GraduateTracerApiError("validation");
  return reference;
}

function listParams(filters: FormsListFilters, page: number) {
  const q = normalizeQuery(filters.q);
  const statuses = normalizeStatuses(filters.status);
  const graduationYear = normalizeFilter(filters.graduationYear);
  const revision = normalizeFilter(filters.revision);
  const employmentStatus = normalizeFilter(filters.employmentStatus);
  if (employmentStatus && !EMPLOYMENT_STATUS_SET.has(employmentStatus.toUpperCase())) {
    throw new GraduateTracerApiError("validation");
  }
  const order = normalizeOrder(filters.order);
  return {
    page: safePage(page),
    page_size: FORMS_PAGE_SIZE,
    ...(q ? { q } : {}),
    ...(statuses.length ? { status: statuses.join(",") } : {}),
    ...(graduationYear ? { graduation_year: graduationYear } : {}),
    ...(revision ? { revision } : {}),
    ...(employmentStatus ? { employment_status: employmentStatus.toUpperCase() } : {}),
    ...(order !== "recent" ? { order } : {}),
  };
}

export function parseGraduateTracerFilters(params: { get: (name: string) => string | null }): FormsListFilters {
  const statuses = normalizeStatuses(params.get("status"), false);
  const employmentStatus = params.get("employment_status")?.trim().slice(0, MAX_FILTER_LENGTH) || null;
  return {
    q: params.get("q")?.trim().slice(0, MAX_QUERY_LENGTH) || null,
    status: statuses.length ? statuses.join(",") : null,
    statuses,
    academicYear: null,
    graduationYear: params.get("graduation_year")?.trim().slice(0, MAX_FILTER_LENGTH) || null,
    revision: params.get("revision")?.trim().slice(0, MAX_FILTER_LENGTH) || null,
    employmentStatus: employmentStatus && EMPLOYMENT_STATUS_SET.has(employmentStatus.toUpperCase()) ? employmentStatus.toUpperCase() : null,
    order: normalizeOrder(params.get("order") && ORDER_SET.has(params.get("order")!) ? params.get("order") : null),
  };
}

export function getPortalGraduateTracerQueue(page = 1, filters: FormsListFilters, signal?: AbortSignal) {
  return readRequest(
    graduateTracerReviewQueueList(listParams(filters, page), cookieSessionReadOptions(signal)),
    parsePage,
  );
}

export function getPortalGraduateTracerQueueDetail(referenceCode: string, signal?: AbortSignal) {
  return readRequest(graduateTracerReviewQueueDetail(safeReference(referenceCode), cookieSessionReadOptions(signal)), parseDetail);
}

export function getPortalGraduateTracerSubmittedAnswers(referenceCode: string, signal?: AbortSignal) {
  return readRequest(graduateTracerReviewQueueSensitiveDetail(safeReference(referenceCode), cookieSessionReadOptions(signal)), (value) => {
    const detail = parseDetail(value);
    return detail?.status === "SUBMITTED" ? detail : null;
  });
}

async function runMutation(
  request: (options: RequestInit) => Promise<GeneratedResponse>,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  try {
    const response = await request(withIdempotencyKey(key, await cookieSessionMutationOptions(signal)));
    if (response.status >= 200 && response.status < 300) return;
    throw new GraduateTracerApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof GraduateTracerApiError) throw error;
    throw new GraduateTracerApiError("unavailable");
  }
}

function lifecyclePayload(reason: string | null, expectedUpdatedAt: string | null): GraduateTracerReviewLifecycleSchema {
  return {
    ...(reason?.trim() ? { reason: reason.trim().slice(0, 500) } : {}),
    ...(expectedUpdatedAt ? { expected_updated_at: expectedUpdatedAt } : {}),
  };
}

export function reopenPortalGraduateTracer(referenceCode: string, reason: string, expectedUpdatedAt: string | null, key: IdempotencyKey, signal?: AbortSignal) {
  if (!reason.trim()) throw new GraduateTracerApiError("validation");
  return runMutation((options) => graduateTracerReviewQueueReopen(safeReference(referenceCode), lifecyclePayload(reason, expectedUpdatedAt), options), key, signal);
}

export function voidPortalGraduateTracer(referenceCode: string, reason: string, expectedUpdatedAt: string | null, key: IdempotencyKey, signal?: AbortSignal) {
  if (!reason.trim()) throw new GraduateTracerApiError("validation");
  return runMutation((options) => graduateTracerReviewQueueVoid(safeReference(referenceCode), lifecyclePayload(reason, expectedUpdatedAt), options), key, signal);
}

export function archivePortalGraduateTracer(referenceCode: string, expectedUpdatedAt: string | null, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => graduateTracerReviewQueueArchive(safeReference(referenceCode), lifecyclePayload(null, expectedUpdatedAt), options), key, signal);
}

export function previewPortalGraduateTracerDocument(referenceCode: string, signal?: AbortSignal) {
  return readBlobRequest(graduateTracerReviewQueueDocumentPreview(safeReference(referenceCode), cookieSessionReadOptions(signal)));
}

export function downloadPortalGraduateTracerDocument(referenceCode: string, signal?: AbortSignal) {
  return readBlobRequest(graduateTracerReviewQueueDocumentDownload(safeReference(referenceCode), cookieSessionReadOptions(signal)));
}

export async function generatePortalGraduateTracerDocument(referenceCode: string, expectedUpdatedAt: string | null, key: IdempotencyKey, signal?: AbortSignal) {
  const payload: DocumentGenerateSchema = expectedUpdatedAt ? { expected_updated_at: expectedUpdatedAt } : {};
  const options = withIdempotencyKey(key, await cookieSessionMutationOptions(signal));
  return readRequest(
    graduateTracerReviewQueueDocumentGenerate(safeReference(referenceCode), payload, options),
    parseDocument,
  );
}
