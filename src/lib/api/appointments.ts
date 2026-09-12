import {
  appointmentsCancel,
  appointmentsComplete,
  appointmentsDetail,
  appointmentsLateCancellationRequest,
  appointmentsList,
  appointmentsNoShow,
  appointmentsReviewDecision,
  appointmentsSchedule,
} from "@/lib/api/generated/appointments/appointments";
import { counselingSessionOpenFromAppointment } from "@/lib/api/generated/counseling/counseling";
import type {
  AppointmentPageResultSchema,
  AppointmentProjectionSchema,
  AppointmentMutationResponseSchema,
  AppointmentReasonSchema,
  CompletionSchema,
  DecisionSchema,
  ReviewDecisionSchema,
  ScheduleSchema,
} from "@/lib/api/generated/model";
import {
  cookieSessionMutationOptions,
  cookieSessionReadOptions,
} from "@/lib/api/auth";
import { withIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";

export const APPOINTMENTS_PAGE_SIZE = 20;

export const APPOINTMENT_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "PENDING_REVIEW",
  "APPROVED",
  "SCHEDULED",
  "DECLINED",
  "CANCELLED_BY_STUDENT",
  "CANCELLED_BY_OFFICE",
  "LATE_CANCELLATION_REQUESTED",
  "LATE_CANCELLATION_APPROVED",
  "LATE_CANCELLATION_DECLINED",
  "COMPLETED",
  "NO_SHOW",
] as const;

export const APPOINTMENT_TYPES = [
  "COUNSELING",
  "ROUTINE_INTERVIEW",
  "FOLLOW_UP",
  "OTHER",
] as const;

export const APPOINTMENT_MODES = ["ONSITE", "ONLINE"] as const;
export const APPOINTMENT_ASSIGNMENTS = ["all", "mine", "unassigned"] as const;
export const APPOINTMENT_ORDERS = ["recent", "upcoming"] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export type AppointmentType = (typeof APPOINTMENT_TYPES)[number];
export type AppointmentMode = (typeof APPOINTMENT_MODES)[number];
export type AppointmentAssignment = (typeof APPOINTMENT_ASSIGNMENTS)[number];
export type AppointmentOrder = (typeof APPOINTMENT_ORDERS)[number];

export type AppointmentsErrorKind =
  | "conflict"
  | "permission"
  | "rate_limited"
  | "unavailable"
  | "validation";

export class AppointmentsApiError extends Error {
  readonly kind: AppointmentsErrorKind;

  constructor(kind: AppointmentsErrorKind) {
    super("The appointment request could not be completed.");
    this.name = "AppointmentsApiError";
    this.kind = kind;
  }
}

export type PortalAppointment = {
  appointment_mode: AppointmentMode;
  appointment_type: AppointmentType;
  assignment_state?: "Assigned to you" | "Assigned" | "Unassigned" | null;
  cancellation_reason?: string | null;
  confirmed_date?: string | null;
  confirmed_end_time?: string | null;
  confirmed_start_time?: string | null;
  internal_notes?: string | null;
  reason?: string | null;
  reference_code: string;
  requested_date?: string | null;
  requested_start_time?: string | null;
  status: AppointmentStatus;
  student_display_name?: string | null;
  student_number?: string | null;
};

export type PortalAppointmentPage = {
  items: PortalAppointment[];
  page: number;
  page_size: number;
  total: number;
};

export type AppointmentListFilters = {
  q?: string | null;
  status?: string | null;
  appointmentType?: AppointmentType | null;
  appointmentMode?: AppointmentMode | null;
  assignment?: AppointmentAssignment;
  dateFrom?: string | null;
  dateTo?: string | null;
  order?: AppointmentOrder;
};

const MAX_PAGE = 100_000;
const MAX_QUERY_LENGTH = 120;
const MAX_REFERENCE_LENGTH = 25;
const MAX_DISPLAY_NAME_LENGTH = 160;
const MAX_STUDENT_NUMBER_LENGTH = 50;
const MAX_TEXT_LENGTH = 2_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?$/;
const STATUS_SET = new Set<string>(APPOINTMENT_STATUSES);
const TYPE_SET = new Set<string>(APPOINTMENT_TYPES);
const MODE_SET = new Set<string>(APPOINTMENT_MODES);
const ASSIGNMENT_SET = new Set<string>(APPOINTMENT_ASSIGNMENTS);
const ORDER_SET = new Set<string>(APPOINTMENT_ORDERS);
const ASSIGNMENT_STATES = new Set([
  "Assigned to you",
  "Assigned",
  "Unassigned",
]);

type GeneratedResponse = { data: unknown; status: number };

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedString(
  value: unknown,
  maximum: number,
  allowEmpty = false,
): value is string {
  return (
    typeof value === "string" &&
    value.length <= maximum &&
    (allowEmpty || value.trim().length > 0)
  );
}

function isOptionalDate(value: unknown): value is string | null | undefined {
  return value === null || value === undefined || (
    typeof value === "string" && DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  );
}

function isOptionalTime(value: unknown): value is string | null | undefined {
  return value === null || value === undefined || (
    typeof value === "string" && TIME_PATTERN.test(value)
  );
}

function isOptionalText(value: unknown): value is string | null | undefined {
  return value === null || value === undefined || isBoundedString(value, MAX_TEXT_LENGTH, true);
}

function isAppointment(value: unknown): value is PortalAppointment {
  if (!isRecord(value)) return false;

  return (
    isBoundedString(value.reference_code, MAX_REFERENCE_LENGTH) &&
    typeof value.appointment_type === "string" &&
    TYPE_SET.has(value.appointment_type) &&
    typeof value.appointment_mode === "string" &&
    MODE_SET.has(value.appointment_mode) &&
    typeof value.status === "string" &&
    STATUS_SET.has(value.status) &&
    isOptionalDate(value.requested_date) &&
    isOptionalTime(value.requested_start_time) &&
    isOptionalDate(value.confirmed_date) &&
    isOptionalTime(value.confirmed_start_time) &&
    isOptionalTime(value.confirmed_end_time) &&
    (value.student_display_name === null ||
      value.student_display_name === undefined ||
      isBoundedString(value.student_display_name, MAX_DISPLAY_NAME_LENGTH, true)) &&
    (value.student_number === null ||
      value.student_number === undefined ||
      isBoundedString(value.student_number, MAX_STUDENT_NUMBER_LENGTH, true)) &&
    (value.assignment_state === null ||
      value.assignment_state === undefined ||
      (typeof value.assignment_state === "string" && ASSIGNMENT_STATES.has(value.assignment_state))) &&
    isOptionalText(value.reason) &&
    isOptionalText(value.cancellation_reason) &&
    isOptionalText(value.internal_notes)
  );
}

function parseAppointment(value: unknown): PortalAppointment | null {
  if (!isAppointment(value)) return null;
  return {
    appointment_mode: value.appointment_mode,
    appointment_type: value.appointment_type,
    assignment_state: value.assignment_state ?? null,
    cancellation_reason: value.cancellation_reason ?? null,
    confirmed_date: value.confirmed_date ?? null,
    confirmed_end_time: value.confirmed_end_time ?? null,
    confirmed_start_time: value.confirmed_start_time ?? null,
    internal_notes: value.internal_notes ?? null,
    reason: value.reason ?? null,
    reference_code: value.reference_code,
    requested_date: value.requested_date ?? null,
    requested_start_time: value.requested_start_time ?? null,
    status: value.status,
    student_display_name: value.student_display_name ?? null,
    student_number: value.student_number ?? null,
  };
}

function parsePage(value: unknown): PortalAppointmentPage | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null;
  const page = value.page;
  const pageSize = value.page_size;
  const total = value.total;
  if (
    typeof page !== "number" ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > MAX_PAGE ||
    typeof pageSize !== "number" ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100 ||
    typeof total !== "number" ||
    !Number.isSafeInteger(total) ||
    total < 0 ||
    value.items.length > pageSize
  ) {
    return null;
  }

  return {
    items: value.items.map(parseAppointment).filter((item): item is PortalAppointment => item !== null),
    page,
    page_size: pageSize,
    total,
  };
}

function normalizeDate(value: string | null | undefined) {
  if (!value || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    return null;
  }
  return value;
}

function normalizeQuery(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized && normalized.length <= MAX_QUERY_LENGTH ? normalized : null;
}

function normalizeStatuses(value: string | null | undefined) {
  if (!value) return null;
  const statuses = [...new Set(value.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean))];
  if (statuses.length === 0 || statuses.length > APPOINTMENT_STATUSES.length || statuses.some((item) => !STATUS_SET.has(item))) {
    return null;
  }
  return statuses.join(",");
}

function normalizeEnum<T extends string>(value: T | null | undefined, values: Set<string>) {
  return value && values.has(value) ? value : null;
}

function requestErrorKind(status: number): AppointmentsErrorKind {
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
    throw new AppointmentsApiError(requestErrorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof AppointmentsApiError) throw error;
    throw new AppointmentsApiError("unavailable");
  }
}

export function getPortalAppointments(
  page = 1,
  filters: AppointmentListFilters = {},
  signal?: AbortSignal,
): Promise<PortalAppointmentPage> {
  const safePage = Number.isSafeInteger(page) && page > 0 && page <= MAX_PAGE ? page : 1;
  const dateFrom = normalizeDate(filters.dateFrom);
  const dateTo = normalizeDate(filters.dateTo);
  const params = {
    page: safePage,
    page_size: APPOINTMENTS_PAGE_SIZE,
    ...(normalizeQuery(filters.q) ? { q: normalizeQuery(filters.q) } : {}),
    ...(normalizeStatuses(filters.status) ? { status: normalizeStatuses(filters.status) } : {}),
    ...(normalizeEnum(filters.appointmentType, TYPE_SET) ? { appointment_type: filters.appointmentType } : {}),
    ...(normalizeEnum(filters.appointmentMode, MODE_SET) ? { appointment_mode: filters.appointmentMode } : {}),
    ...(normalizeEnum(filters.assignment, ASSIGNMENT_SET) ? { assignment: filters.assignment } : {}),
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(dateTo ? { date_to: dateTo } : {}),
    ...(normalizeEnum(filters.order, ORDER_SET) ? { order: filters.order } : {}),
  };

  return readRequest(
    appointmentsList(params, cookieSessionReadOptions(signal)),
    parsePage,
  ).then((page): PortalAppointmentPage => {
    if (page === null) throw new AppointmentsApiError("unavailable");
    return page;
  });
}

export function getPortalAppointmentDetail(referenceCode: string, signal?: AbortSignal) {
  const safeReference = referenceCode.trim().slice(0, MAX_REFERENCE_LENGTH);
  if (!safeReference) {
    return Promise.reject(new AppointmentsApiError("validation"));
  }
  return readRequest(
    appointmentsDetail(safeReference, cookieSessionReadOptions(signal)),
    parseAppointment,
  );
}

async function runMutation(
  request: (options: RequestInit) => Promise<GeneratedResponse>,
  idempotencyKey: IdempotencyKey,
  signal?: AbortSignal,
): Promise<AppointmentMutationResponseSchema> {
  try {
    const response = await request(
      withIdempotencyKey(idempotencyKey, await cookieSessionMutationOptions(signal)),
    );
    if (response.status === 200 && isRecord(response.data) &&
      isBoundedString(response.data.reference_code, MAX_REFERENCE_LENGTH) &&
      isBoundedString(response.data.status, 60)) {
      return {
        reference_code: response.data.reference_code,
        status: response.data.status,
      };
    }
    throw new AppointmentsApiError(requestErrorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof AppointmentsApiError) throw error;
    throw new AppointmentsApiError("unavailable");
  }
}

function safeReference(referenceCode: string) {
  const value = referenceCode.trim().slice(0, MAX_REFERENCE_LENGTH);
  if (!value) throw new AppointmentsApiError("validation");
  return value;
}

export function cancelPortalAppointment(
  referenceCode: string,
  payload: AppointmentReasonSchema,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  return runMutation((options) => appointmentsCancel(safeReference(referenceCode), payload, options), key, signal);
}

export function requestLateCancellation(
  referenceCode: string,
  payload: AppointmentReasonSchema,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  return runMutation((options) => appointmentsLateCancellationRequest(safeReference(referenceCode), payload, options), key, signal);
}

export function completePortalAppointment(
  referenceCode: string,
  payload: CompletionSchema,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  return runMutation((options) => appointmentsComplete(safeReference(referenceCode), payload, options), key, signal);
}

export function markAppointmentNoShow(
  referenceCode: string,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  return runMutation((options) => appointmentsNoShow(safeReference(referenceCode), options), key, signal);
}

export function reviewAppointment(
  referenceCode: string,
  payload: ReviewDecisionSchema,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  return runMutation((options) => appointmentsReviewDecision(safeReference(referenceCode), payload, options), key, signal);
}

export function scheduleAppointment(
  referenceCode: string,
  payload: ScheduleSchema,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  return runMutation((options) => appointmentsSchedule(safeReference(referenceCode), payload, options), key, signal);
}

export function openPortalAppointmentSession(referenceCode: string, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation(
    (options) => counselingSessionOpenFromAppointment(safeReference(referenceCode), options),
    key,
    signal,
  );
}

export type AppointmentDecision = DecisionSchema;

export type GeneratedAppointmentProjection = AppointmentProjectionSchema;
export type GeneratedAppointmentPage = AppointmentPageResultSchema;
