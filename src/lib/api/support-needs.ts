import {
  profilesStaffStudents,
} from "@/lib/api/generated/profiles/profiles";
import {
  supportNeedsStaffArchive,
  supportNeedsStaffCreate,
  supportNeedsStaffDeactivate,
  supportNeedsStaffDetail,
  supportNeedsStaffDispute,
  supportNeedsStaffMarkReview,
  supportNeedsStaffQueue,
  supportNeedsStaffReasonCodes,
  supportNeedsStaffUpdate,
  supportNeedsStaffVerify,
  supportNeedsTypes,
} from "@/lib/api/generated/support-needs/support-needs";
import type {
  SupportNeedStaffCreateSchema,
  SupportNeedStaffReasonSchema,
  SupportNeedStaffUpdateSchema,
  SupportNeedsStaffQueueParams,
} from "@/lib/api/generated/model";
import {
  cookieSessionMutationOptions,
  cookieSessionReadOptions,
} from "@/lib/api/auth";
import { withIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";
import { isResourceVersion } from "@/lib/api/resource-version";

export const SUPPORT_NEEDS_PAGE_SIZE = 20;

export const SUPPORT_NEED_STATUSES = [
  "draft",
  "active",
  "needs_review",
  "verified",
  "disputed",
  "inactive",
  "archived",
] as const;

export const SUPPORT_NEED_CATEGORIES = [
  "household_support",
  "disability_support",
  "family_context",
  "employment_context",
  "financial_context",
  "living_condition",
  "educational_support",
  "office_approved_other",
] as const;

export const SUPPORT_NEED_SOURCES = [
  "student_provided",
  "counselor_staff_verification",
  "official_document_presented",
  "manual_office_validation",
  "imported_official_list_future",
] as const;

export const SUPPORT_NEED_ORDERS = ["recent", "oldest"] as const;

export type SupportNeedStatus = (typeof SUPPORT_NEED_STATUSES)[number];
export type SupportNeedCategory = (typeof SUPPORT_NEED_CATEGORIES)[number];
export type SupportNeedSource = (typeof SUPPORT_NEED_SOURCES)[number];
export type SupportNeedOrder = (typeof SUPPORT_NEED_ORDERS)[number];

export type SupportNeedListFilters = {
  q: string | null;
  status: string | null;
  statuses: SupportNeedStatus[];
  typeKey: string | null;
  category: SupportNeedCategory | null;
  sourceType: SupportNeedSource | null;
  order: SupportNeedOrder;
};

export type PortalSupportNeed = {
  reference_code: string;
  student_display_name: string;
  student_number: string | null;
  type_key: string;
  type_label: string;
  type_category: SupportNeedCategory;
  status: SupportNeedStatus;
  source_type: SupportNeedSource;
  source_snapshot_label: string | null;
  effective_from: string | null;
  effective_until: string | null;
  review_due_at: string | null;
  created_at: string;
  updated_at: string;
  resource_version: string;
  verified_at: string | null;
  reviewed_at: string | null;
  disputed_at: string | null;
  archived_at: string | null;
};

export type PortalSupportNeedPage = {
  items: PortalSupportNeed[];
  page: number;
  page_size: number;
  total: number;
};

export type PortalSupportNeedType = {
  key: string;
  label: string;
  category: SupportNeedCategory;
  is_active: boolean;
};

export type PortalSupportNeedStudentOption = {
  label: string;
  selection_token: string;
};

export type PortalSupportNeedReasonCode = {
  value: string;
  label: string;
};

export type SupportNeedsApiErrorKind =
  | "conflict"
  | "permission"
  | "rate_limited"
  | "unavailable"
  | "validation";

export class SupportNeedsApiError extends Error {
  readonly kind: SupportNeedsApiErrorKind;

  constructor(kind: SupportNeedsApiErrorKind) {
    super("The Support Needs workspace request could not be completed.");
    this.name = "SupportNeedsApiError";
    this.kind = kind;
  }
}

type GeneratedResponse = { data: unknown; status: number };

const MAX_PAGE = 100_000;
const MAX_QUERY_LENGTH = 120;
const MAX_LABEL_LENGTH = 240;
const MAX_TYPE_KEY_LENGTH = 100;
const MAX_REFERENCE_LENGTH = 4096;
const MAX_REASON_LENGTH = 160;
const STATUS_SET = new Set<string>(SUPPORT_NEED_STATUSES);
const CATEGORY_SET = new Set<string>(SUPPORT_NEED_CATEGORIES);
const SOURCE_SET = new Set<string>(SUPPORT_NEED_SOURCES);
const TYPE_KEY_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,99})$/;

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

function requiredTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value));
}

function safePage(value: number) {
  return Number.isSafeInteger(value) && value >= 1 && value <= MAX_PAGE ? value : 1;
}

function safeText(value: string | null | undefined, max: number) {
  const normalized = value?.trim() ?? "";
  if (normalized.length > max) throw new SupportNeedsApiError("validation");
  return normalized || null;
}

function safeReference(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_REFERENCE_LENGTH || /[/?#\\\u0000-\u001f]/.test(normalized)) {
    throw new SupportNeedsApiError("validation");
  }
  return normalized;
}

function safeSelectionToken(value: string) {
  if (!boundedString(value, MAX_REFERENCE_LENGTH) || /[\u0000-\u001f]/.test(value)) {
    throw new SupportNeedsApiError("validation");
  }
  return value;
}

function safeTypeKey(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length > MAX_TYPE_KEY_LENGTH || !TYPE_KEY_PATTERN.test(normalized)) {
    throw new SupportNeedsApiError("validation");
  }
  return normalized;
}

function safeDate(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(Date.parse(`${normalized}T00:00:00Z`))) {
    throw new SupportNeedsApiError("validation");
  }
  return normalized;
}

function safeTimestamp(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (!optionalTimestamp(normalized)) throw new SupportNeedsApiError("validation");
  return normalized;
}

function errorKind(status: number): SupportNeedsApiErrorKind {
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
    throw new SupportNeedsApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof SupportNeedsApiError) throw error;
    throw new SupportNeedsApiError("unavailable");
  }
}

function parseProjection(value: unknown): PortalSupportNeed | null {
  if (!isRecord(value)) return null;
  if (
    !boundedString(value.reference_code, MAX_REFERENCE_LENGTH) ||
    /[/?#\\\u0000-\u001f]/.test(value.reference_code) ||
    !boundedString(value.student_display_name, 160) ||
    !optionalString(value.student_number, 50) ||
    !boundedString(value.type_key, MAX_TYPE_KEY_LENGTH) ||
    !TYPE_KEY_PATTERN.test(value.type_key) ||
    !boundedString(value.type_label, 200) ||
    typeof value.type_category !== "string" || !CATEGORY_SET.has(value.type_category) ||
    typeof value.status !== "string" || !STATUS_SET.has(value.status) ||
    typeof value.source_type !== "string" || !SOURCE_SET.has(value.source_type) ||
    !optionalString(value.source_snapshot_label, 100) ||
    !optionalTimestamp(value.effective_from) ||
    !optionalTimestamp(value.effective_until) ||
    !optionalTimestamp(value.review_due_at) ||
    !requiredTimestamp(value.created_at) ||
    !requiredTimestamp(value.updated_at) ||
    !isResourceVersion(value.resource_version) ||
    !optionalTimestamp(value.verified_at) ||
    !optionalTimestamp(value.reviewed_at) ||
    !optionalTimestamp(value.disputed_at) ||
    !optionalTimestamp(value.archived_at)
  ) return null;

  return {
    reference_code: value.reference_code,
    student_display_name: value.student_display_name,
    student_number: value.student_number ?? null,
    type_key: value.type_key,
    type_label: value.type_label,
    type_category: value.type_category as SupportNeedCategory,
    status: value.status as SupportNeedStatus,
    source_type: value.source_type as SupportNeedSource,
    source_snapshot_label: value.source_snapshot_label ?? null,
    effective_from: value.effective_from ?? null,
    effective_until: value.effective_until ?? null,
    review_due_at: value.review_due_at ?? null,
    created_at: value.created_at,
    updated_at: value.updated_at,
    resource_version: value.resource_version,
    verified_at: value.verified_at ?? null,
    reviewed_at: value.reviewed_at ?? null,
    disputed_at: value.disputed_at ?? null,
    archived_at: value.archived_at ?? null,
  };
}

function parsePage(value: unknown): PortalSupportNeedPage | null {
  if (!isRecord(value) || !Array.isArray(value.items) ||
    typeof value.page !== "number" || !Number.isSafeInteger(value.page) || value.page < 1 || value.page > MAX_PAGE ||
    typeof value.page_size !== "number" || value.page_size !== SUPPORT_NEEDS_PAGE_SIZE ||
    typeof value.total !== "number" || !Number.isSafeInteger(value.total) || value.total < 0 ||
    value.items.length > SUPPORT_NEEDS_PAGE_SIZE) return null;
  const items = value.items.map(parseProjection);
  if (items.some((item) => item === null)) return null;
  return {
    items: items as PortalSupportNeed[],
    page: value.page,
    page_size: value.page_size,
    total: value.total,
  };
}

function parseStudentOptions(value: unknown): PortalSupportNeedStudentOption[] | null {
  if (!isRecord(value) || !Array.isArray(value.items) || value.items.length > SUPPORT_NEEDS_PAGE_SIZE) return null;
  const items = value.items.map((item) => {
    if (!isRecord(item) || !boundedString(item.label, MAX_LABEL_LENGTH) || !boundedString(item.selection_token, MAX_REFERENCE_LENGTH)) return null;
    return { label: item.label, selection_token: item.selection_token };
  });
  if (items.some((item) => item === null)) return null;
  if (new Set(items.map((item) => item?.selection_token)).size !== items.length) return null;
  return items as PortalSupportNeedStudentOption[];
}

function parseTypes(value: unknown): PortalSupportNeedType[] | null {
  if (!isRecord(value) || !Array.isArray(value.items) || value.items.length > 100) return null;
  const items = value.items.map((item) => {
    if (!isRecord(item) || !boundedString(item.key, MAX_TYPE_KEY_LENGTH) || !TYPE_KEY_PATTERN.test(item.key) ||
      !boundedString(item.label, 200) || typeof item.category !== "string" || !CATEGORY_SET.has(item.category) ||
      typeof item.is_active !== "boolean") return null;
    return {
      key: item.key,
      label: item.label,
      category: item.category as SupportNeedCategory,
      is_active: item.is_active,
    };
  });
  if (items.some((item) => item === null)) return null;
  return items as PortalSupportNeedType[];
}

function parseReasonCodes(value: unknown): PortalSupportNeedReasonCode[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const items = value.map((item) => {
    if (!isRecord(item) || !boundedString(item.value, MAX_REASON_LENGTH) || !boundedString(item.label, 200)) return null;
    return { value: item.value, label: item.label };
  });
  if (items.some((item) => item === null)) return null;
  if (new Set(items.map((item) => item?.value)).size !== items.length) return null;
  return items as PortalSupportNeedReasonCode[];
}

function normalizeStatuses(value: string | null | undefined, strict: boolean) {
  if (!value) return [] as SupportNeedStatus[];
  const values = [...new Set(value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean))];
  if (values.length > SUPPORT_NEED_STATUSES.length || values.some((item) => !STATUS_SET.has(item))) {
    if (!strict) return [] as SupportNeedStatus[];
    throw new SupportNeedsApiError("validation");
  }
  return values as SupportNeedStatus[];
}

function normalizeOptionalEnum<T extends readonly string[]>(value: string | null | undefined, values: T, strict: boolean) {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) return null;
  if (!values.includes(normalized as T[number])) {
    if (!strict) return null;
    throw new SupportNeedsApiError("validation");
  }
  return normalized as T[number];
}

function normalizeTypeKey(value: string | null | undefined, strict: boolean) {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) return null;
  if (normalized.length > MAX_TYPE_KEY_LENGTH || !TYPE_KEY_PATTERN.test(normalized)) {
    if (!strict) return null;
    throw new SupportNeedsApiError("validation");
  }
  return normalized;
}

export function parseSupportNeedFilters(params: { get: (name: string) => string | null }): SupportNeedListFilters {
  const statuses = normalizeStatuses(params.get("status"), false);
  const q = params.get("q")?.trim() ?? "";
  return {
    q: q && q.length <= MAX_QUERY_LENGTH ? q : null,
    status: statuses.length ? statuses.join(",") : null,
    statuses,
    typeKey: normalizeTypeKey(params.get("type_key"), false),
    category: normalizeOptionalEnum(params.get("category"), SUPPORT_NEED_CATEGORIES, false),
    sourceType: normalizeOptionalEnum(params.get("source_type"), SUPPORT_NEED_SOURCES, false),
    order: normalizeOptionalEnum(params.get("order"), SUPPORT_NEED_ORDERS, false) ?? "recent",
  };
}

export function supportNeedHref(page = 1, filters: SupportNeedListFilters) {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set("q", filters.q.trim().slice(0, MAX_QUERY_LENGTH));
  if (filters.statuses.length) params.set("status", filters.statuses.join(","));
  if (filters.typeKey) params.set("type_key", filters.typeKey);
  if (filters.category) params.set("category", filters.category);
  if (filters.sourceType) params.set("source_type", filters.sourceType);
  if (filters.order !== "recent") params.set("order", filters.order);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/portal/support-needs?${query}` : "/portal/support-needs";
}

function listParams(page: number, filters: SupportNeedListFilters): SupportNeedsStaffQueueParams {
  const q = safeText(filters.q, MAX_QUERY_LENGTH);
  const statuses = normalizeStatuses(filters.status, true);
  const typeKey = filters.typeKey ? safeTypeKey(filters.typeKey) : null;
  const category = filters.category ? normalizeOptionalEnum(filters.category, SUPPORT_NEED_CATEGORIES, true) : null;
  const sourceType = filters.sourceType ? normalizeOptionalEnum(filters.sourceType, SUPPORT_NEED_SOURCES, true) : null;
  const order = normalizeOptionalEnum(filters.order, SUPPORT_NEED_ORDERS, true) ?? "recent";
  return {
    page: safePage(page),
    page_size: SUPPORT_NEEDS_PAGE_SIZE,
    ...(q ? { q } : {}),
    ...(statuses.length ? { status: statuses.join(",") } : {}),
    ...(typeKey ? { type_key: typeKey } : {}),
    ...(category ? { category } : {}),
    ...(sourceType ? { source_type: sourceType } : {}),
    ...(order !== "recent" ? { order } : {}),
  };
}

async function runMutation<T>(
  request: (options: RequestInit) => Promise<GeneratedResponse>,
  key: IdempotencyKey,
  parse: (value: unknown) => T | null,
  signal?: AbortSignal,
) {
  try {
    const response = await request(withIdempotencyKey(key, await cookieSessionMutationOptions(signal)));
    if (response.status >= 200 && response.status < 300) {
      const value = parse(response.data);
      if (value !== null) return value;
    }
    throw new SupportNeedsApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof SupportNeedsApiError) throw error;
    throw new SupportNeedsApiError("unavailable");
  }
}

export function getPortalSupportNeeds(page: number, filters: SupportNeedListFilters, signal?: AbortSignal) {
  return readRequest(supportNeedsStaffQueue(listParams(page, filters), cookieSessionReadOptions(signal)), parsePage);
}

export function getPortalSupportNeedDetail(referenceCode: string, signal?: AbortSignal) {
  return readRequest(supportNeedsStaffDetail(safeReference(referenceCode), cookieSessionReadOptions(signal)), parseProjection);
}

export function getPortalSupportNeedStudentOptions(query: string, signal?: AbortSignal) {
  const normalized = safeText(query, MAX_QUERY_LENGTH) ?? "";
  return readRequest(
    profilesStaffStudents({ q: normalized, page: 1, page_size: SUPPORT_NEEDS_PAGE_SIZE, workflow: "support_need" }, cookieSessionReadOptions(signal)),
    parseStudentOptions,
  );
}

export function getPortalSupportNeedTypes(signal?: AbortSignal) {
  return readRequest(
    supportNeedsTypes({ page: 1, page_size: 100 }, cookieSessionReadOptions(signal)),
    parseTypes,
  );
}

export function getPortalSupportNeedReasonCodes(signal?: AbortSignal) {
  return readRequest(supportNeedsStaffReasonCodes(cookieSessionReadOptions(signal)), parseReasonCodes);
}

function reasonPayload(reasonCode: string): SupportNeedStaffReasonSchema {
  const reason = safeText(reasonCode, MAX_REASON_LENGTH);
  if (!reason) throw new SupportNeedsApiError("validation");
  return { reason_code: reason };
}

export type PortalSupportNeedCreateInput = {
  student_selection_token: string;
  support_need_type_key: string;
  source_type: SupportNeedSource;
  source_snapshot_label?: string | null;
  effective_from?: string | null;
  effective_until?: string | null;
  review_due_at?: string | null;
};

export type PortalSupportNeedUpdateInput = {
  effective_from?: string | null;
  effective_until?: string | null;
  review_due_at?: string | null;
  source_snapshot_label?: string | null;
};

export function createPortalSupportNeed(payload: PortalSupportNeedCreateInput, key: IdempotencyKey, signal?: AbortSignal) {
  const source = normalizeOptionalEnum(payload.source_type, SUPPORT_NEED_SOURCES, true);
  if (!source || source === "imported_official_list_future") {
    throw new SupportNeedsApiError("validation");
  }
  const createPayload: SupportNeedStaffCreateSchema = {
    student_selection_token: safeSelectionToken(payload.student_selection_token),
    support_need_type_key: safeTypeKey(payload.support_need_type_key),
    source_type: source,
    ...(payload.source_snapshot_label?.trim() ? { source_snapshot_label: safeText(payload.source_snapshot_label, 100)! } : {}),
    ...(payload.effective_from ? { effective_from: safeDate(payload.effective_from) } : {}),
    ...(payload.effective_until ? { effective_until: safeDate(payload.effective_until) } : {}),
    ...(payload.review_due_at ? { review_due_at: safeTimestamp(payload.review_due_at) } : {}),
  };
  return runMutation((options) => supportNeedsStaffCreate(createPayload, options), key, parseProjection, signal);
}

export function updatePortalSupportNeed(referenceCode: string, payload: PortalSupportNeedUpdateInput, key: IdempotencyKey, signal?: AbortSignal) {
  const updatePayload: SupportNeedStaffUpdateSchema = {};
  if (payload.effective_from !== undefined) updatePayload.effective_from = payload.effective_from ? safeDate(payload.effective_from) : null;
  if (payload.effective_until !== undefined) updatePayload.effective_until = payload.effective_until ? safeDate(payload.effective_until) : null;
  if (payload.review_due_at !== undefined) updatePayload.review_due_at = payload.review_due_at ? safeTimestamp(payload.review_due_at) : null;
  if (payload.source_snapshot_label !== undefined) updatePayload.source_snapshot_label = safeText(payload.source_snapshot_label, 100) ?? "";
  if (!Object.keys(updatePayload).length) throw new SupportNeedsApiError("validation");
  return runMutation((options) => supportNeedsStaffUpdate(safeReference(referenceCode), updatePayload, options), key, parseProjection, signal);
}

export function verifyPortalSupportNeed(referenceCode: string, reasonCode: string, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => supportNeedsStaffVerify(safeReference(referenceCode), reasonPayload(reasonCode), options), key, parseProjection, signal);
}

export function markPortalSupportNeedForReview(referenceCode: string, reasonCode: string, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => supportNeedsStaffMarkReview(safeReference(referenceCode), reasonPayload(reasonCode), options), key, parseProjection, signal);
}

export function disputePortalSupportNeed(referenceCode: string, reasonCode: string, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => supportNeedsStaffDispute(safeReference(referenceCode), reasonPayload(reasonCode), options), key, parseProjection, signal);
}

export function deactivatePortalSupportNeed(referenceCode: string, reasonCode: string, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => supportNeedsStaffDeactivate(safeReference(referenceCode), reasonPayload(reasonCode), options), key, parseProjection, signal);
}

export function archivePortalSupportNeed(referenceCode: string, reasonCode: string, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => supportNeedsStaffArchive(safeReference(referenceCode), reasonPayload(reasonCode), options), key, parseProjection, signal);
}
