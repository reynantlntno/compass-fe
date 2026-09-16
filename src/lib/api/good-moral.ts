import {
  goodMoralApprove,
  goodMoralArchive,
  goodMoralCancel,
  goodMoralDocumentDownload,
  goodMoralDrySealConfirm,
  goodMoralGenerate,
  goodMoralHold,
  goodMoralOssdVerification,
  goodMoralPrint,
  goodMoralReceiptEncode,
  goodMoralReceiptVerify,
  goodMoralReject,
  goodMoralRelease,
  goodMoralReviewStart,
  goodMoralStaffQueueCreate,
  goodMoralStaffQueueDetail,
  goodMoralStaffQueueList,
  goodMoralStaffQueueOptions,
  goodMoralStaffQueueReviewerAssign,
  goodMoralStaffQueueReviewerOptions,
  goodMoralSupersede,
  goodMoralVoid,
} from "@/lib/api/generated/good-moral/good-moral";
import { profilesStaffStudents } from "@/lib/api/generated/profiles/profiles";
import type {
  ApprovalSchema,
  GoodMoralReviewerSelectionSchema,
  GoodMoralStaffCreateSchema,
  OssdSchema,
  ReceiptEncodeSchema,
  ReceiptVerificationSchema,
  ReasonSchema,
} from "@/lib/api/generated/model";
import { cookieSessionMutationOptions, cookieSessionReadOptions } from "@/lib/api/auth";
import { withIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";
import { isResourceVersion } from "@/lib/api/resource-version";

export const GOOD_MORAL_PAGE_SIZE = 20;
export const GOOD_MORAL_ORDERS = ["recent", "oldest"] as const;
export const GOOD_MORAL_STATUSES = [
  "DRAFT", "SUBMITTED", "FOR_PAYMENT", "PAYMENT_ENCODED", "FOR_RECORD_CHECKING",
  "PENDING_MANUAL_OSSD_VERIFICATION", "ON_HOLD_FOR_REVIEW", "FOR_APPROVAL",
  "APPROVED_FOR_GENERATION", "GENERATING", "GENERATED", "PRINTED", "RELEASED",
  "REJECTED", "CANCELLED", "VOIDED", "ARCHIVED", "FAILED",
] as const;
export const GOOD_MORAL_REQUEST_TYPES = ["STUDENT", "GRADUATE"] as const;
export const GOOD_MORAL_RECEIPT_STATUSES = ["PENDING", "ENCODED", "VERIFIED", "REJECTED"] as const;
export const GOOD_MORAL_OSSD_STATUSES = ["PENDING", "VERIFIED", "NOT_REQUIRED"] as const;
export const GOOD_MORAL_DRY_SEAL_STATUSES = ["PENDING", "SEALED"] as const;

export type GoodMoralStatus = (typeof GOOD_MORAL_STATUSES)[number];
export type GoodMoralRequestType = (typeof GOOD_MORAL_REQUEST_TYPES)[number];
export type GoodMoralFilters = {
  q: string | null;
  statuses: GoodMoralStatus[];
  requestTypes: GoodMoralRequestType[];
  receiptStatuses: string[];
  ossdStatuses: string[];
  drySealStatuses: string[];
  academicYear: string | null;
  campus: string | null;
  college: string | null;
  department: string | null;
  program: string | null;
  order: (typeof GOOD_MORAL_ORDERS)[number];
};

export type PortalGoodMoral = {
  reference_code: string;
  student_display_name: string;
  student_number_masked: string;
  request_type: GoodMoralRequestType;
  applicant_lifecycle_status: string;
  applicant_academic_year: string;
  applicant_graduation_date: string | null;
  applicant_campus: string | null;
  applicant_college: string | null;
  applicant_department: string | null;
  applicant_program_degree: string | null;
  applicant_year_level: string | null;
  status: GoodMoralStatus;
  receipt_status: string;
  ossd_verification_status: string;
  dry_seal_status: string;
  dry_seal_confirmation_method: string | null;
  created_at: string;
  updated_at: string;
  resource_version: string;
  approved_at: string | null;
  generated_at: string | null;
  printed_at: string | null;
  released_at: string | null;
  document_available: boolean;
  document_status: string | null;
  document_generated_at: string | null;
  document_released_at: string | null;
  reviewer_assigned: boolean;
};

export type PortalGoodMoralPage = { items: PortalGoodMoral[]; page: number; page_size: number; total: number };
export type PortalGoodMoralOption = { value: string; label: string };
export type PortalGoodMoralStudentOption = { label: string; selection_token: string };
export type PortalGoodMoralReviewerOption = { label: string; selection_token: string };
export type PortalGoodMoralOptions = {
  statuses: PortalGoodMoralOption[];
  request_types: PortalGoodMoralOption[];
  receipt_statuses: PortalGoodMoralOption[];
  ossd_statuses: PortalGoodMoralOption[];
  dry_seal_statuses: PortalGoodMoralOption[];
  academic_years: PortalGoodMoralOption[];
  campuses: PortalGoodMoralOption[];
  colleges: PortalGoodMoralOption[];
  departments: PortalGoodMoralOption[];
  programs: PortalGoodMoralOption[];
};

export type GoodMoralApiErrorKind = "conflict" | "permission" | "rate_limited" | "unavailable" | "validation";
export class GoodMoralApiError extends Error {
  readonly kind: GoodMoralApiErrorKind;
  constructor(kind: GoodMoralApiErrorKind) {
    super("The Good Moral workspace request could not be completed.");
    this.name = "GoodMoralApiError";
    this.kind = kind;
  }
}

type GeneratedResponse = { data: unknown; status: number };
const MAX_PAGE = 100_000;
const MAX_TEXT = 240;
const MAX_REFERENCE = 64;
const STATUS_SET = new Set<string>(GOOD_MORAL_STATUSES);
const TYPE_SET = new Set<string>(GOOD_MORAL_REQUEST_TYPES);
const ORDER_SET = new Set<string>(GOOD_MORAL_ORDERS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function bounded(value: unknown, max: number, allowEmpty = false): value is string {
  return typeof value === "string" && value.length <= max && (allowEmpty || value.trim().length > 0);
}
function optionalText(value: unknown, max = MAX_TEXT): value is string | null | undefined {
  return value === null || value === undefined || bounded(value, max, true);
}
function timestamp(value: unknown): value is string {
  return typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value));
}
function optionalTimestamp(value: unknown): value is string | null | undefined {
  return value === null || value === undefined || timestamp(value);
}
function errorKind(status: number): GoodMoralApiErrorKind {
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 422) return "validation";
  if (status === 401 || status === 403 || status === 404) return "permission";
  return "unavailable";
}
function isAbortError(error: unknown) { return error instanceof Error && error.name === "AbortError"; }
async function readRequest<T>(request: Promise<GeneratedResponse>, parse: (value: unknown) => T | null): Promise<T> {
  try {
    const response = await request;
    if (response.status >= 200 && response.status < 300) {
      const value = parse(response.data);
      if (value !== null) return value;
    }
    throw new GoodMoralApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof GoodMoralApiError) throw error;
    throw new GoodMoralApiError("unavailable");
  }
}
async function readBlobRequest(request: Promise<GeneratedResponse>): Promise<Blob> {
  try {
    const response = await request;
    if (response.status >= 200 && response.status < 300 && response.data instanceof Blob) return response.data;
    throw new GoodMoralApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof GoodMoralApiError) throw error;
    throw new GoodMoralApiError("unavailable");
  }
}
function safeReference(value: string) {
  const normalized = value.trim();
  if (!bounded(normalized, MAX_REFERENCE) || /[/?#\\\u0000-\u001f]/.test(normalized)) throw new GoodMoralApiError("validation");
  return normalized;
}
function safePage(value: number) { return Number.isSafeInteger(value) && value >= 1 && value <= MAX_PAGE ? value : 1; }
function parseItem(value: unknown): PortalGoodMoral | null {
  if (!isRecord(value) || !bounded(value.reference_code, MAX_REFERENCE) || !bounded(value.student_display_name, 160) ||
      !bounded(value.student_number_masked, 20) || typeof value.request_type !== "string" || !TYPE_SET.has(value.request_type) ||
      !bounded(value.applicant_lifecycle_status, 100, true) || !bounded(value.applicant_academic_year, 100) ||
      !optionalText(value.applicant_graduation_date, 40) || !optionalText(value.applicant_campus) || !optionalText(value.applicant_college) ||
      !optionalText(value.applicant_department) || !optionalText(value.applicant_program_degree) || !optionalText(value.applicant_year_level) ||
      typeof value.status !== "string" || !STATUS_SET.has(value.status) || !bounded(value.receipt_status, 40) ||
      !bounded(value.ossd_verification_status, 40) || !bounded(value.dry_seal_status, 40) || !optionalText(value.dry_seal_confirmation_method, 60) ||
      !timestamp(value.created_at) || !timestamp(value.updated_at) || !isResourceVersion(value.resource_version) || !optionalTimestamp(value.approved_at) || !optionalTimestamp(value.generated_at) ||
      !optionalTimestamp(value.printed_at) || !optionalTimestamp(value.released_at) || typeof value.document_available !== "boolean" ||
      !optionalText(value.document_status, 60) || !optionalTimestamp(value.document_generated_at) || !optionalTimestamp(value.document_released_at) ||
      typeof value.reviewer_assigned !== "boolean") return null;
  return {
    reference_code: value.reference_code, student_display_name: value.student_display_name, student_number_masked: value.student_number_masked,
    request_type: value.request_type as GoodMoralRequestType, applicant_lifecycle_status: value.applicant_lifecycle_status,
    applicant_academic_year: value.applicant_academic_year, applicant_graduation_date: value.applicant_graduation_date ?? null,
    applicant_campus: value.applicant_campus ?? null, applicant_college: value.applicant_college ?? null, applicant_department: value.applicant_department ?? null,
    applicant_program_degree: value.applicant_program_degree ?? null, applicant_year_level: value.applicant_year_level ?? null,
    status: value.status as GoodMoralStatus, receipt_status: value.receipt_status, ossd_verification_status: value.ossd_verification_status,
    dry_seal_status: value.dry_seal_status, dry_seal_confirmation_method: value.dry_seal_confirmation_method ?? null,
    created_at: value.created_at, updated_at: value.updated_at, resource_version: value.resource_version, approved_at: value.approved_at ?? null, generated_at: value.generated_at ?? null,
    printed_at: value.printed_at ?? null, released_at: value.released_at ?? null, document_available: value.document_available,
    document_status: value.document_status ?? null, document_generated_at: value.document_generated_at ?? null,
    document_released_at: value.document_released_at ?? null, reviewer_assigned: value.reviewer_assigned,
  };
}
function parsePage(value: unknown): PortalGoodMoralPage | null {
  if (!isRecord(value) || !Array.isArray(value.items) || typeof value.page !== "number" || !Number.isSafeInteger(value.page) ||
      value.page < 1 || value.page > MAX_PAGE || typeof value.page_size !== "number" || value.page_size !== GOOD_MORAL_PAGE_SIZE ||
      typeof value.total !== "number" || !Number.isSafeInteger(value.total) || value.total < 0 || value.items.length > GOOD_MORAL_PAGE_SIZE) return null;
  const items = value.items.map(parseItem);
  if (items.some((item) => item === null)) return null;
  return { items: items as PortalGoodMoral[], page: value.page, page_size: value.page_size, total: value.total };
}
function parseOptions(value: unknown): PortalGoodMoralOptions | null {
  if (!isRecord(value)) return null;
  const keys = ["statuses", "request_types", "receipt_statuses", "ossd_statuses", "dry_seal_statuses", "academic_years", "campuses", "colleges", "departments", "programs"] as const;
  const parsed = Object.fromEntries(keys.map((key) => [key, parseOptionList(value[key])])) as Record<string, PortalGoodMoralOption[] | null>;
  if (keys.some((key) => parsed[key] === null)) return null;
  return parsed as PortalGoodMoralOptions;
}
function parseOptionList(value: unknown): PortalGoodMoralOption[] | null {
  if (!Array.isArray(value) || value.length > 200) return null;
  const items = value.map((item) => isRecord(item) && bounded(item.value, 120) && bounded(item.label, 200) ? { value: item.value, label: item.label } : null);
  return items.some((item) => item === null) ? null : items as PortalGoodMoralOption[];
}
function parseStudentOptions(value: unknown): PortalGoodMoralStudentOption[] | null {
  if (!isRecord(value) || !Array.isArray(value.items) || value.items.length > GOOD_MORAL_PAGE_SIZE) return null;
  const items = value.items.map((item) => isRecord(item) && bounded(item.label, 240) && bounded(item.selection_token, 4096) ? { label: item.label, selection_token: item.selection_token } : null);
  return items.some((item) => item === null) ? null : items as PortalGoodMoralStudentOption[];
}
function parseReviewerOptions(value: unknown): PortalGoodMoralReviewerOption[] | null {
  if (!Array.isArray(value) || value.length > 200) return null;
  const items = value.map((item) => isRecord(item) && bounded(item.label, 160) && bounded(item.selection_token, 4096) ? { label: item.label, selection_token: item.selection_token } : null);
  return items.some((item) => item === null) ? null : items as PortalGoodMoralReviewerOption[];
}
function listParams(filters: GoodMoralFilters, page: number) {
  const params: Record<string, string | number> = { page: safePage(page), page_size: GOOD_MORAL_PAGE_SIZE };
  if (filters.q) params.q = filters.q.trim().slice(0, 120);
  if (filters.statuses.length) params.status = filters.statuses.join(",");
  if (filters.requestTypes.length) params.request_type = filters.requestTypes.join(",");
  if (filters.receiptStatuses.length) params.receipt_status = filters.receiptStatuses.join(",");
  if (filters.ossdStatuses.length) params.ossd_status = filters.ossdStatuses.join(",");
  if (filters.drySealStatuses.length) params.dry_seal_status = filters.drySealStatuses.join(",");
  for (const [key, value] of [["academic_year", filters.academicYear], ["campus", filters.campus], ["college", filters.college], ["department", filters.department], ["program", filters.program]] as const) if (value) params[key] = value;
  if (filters.order !== "recent") params.order = filters.order;
  return params;
}
export function parseGoodMoralFilters(params: { get: (name: string) => string | null }): GoodMoralFilters {
  const parseMany = <T extends string>(value: string | null, allowed: readonly T[]) => [...new Set((value ?? "").split(",").map((item) => item.trim().toUpperCase()).filter((item): item is T => allowed.includes(item as T)))];
  const orderValue = params.get("order");
  return {
    q: params.get("q")?.trim().slice(0, 120) || null,
    statuses: parseMany(params.get("status"), GOOD_MORAL_STATUSES) as GoodMoralStatus[],
    requestTypes: parseMany(params.get("request_type"), GOOD_MORAL_REQUEST_TYPES) as GoodMoralRequestType[],
    receiptStatuses: parseMany(params.get("receipt_status"), GOOD_MORAL_RECEIPT_STATUSES),
    ossdStatuses: parseMany(params.get("ossd_status"), GOOD_MORAL_OSSD_STATUSES),
    drySealStatuses: parseMany(params.get("dry_seal_status"), GOOD_MORAL_DRY_SEAL_STATUSES),
    academicYear: params.get("academic_year")?.trim().slice(0, 100) || null,
    campus: params.get("campus")?.trim().slice(0, 100) || null,
    college: params.get("college")?.trim().slice(0, 100) || null,
    department: params.get("department")?.trim().slice(0, 100) || null,
    program: params.get("program")?.trim().slice(0, 100) || null,
    order: orderValue && ORDER_SET.has(orderValue) ? orderValue as GoodMoralFilters["order"] : "recent",
  };
}
export function getPortalGoodMoralQueue(filters: GoodMoralFilters, page = 1, signal?: AbortSignal) {
  return readRequest(goodMoralStaffQueueList(listParams(filters, page), cookieSessionReadOptions(signal)), parsePage);
}
export function getPortalGoodMoralOptions(signal?: AbortSignal) { return readRequest(goodMoralStaffQueueOptions(cookieSessionReadOptions(signal)), parseOptions); }
export function getPortalGoodMoralDetail(referenceCode: string, signal?: AbortSignal) { return readRequest(goodMoralStaffQueueDetail(safeReference(referenceCode), cookieSessionReadOptions(signal)), parseItem); }
export function getPortalGoodMoralReviewerOptions(referenceCode: string, signal?: AbortSignal) { return readRequest(goodMoralStaffQueueReviewerOptions(safeReference(referenceCode), cookieSessionReadOptions(signal)), parseReviewerOptions); }
export function getPortalGoodMoralStudents(query: string, signal?: AbortSignal) {
  return readRequest(profilesStaffStudents({ q: query.trim().slice(0, 120), page: 1, page_size: GOOD_MORAL_PAGE_SIZE, workflow: "good_moral_request" }, cookieSessionReadOptions(signal)), parseStudentOptions);
}
async function runMutation(request: (options: RequestInit) => Promise<GeneratedResponse>, key: IdempotencyKey, signal?: AbortSignal) {
  try {
    const response = await request(withIdempotencyKey(key, await cookieSessionMutationOptions(signal)));
    if (response.status >= 200 && response.status < 300) return;
    throw new GoodMoralApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof GoodMoralApiError) throw error;
    throw new GoodMoralApiError("unavailable");
  }
}
function safePayloadReason(reasonCode: string, note = "", expectedResourceVersion: string | null = null) {
  const value = { reason_code: reasonCode.trim().slice(0, 64), ...(note.trim() ? { note: note.trim().slice(0, 1000) } : {}), ...(expectedResourceVersion ? { expected_resource_version: expectedResourceVersion } : {}) };
  return value as unknown as ReasonSchema;
}
export async function createPortalGoodMoral(input: { student_selection_token: string; purpose_text: string; graduation_date: string | null }, key: IdempotencyKey, signal?: AbortSignal) {
  if (!input.student_selection_token || !input.purpose_text.trim() || input.purpose_text.length > 500) throw new GoodMoralApiError("validation");
  const payload: GoodMoralStaffCreateSchema = { student_selection_token: input.student_selection_token, purpose_text: input.purpose_text.trim(), graduation_date: input.graduation_date || null };
  const options = withIdempotencyKey(key, await cookieSessionMutationOptions(signal));
  return readRequest(goodMoralStaffQueueCreate(payload, options), parseItem);
}
export async function assignPortalGoodMoralReviewer(referenceCode: string, token: string, key: IdempotencyKey, signal?: AbortSignal) {
  const payload: GoodMoralReviewerSelectionSchema = { reviewer_selection_token: token };
  const options = withIdempotencyKey(key, await cookieSessionMutationOptions(signal));
  return readRequest(goodMoralStaffQueueReviewerAssign(safeReference(referenceCode), payload, options), parseItem);
}
function mutation(request: (options: RequestInit) => Promise<GeneratedResponse>, key: IdempotencyKey, signal?: AbortSignal) { return runMutation(request, key, signal); }
export function encodePortalGoodMoralReceipt(reference: string, payload: ReceiptEncodeSchema, key: IdempotencyKey, signal?: AbortSignal) { return mutation((options) => goodMoralReceiptEncode(safeReference(reference), payload, options), key, signal); }
export function verifyPortalGoodMoralReceipt(reference: string, payload: ReceiptVerificationSchema, key: IdempotencyKey, signal?: AbortSignal) { return mutation((options) => goodMoralReceiptVerify(safeReference(reference), payload, options), key, signal); }
export function startPortalGoodMoralReview(reference: string, key: IdempotencyKey, signal?: AbortSignal) { return mutation((options) => goodMoralReviewStart(safeReference(reference), options), key, signal); }
export function updatePortalGoodMoralOssd(reference: string, payload: OssdSchema, key: IdempotencyKey, signal?: AbortSignal) { return mutation((options) => goodMoralOssdVerification(safeReference(reference), payload, options), key, signal); }
export function holdPortalGoodMoral(reference: string, reason: string, note: string, key: IdempotencyKey, signal?: AbortSignal) { return mutation((options) => goodMoralHold(safeReference(reference), safePayloadReason(reason, note), options), key, signal); }
export function rejectPortalGoodMoral(reference: string, reason: string, note: string, key: IdempotencyKey, signal?: AbortSignal) { return mutation((options) => goodMoralReject(safeReference(reference), safePayloadReason(reason, note), options), key, signal); }
export function approvePortalGoodMoral(reference: string, payload: ApprovalSchema, key: IdempotencyKey, signal?: AbortSignal) { return mutation((options) => goodMoralApprove(safeReference(reference), payload, options), key, signal); }
export function generatePortalGoodMoral(reference: string, key: IdempotencyKey, signal?: AbortSignal) { return mutation((options) => goodMoralGenerate(safeReference(reference), options), key, signal); }
export function printPortalGoodMoral(reference: string, key: IdempotencyKey, signal?: AbortSignal) { return mutation((options) => goodMoralPrint(safeReference(reference), options), key, signal); }
export function confirmPortalGoodMoralDrySeal(reference: string, key: IdempotencyKey, signal?: AbortSignal) { return mutation((options) => goodMoralDrySealConfirm(safeReference(reference), options), key, signal); }
export function releasePortalGoodMoral(reference: string, key: IdempotencyKey, signal?: AbortSignal) { return mutation((options) => goodMoralRelease(safeReference(reference), options), key, signal); }
export function cancelPortalGoodMoral(reference: string, reason: string, key: IdempotencyKey, signal?: AbortSignal) { return mutation((options) => goodMoralCancel(safeReference(reference), safePayloadReason(reason), options), key, signal); }
export function voidPortalGoodMoral(reference: string, reason: string, key: IdempotencyKey, signal?: AbortSignal) { return mutation((options) => goodMoralVoid(safeReference(reference), safePayloadReason(reason), options), key, signal); }
export function supersedePortalGoodMoral(reference: string, key: IdempotencyKey, signal?: AbortSignal) { return mutation((options) => goodMoralSupersede(safeReference(reference), options), key, signal); }
export function archivePortalGoodMoral(reference: string, reason: string, key: IdempotencyKey, signal?: AbortSignal) { return mutation((options) => goodMoralArchive(safeReference(reference), safePayloadReason(reason), options), key, signal); }
export function downloadPortalGoodMoralDocument(reference: string, signal?: AbortSignal) { return readBlobRequest(goodMoralDocumentDownload(safeReference(reference), cookieSessionReadOptions(signal))); }
