import {
  auditEntriesList,
  auditEntryDetail,
} from "@/lib/api/generated/audit/audit";
import {
  cookieSessionReadOptions,
} from "@/lib/api/auth";
import type {
  AuditEntryProjectionSchema,
  AuditPageSchema,
  AuditSafeContextSchema,
  AuthorityMeProjectionSchemaAuditPlanesItem,
} from "@/lib/api/generated/model";

export type PortalAuditPlane = AuthorityMeProjectionSchemaAuditPlanesItem;

export type AuditApiErrorKind =
  | "permission"
  | "rate_limited"
  | "unavailable"
  | "validation";

export class AuditApiError extends Error {
  readonly kind: AuditApiErrorKind;

  constructor(kind: AuditApiErrorKind) {
    super("The audit request could not be completed.");
    this.name = "AuditApiError";
    this.kind = kind;
  }
}

export type PortalAuditFilters = {
  actionType?: string | null;
  createdFrom?: string | null;
  createdUntil?: string | null;
  eventCategory?: string | null;
  requestId?: string | null;
  severity?: string | null;
  sourceApp?: string | null;
  targetModel?: string | null;
  traceId?: string | null;
};

const PAGE_SIZE = 20;
const MAX_PAGE = 100_000;
const MAX_PAGE_SIZE = 100;
const MAX_CODE_LENGTH = 100;
const MAX_TIMESTAMP_LENGTH = 80;
const SAFE_CODE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/;
const SAFE_CONTEXT_KEYS = [
  "status",
  "from_status",
  "to_status",
  "decision",
  "decision_code",
  "reason_code",
  "result_code",
  "operation",
  "outcome",
  "scope",
  "policy_key",
  "success",
  "has_notes",
  "count",
] as const;

type GeneratedResponse = {
  data: unknown;
  status: number;
};

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeCode(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_CODE_LENGTH &&
    SAFE_CODE.test(value)
  );
}

function isOptionalSafeCode(value: unknown): value is string | null | undefined {
  return value === null || value === undefined || isSafeCode(value);
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_TIMESTAMP_LENGTH &&
    !Number.isNaN(Date.parse(value))
  );
}

function isSafeInteger(value: unknown, minimum = 0): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;
}

function isSafeContext(value: unknown): value is AuditSafeContextSchema {
  if (!isRecord(value)) return false;

  return Object.entries(value).every(([key, contextValue]) => {
    if (!SAFE_CONTEXT_KEYS.includes(key as (typeof SAFE_CONTEXT_KEYS)[number])) {
      return false;
    }

    return (
      contextValue === null ||
      typeof contextValue === "boolean" ||
      (typeof contextValue === "number" &&
        Number.isSafeInteger(contextValue) &&
        contextValue >= 0 &&
        contextValue <= 1_000_000) ||
      (typeof contextValue === "string" && isSafeCode(contextValue))
    );
  });
}

function isAuditEntry(value: unknown): value is AuditEntryProjectionSchema {
  if (!isRecord(value)) return false;

  return (
    isSafeInteger(value.id, 1) &&
    isTimestamp(value.created_at) &&
    isSafeCode(value.action_type) &&
    isSafeCode(value.event_category) &&
    isSafeCode(value.severity) &&
    isSafeCode(value.source_app) &&
    isSafeCode(value.actor_role) &&
    isOptionalSafeCode(value.actor_fingerprint) &&
    isSafeCode(value.target_model) &&
    isOptionalSafeCode(value.target_reference) &&
    isOptionalSafeCode(value.target_fingerprint) &&
    isOptionalSafeCode(value.request_id) &&
    isOptionalSafeCode(value.trace_id) &&
    isSafeContext(value.safe_context)
  );
}

function parsePage(value: unknown): AuditPageSchema | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null;
  if (
    !isSafeInteger(value.page, 1) ||
    value.page > MAX_PAGE ||
    !isSafeInteger(value.page_size, 1) ||
    value.page_size > MAX_PAGE_SIZE ||
    !isSafeInteger(value.total) ||
    value.items.length > value.page_size
  ) {
    return null;
  }

  return {
    items: value.items.filter(isAuditEntry),
    page: value.page,
    page_size: value.page_size,
    total: value.total,
  };
}

function normalizeCode(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return isSafeCode(normalized) ? normalized : null;
}

function normalizeDate(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(normalized) ||
    Number.isNaN(Date.parse(`${normalized}T00:00:00`))
  ) {
    return null;
  }
  return normalized;
}

function normalizePage(value: number) {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_PAGE) return 1;
  return value;
}

function responseErrorKind(status: number): AuditApiErrorKind {
  if (status === 400 || status === 422) return "validation";
  if (status === 401 || status === 403 || status === 404) return "permission";
  if (status === 429) return "rate_limited";
  return "unavailable";
}

async function getReadResponse<T>(
  request: Promise<GeneratedResponse>,
  parse: (value: unknown) => T | null,
): Promise<T> {
  try {
    const response = await request;
    if (response.status === 200) {
      const data = parse(response.data);
      if (data) return data;
    }
    throw new AuditApiError(responseErrorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof AuditApiError) throw error;
    throw new AuditApiError("unavailable");
  }
}

function normalizedFilters(filters: PortalAuditFilters) {
  return {
    action_type: normalizeCode(filters.actionType),
    created_from: normalizeDate(filters.createdFrom),
    created_until: normalizeDate(filters.createdUntil),
    event_category: normalizeCode(filters.eventCategory),
    request_id: normalizeCode(filters.requestId),
    severity: normalizeCode(filters.severity),
    source_app: normalizeCode(filters.sourceApp),
    target_model: normalizeCode(filters.targetModel),
    trace_id: normalizeCode(filters.traceId),
  };
}

export function getPortalAuditEntries(
  plane: PortalAuditPlane,
  page = 1,
  filters: PortalAuditFilters = {},
  signal?: AbortSignal,
) {
  const normalized = normalizedFilters(filters);

  return getReadResponse(
    auditEntriesList(
      {
        page: normalizePage(page),
        page_size: PAGE_SIZE,
        plane,
        ...(normalized.action_type ? { action_type: normalized.action_type } : {}),
        ...(normalized.created_from ? { created_from: normalized.created_from } : {}),
        ...(normalized.created_until ? { created_until: normalized.created_until } : {}),
        ...(normalized.event_category ? { event_category: normalized.event_category } : {}),
        ...(normalized.request_id ? { request_id: normalized.request_id } : {}),
        ...(normalized.severity ? { severity: normalized.severity } : {}),
        ...(normalized.source_app ? { source_app: normalized.source_app } : {}),
        ...(normalized.target_model ? { target_model: normalized.target_model } : {}),
        ...(normalized.trace_id ? { trace_id: normalized.trace_id } : {}),
      },
      cookieSessionReadOptions(signal),
    ),
    parsePage,
  );
}

export function getPortalAuditEntryDetail(
  entryId: number,
  plane: PortalAuditPlane,
  signal?: AbortSignal,
) {
  return getReadResponse(
    auditEntryDetail(
      entryId,
      { plane },
      cookieSessionReadOptions(signal),
    ),
    (value) => (isAuditEntry(value) ? value : null),
  );
}
