import {
  counselingUrgentAccessGrant,
  counselingUrgentAccessRevoke,
  counselingUrgentClose,
  counselingUrgentCounselorOptions,
  counselingUrgentDetail,
  counselingUrgentList,
  counselingUrgentReview,
  counselingUrgentTriage,
  type counselingUrgentAccessGrantResponse,
  type counselingUrgentAccessRevokeResponse,
  type counselingUrgentCloseResponse,
  type counselingUrgentReviewResponse,
  type counselingUrgentTriageResponse,
} from "@/lib/api/generated/counseling/counseling";
import type {
  AccessGrantSchema,
  ClosureSchema,
  UrgentSupportReviewSchema,
  UrgentSupportAccessGrantProjectionSchema,
  UrgentSupportProjectionSchema,
  UrgentSupportQueueProjectionSchema,
  UrgentSupportRevokeSchema,
  UrgentTriageSchema,
} from "@/lib/api/generated/model";
import { cookieSessionMutationOptions, cookieSessionReadOptions } from "@/lib/api/auth";
import { CounselingApiError } from "@/lib/api/counseling";
import { withIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";

export const URGENT_SUPPORT_PAGE_SIZE = 20;

export const URGENT_SUPPORT_STATUSES = [
  "OPEN",
  "TRIAGE_ACCESS_GRANTED",
  "TRIAGE_IN_PROGRESS",
  "PENDING_HEAD_REVIEW",
  "CONFIRMED",
  "REVOKED",
  "CLOSED",
  "EXPIRED",
] as const;
export const URGENT_SUPPORT_URGENCY_LEVELS = ["IMMEDIATE_TRIAGE", "SAME_DAY_REVIEW", "PROMPT_REVIEW"] as const;
export const URGENT_SUPPORT_SOURCE_TYPES = ["COUNSELOR_MANUAL", "HEAD_GUIDANCE_MANUAL", "SESSION_FLAG", "CASE_FLAG"] as const;
export const URGENT_SUPPORT_REVIEW_STATUSES = [
  "NOT_REVIEWED",
  "REVIEWED_CONFIRMED",
  "REVIEWED_REASSIGNMENT_REQUIRED",
  "REVIEWED_CASE_COLLABORATOR_REQUIRED",
  "REVIEWED_CLOSE_ALLOWED",
  "REVIEWED_REVOKED",
] as const;
export const URGENT_SUPPORT_ASSIGNMENTS = ["all", "mine", "unassigned"] as const;
export const URGENT_SUPPORT_ORDERS = ["recent", "oldest"] as const;

export type UrgentSupportStatus = (typeof URGENT_SUPPORT_STATUSES)[number];
export type UrgentSupportUrgency = (typeof URGENT_SUPPORT_URGENCY_LEVELS)[number];
export type UrgentSupportSource = (typeof URGENT_SUPPORT_SOURCE_TYPES)[number];
export type UrgentSupportReviewStatus = (typeof URGENT_SUPPORT_REVIEW_STATUSES)[number];
export type UrgentSupportAssignment = (typeof URGENT_SUPPORT_ASSIGNMENTS)[number];
export type UrgentSupportOrder = (typeof URGENT_SUPPORT_ORDERS)[number];

export type UrgentSupportListFilters = {
  q: string | null;
  status: string | null;
  statuses: UrgentSupportStatus[];
  urgencyLevel: UrgentSupportUrgency | null;
  sourceType: UrgentSupportSource | null;
  assignment: UrgentSupportAssignment;
  reviewStatus: UrgentSupportReviewStatus | null;
  order: UrgentSupportOrder;
};

export type PortalUrgentSupportAccessGrant = {
  selection_token: string;
  display_name: string;
  grant_type: string;
  purpose_code: string;
  starts_at: string | null;
  expires_at: string | null;
  status: string;
};

export type PortalUrgentSupport = {
  reference_code: string;
  student_display_name: string | null;
  student_number: string | null;
  urgency_level: UrgentSupportUrgency;
  status: UrgentSupportStatus;
  source_type: UrgentSupportSource;
  review_status: UrgentSupportReviewStatus | null;
  documentation_status: string;
  assignment_state: "Assigned to you" | "Assigned" | "Unassigned" | null;
  created_at: string | null;
  updated_at: string | null;
  reviewed_at: string | null;
  closed_at: string | null;
  expires_at: string | null;
  counseling_case_reference: string | null;
  originating_session_reference: string | null;
  documentation_session_reference: string | null;
};

export type PortalUrgentSupportDetail = PortalUrgentSupport & {
  active_access_grants: PortalUrgentSupportAccessGrant[];
};

export type PortalUrgentSupportPage = {
  items: PortalUrgentSupport[];
  page: number;
  page_size: number;
  total: number;
};

export type PortalUrgentCounselorOption = {
  display_name: string;
  selection_token: string;
};

export type UrgentSupportMutationResponse =
  | counselingUrgentAccessGrantResponse
  | counselingUrgentAccessRevokeResponse
  | counselingUrgentCloseResponse
  | counselingUrgentReviewResponse
  | counselingUrgentTriageResponse;

const MAX_PAGE = 100_000;
const MAX_REFERENCE_LENGTH = 25;
const MAX_QUERY_LENGTH = 120;
const MAX_TEXT_LENGTH = 160;
const MAX_TOKEN_LENGTH = 512;
const STATUS_SET = new Set<string>(URGENT_SUPPORT_STATUSES);
const URGENCY_SET = new Set<string>(URGENT_SUPPORT_URGENCY_LEVELS);
const SOURCE_SET = new Set<string>(URGENT_SUPPORT_SOURCE_TYPES);
const REVIEW_SET = new Set<string>(URGENT_SUPPORT_REVIEW_STATUSES);
const ASSIGNMENT_SET = new Set<string>(URGENT_SUPPORT_ASSIGNMENTS);
const ORDER_SET = new Set<string>(URGENT_SUPPORT_ORDERS);
const ASSIGNMENT_STATE_SET = new Set(["Assigned to you", "Assigned", "Unassigned"]);

type GeneratedResponse = { data: unknown; status: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function optionalString(value: unknown, max = MAX_TEXT_LENGTH): value is string | null | undefined {
  return value === null || value === undefined || (typeof value === "string" && value.length <= max);
}

function optionalTimestamp(value: unknown): value is string | null | undefined {
  return value === null || value === undefined || (
    typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value))
  );
}

function safePage(value: number) {
  return Number.isSafeInteger(value) && value >= 1 && value <= MAX_PAGE ? value : 1;
}

function safeReference(value: string) {
  const reference = value.trim().slice(0, MAX_REFERENCE_LENGTH);
  if (!reference) throw new CounselingApiError("validation");
  return reference;
}

function isEnum<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

function parseStatuses(value: string | null | undefined) {
  if (!value) return [] as UrgentSupportStatus[];
  return [...new Set(value.split(",").map((item) => item.trim().toUpperCase()))].filter(
    (item): item is UrgentSupportStatus => STATUS_SET.has(item),
  );
}

export function parseUrgentSupportFilters(params: { get: (name: string) => string | null }): UrgentSupportListFilters {
  const statuses = parseStatuses(params.get("status"));
  const q = params.get("q")?.trim() ?? "";
  const urgency = params.get("urgency_level");
  const source = params.get("source_type");
  const assignment = params.get("assignment");
  const review = params.get("review_status");
  const order = params.get("order");
  return {
    q: q && q.length <= MAX_QUERY_LENGTH ? q : null,
    status: statuses.length ? statuses.join(",") : null,
    statuses,
    urgencyLevel: urgency && URGENCY_SET.has(urgency) ? urgency as UrgentSupportUrgency : null,
    sourceType: source && SOURCE_SET.has(source) ? source as UrgentSupportSource : null,
    assignment: assignment && ASSIGNMENT_SET.has(assignment) ? assignment as UrgentSupportAssignment : "all",
    reviewStatus: review && REVIEW_SET.has(review) ? review as UrgentSupportReviewStatus : null,
    order: order && ORDER_SET.has(order) ? order as UrgentSupportOrder : "recent",
  };
}

export function urgentSupportHref(page = 1, filters: UrgentSupportListFilters): string {
  const params = new URLSearchParams({ section: "urgent-support" });
  if (filters.q?.trim()) params.set("q", filters.q.trim().slice(0, MAX_QUERY_LENGTH));
  if (filters.statuses.length) params.set("status", filters.statuses.join(","));
  if (filters.urgencyLevel) params.set("urgency_level", filters.urgencyLevel);
  if (filters.sourceType) params.set("source_type", filters.sourceType);
  if (filters.assignment !== "all") params.set("assignment", filters.assignment);
  if (filters.reviewStatus) params.set("review_status", filters.reviewStatus);
  if (filters.order !== "recent") params.set("order", filters.order);
  if (page > 1) params.set("page", String(page));
  return `/portal/counseling?${params.toString()}`;
}

function isAssignmentState(value: unknown) {
  return value === null || value === undefined || (typeof value === "string" && ASSIGNMENT_STATE_SET.has(value));
}

function isQueueProjection(value: unknown): value is UrgentSupportQueueProjectionSchema {
  return isRecord(value) &&
    typeof value.reference_code === "string" && value.reference_code.length > 0 && value.reference_code.length <= MAX_REFERENCE_LENGTH &&
    isEnum(value.status, URGENT_SUPPORT_STATUSES) &&
    isEnum(value.urgency_level, URGENT_SUPPORT_URGENCY_LEVELS) &&
    isEnum(value.source_type, URGENT_SUPPORT_SOURCE_TYPES) &&
    optionalString(value.student_display_name) && optionalString(value.student_number, 50) &&
    (value.review_status === null || value.review_status === undefined || isEnum(value.review_status, URGENT_SUPPORT_REVIEW_STATUSES)) &&
    typeof value.documentation_status === "string" && value.documentation_status.length <= MAX_TEXT_LENGTH &&
    isAssignmentState(value.assignment_state) &&
    optionalTimestamp(value.created_at) && optionalTimestamp(value.updated_at) && optionalTimestamp(value.reviewed_at) &&
    optionalTimestamp(value.closed_at) && optionalTimestamp(value.expires_at) &&
    optionalString(value.counseling_case_reference, MAX_REFERENCE_LENGTH);
}

function parseQueueProjection(value: unknown): PortalUrgentSupport | null {
  if (!isQueueProjection(value)) return null;
  return {
    reference_code: value.reference_code,
    student_display_name: value.student_display_name ?? null,
    student_number: value.student_number ?? null,
    urgency_level: value.urgency_level as UrgentSupportUrgency,
    status: value.status as UrgentSupportStatus,
    source_type: value.source_type as UrgentSupportSource,
    review_status: isEnum(value.review_status, URGENT_SUPPORT_REVIEW_STATUSES) ? value.review_status : null,
    documentation_status: value.documentation_status,
    assignment_state: (value.assignment_state as PortalUrgentSupport["assignment_state"]) ?? null,
    created_at: value.created_at as string | null | undefined ?? null,
    updated_at: value.updated_at as string | null | undefined ?? null,
    reviewed_at: value.reviewed_at as string | null | undefined ?? null,
    closed_at: value.closed_at as string | null | undefined ?? null,
    expires_at: value.expires_at as string | null | undefined ?? null,
    counseling_case_reference: value.counseling_case_reference as string | null | undefined ?? null,
    originating_session_reference: value.originating_session_reference as string | null | undefined ?? null,
    documentation_session_reference: value.documentation_session_reference as string | null | undefined ?? null,
  };
}

function isPage(value: unknown): value is { items: unknown[]; page: number; page_size: number; total: number } {
  return isRecord(value) && Array.isArray(value.items) &&
    typeof value.page === "number" && Number.isSafeInteger(value.page) && value.page >= 1 && value.page <= MAX_PAGE &&
    typeof value.page_size === "number" && Number.isSafeInteger(value.page_size) && value.page_size === URGENT_SUPPORT_PAGE_SIZE &&
    typeof value.total === "number" && Number.isSafeInteger(value.total) && value.total >= 0 && value.items.length <= value.page_size;
}

function parsePage(value: unknown): PortalUrgentSupportPage | null {
  if (!isPage(value)) return null;
  return {
    items: value.items.map(parseQueueProjection).filter((item): item is PortalUrgentSupport => item !== null),
    page: value.page,
    page_size: value.page_size,
    total: value.total,
  };
}

function isGrant(value: unknown): value is UrgentSupportAccessGrantProjectionSchema {
  return isRecord(value) &&
    typeof value.selection_token === "string" && value.selection_token.length > 0 && value.selection_token.length <= MAX_TOKEN_LENGTH &&
    typeof value.display_name === "string" && value.display_name.length <= MAX_TEXT_LENGTH &&
    typeof value.grant_type === "string" && value.grant_type.length <= 80 &&
    typeof value.purpose_code === "string" && value.purpose_code.length <= 80 &&
    optionalTimestamp(value.starts_at) && optionalTimestamp(value.expires_at) &&
    typeof value.status === "string" && value.status.length <= 40;
}

function isDetailProjection(value: unknown): value is UrgentSupportProjectionSchema {
  if (!isQueueProjection(value) || !isRecord(value)) return false;
  const record = value as Record<string, unknown>;
  return optionalString(record.originating_session_reference, MAX_REFERENCE_LENGTH) &&
    optionalString(record.documentation_session_reference, MAX_REFERENCE_LENGTH) &&
    (record.active_access_grants === null || record.active_access_grants === undefined || (
      Array.isArray(record.active_access_grants) && record.active_access_grants.every(isGrant)
    ));
}

function parseDetail(value: unknown): PortalUrgentSupportDetail | null {
  if (!isDetailProjection(value)) return null;
  const queue = parseQueueProjection(value);
  if (!queue) return null;
  const detail = value as UrgentSupportProjectionSchema;
  return {
    ...queue,
    originating_session_reference: detail.originating_session_reference ?? null,
    documentation_session_reference: detail.documentation_session_reference ?? null,
    active_access_grants: (detail.active_access_grants ?? []).filter(isGrant).map((grant) => ({
      selection_token: grant.selection_token,
      display_name: grant.display_name,
      grant_type: grant.grant_type,
      purpose_code: grant.purpose_code,
      starts_at: grant.starts_at ?? null,
      expires_at: grant.expires_at ?? null,
      status: grant.status,
    })),
  };
}

function parseOptions(value: unknown): PortalUrgentCounselorOption[] | null {
  if (!isPage(value)) return null;
  return value.items.filter((item): item is Record<string, unknown> => isRecord(item)).map((item) => {
    if (
      typeof item.display_name !== "string" || item.display_name.length > MAX_TEXT_LENGTH ||
      typeof item.selection_token !== "string" || item.selection_token.length === 0 || item.selection_token.length > MAX_TOKEN_LENGTH
    ) return null;
    return { display_name: item.display_name, selection_token: item.selection_token };
  }).filter((item): item is PortalUrgentCounselorOption => item !== null);
}

function errorKind(status: number) {
  if (status === 409) return "conflict" as const;
  if (status === 429) return "rate_limited" as const;
  if (status === 400 || status === 422) return "validation" as const;
  if (status === 401 || status === 403 || status === 404) return "permission" as const;
  return "unavailable" as const;
}

async function readRequest<T>(request: Promise<GeneratedResponse>, parse: (value: unknown) => T | null): Promise<T> {
  try {
    const response = await request;
    if (response.status === 200) {
      const value = parse(response.data);
      if (value) return value;
    }
    throw new CounselingApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof CounselingApiError) throw error;
    throw new CounselingApiError("unavailable");
  }
}

export function getPortalUrgentSupport(page = 1, filters: UrgentSupportListFilters, signal?: AbortSignal) {
  return readRequest(
    counselingUrgentList({
      page: safePage(page),
      page_size: URGENT_SUPPORT_PAGE_SIZE,
      ...(filters.q ? { q: filters.q } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.urgencyLevel ? { urgency_level: filters.urgencyLevel } : {}),
      ...(filters.sourceType ? { source_type: filters.sourceType } : {}),
      ...(filters.assignment !== "all" ? { assignment: filters.assignment } : {}),
      ...(filters.reviewStatus ? { review_status: filters.reviewStatus } : {}),
      ...(filters.order !== "recent" ? { order: filters.order } : {}),
    }, cookieSessionReadOptions(signal)),
    parsePage,
  );
}

export function getPortalUrgentSupportDetail(referenceCode: string, signal?: AbortSignal) {
  return readRequest(counselingUrgentDetail(safeReference(referenceCode), cookieSessionReadOptions(signal)), parseDetail);
}

export function getPortalUrgentCounselorOptions(referenceCode: string, q?: string, signal?: AbortSignal) {
  return readRequest(
    counselingUrgentCounselorOptions(
      safeReference(referenceCode),
      { page: 1, page_size: URGENT_SUPPORT_PAGE_SIZE, ...(q?.trim() ? { q: q.trim().slice(0, MAX_QUERY_LENGTH) } : {}) },
      cookieSessionReadOptions(signal),
    ),
    parseOptions,
  );
}

async function runMutation(
  request: (options: RequestInit) => Promise<GeneratedResponse>,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  try {
    const response = await request(withIdempotencyKey(key, await cookieSessionMutationOptions(signal)));
    if (response.status === 200 && isRecord(response.data)) return response.data;
    throw new CounselingApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof CounselingApiError) throw error;
    throw new CounselingApiError("unavailable");
  }
}

export type UrgentTriagePayload = Omit<UrgentTriageSchema, "assigned_counselor">;
export type UrgentReviewPayload = Pick<UrgentSupportReviewSchema, "review_status">;
export type UrgentGrantPayload = Pick<AccessGrantSchema, "grant_type" | "purpose_code" | "grantee_selection_token" | "expires_at">;
export type UrgentRevokePayload = Pick<UrgentSupportRevokeSchema, "grant_selection_token" | "reason_code">;

export function triagePortalUrgentSupport(referenceCode: string, payload: UrgentTriagePayload, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => counselingUrgentTriage(safeReference(referenceCode), payload, options), key, signal);
}

export function reviewPortalUrgentSupport(referenceCode: string, reviewStatus: UrgentSupportReviewStatus, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => counselingUrgentReview(safeReference(referenceCode), { review_status: reviewStatus }, options), key, signal);
}

export function closePortalUrgentSupport(referenceCode: string, closureReasonCode: string, key: IdempotencyKey, signal?: AbortSignal) {
  const payload: ClosureSchema = { closure_reason_code: closureReasonCode };
  return runMutation((options) => counselingUrgentClose(safeReference(referenceCode), payload, options), key, signal);
}

export function grantPortalUrgentSupportAccess(referenceCode: string, payload: UrgentGrantPayload, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => counselingUrgentAccessGrant(safeReference(referenceCode), payload, options), key, signal);
}

export function revokePortalUrgentSupportAccess(payload: UrgentRevokePayload, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => counselingUrgentAccessRevoke(payload, options), key, signal);
}
