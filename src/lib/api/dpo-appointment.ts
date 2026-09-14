import {
  policiesDpoStaffAppointmentCreate,
  policiesDpoStaffAppointmentDetail,
  policiesDpoStaffAppointmentOptions,
  policiesDpoStaffAppointmentRetire,
  policiesDpoStaffAppointments,
} from "@/lib/api/generated/policies/policies";
import { cookieSessionMutationOptions, cookieSessionReadOptions } from "@/lib/api/auth";
import { withIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";

export const DPO_APPOINTMENT_PAGE_SIZE = 20;
export const DPO_APPOINTMENT_STATUSES = ["ACTIVE", "RETIRED"] as const;
export const DPO_APPOINTMENT_ORDERS = ["recent", "oldest"] as const;

export type DpoAppointmentStatus = (typeof DPO_APPOINTMENT_STATUSES)[number];
export type DpoAppointmentOrder = (typeof DPO_APPOINTMENT_ORDERS)[number];

export type DpoAppointment = {
  reference_code: string;
  holder_display_name: string;
  holder_role_label: string;
  contact_email: string;
  appointment_reference: string;
  status: DpoAppointmentStatus;
  valid_from: string;
  valid_until: string | null;
  appointed_at: string;
  retired_at: string | null;
};

export type DpoAppointmentHolderOption = {
  display_name: string;
  role_label: string;
};

export type DpoAppointmentFilters = {
  status?: DpoAppointmentStatus[];
  order?: DpoAppointmentOrder;
};

export type DpoAppointmentPage = {
  items: DpoAppointment[];
  page: number;
  page_size: number;
  total: number;
};

export type DpoAppointmentCreateFields = {
  holder: DpoAppointmentHolderOption;
  valid_from: string;
  valid_until?: string;
  appointment_reference: string;
  contact_email: string;
};

export type DpoAppointmentApiErrorKind =
  | "conflict"
  | "permission"
  | "rate_limited"
  | "unavailable"
  | "validation";

export class DpoAppointmentApiError extends Error {
  readonly kind: DpoAppointmentApiErrorKind;

  constructor(kind: DpoAppointmentApiErrorKind) {
    super("The DPO appointment request could not be completed.");
    this.name = "DpoAppointmentApiError";
    this.kind = kind;
  }
}
type GeneratedResponse = { data: unknown; status: number };

const holderTokens = new WeakMap<DpoAppointmentHolderOption, string>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, max: number, required = true): string | null {
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) {
    return null;
  }
  return value;
}

function timestamp(value: unknown, required = true): string | null {
  if (value === null && !required) return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return value;
}

function status(value: unknown): DpoAppointmentStatus | null {
  return typeof value === "string" && DPO_APPOINTMENT_STATUSES.includes(value as DpoAppointmentStatus)
    ? (value as DpoAppointmentStatus)
    : null;
}

function parseAppointment(value: unknown): DpoAppointment | null {
  if (!isRecord(value)) return null;
  const referenceCode = boundedString(value.reference_code, 300);
  const displayName = boundedString(value.holder_display_name, 255);
  const roleLabel = boundedString(value.holder_role_label, 120);
  const contactEmail = boundedString(value.contact_email, 254);
  const appointmentReference = boundedString(value.appointment_reference, 255);
  const appointmentStatus = status(value.status);
  const validFrom = timestamp(value.valid_from);
  const validUntil = timestamp(value.valid_until, false);
  const appointedAt = timestamp(value.appointed_at);
  const retiredAt = timestamp(value.retired_at, false);
  if (!referenceCode || !displayName || !roleLabel || !contactEmail || !appointmentReference || !appointmentStatus || !validFrom || !appointedAt) {
    return null;
  }
  return {
    reference_code: referenceCode,
    holder_display_name: displayName,
    holder_role_label: roleLabel,
    contact_email: contactEmail,
    appointment_reference: appointmentReference,
    status: appointmentStatus,
    valid_from: validFrom,
    valid_until: validUntil,
    appointed_at: appointedAt,
    retired_at: retiredAt,
  };
}

function parsePage(value: unknown): DpoAppointmentPage | null {
  if (!isRecord(value) || !Array.isArray(value.items) || typeof value.page !== "number" || typeof value.page_size !== "number" || typeof value.total !== "number") {
    return null;
  }
  if (!Number.isSafeInteger(value.page) || value.page < 1 || value.page_size !== DPO_APPOINTMENT_PAGE_SIZE || !Number.isSafeInteger(value.total) || value.total < 0) {
    return null;
  }
  const items = value.items.map(parseAppointment).filter((item): item is DpoAppointment => item !== null);
  if (items.length !== value.items.length) return null;
  return { items, page: value.page, page_size: value.page_size, total: value.total };
}

function parseOptions(value: unknown): DpoAppointmentHolderOption[] | null {
  if (!isRecord(value) || !Array.isArray(value.holders)) return null;
  const options: DpoAppointmentHolderOption[] = [];
  for (const item of value.holders) {
    if (!isRecord(item)) return null;
    const displayName = boundedString(item.display_name, 255);
    const roleLabel = boundedString(item.role_label, 120);
    const token = boundedString(item.selection_token, 4000);
    if (!displayName || !roleLabel || !token) return null;
    const option = { display_name: displayName, role_label: roleLabel };
    holderTokens.set(option, token);
    options.push(option);
  }
  return options;
}

function errorKind(httpStatus: number): DpoAppointmentApiErrorKind {
  if (httpStatus === 409) return "conflict";
  if (httpStatus === 429) return "rate_limited";
  if (httpStatus === 400 || httpStatus === 422) return "validation";
  if (httpStatus === 401 || httpStatus === 403 || httpStatus === 404) return "permission";
  return "unavailable";
}

async function readRequest<T>(request: Promise<GeneratedResponse>, parse: (value: unknown) => T | null): Promise<T> {
  try {
    const response = await request;
    if (response.status === 200) {
      const parsed = parse(response.data);
      if (parsed !== null) return parsed;
    }
    throw new DpoAppointmentApiError(errorKind(response.status));
  } catch (error) {
    if (error instanceof DpoAppointmentApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new DpoAppointmentApiError("unavailable");
  }
}

function toDateTime(value: string, endOfDay = false): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T${endOfDay ? "23:59:59" : "00:00:00"}+08:00`;
  }
  if (Number.isNaN(Date.parse(trimmed))) throw new DpoAppointmentApiError("validation");
  return trimmed;
}

function mutation<T>(request: (options: RequestInit) => Promise<GeneratedResponse>, key: IdempotencyKey, parse: (value: unknown) => T | null, signal?: AbortSignal): Promise<T> {
  return cookieSessionMutationOptions(signal)
    .then((options) => request(withIdempotencyKey(key, options)))
    .then((response) => {
      if (response.status >= 200 && response.status < 300) {
        const parsed = parse(response.data);
        if (parsed !== null) return parsed;
      }
      throw new DpoAppointmentApiError(errorKind(response.status));
    })
    .catch((error) => {
      if (error instanceof DpoAppointmentApiError || (error instanceof Error && error.name === "AbortError")) throw error;
      throw new DpoAppointmentApiError("unavailable");
    });
}

export function getDpoAppointments(filters: DpoAppointmentFilters = {}, page = 1, signal?: AbortSignal) {
  if (!Number.isSafeInteger(page) || page < 1) throw new DpoAppointmentApiError("validation");
  const statusValues = filters.status?.join(",");
  if (filters.order && !DPO_APPOINTMENT_ORDERS.includes(filters.order)) throw new DpoAppointmentApiError("validation");
  return readRequest(
    policiesDpoStaffAppointments(
      { page, page_size: DPO_APPOINTMENT_PAGE_SIZE, status: statusValues, order: filters.order ?? "recent" },
      cookieSessionReadOptions(signal),
    ),
    parsePage,
  );
}

export function getDpoAppointmentOptions(signal?: AbortSignal) {
  return readRequest(policiesDpoStaffAppointmentOptions(cookieSessionReadOptions(signal)), parseOptions);
}

export function getDpoAppointmentDetail(referenceCode: string, signal?: AbortSignal) {
  const safeReference = boundedString(referenceCode, 300);
  if (!safeReference) throw new DpoAppointmentApiError("validation");
  return readRequest(policiesDpoStaffAppointmentDetail(safeReference, cookieSessionReadOptions(signal)), parseAppointment);
}

export function createDpoAppointment(fields: DpoAppointmentCreateFields, key: IdempotencyKey, signal?: AbortSignal) {
  const token = holderTokens.get(fields.holder);
  const appointmentReference = boundedString(fields.appointment_reference, 255);
  const contactEmail = boundedString(fields.contact_email, 254);
  if (!token || !appointmentReference || !contactEmail) throw new DpoAppointmentApiError("validation");
  return mutation(
    (options) => policiesDpoStaffAppointmentCreate({
      holder_selection_token: token,
      valid_from: toDateTime(fields.valid_from),
      valid_until: fields.valid_until?.trim() ? toDateTime(fields.valid_until, true) : null,
      appointment_reference: appointmentReference,
      contact_email: contactEmail,
    }, options),
    key,
    parseAppointment,
    signal,
  );
}

export function retireDpoAppointment(appointment: DpoAppointment, reasonCode: string, key: IdempotencyKey, signal?: AbortSignal) {
  const referenceCode = boundedString(appointment.reference_code, 300);
  const reason = boundedString(reasonCode, 80);
  if (!referenceCode || !reason) throw new DpoAppointmentApiError("validation");
  return mutation(
    (options) => policiesDpoStaffAppointmentRetire(referenceCode, { reason_code: reason }, options),
    key,
    parseAppointment,
    signal,
  );
}
