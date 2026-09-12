import {
  referralsActionRequired,
  referralsAssign,
  referralsCancel,
  referralsClose,
  referralsCounselorOptions,
  referralsCreate,
  referralsDetail,
  referralsEscalate,
  referralsQueueList,
  referralsReassign,
  referralsReceive,
  referralsReopen,
  referralsReview,
  referralsSubmit,
} from "@/lib/api/generated/referrals/referrals";
import { profilesStaffStudents } from "@/lib/api/generated/profiles/profiles";
import type {
  ReferralAssignmentSchema,
  ReferralDraftSchema,
  ReferralStaffQueueItemSchema,
  ReferralSubmitSchema,
  ReferralTransitionSchema,
  ReferralsQueueListParams,
} from "@/lib/api/generated/model";
import {
  cookieSessionMutationOptions,
  cookieSessionReadOptions,
} from "@/lib/api/auth";
import { withIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";

export const REFERRALS_PAGE_SIZE = 20;

export const REFERRAL_QUEUE_STATUSES = [
  "DRAFT", "SUBMITTED", "RECEIVED", "UNDER_REVIEW", "ACTION_REQUIRED",
  "ESCALATED", "CLOSED", "CANCELLED",
] as const;
export const REFERRAL_SOURCE_TYPES = [
  "FACULTY", "ADVISER", "INSTITUTIONAL_STAFF", "PARENT_GUARDIAN", "GCO", "OTHER",
] as const;
export const REFERRAL_REASON_CATEGORIES = [
  "UNCATEGORIZED", "ACADEMIC", "ATTENDANCE", "BEHAVIOR_OR_CONDUCT",
  "PERSONAL_OR_SOCIAL", "FAMILY_OR_HOME", "FINANCIAL", "CAREER_OR_PLANNING", "OTHER",
] as const;
export const REFERRAL_QUEUE_ORDERS = ["recent", "oldest"] as const;
export const REFERRAL_ASSIGNMENTS = ["all", "mine", "unassigned"] as const;

export type ReferralQueueStatus = (typeof REFERRAL_QUEUE_STATUSES)[number];
export type ReferralSourceType = (typeof REFERRAL_SOURCE_TYPES)[number];
export type ReferralReasonCategory = (typeof REFERRAL_REASON_CATEGORIES)[number];
export type ReferralQueueOrder = (typeof REFERRAL_QUEUE_ORDERS)[number];
export type ReferralAssignment = (typeof REFERRAL_ASSIGNMENTS)[number];

type ReferralCreatePayload = Omit<ReferralDraftSchema, "student_id"> & {
  student_id?: number;
  student_selection_token?: string;
};

export type ReferralTransition = "receive" | "review" | "action-required" | "escalate" | "close" | "cancel" | "reopen";

export type ReferralsFilters = {
  q: string | null;
  status: string | null;
  statuses: string[];
  academicYear: string | null;
  assignment: ReferralAssignment;
  sourceType: string | null;
  reasonCategory: string | null;
  order: ReferralQueueOrder;
};

export type ReferralCounselorOption = { selection_token: string; display_name: string };
export type StaffStudentOption = {
  selection_token: string;
  label: string;
};

export type ReferralStaffQueueItem = {
  reference_code: string;
  student_display_name: string;
  student_number: string | null;
  student_block_snapshot: string | null;
  source_type: ReferralSourceType;
  source_type_label: string;
  reason_category: string;
  reason_category_label: string;
  status: ReferralQueueStatus;
  status_label: string;
  assignment_state: string;
  age_bucket: string;
  received_at: string | null;
  created_at: string;
  updated_at: string;
  has_active_call_slip: boolean;
  active_call_slip_reference: string | null;
  can_prepare_call_slip: boolean;
  is_terminal: boolean;
};

export type PortalReferralLinkedCallSlip = {
  reference_code: string;
  status_code: string;
  status_label: string;
};

export type PortalReferralDetail = {
  reference_code: string;
  status: string;
  student_label: string;
  source_type: string;
  reason_category: string;
  assignment_state: string;
  updated_at: string | null;
  linked_call_slips: PortalReferralLinkedCallSlip[];
};

export type PortalReferralsPage = {
  items: ReferralStaffQueueItem[];
  page: number;
  page_size: number;
  total: number;
};

export type ReferralsErrorKind =
  | "conflict" | "permission" | "rate_limited" | "unavailable" | "validation";

export class ReferralsApiError extends Error {
  readonly kind: ReferralsErrorKind;
  constructor(kind: ReferralsErrorKind) {
    super("The referrals workspace request could not be completed.");
    this.name = "ReferralsApiError";
    this.kind = kind;
  }
}

type GeneratedResponse = { data: unknown; status: number };

const MAX_PAGE = 100_000;
const MAX_QUERY_LENGTH = 120;
const MAX_FILTER_LENGTH = 100;
const MAX_REFERENCE_LENGTH = 25;
const STATUS_SET = new Set<string>(REFERRAL_QUEUE_STATUSES);
const SOURCE_SET = new Set<string>(REFERRAL_SOURCE_TYPES);
const CATEGORY_SET = new Set<string>(REFERRAL_REASON_CATEGORIES);
const ORDER_SET = new Set<string>(REFERRAL_QUEUE_ORDERS);
const ASSIGNMENT_SET = new Set<string>(REFERRAL_ASSIGNMENTS);
const ASSIGNMENT_STATE_SET = new Set(["Assigned", "Unassigned"]);

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

function errorKind(status: number): ReferralsErrorKind {
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 422) return "validation";
  if (status === 401 || status === 403 || status === 404) return "permission";
  return "unavailable";
}

function isReferralProjection(value: unknown): value is ReferralStaffQueueItemSchema {
  if (!isRecord(value)) return false;
  return (
    boundedString(value.reference_code, MAX_REFERENCE_LENGTH) &&
    boundedString(value.student_display_name, 160) &&
    optionalString(value.student_number, 50) &&
    optionalString(value.student_block_snapshot, 100) &&
    boundedString(value.source_type, 30) && SOURCE_SET.has(value.source_type) &&
    boundedString(value.source_type_label, 60) &&
    boundedString(value.reason_category, 30) && CATEGORY_SET.has(value.reason_category) &&
    boundedString(value.reason_category_label, 60) &&
    boundedString(value.status, 30) && STATUS_SET.has(value.status) &&
    boundedString(value.status_label, 60) &&
    boundedString(value.assignment_state, 20) && ASSIGNMENT_STATE_SET.has(value.assignment_state) &&
    boundedString(value.age_bucket, 40) &&
    optionalTimestamp(value.received_at) &&
    requiredTimestamp(value.created_at) &&
    requiredTimestamp(value.updated_at) &&
    typeof value.has_active_call_slip === "boolean" &&
    typeof value.can_prepare_call_slip === "boolean" &&
    typeof value.is_terminal === "boolean" &&
    optionalString(value.active_call_slip_reference, MAX_REFERENCE_LENGTH)
  );
}

function parseReferralItem(value: unknown): ReferralStaffQueueItem | null {
  if (!isReferralProjection(value)) return null;
  return {
    reference_code: value.reference_code,
    student_display_name: value.student_display_name.slice(0, 160),
    student_number: value.student_number ?? null,
    student_block_snapshot: value.student_block_snapshot ?? null,
    source_type: value.source_type as ReferralSourceType,
    source_type_label: value.source_type_label,
    reason_category: value.reason_category,
    reason_category_label: value.reason_category_label,
    status: value.status as ReferralQueueStatus,
    status_label: value.status_label,
    assignment_state: value.assignment_state,
    age_bucket: value.age_bucket,
    received_at: value.received_at ?? null,
    created_at: value.created_at,
    updated_at: value.updated_at,
    has_active_call_slip: value.has_active_call_slip,
    active_call_slip_reference: value.active_call_slip_reference ?? null,
    can_prepare_call_slip: value.can_prepare_call_slip,
    is_terminal: value.is_terminal,
  };
}
function isReferralPage(value: unknown): value is { items: unknown[]; page: number; page_size: number; total: number } {
  return isRecord(value) && Array.isArray(value.items) &&
    typeof value.page === "number" && Number.isSafeInteger(value.page) && value.page >= 1 && value.page <= MAX_PAGE &&
    typeof value.page_size === "number" && Number.isSafeInteger(value.page_size) && value.page_size === REFERRALS_PAGE_SIZE &&
    typeof value.total === "number" && Number.isSafeInteger(value.total) && value.total >= 0 && value.items.length <= value.page_size;
}

function parseReferralsPage(value: unknown): PortalReferralsPage | null {
  if (!isReferralPage(value)) return null;
  const items = value.items
    .map(parseReferralItem)
    .filter((item): item is ReferralStaffQueueItem => item !== null);
  return { items, page: value.page, page_size: value.page_size, total: value.total };
}

function safeReference(value: string) {
  const reference = value.trim().slice(0, MAX_REFERENCE_LENGTH);
  if (!reference) throw new ReferralsApiError("validation");
  return reference;
}

function normalizeQuery(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (normalized.length > MAX_QUERY_LENGTH) throw new ReferralsApiError("validation");
  return normalized;
}

function normalizeFilter(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (normalized.length > MAX_FILTER_LENGTH) throw new ReferralsApiError("validation");
  return normalized;
}

function normalizeStatuses(value: string | null | undefined, allowed: Set<string>, strict = true) {
  if (!value) return [];
  const values = [...new Set(value.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean))];
  if (values.length > 12 || values.some((item) => !allowed.has(item))) {
    if (!strict) return [];
    throw new ReferralsApiError("validation");
  }
  return values;
}

function normalizeSingle(value: string | null | undefined, allowed: Set<string>, strict = true) {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (!allowed.has(normalized)) {
    if (!strict) return null;
    throw new ReferralsApiError("validation");
  }
  return normalized;
}

export function parseReferralsFilters(params: { get: (name: string) => string | null }): ReferralsFilters {
  const statuses = normalizeStatuses(params.get("status"), STATUS_SET, false);
  const order = params.get("order");
  const assignment = params.get("assignment");
  return {
    q: params.get("q")?.trim().slice(0, MAX_QUERY_LENGTH) || null,
    status: statuses.length ? statuses.join(",") : null,
    statuses,
    academicYear: params.get("academic_year")?.trim().slice(0, MAX_FILTER_LENGTH) || null,
    assignment: assignment && ASSIGNMENT_SET.has(assignment) ? assignment as ReferralAssignment : "all",
    sourceType: normalizeSingle(params.get("source_type"), SOURCE_SET, false),
    reasonCategory: normalizeSingle(params.get("reason_category"), CATEGORY_SET, false),
    order: order && ORDER_SET.has(order) ? order as ReferralQueueOrder : "recent",
  };
}

export function referralsHref(section: "referrals" | "call-slips", page = 1, filters: ReferralsFilters) {
  const params = new URLSearchParams({ section });
  if (filters.statuses.length) params.set("status", filters.statuses.join(","));
  if (filters.q?.trim()) params.set("q", filters.q.trim().slice(0, MAX_QUERY_LENGTH));
  if (filters.academicYear?.trim()) params.set("academic_year", filters.academicYear.trim().slice(0, MAX_FILTER_LENGTH));
  if (filters.assignment !== "all") params.set("assignment", filters.assignment);
  if (filters.sourceType) params.set("source_type", filters.sourceType);
  if (filters.reasonCategory) params.set("reason_category", filters.reasonCategory);
  if (filters.order !== "recent") params.set("order", filters.order);
  if (page > 1) params.set("page", String(page));
  return `/portal/referrals?${params.toString()}`;
}

function buildListParams(filters: ReferralsFilters, page: number) {
  const q = normalizeQuery(filters.q);
  const academicYear = normalizeFilter(filters.academicYear);
  const statuses = normalizeStatuses(filters.status, STATUS_SET);
  const sourceType = normalizeSingle(filters.sourceType, SOURCE_SET);
  const reasonCategory = normalizeSingle(filters.reasonCategory, CATEGORY_SET);
  const params: ReferralsQueueListParams = {
    page: safePage(page),
    page_size: REFERRALS_PAGE_SIZE,
    ...(q ? { q } : {}),
    ...(statuses.length ? { status: statuses.join(",") } : {}),
    ...(academicYear ? { academic_year: academicYear } : {}),
    ...(filters.assignment !== "all" ? { assignment: filters.assignment } : {}),
    ...(sourceType ? { source_type: sourceType } : {}),
    ...(reasonCategory ? { reason_category: reasonCategory } : {}),
    ...(filters.order !== "recent" ? { order: filters.order } : {}),
  };
  return params;
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
    throw new ReferralsApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof ReferralsApiError) throw error;
    throw new ReferralsApiError("unavailable");
  }
}
export function getPortalReferralQueue(page = 1, filters: ReferralsFilters, signal?: AbortSignal) {
  return readRequest(
    referralsQueueList(buildListParams(filters, page), cookieSessionReadOptions(signal)),
    parseReferralsPage,
  );
}

export function getPortalReferralDetail(referenceCode: string, signal?: AbortSignal) {
  return readRequest(
    referralsDetail(safeReference(referenceCode), cookieSessionReadOptions(signal)),
    parseReferralDetail,
  );
}

function parseReferralDetail(value: unknown): PortalReferralDetail | null {
  if (!isRecord(value)) return null;
  if (
    !boundedString(value.reference_code, MAX_REFERENCE_LENGTH) ||
    !boundedString(value.status, 40) || !STATUS_SET.has(value.status) ||
    !boundedString(value.student_label, 160) ||
    !boundedString(value.source_type, 40) || !SOURCE_SET.has(value.source_type) ||
    !boundedString(value.reason_category, 40) || !CATEGORY_SET.has(value.reason_category) ||
    !boundedString(value.assignment_state, 40) || !ASSIGNMENT_STATE_SET.has(value.assignment_state) ||
    !optionalTimestamp(value.updated_at) ||
    !Array.isArray(value.linked_call_slips)
  ) return null;

  const linkedCallSlips = value.linked_call_slips
    .map((entry): PortalReferralLinkedCallSlip | null => {
      if (!isRecord(entry)) return null;
      if (
        !boundedString(entry.reference_code, MAX_REFERENCE_LENGTH) ||
        !boundedString(entry.status_code, 40) ||
        !boundedString(entry.status_label, 80)
      ) return null;
      return {
        reference_code: entry.reference_code,
        status_code: entry.status_code,
        status_label: entry.status_label,
      };
    })
    .filter((entry): entry is PortalReferralLinkedCallSlip => entry !== null)
    .slice(0, 25);

  return {
    reference_code: value.reference_code,
    status: value.status,
    student_label: value.student_label,
    source_type: value.source_type,
    reason_category: value.reason_category,
    assignment_state: value.assignment_state,
    updated_at: value.updated_at ?? null,
    linked_call_slips: linkedCallSlips,
  };
}

export function getPortalReferralCounselorOptions(referenceCode: string, q = "", signal?: AbortSignal) {
  return readRequest(
    referralsCounselorOptions(
      safeReference(referenceCode),
      { page: 1, page_size: 20, q: q || undefined },
      cookieSessionReadOptions(signal),
    ),
    (value): ReferralCounselorOption[] | null => {
      if (!isRecord(value) || !Array.isArray(value.items)) return null;
      return value.items
        .map((entry) => isRecord(entry) && boundedString(entry.selection_token, 500) && boundedString(entry.display_name, 160)
          ? { selection_token: entry.selection_token, display_name: entry.display_name }
          : null)
        .filter((entry): entry is ReferralCounselorOption => entry !== null);
    },
  );
}

export function getPortalStaffStudents(q = "", workflow: "referral" | "call_slip" = "referral", signal?: AbortSignal) {
  return readRequest(
    profilesStaffStudents(
      { page: 1, page_size: 25, q: q || undefined, workflow } as unknown as Parameters<typeof profilesStaffStudents>[0],
      cookieSessionReadOptions(signal),
    ),
    (value): StaffStudentOption[] | null => {
      if (!isRecord(value) || !Array.isArray(value.items)) return null;
      return value.items
        .map((entry) => isRecord(entry) && boundedString(entry.selection_token, 500) && boundedString(entry.label, 200)
          ? {
              selection_token: entry.selection_token,
              label: entry.label,
            }
          : null)
        .filter((entry): entry is StaffStudentOption => entry !== null);
    },
  );
}

async function runMutation(
  request: (options: RequestInit) => Promise<GeneratedResponse>,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  try {
    const response = await request(withIdempotencyKey(key, await cookieSessionMutationOptions(signal)));
    if (response.status >= 200 && response.status < 300) return;
    throw new ReferralsApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof ReferralsApiError) throw error;
    throw new ReferralsApiError("unavailable");
  }
}

export async function createPortalReferral(payload: ReferralCreatePayload, key: IdempotencyKey, signal?: AbortSignal) {
  try {
    const response = await referralsCreate(payload as unknown as ReferralDraftSchema, withIdempotencyKey(key, await cookieSessionMutationOptions(signal)));
    if (response.status === 200 && isRecord(response.data) && typeof response.data.reference_code === "string") {
      return response.data.reference_code;
    }
    throw new ReferralsApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof ReferralsApiError) throw error;
    throw new ReferralsApiError("unavailable");
  }
}

export function submitPortalReferral(referenceCode: string, payload: ReferralSubmitSchema, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => referralsSubmit(safeReference(referenceCode), payload as never, options), key, signal);
}

export function transitionPortalReferral(
  referenceCode: string,
  transition: ReferralTransition,
  reasonCode: string,
  reasonDetail = "",
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  const payload = { reason_code: reasonCode.trim().slice(0, 50), reason_detail: reasonDetail.trim().slice(0, 500) } as ReferralTransitionSchema;
  const reference = safeReference(referenceCode);
  const operation: Record<ReferralTransition, (options: RequestInit) => Promise<GeneratedResponse>> = {
    receive: (options) => referralsReceive(reference, payload, options),
    review: (options) => referralsReview(reference, payload, options),
    "action-required": (options) => referralsActionRequired(reference, payload, options),
    escalate: (options) => referralsEscalate(reference, payload, options),
    close: (options) => referralsClose(reference, payload, options),
    cancel: (options) => referralsCancel(reference, payload, options),
    reopen: (options) => referralsReopen(reference, payload, options),
  };
  return runMutation(operation[transition], key, signal);
}

export function assignPortalReferral(
  referenceCode: string,
  selectionToken: string,
  reasonCode: string,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  const payload = { counselor_selection_token: selectionToken, reason_code: reasonCode.trim().slice(0, 50) } as unknown as ReferralAssignmentSchema;
  return runMutation((options) => referralsAssign(safeReference(referenceCode), payload, options), key, signal);
}

export function reassignPortalReferral(
  referenceCode: string,
  selectionToken: string,
  reasonCode: string,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  const payload = { counselor_selection_token: selectionToken, reason_code: reasonCode.trim().slice(0, 50) } as unknown as ReferralAssignmentSchema;
  return runMutation((options) => referralsReassign(safeReference(referenceCode), payload, options), key, signal);
}

export function rememberReferralOptions(item: ReferralStaffQueueItem, referenceCode: string) {
  counselorOptionsKeys.set(item, referenceCode);
}

export function referralOptionsKey(item: ReferralStaffQueueItem) {
  const key = counselorOptionsKeys.get(item);
  if (!key) throw new ReferralsApiError("validation");
  return key;
}
const counselorOptionsKeys = new WeakMap<ReferralStaffQueueItem, string>();
