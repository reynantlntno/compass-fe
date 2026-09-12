import {
  counselingNoteSave,
  counselingRoutineInterviewsList,
  counselingSessionCancel,
  counselingSessionComplete,
  counselingSessionCreate,
  counselingSessionDetail,
  counselingSessionFinalize,
  counselingSessionLock,
  counselingSessionNoShow,
  counselingSessionStart,
  counselingSessionsList,
} from "@/lib/api/generated/counseling/counseling";
import type {
  CounselingMutationResponseSchema,
  CounselingReasonSchema,
  CounselingSessionPageSchema,
  CounselingSessionProjectionSchema,
  NoteSchema,
  SessionCreateSchema,
} from "@/lib/api/generated/model";
import {
  cookieSessionMutationOptions,
  cookieSessionReadOptions,
} from "@/lib/api/auth";
import { withIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";
import { profilesStaffStudents } from "@/lib/api/generated/profiles/profiles";

export const COUNSELING_SESSIONS_PAGE_SIZE = 20;

export const COUNSELING_SESSION_STATUSES = [
  "SCHEDULED",
  "IN_PROGRESS",
  "COUNSELOR_NOTES_DRAFT",
  "COMPLETED",
  "FINALIZED",
  "LOCKED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export const COUNSELING_SESSION_TYPES = [
  "COUNSELING",
  "ROUTINE_INTERVIEW",
  "FOLLOW_UP",
  "TRIAGE",
  "ADMINISTRATIVE_INTERVIEW",
] as const;

export const COUNSELING_SESSION_MODES = ["ONSITE", "ONLINE"] as const;
export const COUNSELING_SESSION_SOURCES = [
  "WALK_IN",
  "CALLED_IN",
  "REFERRED",
  "APPOINTMENT",
  "COUNSELOR_INITIATED",
  "CALL_SLIP",
  "ROUTINE_COLLECTION",
  "ECOUNSELING",
  "URGENT_SUPPORT",
] as const;
export const COUNSELING_SESSION_ASSIGNMENTS = ["all", "mine", "unassigned"] as const;
export const COUNSELING_SESSION_ORDERS = ["recent", "upcoming"] as const;

export type CounselingSessionStatus = (typeof COUNSELING_SESSION_STATUSES)[number];
export type CounselingSessionType = (typeof COUNSELING_SESSION_TYPES)[number];
export type CounselingSessionMode = (typeof COUNSELING_SESSION_MODES)[number];
export type CounselingSessionSource = (typeof COUNSELING_SESSION_SOURCES)[number];
export type CounselingSessionAssignment = (typeof COUNSELING_SESSION_ASSIGNMENTS)[number];
export type CounselingSessionOrder = (typeof COUNSELING_SESSION_ORDERS)[number];

export type CounselingListFilters = {
  q?: string | null;
  status?: string | null;
  sessionType?: CounselingSessionType | null;
  sessionMode?: CounselingSessionMode | null;
  sessionSource?: CounselingSessionSource | null;
  assignment?: CounselingSessionAssignment;
  dateFrom?: string | null;
  dateTo?: string | null;
  order?: CounselingSessionOrder;
};

export type PortalCounselingSession = {
  reference_code: string;
  session_type: CounselingSessionType;
  session_mode: CounselingSessionMode;
  session_source: CounselingSessionSource;
  status: CounselingSessionStatus;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  actual_started_at: string | null;
  actual_ended_at: string | null;
  completed_at: string | null;
  finalized_at: string | null;
  locked_at: string | null;
  student_display_name: string | null;
  student_number: string | null;
  assignment_state: "Assigned to you" | "Assigned" | "Unassigned" | null;
};

export type PortalCounselingSessionPage = {
  items: PortalCounselingSession[];
  page: number;
  page_size: number;
  total: number;
};

export type PortalCounselingStudentOption = {
  selection_token: string;
  label: string;
};

export type CounselingErrorKind =
  | "conflict"
  | "permission"
  | "rate_limited"
  | "unavailable"
  | "validation";

export class CounselingApiError extends Error {
  readonly kind: CounselingErrorKind;

  constructor(kind: CounselingErrorKind) {
    super("The counseling request could not be completed.");
    this.name = "CounselingApiError";
    this.kind = kind;
  }
}

const MAX_PAGE = 100_000;
const MAX_REFERENCE_LENGTH = 25;
const MAX_QUERY_LENGTH = 120;
const MAX_DISPLAY_NAME_LENGTH = 160;
const MAX_STUDENT_NUMBER_LENGTH = 50;
const MAX_SELECTION_TOKEN_LENGTH = 500;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const STATUS_SET = new Set<string>(COUNSELING_SESSION_STATUSES);
const TYPE_SET = new Set<string>(COUNSELING_SESSION_TYPES);
const MODE_SET = new Set<string>(COUNSELING_SESSION_MODES);
const SOURCE_SET = new Set<string>(COUNSELING_SESSION_SOURCES);
const ASSIGNMENT_SET = new Set<string>(COUNSELING_SESSION_ASSIGNMENTS);
const ORDER_SET = new Set<string>(COUNSELING_SESSION_ORDERS);
const ASSIGNMENT_STATES = new Set(["Assigned to you", "Assigned", "Unassigned"]);

type GeneratedResponse = { data: unknown; status: number };

const MUTATION_BOOLEAN_FIELDS = [
  "added",
  "cancelled",
  "created",
  "decided",
  "granted",
  "requested",
  "revoked",
  "saved",
  "submitted",
  "withdrawn",
] as const;

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, max: number, allowEmpty = false): value is string {
  return typeof value === "string" && value.length <= max && (allowEmpty || value.trim().length > 0);
}

function optionalTimestamp(value: unknown): value is string | null | undefined {
  return value === null || value === undefined || (
    typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value))
  );
}

function optionalDisplay(value: unknown, max: number) {
  return value === null || value === undefined || boundedString(value, max, true);
}

function isSession(value: unknown): value is CounselingSessionProjectionSchema {
  if (!isRecord(value)) return false;
  return (
    boundedString(value.reference_code, MAX_REFERENCE_LENGTH) &&
    typeof value.session_type === "string" && TYPE_SET.has(value.session_type) &&
    typeof value.session_mode === "string" && MODE_SET.has(value.session_mode) &&
    typeof value.status === "string" && STATUS_SET.has(value.status) &&
    typeof value.session_source === "string" && SOURCE_SET.has(value.session_source) &&
    optionalTimestamp(value.scheduled_start_at) &&
    optionalTimestamp(value.scheduled_end_at) &&
    optionalTimestamp(value.actual_started_at) &&
    optionalTimestamp(value.actual_ended_at) &&
    optionalTimestamp(value.completed_at) &&
    optionalTimestamp(value.finalized_at) &&
    optionalTimestamp(value.locked_at) &&
    optionalDisplay(value.student_display_name, MAX_DISPLAY_NAME_LENGTH) &&
    optionalDisplay(value.student_number, MAX_STUDENT_NUMBER_LENGTH) &&
    (value.assignment_state === null || value.assignment_state === undefined ||
      (typeof value.assignment_state === "string" && ASSIGNMENT_STATES.has(value.assignment_state)))
  );
}

function parseSession(value: unknown): PortalCounselingSession | null {
  if (!isSession(value)) return null;
  return {
    reference_code: value.reference_code,
    session_type: value.session_type as CounselingSessionType,
    session_mode: value.session_mode as CounselingSessionMode,
    session_source: value.session_source as CounselingSessionSource,
    status: value.status as CounselingSessionStatus,
    scheduled_start_at: value.scheduled_start_at ?? null,
    scheduled_end_at: value.scheduled_end_at ?? null,
    actual_started_at: value.actual_started_at ?? null,
    actual_ended_at: value.actual_ended_at ?? null,
    completed_at: value.completed_at ?? null,
    finalized_at: value.finalized_at ?? null,
    locked_at: value.locked_at ?? null,
    student_display_name: value.student_display_name ?? null,
    student_number: value.student_number ?? null,
    assignment_state: (value.assignment_state as PortalCounselingSession["assignment_state"]) ?? null,
  };
}

function parsePage(value: unknown): PortalCounselingSessionPage | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null;
  if (
    typeof value.page !== "number" || !Number.isSafeInteger(value.page) || value.page < 1 || value.page > MAX_PAGE ||
    typeof value.page_size !== "number" || !Number.isSafeInteger(value.page_size) || value.page_size < 1 || value.page_size > 100 ||
    typeof value.total !== "number" || !Number.isSafeInteger(value.total) || value.total < 0 || value.items.length > value.page_size
  ) return null;
  return {
    items: value.items.map(parseSession).filter((item): item is PortalCounselingSession => item !== null),
    page: value.page,
    page_size: value.page_size,
    total: value.total,
  };
}

function parseMutationResponse(value: unknown): CounselingMutationResponseSchema | null {
  if (!isRecord(value)) return null;
  if (
    value.reference_code !== undefined &&
    value.reference_code !== null &&
    !boundedString(value.reference_code, MAX_REFERENCE_LENGTH)
  ) return null;
  if (value.status !== undefined && value.status !== null && !boundedString(value.status, 64)) return null;

  const parsed: Record<string, boolean | string | null> = {};
  if (value.reference_code !== undefined) parsed.reference_code = value.reference_code as string | null;
  if (value.status !== undefined) parsed.status = value.status as string | null;
  for (const field of MUTATION_BOOLEAN_FIELDS) {
    if (value[field] !== undefined) {
      if (value[field] !== null && typeof value[field] !== "boolean") return null;
      parsed[field] = value[field] as boolean | null;
    }
  }
  return parsed as CounselingMutationResponseSchema;
}

function parseStudentOptions(value: unknown): PortalCounselingStudentOption[] | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null;
  if (
    typeof value.page !== "number" || !Number.isSafeInteger(value.page) || value.page < 1 || value.page > MAX_PAGE ||
    typeof value.page_size !== "number" || !Number.isSafeInteger(value.page_size) || value.page_size < 1 || value.page_size > 100 ||
    typeof value.total !== "number" || !Number.isSafeInteger(value.total) || value.total < 0 || value.items.length > value.page_size
  ) return null;

  const options: PortalCounselingStudentOption[] = [];
  for (const entry of value.items) {
    if (!isRecord(entry)) return null;
    if (!boundedString(entry.selection_token, MAX_SELECTION_TOKEN_LENGTH)) return null;
    if (!boundedString(entry.label, 200)) return null;
    options.push({
      selection_token: entry.selection_token,
      label: entry.label,
    });
  }
  return options;
}

type RoutineInterviewCountPage = {
  page: number;
  page_size: number;
  total: number;
};

function parseRoutinePage(value: unknown): RoutineInterviewCountPage | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null;
  if (
    typeof value.page !== "number" || !Number.isSafeInteger(value.page) || value.page < 1 ||
    typeof value.page_size !== "number" || !Number.isSafeInteger(value.page_size) || value.page_size < 1 ||
    typeof value.total !== "number" || !Number.isSafeInteger(value.total) || value.total < 0 || value.items.length > value.page_size
  ) return null;
  return {
    page: value.page as number,
    page_size: value.page_size as number,
    total: value.total as number,
  };
}

function normalizeDate(value: string | null | undefined) {
  if (!value || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) return null;
  return value;
}

function normalizeQuery(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized && normalized.length <= MAX_QUERY_LENGTH ? normalized : null;
}

function normalizeStatuses(value: string | null | undefined) {
  if (!value) return null;
  const statuses = [...new Set(value.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean))];
  if (!statuses.length || statuses.length > COUNSELING_SESSION_STATUSES.length || statuses.some((item) => !STATUS_SET.has(item))) return null;
  return statuses.join(",");
}

function normalizeEnum(value: string | null | undefined, values: Set<string>) {
  return value && values.has(value) ? value : null;
}

function errorKind(status: number): CounselingErrorKind {
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 422) return "validation";
  if (status === 401 || status === 403 || status === 404) return "permission";
  return "unavailable";
}

async function readRequest<T>(request: Promise<GeneratedResponse>, parse: (value: unknown) => T | null) {
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

export function getPortalCounselingSessions(
  page = 1,
  filters: CounselingListFilters = {},
  signal?: AbortSignal,
): Promise<PortalCounselingSessionPage> {
  const safePage = Number.isSafeInteger(page) && page > 0 && page <= MAX_PAGE ? page : 1;
  const dateFrom = normalizeDate(filters.dateFrom);
  const dateTo = normalizeDate(filters.dateTo);
  const params = {
    page: safePage,
    page_size: COUNSELING_SESSIONS_PAGE_SIZE,
    ...(normalizeQuery(filters.q) ? { q: normalizeQuery(filters.q) } : {}),
    ...(normalizeStatuses(filters.status) ? { status: normalizeStatuses(filters.status) } : {}),
    ...(normalizeEnum(filters.sessionType, TYPE_SET) ? { session_type: filters.sessionType } : {}),
    ...(normalizeEnum(filters.sessionMode, MODE_SET) ? { session_mode: filters.sessionMode } : {}),
    ...(normalizeEnum(filters.sessionSource, SOURCE_SET) ? { session_source: filters.sessionSource } : {}),
    ...(normalizeEnum(filters.assignment, ASSIGNMENT_SET) ? { assignment: filters.assignment } : {}),
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(dateTo ? { date_to: dateTo } : {}),
    ...(normalizeEnum(filters.order, ORDER_SET) ? { order: filters.order } : {}),
  };
  return readRequest(counselingSessionsList(params, cookieSessionReadOptions(signal)), parsePage);
}

function safeReference(referenceCode: string) {
  const value = referenceCode.trim().slice(0, MAX_REFERENCE_LENGTH);
  if (!value) throw new CounselingApiError("validation");
  return value;
}

export function getPortalCounselingSessionDetail(referenceCode: string, signal?: AbortSignal) {
  return readRequest(counselingSessionDetail(safeReference(referenceCode), cookieSessionReadOptions(signal)), parseSession);
}

export function getPortalCounselingSessionStudents(query = "", signal?: AbortSignal) {
  const normalizedQuery = query.trim().slice(0, 80);
  return readRequest(
    profilesStaffStudents(
      {
        page: 1,
        page_size: 25,
        q: normalizedQuery || undefined,
        workflow: "counseling_session",
      } as unknown as Parameters<typeof profilesStaffStudents>[0],
      cookieSessionReadOptions(signal),
    ),
    parseStudentOptions,
  );
}

export function getPortalRoutineInterviewCount(signal?: AbortSignal) {
  return readRequest(
    counselingRoutineInterviewsList({ page: 1, page_size: COUNSELING_SESSIONS_PAGE_SIZE, status: "INTAKE_SUBMITTED" }, cookieSessionReadOptions(signal)),
    parseRoutinePage,
  ).then((page) => page.total);
}

async function runMutation(
  request: (options: RequestInit) => Promise<GeneratedResponse>,
  key: IdempotencyKey,
  signal?: AbortSignal,
): Promise<CounselingMutationResponseSchema> {
  try {
    const response = await request(withIdempotencyKey(key, await cookieSessionMutationOptions(signal)));
    if (response.status === 200) {
      const parsed = parseMutationResponse(response.data);
      if (parsed) return parsed;
    }
    throw new CounselingApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof CounselingApiError) throw error;
    throw new CounselingApiError("unavailable");
  }
}

function safeSelectionToken(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_SELECTION_TOKEN_LENGTH) {
    throw new CounselingApiError("validation");
  }
  return normalized;
}

export async function createPortalWalkInCounselingSession(
  studentSelectionToken: string,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  const payload: SessionCreateSchema = {
    student_selection_token: safeSelectionToken(studentSelectionToken),
    session_type: "COUNSELING",
    session_mode: "ONSITE",
    session_source: "WALK_IN",
  };
  try {
    const response = await counselingSessionCreate(
      payload,
      withIdempotencyKey(key, await cookieSessionMutationOptions(signal)),
    );
    if (response.status === 200) {
      const parsed = parseMutationResponse(response.data);
      if (parsed?.reference_code) return parsed.reference_code;
    }
    throw new CounselingApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof CounselingApiError) throw error;
    throw new CounselingApiError("unavailable");
  }
}

export function startPortalCounselingSession(referenceCode: string, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => counselingSessionStart(safeReference(referenceCode), options), key, signal);
}

export function savePortalCounselingNote(referenceCode: string, payload: NoteSchema, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => counselingNoteSave(safeReference(referenceCode), payload, options), key, signal);
}

export function completePortalCounselingSession(referenceCode: string, payload: NoteSchema, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => counselingSessionComplete(safeReference(referenceCode), payload, options), key, signal);
}

export function cancelPortalCounselingSession(referenceCode: string, payload: CounselingReasonSchema, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => counselingSessionCancel(safeReference(referenceCode), payload, options), key, signal);
}

export function noShowPortalCounselingSession(referenceCode: string, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => counselingSessionNoShow(safeReference(referenceCode), options), key, signal);
}

export function finalizePortalCounselingSession(referenceCode: string, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => counselingSessionFinalize(safeReference(referenceCode), options), key, signal);
}

export function lockPortalCounselingSession(referenceCode: string, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => counselingSessionLock(safeReference(referenceCode), options), key, signal);
}

export type GeneratedCounselingSessionPage = CounselingSessionPageSchema;
