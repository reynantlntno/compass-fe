import {
  exitInterviewsAcknowledge,
  exitInterviewsArchive,
  exitInterviewsQueueDetail,
  exitInterviewsQueueList,
  exitInterviewsQueueSensitiveDetail,
  exitInterviewsReopen,
  exitInterviewsVoid,
} from "@/lib/api/generated/exit-interviews/exit-interviews";
import {
  inventoryQueueDetail,
  inventoryQueueList,
  inventoryQueueSensitiveDetail,
  inventoryReopen,
} from "@/lib/api/generated/inventory/inventory";
import type {
  ExitInterviewQueueDetailSchema,
  ExitInterviewQueueItemSchema,
  ExitInterviewsQueueListParams,
  InventoryQueueItemSchema,
  InventoryQueueListParams,
  LifecycleSchema,
} from "@/lib/api/generated/model";
import { cookieSessionMutationOptions, cookieSessionReadOptions } from "@/lib/api/auth";
import { withIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";

export const FORMS_PAGE_SIZE = 20;

export const INVENTORY_QUEUE_STATUSES = [
  "SUBMITTED",
  "REOPENED_FOR_CORRECTION",
] as const;
export const EXIT_INTERVIEW_QUEUE_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "REOPENED_FOR_CORRECTION",
  "VOIDED",
  "ARCHIVED",
] as const;
export const FORMS_QUEUE_ORDERS = ["recent", "oldest"] as const;

export type InventoryQueueStatus = (typeof INVENTORY_QUEUE_STATUSES)[number];
export type ExitInterviewQueueStatus = (typeof EXIT_INTERVIEW_QUEUE_STATUSES)[number];
export type FormsQueueOrder = (typeof FORMS_QUEUE_ORDERS)[number];

export type FormsListFilters = {
  q: string | null;
  status: string | null;
  statuses: string[];
  academicYear: string | null;
  revision: string | null;
  order: FormsQueueOrder;
};

export type PortalInventoryQueueItem = {
  student_display_name: string;
  student_number: string | null;
  academic_year: string;
  schema_key: string;
  schema_version: string;
  status: InventoryQueueStatus;
  submitted_at: string | null;
  reopened_at: string | null;
  updated_at: string | null;
  review_state: string;
};

export type PortalInventoryQueueDetail = PortalInventoryQueueItem & {
  answers: Record<string, unknown> | null;
};

export type PortalExitInterviewQueueItem = {
  reference_code: string;
  student_display_name: string;
  student_number: string | null;
  academic_year: string;
  graduation_year_snapshot: string;
  form_code: string;
  form_revision: string;
  form_title: string;
  status: ExitInterviewQueueStatus;
  submitted_at: string | null;
  counselor_acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PortalExitInterviewQueueDetail = PortalExitInterviewQueueItem & {
  answers: Record<string, unknown> | null;
};

export type PortalFormsPage<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
};

export type FormsErrorKind =
  | "conflict"
  | "permission"
  | "rate_limited"
  | "unavailable"
  | "validation";

export class FormsApiError extends Error {
  readonly kind: FormsErrorKind;

  constructor(kind: FormsErrorKind) {
    super("The forms workspace request could not be completed.");
    this.name = "FormsApiError";
    this.kind = kind;
  }
}

type GeneratedResponse = { data: unknown; status: number };

const MAX_PAGE = 100_000;
const MAX_QUERY_LENGTH = 120;
const MAX_FILTER_LENGTH = 100;
const MAX_DISPLAY_NAME_LENGTH = 160;
const MAX_STUDENT_NUMBER_LENGTH = 50;
const MAX_REVISION_LENGTH = 100;
const MAX_STATUS_COUNT = 12;
const INVENTORY_STATUS_SET = new Set<string>(INVENTORY_QUEUE_STATUSES);
const EXIT_STATUS_SET = new Set<string>(EXIT_INTERVIEW_QUEUE_STATUSES);
const ORDER_SET = new Set<string>(FORMS_QUEUE_ORDERS);
const inventoryRequestKeys = new WeakMap<PortalInventoryQueueItem, number>();

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function requiredTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value));
}

function safePage(value: number) {
  return Number.isSafeInteger(value) && value >= 1 && value <= MAX_PAGE ? value : 1;
}

function normalizeQuery(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (normalized.length > MAX_QUERY_LENGTH) throw new FormsApiError("validation");
  return normalized;
}

function normalizeFilter(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (normalized.length > MAX_FILTER_LENGTH) throw new FormsApiError("validation");
  return normalized;
}

function normalizeStatuses(value: string | null | undefined, allowed: Set<string>, strict = true) {
  if (!value) return [];
  const values = [...new Set(value.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean))];
  if (values.length > MAX_STATUS_COUNT || values.some((item) => !allowed.has(item))) {
    if (!strict) return [];
    throw new FormsApiError("validation");
  }
  return values;
}

function normalizeOrder(value: FormsQueueOrder | null | undefined) {
  if (!value) return "recent" as const;
  if (!ORDER_SET.has(value)) throw new FormsApiError("validation");
  return value;
}

function errorKind(status: number): FormsErrorKind {
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
    if (response.status === 200) {
      const value = parse(response.data);
      if (value) return value;
    }
    throw new FormsApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof FormsApiError) throw error;
    throw new FormsApiError("unavailable");
  }
}

function parseAnswers(value: unknown): Record<string, unknown> | null {
  return value === null || value === undefined || isRecord(value) ? value as Record<string, unknown> | null : null;
}

function isInventoryProjection(value: unknown): value is InventoryQueueItemSchema {
  if (!isRecord(value)) return false;
  return (
    typeof value.snapshot_id === "number" && Number.isSafeInteger(value.snapshot_id) && value.snapshot_id > 0 &&
    boundedString(value.student_display_name, MAX_DISPLAY_NAME_LENGTH) &&
    optionalString(value.student_number, MAX_STUDENT_NUMBER_LENGTH) &&
    boundedString(value.academic_year, MAX_FILTER_LENGTH) &&
    boundedString(value.schema_key, MAX_REVISION_LENGTH) &&
    boundedString(value.schema_version, MAX_REVISION_LENGTH) &&
    typeof value.status === "string" && INVENTORY_STATUS_SET.has(value.status) &&
    optionalTimestamp(value.submitted_at) && optionalTimestamp(value.reopened_at) && optionalTimestamp(value.updated_at) &&
    boundedString(value.review_state, 80)
  );
}

function parseInventoryItem(value: unknown): PortalInventoryQueueItem | null {
  if (!isInventoryProjection(value)) return null;
  const item: PortalInventoryQueueItem = {
    student_display_name: value.student_display_name,
    student_number: value.student_number ?? null,
    academic_year: value.academic_year,
    schema_key: value.schema_key,
    schema_version: value.schema_version,
    status: value.status as InventoryQueueStatus,
    submitted_at: value.submitted_at ?? null,
    reopened_at: value.reopened_at ?? null,
    updated_at: value.updated_at ?? null,
    review_state: value.review_state,
  };
  inventoryRequestKeys.set(item, value.snapshot_id);
  return item;
}

function isInventoryPage(value: unknown): value is { items: unknown[]; page: number; page_size: number; total: number } {
  return isRecord(value) && Array.isArray(value.items) &&
    typeof value.page === "number" && Number.isSafeInteger(value.page) && value.page >= 1 && value.page <= MAX_PAGE &&
    typeof value.page_size === "number" && Number.isSafeInteger(value.page_size) && value.page_size === FORMS_PAGE_SIZE &&
    typeof value.total === "number" && Number.isSafeInteger(value.total) && value.total >= 0 && value.items.length <= value.page_size;
}

function parseInventoryPage(value: unknown): PortalFormsPage<PortalInventoryQueueItem> | null {
  if (!isInventoryPage(value)) return null;
  return {
    items: value.items.map(parseInventoryItem).filter((item): item is PortalInventoryQueueItem => item !== null),
    page: value.page,
    page_size: value.page_size,
    total: value.total,
  };
}

function parseInventoryDetail(value: unknown): PortalInventoryQueueDetail | null {
  if (!isRecord(value)) return null;
  const item = parseInventoryItem({ ...value, snapshot_id: 1 });
  if (!item) return null;
  return { ...item, answers: parseAnswers(value.answers) };
}

function isExitProjection(value: unknown): value is ExitInterviewQueueItemSchema {
  if (!isRecord(value)) return false;
  return (
    boundedString(value.reference_code, 50) &&
    boundedString(value.student_display_name, MAX_DISPLAY_NAME_LENGTH) &&
    optionalString(value.student_number, MAX_STUDENT_NUMBER_LENGTH) &&
    boundedString(value.academic_year, MAX_FILTER_LENGTH) &&
    boundedString(value.graduation_year_snapshot, MAX_FILTER_LENGTH, true) &&
    boundedString(value.form_code, 80) && boundedString(value.form_revision, MAX_REVISION_LENGTH) &&
    boundedString(value.form_title, 255) &&
    typeof value.status === "string" && EXIT_STATUS_SET.has(value.status) &&
    optionalTimestamp(value.submitted_at) && optionalTimestamp(value.counselor_acknowledged_at) &&
    requiredTimestamp(value.created_at) && requiredTimestamp(value.updated_at)
  );
}

function parseExitItem(value: unknown): PortalExitInterviewQueueItem | null {
  if (!isExitProjection(value)) return null;
  return {
    reference_code: value.reference_code,
    student_display_name: value.student_display_name,
    student_number: value.student_number ?? null,
    academic_year: value.academic_year,
    graduation_year_snapshot: value.graduation_year_snapshot,
    form_code: value.form_code,
    form_revision: value.form_revision,
    form_title: value.form_title,
    status: value.status as ExitInterviewQueueStatus,
    submitted_at: value.submitted_at ?? null,
    counselor_acknowledged_at: value.counselor_acknowledged_at ?? null,
    created_at: value.created_at,
    updated_at: value.updated_at,
  };
}

function isExitPage(value: unknown): value is { items: unknown[]; page: number; page_size: number; total: number } {
  return isRecord(value) && Array.isArray(value.items) &&
    typeof value.page === "number" && Number.isSafeInteger(value.page) && value.page >= 1 && value.page <= MAX_PAGE &&
    typeof value.page_size === "number" && Number.isSafeInteger(value.page_size) && value.page_size === FORMS_PAGE_SIZE &&
    typeof value.total === "number" && Number.isSafeInteger(value.total) && value.total >= 0 && value.items.length <= value.page_size;
}

function parseExitPage(value: unknown): PortalFormsPage<PortalExitInterviewQueueItem> | null {
  if (!isExitPage(value)) return null;
  return {
    items: value.items.map(parseExitItem).filter((item): item is PortalExitInterviewQueueItem => item !== null),
    page: value.page,
    page_size: value.page_size,
    total: value.total,
  };
}

function parseExitDetail(value: unknown): PortalExitInterviewQueueDetail | null {
  if (!isExitProjection(value)) return null;
  return { ...parseExitItem(value)!, answers: parseAnswers((value as ExitInterviewQueueDetailSchema).answers) };
}

function safeInventoryKey(item: PortalInventoryQueueItem) {
  const key = inventoryRequestKeys.get(item);
  if (!key) throw new FormsApiError("validation");
  return key;
}

function safeReference(value: string) {
  const reference = value.trim().slice(0, 50);
  if (!reference) throw new FormsApiError("validation");
  return reference;
}

function buildListParams(filters: FormsListFilters, page: number, allowedStatuses: Set<string>) {
  const q = normalizeQuery(filters.q);
  const academicYear = normalizeFilter(filters.academicYear);
  const revision = normalizeFilter(filters.revision);
  const statuses = normalizeStatuses(filters.status, allowedStatuses);
  const order = normalizeOrder(filters.order);
  return {
    page: safePage(page),
    page_size: FORMS_PAGE_SIZE,
    ...(q ? { q } : {}),
    ...(statuses.length ? { status: statuses.join(",") } : {}),
    ...(academicYear ? { academic_year: academicYear } : {}),
    ...(revision ? { revision } : {}),
    ...(order !== "recent" ? { order } : {}),
  };
}

export function parseInventoryFilters(params: { get: (name: string) => string | null }): FormsListFilters {
  const statuses = normalizeStatuses(params.get("status"), INVENTORY_STATUS_SET, false);
  const order = params.get("order");
  return {
    q: params.get("q")?.trim().slice(0, MAX_QUERY_LENGTH) || null,
    status: statuses.length ? statuses.join(",") : null,
    statuses,
    academicYear: params.get("academic_year")?.trim().slice(0, MAX_FILTER_LENGTH) || null,
    revision: params.get("revision")?.trim().slice(0, MAX_REVISION_LENGTH) || null,
    order: order && ORDER_SET.has(order) ? order as FormsQueueOrder : "recent",
  };
}

export function parseExitInterviewFilters(params: { get: (name: string) => string | null }): FormsListFilters {
  const statuses = normalizeStatuses(params.get("status"), EXIT_STATUS_SET, false);
  const order = params.get("order");
  return {
    q: params.get("q")?.trim().slice(0, MAX_QUERY_LENGTH) || null,
    status: statuses.length ? statuses.join(",") : null,
    statuses,
    academicYear: params.get("academic_year")?.trim().slice(0, MAX_FILTER_LENGTH) || null,
    revision: params.get("revision")?.trim().slice(0, MAX_REVISION_LENGTH) || null,
    order: order && ORDER_SET.has(order) ? order as FormsQueueOrder : "recent",
  };
}

export function formsHref(section: "inventory" | "exit-interviews", page = 1, filters: FormsListFilters) {
  const params = new URLSearchParams({ section });
  if (filters.statuses.length) params.set("status", filters.statuses.join(","));
  if (filters.q?.trim()) params.set("q", filters.q.trim().slice(0, MAX_QUERY_LENGTH));
  if (filters.academicYear?.trim()) params.set("academic_year", filters.academicYear.trim().slice(0, MAX_FILTER_LENGTH));
  if (filters.revision?.trim()) params.set("revision", filters.revision.trim().slice(0, MAX_REVISION_LENGTH));
  if (filters.order !== "recent") params.set("order", filters.order);
  if (page > 1) params.set("page", String(page));
  return `/portal/forms?${params.toString()}`;
}

export function getPortalInventoryQueue(page = 1, filters: FormsListFilters, signal?: AbortSignal) {
  const params = buildListParams(filters, page, INVENTORY_STATUS_SET) as InventoryQueueListParams;
  return readRequest(inventoryQueueList(params, cookieSessionReadOptions(signal)), parseInventoryPage);
}

export function getPortalInventoryQueueDetail(item: PortalInventoryQueueItem, signal?: AbortSignal) {
  return readRequest(inventoryQueueDetail(safeInventoryKey(item), cookieSessionReadOptions(signal)), parseInventoryDetail);
}

export function getPortalInventorySubmittedAnswers(item: PortalInventoryQueueItem, signal?: AbortSignal) {
  return readRequest(inventoryQueueSensitiveDetail(safeInventoryKey(item), cookieSessionReadOptions(signal)), parseInventoryDetail);
}

async function runMutation(
  request: (options: RequestInit) => Promise<GeneratedResponse>,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  try {
    const response = await request(withIdempotencyKey(key, await cookieSessionMutationOptions(signal)));
    if (response.status >= 200 && response.status < 300) return;
    throw new FormsApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof FormsApiError) throw error;
    throw new FormsApiError("unavailable");
  }
}

export function reopenPortalInventory(
  item: PortalInventoryQueueItem,
  reason: string,
  expectedStateToken: string,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  const normalizedReason = reason.trim().slice(0, 500);
  if (!normalizedReason) throw new FormsApiError("validation");
  return runMutation(
    (options) => inventoryReopen(safeInventoryKey(item), { reason: normalizedReason, expected_state_token: expectedStateToken }, options),
    key,
    signal,
  );
}

export function getPortalExitInterviewQueue(page = 1, filters: FormsListFilters, signal?: AbortSignal) {
  const params = buildListParams(filters, page, EXIT_STATUS_SET) as ExitInterviewsQueueListParams;
  return readRequest(exitInterviewsQueueList(params, cookieSessionReadOptions(signal)), parseExitPage);
}

export function getPortalExitInterviewQueueDetail(referenceCode: string, signal?: AbortSignal) {
  return readRequest(exitInterviewsQueueDetail(safeReference(referenceCode), cookieSessionReadOptions(signal)), parseExitDetail);
}

export function getPortalExitInterviewAnswers(referenceCode: string, signal?: AbortSignal) {
  return readRequest(exitInterviewsQueueSensitiveDetail(safeReference(referenceCode), cookieSessionReadOptions(signal)), parseExitDetail);
}

type LifecycleOptions = { expectedUpdatedAt?: string | null; reasonCode?: string };

function lifecyclePayload(options: LifecycleOptions = {}) {
  const payload: Record<string, string | null> = {};
  if (options.expectedUpdatedAt !== undefined) payload.expected_updated_at = options.expectedUpdatedAt;
  if (options.reasonCode) payload.reason = options.reasonCode.trim().slice(0, 120);
  return payload as unknown as LifecycleSchema;
}

export function acknowledgePortalExitInterview(referenceCode: string, key: IdempotencyKey, options: LifecycleOptions = {}, signal?: AbortSignal) {
  return runMutation((requestOptions) => exitInterviewsAcknowledge(safeReference(referenceCode), { expected_updated_at: options.expectedUpdatedAt }, requestOptions), key, signal);
}

export function reopenPortalExitInterview(referenceCode: string, reasonCode: string, key: IdempotencyKey, options: LifecycleOptions = {}, signal?: AbortSignal) {
  return runMutation((requestOptions) => exitInterviewsReopen(safeReference(referenceCode), lifecyclePayload({ ...options, reasonCode }), requestOptions), key, signal);
}

export function voidPortalExitInterview(referenceCode: string, reasonCode: string, key: IdempotencyKey, options: LifecycleOptions = {}, signal?: AbortSignal) {
  return runMutation((requestOptions) => exitInterviewsVoid(safeReference(referenceCode), lifecyclePayload({ ...options, reasonCode }), requestOptions), key, signal);
}

export function archivePortalExitInterview(referenceCode: string, reasonCode: string, key: IdempotencyKey, options: LifecycleOptions = {}, signal?: AbortSignal) {
  return runMutation((requestOptions) => exitInterviewsArchive(safeReference(referenceCode), lifecyclePayload({ ...options, reasonCode }), requestOptions), key, signal);
}
