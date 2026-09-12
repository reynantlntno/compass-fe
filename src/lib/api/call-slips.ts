import {
  callSlipsAssign,
  callSlipsAttendance,
  callSlipsCancel,
  callSlipsCounselorOptions,
  callSlipsCreate,
  callSlipsDetail,
  callSlipsExpire,
  callSlipsFromReferral,
  callSlipsIssue,
  callSlipsNoShow,
  callSlipsQueueList,
  callSlipsReassign,
} from "@/lib/api/generated/call-slips/call-slips";
import type {
  CallSlipAssignmentSchema,
  CallSlipAttendanceSchema,
  CallSlipDraftSchema,
  CallSlipFromReferralSchema,
  CallSlipIssueSchema,
  CallSlipReasonSchema,
  CallSlipStaffQueueItemSchema,
  CallSlipsQueueListParams,
} from "@/lib/api/generated/model";
import {
  cookieSessionMutationOptions,
  cookieSessionReadOptions,
} from "@/lib/api/auth";
import { withIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";

export const CALL_SLIPS_PAGE_SIZE = 20;

export const CALL_SLIP_QUEUE_STATUSES = [
  "DRAFT", "ISSUED", "ACKNOWLEDGED", "RESCHEDULE_REQUESTED",
  "ATTENDED", "NO_SHOW", "EXPIRED", "CANCELLED",
] as const;
export const CALL_SLIP_SOURCE_TYPES = [
  "OFFICE_INITIATED", "REFERRAL", "APPOINTMENT", "COUNSELOR_FOLLOW_UP", "OTHER_APPROVED",
] as const;
export const CALL_SLIP_PURPOSES = [
  "ROUTINE_INTERVIEW_REPORTING", "COUNSELOR_FOLLOW_UP", "GUIDANCE_INTERVIEW",
  "APPOINTMENT_REPORTING", "GENERAL_OFFICE_REPORTING", "DOCUMENT_FOLLOW_UP", "OTHER_APPROVED",
] as const;
export const CALL_SLIP_MODES = ["ONSITE", "ONLINE"] as const;
export const CALL_SLIP_DESTINATIONS = [
  "GUIDANCE_OFFICE", "ASSIGNED_COUNSELOR", "APPROVED_OFFICE_LOCATION", "AUTHENTICATED_ONLINE_ARRANGEMENT",
] as const;
export const CALL_SLIP_QUEUE_ORDERS = ["recent", "oldest"] as const;
export const CALL_SLIP_ASSIGNMENTS = ["all", "mine", "unassigned"] as const;

export type CallSlipQueueStatus = (typeof CALL_SLIP_QUEUE_STATUSES)[number];
export type CallSlipPurpose = (typeof CALL_SLIP_PURPOSES)[number];
export type CallSlipMode = (typeof CALL_SLIP_MODES)[number];
export type CallSlipDestination = (typeof CALL_SLIP_DESTINATIONS)[number];
export type CallSlipQueueOrder = (typeof CALL_SLIP_QUEUE_ORDERS)[number];
export type CallSlipAssignment = (typeof CALL_SLIP_ASSIGNMENTS)[number];

export type CallSlipAction =
  | "issue" | "attendance" | "no-show" | "expire" | "cancel" | "assign" | "reassign";

export type CallSlipsFilters = {
  q: string | null;
  status: string | null;
  statuses: string[];
  academicYear: string | null;
  assignment: CallSlipAssignment;
  purpose: string | null;
  mode: string | null;
  destination: string | null;
  order: CallSlipQueueOrder;
};

export type CallSlipStaffQueueItem = {
  reference_code: string;
  student_display_name: string;
  student_number: string | null;
  source_type: string;
  source_type_label: string;
  purpose_code: CallSlipPurpose;
  purpose_label: string;
  mode_code: CallSlipMode;
  mode_label: string;
  destination_code: CallSlipDestination;
  destination_label: string;
  status: CallSlipQueueStatus;
  status_label: string;
  assignment_state: string;
  schedule_bucket: string;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  referral_reference: string | null;
  appointment_reference: string | null;
  issued_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PortalCallSlipDetail = {
  reference_code: string;
  status_label: string;
  student_label: string;
  purpose_label: string;
  destination_label: string;
  mode_label: string;
  scheduled_start_at: string | null;
  appointment_reference: string | null;
  referral_reference: string | null;
};

export type PortalCallSlipsPage = {
  items: CallSlipStaffQueueItem[];
  page: number;
  page_size: number;
  total: number;
};

export type CallSlipsErrorKind =
  | "conflict" | "permission" | "rate_limited" | "unavailable" | "validation";

export class CallSlipsApiError extends Error {
  readonly kind: CallSlipsErrorKind;
  constructor(kind: CallSlipsErrorKind) {
    super("The call slips workspace request could not be completed.");
    this.name = "CallSlipsApiError";
    this.kind = kind;
  }
}

type GeneratedResponse = { data: unknown; status: number };

const MAX_PAGE = 100_000;
const MAX_QUERY_LENGTH = 120;
const MAX_FILTER_LENGTH = 100;
const MAX_REFERENCE_LENGTH = 25;
const STATUS_SET = new Set<string>(CALL_SLIP_QUEUE_STATUSES);
const SOURCE_SET = new Set<string>(CALL_SLIP_SOURCE_TYPES);
const PURPOSE_SET = new Set<string>(CALL_SLIP_PURPOSES);
const MODE_SET = new Set<string>(CALL_SLIP_MODES);
const DESTINATION_SET = new Set<string>(CALL_SLIP_DESTINATIONS);
const ORDER_SET = new Set<string>(CALL_SLIP_QUEUE_ORDERS);
const ASSIGNMENT_SET = new Set<string>(CALL_SLIP_ASSIGNMENTS);
const ASSIGNMENT_STATE_SET = new Set(["Assigned", "Unassigned"]);
const counselorOptionsKeys = new WeakMap<CallSlipStaffQueueItem, string>();
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

function errorKind(status: number): CallSlipsErrorKind {
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 422) return "validation";
  if (status === 401 || status === 403 || status === 404) return "permission";
  return "unavailable";
}

function isCallSlipProjection(value: unknown): value is CallSlipStaffQueueItemSchema {
  if (!isRecord(value)) return false;
  return (
    boundedString(value.reference_code, MAX_REFERENCE_LENGTH) &&
    boundedString(value.student_display_name, 160) &&
    optionalString(value.student_number, 50) &&
    boundedString(value.source_type, 30) && SOURCE_SET.has(value.source_type) &&
    boundedString(value.source_type_label, 60) &&
    boundedString(value.purpose_code, 30) && PURPOSE_SET.has(value.purpose_code) &&
    boundedString(value.purpose_label, 60) &&
    boundedString(value.mode_code, 10) && MODE_SET.has(value.mode_code) &&
    boundedString(value.mode_label, 20) &&
    boundedString(value.destination_code, 50) && DESTINATION_SET.has(value.destination_code) &&
    boundedString(value.destination_label, 60) &&
    boundedString(value.status, 30) && STATUS_SET.has(value.status) &&
    boundedString(value.status_label, 60) &&
    boundedString(value.assignment_state, 20) && ASSIGNMENT_STATE_SET.has(value.assignment_state) &&
    boundedString(value.schedule_bucket, 40) &&
    optionalTimestamp(value.scheduled_start_at) &&
    optionalTimestamp(value.scheduled_end_at) &&
    optionalString(value.referral_reference, MAX_REFERENCE_LENGTH) &&
    optionalString(value.appointment_reference, MAX_REFERENCE_LENGTH) &&
    optionalTimestamp(value.issued_at) &&
    optionalTimestamp(value.acknowledged_at) &&
    requiredTimestamp(value.created_at) &&
    requiredTimestamp(value.updated_at)
  );
}

function parseCallSlipItem(value: unknown): CallSlipStaffQueueItem | null {
  if (!isCallSlipProjection(value)) return null;
  return {
    reference_code: value.reference_code,
    student_display_name: value.student_display_name.slice(0, 160),
    student_number: value.student_number ?? null,
    source_type: value.source_type,
    source_type_label: value.source_type_label,
    purpose_code: value.purpose_code as CallSlipPurpose,
    purpose_label: value.purpose_label,
    mode_code: value.mode_code as CallSlipMode,
    mode_label: value.mode_label,
    destination_code: value.destination_code as CallSlipDestination,
    destination_label: value.destination_label,
    status: value.status as CallSlipQueueStatus,
    status_label: value.status_label,
    assignment_state: value.assignment_state,
    schedule_bucket: value.schedule_bucket,
    scheduled_start_at: value.scheduled_start_at ?? null,
    scheduled_end_at: value.scheduled_end_at ?? null,
    referral_reference: value.referral_reference ?? null,
    appointment_reference: value.appointment_reference ?? null,
    issued_at: value.issued_at ?? null,
    acknowledged_at: value.acknowledged_at ?? null,
    created_at: value.created_at,
    updated_at: value.updated_at,
  };
}
function isCallSlipPage(value: unknown): value is { items: unknown[]; page: number; page_size: number; total: number } {
  return isRecord(value) && Array.isArray(value.items) &&
    typeof value.page === "number" && Number.isSafeInteger(value.page) && value.page >= 1 && value.page <= MAX_PAGE &&
    typeof value.page_size === "number" && Number.isSafeInteger(value.page_size) && value.page_size === CALL_SLIPS_PAGE_SIZE &&
    typeof value.total === "number" && Number.isSafeInteger(value.total) && value.total >= 0 && value.items.length <= value.page_size;
}

function parseCallSlipsPage(value: unknown): PortalCallSlipsPage | null {
  if (!isCallSlipPage(value)) return null;
  const items = value.items
    .map(parseCallSlipItem)
    .filter((item): item is CallSlipStaffQueueItem => item !== null);
  return { items, page: value.page, page_size: value.page_size, total: value.total };
}

function safeReference(value: string) {
  const reference = value.trim().slice(0, MAX_REFERENCE_LENGTH);
  if (!reference) throw new CallSlipsApiError("validation");
  return reference;
}

function normalizeQuery(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (normalized.length > MAX_QUERY_LENGTH) throw new CallSlipsApiError("validation");
  return normalized;
}

function normalizeFilter(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (normalized.length > MAX_FILTER_LENGTH) throw new CallSlipsApiError("validation");
  return normalized;
}

function normalizeStatuses(value: string | null | undefined, allowed: Set<string>, strict = true) {
  if (!value) return [];
  const values = [...new Set(value.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean))];
  if (values.length > 12 || values.some((item) => !allowed.has(item))) {
    if (!strict) return [];
    throw new CallSlipsApiError("validation");
  }
  return values;
}

function normalizeSingle(value: string | null | undefined, allowed: Set<string>, strict = true) {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (!allowed.has(normalized)) {
    if (!strict) return null;
    throw new CallSlipsApiError("validation");
  }
  return normalized;
}

export function parseCallSlipsFilters(params: { get: (name: string) => string | null }): CallSlipsFilters {
  const statuses = normalizeStatuses(params.get("status"), STATUS_SET, false);
  const order = params.get("order");
  const assignment = params.get("assignment");
  return {
    q: params.get("q")?.trim().slice(0, MAX_QUERY_LENGTH) || null,
    status: statuses.length ? statuses.join(",") : null,
    statuses,
    academicYear: params.get("academic_year")?.trim().slice(0, MAX_FILTER_LENGTH) || null,
    assignment: assignment && ASSIGNMENT_SET.has(assignment) ? assignment as CallSlipAssignment : "all",
    purpose: normalizeSingle(params.get("purpose"), PURPOSE_SET, false),
    mode: normalizeSingle(params.get("mode"), MODE_SET, false),
    destination: normalizeSingle(params.get("destination"), DESTINATION_SET, false),
    order: order && ORDER_SET.has(order) ? order as CallSlipQueueOrder : "recent",
  };
}

export function callSlipsHref(section: "referrals" | "call-slips", page = 1, filters: CallSlipsFilters) {
  const params = new URLSearchParams({ section });
  if (filters.statuses.length) params.set("status", filters.statuses.join(","));
  if (filters.q?.trim()) params.set("q", filters.q.trim().slice(0, MAX_QUERY_LENGTH));
  if (filters.academicYear?.trim()) params.set("academic_year", filters.academicYear.trim().slice(0, MAX_FILTER_LENGTH));
  if (filters.assignment !== "all") params.set("assignment", filters.assignment);
  if (filters.purpose) params.set("purpose", filters.purpose);
  if (filters.mode) params.set("mode", filters.mode);
  if (filters.destination) params.set("destination", filters.destination);
  if (filters.order !== "recent") params.set("order", filters.order);
  if (page > 1) params.set("page", String(page));
  return `/portal/referrals?${params.toString()}`;
}

function buildListParams(filters: CallSlipsFilters, page: number) {
  const q = normalizeQuery(filters.q);
  const academicYear = normalizeFilter(filters.academicYear);
  const statuses = normalizeStatuses(filters.status, STATUS_SET);
  const purpose = normalizeSingle(filters.purpose, PURPOSE_SET);
  const mode = normalizeSingle(filters.mode, MODE_SET);
  const destination = normalizeSingle(filters.destination, DESTINATION_SET);
  const params: CallSlipsQueueListParams = {
    page: safePage(page),
    page_size: CALL_SLIPS_PAGE_SIZE,
    ...(q ? { q } : {}),
    ...(statuses.length ? { status: statuses.join(",") } : {}),
    ...(academicYear ? { academic_year: academicYear } : {}),
    ...(filters.assignment !== "all" ? { assignment: filters.assignment } : {}),
    ...(purpose ? { purpose } : {}),
    ...(mode ? { mode } : {}),
    ...(destination ? { destination } : {}),
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
    throw new CallSlipsApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof CallSlipsApiError) throw error;
    throw new CallSlipsApiError("unavailable");
  }
}
export function getPortalCallSlipQueue(page = 1, filters: CallSlipsFilters, signal?: AbortSignal) {
  return readRequest(
    callSlipsQueueList(buildListParams(filters, page), cookieSessionReadOptions(signal)),
    parseCallSlipsPage,
  );
}

export function getPortalCallSlipDetail(referenceCode: string, signal?: AbortSignal) {
  return readRequest(
    callSlipsDetail(safeReference(referenceCode), cookieSessionReadOptions(signal)),
    parseCallSlipDetail,
  );
}

function parseCallSlipDetail(value: unknown): PortalCallSlipDetail | null {
  if (!isRecord(value)) return null;
  if (
    !boundedString(value.reference_code, MAX_REFERENCE_LENGTH) ||
    !boundedString(value.status_label, 80) ||
    !boundedString(value.student_label, 160) ||
    !boundedString(value.purpose_label, 80) ||
    !boundedString(value.destination_label, 80) ||
    !boundedString(value.mode_label, 40) ||
    !optionalTimestamp(value.scheduled_start_at) ||
    !optionalString(value.referral_reference, MAX_REFERENCE_LENGTH) ||
    !optionalString(value.appointment_reference, MAX_REFERENCE_LENGTH)
  ) return null;

  return {
    reference_code: value.reference_code,
    status_label: value.status_label,
    student_label: value.student_label,
    purpose_label: value.purpose_label,
    destination_label: value.destination_label,
    mode_label: value.mode_label,
    scheduled_start_at: value.scheduled_start_at ?? null,
    appointment_reference: value.appointment_reference ?? null,
    referral_reference: value.referral_reference ?? null,
  };
}

export type ReferralCounselorOptionLike = { selection_token: string; display_name: string };

export function getPortalCallSlipCounselorOptions(referenceCode: string, q = "", signal?: AbortSignal) {
  return readRequest(
    callSlipsCounselorOptions(
      safeReference(referenceCode),
      { page: 1, page_size: 20, q: q || undefined },
      cookieSessionReadOptions(signal),
    ),
    (value): ReferralCounselorOptionLike[] | null => {
      if (!isRecord(value) || !Array.isArray(value.items)) return null;
      return value.items
        .map((entry) => isRecord(entry) && boundedString(entry.selection_token, 500) && boundedString(entry.display_name, 160)
          ? { selection_token: entry.selection_token, display_name: entry.display_name }
          : null)
        .filter((entry): entry is ReferralCounselorOptionLike => entry !== null);
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
    throw new CallSlipsApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof CallSlipsApiError) throw error;
    throw new CallSlipsApiError("unavailable");
  }
}

export async function createPortalCallSlip(payload: CallSlipDraftSchema, key: IdempotencyKey, signal?: AbortSignal) {
  try {
    const response = await callSlipsCreate(payload, withIdempotencyKey(key, await cookieSessionMutationOptions(signal)));
    if (response.status === 200 && isRecord(response.data) && typeof response.data.reference_code === "string") {
      return response.data.reference_code;
    }
    throw new CallSlipsApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof CallSlipsApiError) throw error;
    throw new CallSlipsApiError("unavailable");
  }
}

export async function createPortalCallSlipFromReferral(payload: CallSlipFromReferralSchema, key: IdempotencyKey, signal?: AbortSignal) {
  try {
    const response = await callSlipsFromReferral(payload, withIdempotencyKey(key, await cookieSessionMutationOptions(signal)));
    if (response.status === 200 && isRecord(response.data) && typeof response.data.reference_code === "string") {
      return response.data.reference_code;
    }
    throw new CallSlipsApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof CallSlipsApiError) throw error;
    throw new CallSlipsApiError("unavailable");
  }
}

export function issuePortalCallSlip(referenceCode: string, payload: CallSlipIssueSchema, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => callSlipsIssue(safeReference(referenceCode), payload, options), key, signal);
}

export function recordPortalCallSlipAttendance(referenceCode: string, reportedAt: string, key: IdempotencyKey, signal?: AbortSignal) {
  const payload: CallSlipAttendanceSchema = { reported_at: reportedAt };
  return runMutation((options) => callSlipsAttendance(safeReference(referenceCode), payload, options), key, signal);
}

export function callSlipReasonAction(
  referenceCode: string,
  action: "no-show" | "expire" | "cancel",
  reasonCode: string,
  detail = "",
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  const payload = { reason_code: reasonCode.trim().slice(0, 50), detail: detail.trim().slice(0, 500) } as CallSlipReasonSchema;
  const reference = safeReference(referenceCode);
  const operation: Record<"no-show" | "expire" | "cancel", (options: RequestInit) => Promise<GeneratedResponse>> = {
    "no-show": (options) => callSlipsNoShow(reference, payload, options),
    expire: (options) => callSlipsExpire(reference, payload, options),
    cancel: (options) => callSlipsCancel(reference, payload, options),
  };
  return runMutation(operation[action], key, signal);
}

export function assignPortalCallSlip(
  referenceCode: string,
  selectionToken: string,
  reasonCode: string,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  const payload: CallSlipAssignmentSchema = { counselor_selection_token: selectionToken, reason_code: reasonCode.trim().slice(0, 50) };
  return runMutation((options) => callSlipsAssign(safeReference(referenceCode), payload, options), key, signal);
}

export function reassignPortalCallSlip(
  referenceCode: string,
  selectionToken: string,
  reasonCode: string,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  const payload: CallSlipAssignmentSchema = { counselor_selection_token: selectionToken, reason_code: reasonCode.trim().slice(0, 50) };
  return runMutation((options) => callSlipsReassign(safeReference(referenceCode), payload, options), key, signal);
}

export function rememberCallSlipOptions(item: CallSlipStaffQueueItem, referenceCode: string) {
  counselorOptionsKeys.set(item, referenceCode);
}

export function callSlipOptionsKey(item: CallSlipStaffQueueItem) {
  const key = counselorOptionsKeys.get(item);
  if (!key) throw new CallSlipsApiError("validation");
  return key;
}
