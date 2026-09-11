import {
  counselingCaseClose,
  counselingCaseDetail,
  counselingCaseHold,
  counselingCaseReopen,
  counselingCaseResolve,
  counselingCaseResume,
  counselingCaseTransitionFollowUp,
  counselingCaseTransitionMonitoring,
  type counselingCaseCloseResponse,
  type counselingCaseHoldResponse,
  type counselingCaseReopenResponse,
  type counselingCaseResolveResponse,
  type counselingCaseResumeResponse,
  type counselingCaseTransitionFollowUpResponse,
  type counselingCaseTransitionMonitoringResponse,
  counselingCasesList,
} from "@/lib/api/generated/counseling/counseling";
import { cookieSessionMutationOptions, cookieSessionReadOptions } from "@/lib/api/auth";
import { CounselingApiError } from "@/lib/api/counseling";
import { withIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";

export const COUNSELING_CASE_PAGE_SIZE = 20;

export const COUNSELING_CASE_STATUSES = [
  "OPEN",
  "MONITORING",
  "FOLLOW_UP_PENDING",
  "ON_HOLD",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
] as const;

export const COUNSELING_CASE_CATEGORIES = [
  "ACADEMIC",
  "PERSONAL",
  "FAMILY",
  "FINANCIAL",
  "BEHAVIORAL",
  "MENTAL_WELLNESS",
  "ADJUSTMENT",
  "CAREER",
  "PEER_RELATIONSHIP",
  "SUBSTANCE",
  "DISCIPLINARY",
  "OTHER",
] as const;

export const COUNSELING_CASE_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const COUNSELING_CASE_ASSIGNMENTS = ["all", "mine", "unassigned"] as const;
export const COUNSELING_CASE_ORDERS = ["recent", "oldest"] as const;

export type CounselingCaseStatus = (typeof COUNSELING_CASE_STATUSES)[number];
export type CounselingCaseCategory = (typeof COUNSELING_CASE_CATEGORIES)[number];
export type CounselingCasePriority = (typeof COUNSELING_CASE_PRIORITIES)[number];
export type CounselingCaseAssignment = (typeof COUNSELING_CASE_ASSIGNMENTS)[number];
export type CounselingCaseOrder = (typeof COUNSELING_CASE_ORDERS)[number];
export type CounselingCaseAction = "monitoring" | "follow-up" | "hold" | "resolve" | "close" | "resume" | "reopen";

export type CounselingCaseListFilters = {
  q: string | null;
  status: string | null;
  statuses: CounselingCaseStatus[];
  concernCategory: CounselingCaseCategory | null;
  priority: CounselingCasePriority | null;
  assignment: CounselingCaseAssignment;
  order: CounselingCaseOrder;
};

export type PortalCounselingCase = {
  reference_code: string;
  status: CounselingCaseStatus;
  concern_category: CounselingCaseCategory | null;
  priority: CounselingCasePriority | null;
  created_at: string | null;
  updated_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  reopened_at: string | null;
  student_display_name: string | null;
  student_number: string | null;
  assignment_state: "Assigned to you" | "Assigned" | "Unassigned" | null;
};

export type PortalCounselingCasePage = {
  items: PortalCounselingCase[];
  page: number;
  page_size: number;
  total: number;
};

export type PortalCounselingCaseDetail = Pick<
  PortalCounselingCase,
  | "reference_code"
  | "status"
  | "concern_category"
  | "priority"
  | "created_at"
  | "updated_at"
  | "resolved_at"
  | "closed_at"
  | "reopened_at"
>;

type GeneratedResponse = { data: unknown; status: number };
type CaseMutationResponse =
  | counselingCaseCloseResponse
  | counselingCaseHoldResponse
  | counselingCaseReopenResponse
  | counselingCaseResolveResponse
  | counselingCaseResumeResponse
  | counselingCaseTransitionFollowUpResponse
  | counselingCaseTransitionMonitoringResponse;

const MAX_PAGE = 100_000;
const MAX_QUERY_LENGTH = 120;
const MAX_REFERENCE_LENGTH = 25;
const MAX_TEXT_LENGTH = 160;
const STATUS_SET = new Set<string>(COUNSELING_CASE_STATUSES);
const CATEGORY_SET = new Set<string>(COUNSELING_CASE_CATEGORIES);
const PRIORITY_SET = new Set<string>(COUNSELING_CASE_PRIORITIES);
const ASSIGNMENT_SET = new Set<string>(COUNSELING_CASE_ASSIGNMENTS);
const ORDER_SET = new Set<string>(COUNSELING_CASE_ORDERS);
const ASSIGNMENT_STATE_SET = new Set(["Assigned to you", "Assigned", "Unassigned"]);

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
  if (!value) return [] as CounselingCaseStatus[];
  return [...new Set(value.split(",").map((item) => item.trim().toUpperCase()))].filter(
    (item): item is CounselingCaseStatus => STATUS_SET.has(item),
  );
}

export function parseCounselingCaseFilters(params: { get: (name: string) => string | null }): CounselingCaseListFilters {
  const statuses = parseStatuses(params.get("status"));
  const q = params.get("q")?.trim() ?? "";
  const concernCategory = params.get("concern_category");
  const priority = params.get("priority");
  const assignment = params.get("assignment");
  const order = params.get("order");
  return {
    q: q && q.length <= MAX_QUERY_LENGTH ? q : null,
    status: statuses.length ? statuses.join(",") : null,
    statuses,
    concernCategory: concernCategory && CATEGORY_SET.has(concernCategory) ? concernCategory as CounselingCaseCategory : null,
    priority: priority && PRIORITY_SET.has(priority) ? priority as CounselingCasePriority : null,
    assignment: assignment && ASSIGNMENT_SET.has(assignment) ? assignment as CounselingCaseAssignment : "all",
    order: order && ORDER_SET.has(order) ? order as CounselingCaseOrder : "recent",
  };
}

export function counselingCaseHref(page = 1, filters: CounselingCaseListFilters): string {
  const params = new URLSearchParams({ section: "cases" });
  if (filters.statuses.length) params.set("status", filters.statuses.join(","));
  if (filters.q?.trim()) params.set("q", filters.q.trim().slice(0, MAX_QUERY_LENGTH));
  if (filters.concernCategory) params.set("concern_category", filters.concernCategory);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.assignment !== "all") params.set("assignment", filters.assignment);
  if (filters.order !== "recent") params.set("order", filters.order);
  if (page > 1) params.set("page", String(page));
  return `/portal/counseling?${params.toString()}`;
}

function isCaseProjection(value: unknown): value is Record<string, unknown> {
  return isRecord(value) &&
    typeof value.reference_code === "string" && value.reference_code.length > 0 && value.reference_code.length <= MAX_REFERENCE_LENGTH &&
    isEnum(value.status, COUNSELING_CASE_STATUSES) &&
    optionalString(value.concern_category, 80) &&
    optionalString(value.priority, 40) &&
    optionalTimestamp(value.created_at) && optionalTimestamp(value.updated_at) &&
    optionalTimestamp(value.resolved_at) && optionalTimestamp(value.closed_at) && optionalTimestamp(value.reopened_at) &&
    optionalString(value.student_display_name, 160) && optionalString(value.student_number, 50) &&
    (value.assignment_state === null || value.assignment_state === undefined || (typeof value.assignment_state === "string" && ASSIGNMENT_STATE_SET.has(value.assignment_state)));
}

function parseCaseProjection(value: unknown): PortalCounselingCase | null {
  if (!isCaseProjection(value)) return null;
  return {
    reference_code: value.reference_code as string,
    status: value.status as CounselingCaseStatus,
    concern_category: isEnum(value.concern_category, COUNSELING_CASE_CATEGORIES) ? value.concern_category : null,
    priority: isEnum(value.priority, COUNSELING_CASE_PRIORITIES) ? value.priority : null,
    created_at: value.created_at as string | null | undefined ?? null,
    updated_at: value.updated_at as string | null | undefined ?? null,
    resolved_at: value.resolved_at as string | null | undefined ?? null,
    closed_at: value.closed_at as string | null | undefined ?? null,
    reopened_at: value.reopened_at as string | null | undefined ?? null,
    student_display_name: value.student_display_name as string | null | undefined ?? null,
    student_number: value.student_number as string | null | undefined ?? null,
    assignment_state: (value.assignment_state as PortalCounselingCase["assignment_state"]) ?? null,
  };
}

function isPage(value: unknown): value is { items: unknown[]; page: number; page_size: number; total: number } {
  return isRecord(value) && Array.isArray(value.items) &&
    typeof value.page === "number" && Number.isSafeInteger(value.page) && value.page >= 1 && value.page <= MAX_PAGE &&
    typeof value.page_size === "number" && Number.isSafeInteger(value.page_size) && value.page_size === COUNSELING_CASE_PAGE_SIZE &&
    typeof value.total === "number" && Number.isSafeInteger(value.total) && value.total >= 0 && value.items.length <= value.page_size;
}

function parsePage(value: unknown): PortalCounselingCasePage | null {
  if (!isPage(value)) return null;
  return {
    items: value.items.map(parseCaseProjection).filter((item): item is PortalCounselingCase => item !== null),
    page: value.page,
    page_size: value.page_size,
    total: value.total,
  };
}

function parseDetail(value: unknown): PortalCounselingCaseDetail | null {
  const projection = parseCaseProjection(value);
  if (!projection) return null;
  return {
    reference_code: projection.reference_code,
    status: projection.status,
    concern_category: projection.concern_category,
    priority: projection.priority,
    created_at: projection.created_at,
    updated_at: projection.updated_at,
    resolved_at: projection.resolved_at,
    closed_at: projection.closed_at,
    reopened_at: projection.reopened_at,
  };
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

export function getPortalCounselingCases(page = 1, filters: CounselingCaseListFilters, signal?: AbortSignal) {
  return readRequest(
    counselingCasesList({
      page: safePage(page),
      page_size: COUNSELING_CASE_PAGE_SIZE,
      ...(filters.q ? { q: filters.q } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.concernCategory ? { concern_category: filters.concernCategory } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.assignment !== "all" ? { assignment: filters.assignment } : {}),
      ...(filters.order !== "recent" ? { order: filters.order } : {}),
    }, cookieSessionReadOptions(signal)),
    parsePage,
  );
}

export function getPortalCounselingCaseDetail(referenceCode: string, signal?: AbortSignal) {
  return readRequest(counselingCaseDetail(safeReference(referenceCode), cookieSessionReadOptions(signal)), parseDetail);
}

async function runMutation(
  request: (options: RequestInit) => Promise<CaseMutationResponse>,
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

export function transitionCounselingCaseToMonitoring(referenceCode: string, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => counselingCaseTransitionMonitoring(safeReference(referenceCode), options), key, signal);
}

export function transitionCounselingCaseToFollowUp(referenceCode: string, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => counselingCaseTransitionFollowUp(safeReference(referenceCode), options), key, signal);
}

export function resolvePortalCounselingCase(referenceCode: string, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => counselingCaseResolve(safeReference(referenceCode), options), key, signal);
}

export function holdPortalCounselingCase(referenceCode: string, reasonCode: string, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => counselingCaseHold(safeReference(referenceCode), { reason_code: reasonCode }, options), key, signal);
}

export function closePortalCounselingCase(referenceCode: string, reasonCode: string, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => counselingCaseClose(safeReference(referenceCode), { reason_code: reasonCode }, options), key, signal);
}

export function resumePortalCounselingCase(referenceCode: string, targetStatus: CounselingCaseStatus, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => counselingCaseResume(safeReference(referenceCode), { target_status: targetStatus }, options), key, signal);
}

export function reopenPortalCounselingCase(referenceCode: string, reasonCode: string, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => counselingCaseReopen(safeReference(referenceCode), { reason_code: reasonCode }, options), key, signal);
}
