import {
  systemEnvironmentSummary as generatedEnvironmentSummary,
  systemErrorReopen,
  systemErrorResolve,
  systemErrorsList,
  systemMaintenanceActivate,
  systemMaintenanceCancel,
  systemMaintenanceComplete,
  systemMaintenanceExtend,
  systemMaintenanceList,
  systemMaintenanceSchedule,
  systemOperationsCatalog,
  systemOperationsRuns,
  systemReleaseMetadata as generatedReleaseMetadata,
} from "@/lib/api/generated/system/system";
import {
  cookieSessionMutationOptions,
  cookieSessionReadOptions,
} from "@/lib/api/auth";
import { withIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";
import type {
  ApplicationErrorProjectionSchema,
  DiagnosticTransitionSchema,
  EnvironmentSummarySchema,
  MaintenancePageSchema,
  MaintenanceProjectionSchema,
  MaintenanceScheduleSchema,
  MaintenanceTransitionSchema,
  OperationalCommandCatalogSchema,
  OperationalCommandRunProjectionSchema,
  OperationalRunPageSchema,
  ReleaseMetadataSchema,
  SystemErrorPageSchema,
} from "@/lib/api/generated/model";

export type SystemOperationsErrorKind =
  | "conflict"
  | "permission"
  | "rate_limited"
  | "unavailable"
  | "validation";

export class SystemOperationsApiError extends Error {
  readonly kind: SystemOperationsErrorKind;

  constructor(kind: SystemOperationsErrorKind) {
    super("The system operations request could not be completed.");
    this.name = "SystemOperationsApiError";
    this.kind = kind;
  }
}

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_ID_LENGTH = 160;
const MAX_SHORT_TEXT_LENGTH = 160;
const MAX_TEXT_LENGTH = 500;
const MAX_LONG_TEXT_LENGTH = 1000;
const MAX_TIMESTAMP_LENGTH = 80;
const ERROR_SEVERITIES = new Set(["debug", "info", "warning", "error", "critical"]);
const MAINTENANCE_STATUSES = new Set(["scheduled", "active", "completed", "cancelled"]);

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

function isBoundedString(
  value: unknown,
  maximum = MAX_SHORT_TEXT_LENGTH,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maximum
  );
}

function isBoundedStringAllowEmpty(
  value: unknown,
  maximum = MAX_SHORT_TEXT_LENGTH,
): value is string {
  return typeof value === "string" && value.length <= maximum;
}

function isOptionalBoundedString(
  value: unknown,
  maximum = MAX_SHORT_TEXT_LENGTH,
): value is string | null | undefined {
  return value === null || value === undefined || isBoundedString(value, maximum);
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAX_TIMESTAMP_LENGTH &&
    !Number.isNaN(Date.parse(value))
  );
}

function isOptionalTimestamp(value: unknown) {
  return value === null || value === undefined || isTimestamp(value);
}

function isSafeInteger(value: unknown, minimum = 0): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;
}

function isOptionalStatusCode(value: unknown): value is number | null | undefined {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= 100 &&
      value <= 599)
  );
}

function isPageEnvelope(value: unknown): value is {
  items: unknown[];
  page: number;
  page_size: number;
  total: number;
} {
  if (!isRecord(value) || !Array.isArray(value.items)) return false;

  return (
    isSafeInteger(value.page, 1) &&
    isSafeInteger(value.page_size, 1) &&
    value.page_size <= MAX_PAGE_SIZE &&
    isSafeInteger(value.total) &&
    value.items.length <= value.page_size &&
    value.items.length <= value.total
  );
}

function parsePageEnvelope<T>(
  value: unknown,
  isItem: (item: unknown) => item is T,
): { items: T[]; page: number; page_size: number; total: number } | null {
  if (!isPageEnvelope(value)) return null;

  return {
    ...value,
    // A malformed row must not make the rest of an otherwise safe page unusable.
    items: value.items.filter(isItem),
  };
}

function isApplicationError(
  value: unknown,
): value is ApplicationErrorProjectionSchema {
  if (!isRecord(value)) return false;

  return (
    isBoundedString(value.category) &&
    isTimestamp(value.created_at) &&
    isRecord(value.diagnostic_context) &&
    isBoundedString(value.environment) &&
    isBoundedString(value.error_id, MAX_ID_LENGTH) &&
    isBoundedString(value.fingerprint, MAX_ID_LENGTH) &&
    isBoundedString(value.fingerprint_version, MAX_SHORT_TEXT_LENGTH) &&
    typeof value.is_resolved === "boolean" &&
    isRecord(value.remediation) &&
    isBoundedString(value.safe_message, MAX_LONG_TEXT_LENGTH) &&
    isBoundedString(value.severity) &&
    ERROR_SEVERITIES.has(value.severity) &&
    isOptionalTimestamp(value.resolved_at) &&
    isOptionalBoundedString(value.app_label) &&
    isOptionalBoundedString(value.build_id) &&
    isOptionalBoundedString(value.exception_class) &&
    isOptionalBoundedString(value.http_method) &&
    isOptionalBoundedString(value.path_template, MAX_TEXT_LENGTH) &&
    isOptionalBoundedString(value.release_version) &&
    isOptionalBoundedString(value.request_id, MAX_ID_LENGTH) &&
    isOptionalBoundedString(value.route_name, MAX_TEXT_LENGTH) &&
    isOptionalStatusCode(value.status_code) &&
    isOptionalBoundedString(value.trace_id, MAX_ID_LENGTH) &&
    isOptionalBoundedString(value.view_name, MAX_TEXT_LENGTH)
  );
}

function parseSystemErrorPage(value: unknown): SystemErrorPageSchema | null {
  return parsePageEnvelope(value, isApplicationError);
}

function isMaintenance(value: unknown): value is MaintenanceProjectionSchema {
  if (!isRecord(value)) return false;

  return (
    isOptionalTimestamp(value.created_at) &&
    isOptionalTimestamp(value.ends_at) &&
    isBoundedString(value.id, MAX_ID_LENGTH) &&
    isBoundedStringAllowEmpty(value.internal_reason_code) &&
    typeof value.is_expired === "boolean" &&
    isBoundedStringAllowEmpty(value.safe_public_message, MAX_LONG_TEXT_LENGTH) &&
    isOptionalTimestamp(value.starts_at) &&
    isBoundedString(value.status) &&
    MAINTENANCE_STATUSES.has(value.status) &&
    isOptionalTimestamp(value.updated_at)
  );
}

function parseMaintenancePage(value: unknown): MaintenancePageSchema | null {
  return parsePageEnvelope(value, isMaintenance);
}

function isReleaseMetadata(value: unknown): value is ReleaseMetadataSchema {
  if (!isRecord(value) || !isRecord(value.release)) return false;

  return (
    isBoundedString(value.environment) &&
    isBoundedString(value.release.build_id, MAX_ID_LENGTH) &&
    typeof value.release.configured === "boolean" &&
    isBoundedString(value.release.version)
  );
}

function isEnvironmentSummary(value: unknown): value is EnvironmentSummarySchema {
  if (
    !isRecord(value) ||
    !isRecord(value.components) ||
    !isRecord(value.maintenance) ||
    !isRecord(value.release)
  ) {
    return false;
  }

  return (
    isBoundedString(value.deployment_class) &&
    isBoundedString(value.environment) &&
    typeof value.maintenance.active === "boolean" &&
    typeof value.components.backup_worker_enabled === "boolean" &&
    isBoundedString(value.components.cache_backend) &&
    typeof value.components.notification_worker_enabled === "boolean" &&
    isBoundedString(value.components.protected_storage_backend) &&
    isBoundedString(value.release.build_id, MAX_ID_LENGTH) &&
    typeof value.release.configured === "boolean" &&
    isBoundedString(value.release.version)
  );
}

function isOperationsCatalog(
  value: unknown,
): value is OperationalCommandCatalogSchema {
  if (!isRecord(value) || !Array.isArray(value.items)) return false;

  return value.items.every((item) => {
    if (!isRecord(item)) return false;
    return (
      isBoundedString(item.key, MAX_ID_LENGTH) &&
      isBoundedString(item.label, MAX_TEXT_LENGTH) &&
      isBoundedString(item.mode)
    );
  });
}

function isOperationRun(
  value: unknown,
): value is OperationalCommandRunProjectionSchema {
  if (!isRecord(value)) return false;

  return (
    isBoundedString(value.command_key, MAX_ID_LENGTH) &&
    isBoundedString(value.environment) &&
    isBoundedString(value.id, MAX_ID_LENGTH) &&
    isBoundedString(value.mode) &&
    isBoundedString(value.outcome) &&
    isBoundedString(value.reason_code) &&
    isOptionalTimestamp(value.finished_at) &&
    isOptionalTimestamp(value.started_at) &&
    isOptionalBoundedString(value.build_id, MAX_ID_LENGTH) &&
    isOptionalBoundedString(value.configuration_identifier, MAX_ID_LENGTH) &&
    isOptionalBoundedString(value.outcome_reason_code, MAX_TEXT_LENGTH) &&
    isOptionalBoundedString(value.release_version, MAX_SHORT_TEXT_LENGTH)
  );
}

function parseOperationRunPage(value: unknown): OperationalRunPageSchema | null {
  return parsePageEnvelope(value, isOperationRun);
}

function isDiagnosticTransitionResult(
  value: unknown,
): value is ApplicationErrorProjectionSchema {
  return isApplicationError(value);
}

function isMaintenanceResult(value: unknown): value is MaintenanceProjectionSchema {
  return isMaintenance(value);
}

function errorKind(status: number): SystemOperationsErrorKind {
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 422) return "validation";
  if (status === 401 || status === 403 || status === 404) return "permission";
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
    throw new SystemOperationsApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof SystemOperationsApiError) throw error;
    throw new SystemOperationsApiError("unavailable");
  }
}

async function getMutationResponse<T>(
  request: (options: RequestInit) => Promise<GeneratedResponse>,
  idempotencyKey: IdempotencyKey,
  validate: (value: unknown) => value is T,
  signal?: AbortSignal,
): Promise<T> {
  try {
    const options = await cookieSessionMutationOptions(signal);
    const response = await request(withIdempotencyKey(idempotencyKey, options));
    if (response.status === 200 && validate(response.data)) return response.data;
    throw new SystemOperationsApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof SystemOperationsApiError) throw error;
    throw new SystemOperationsApiError("unavailable");
  }
}

export function getSystemErrors(page = 1, signal?: AbortSignal) {
  return getReadResponse(
    systemErrorsList({ page, page_size: PAGE_SIZE }, cookieSessionReadOptions(signal)),
    parseSystemErrorPage,
  );
}

export function getUnresolvedSystemErrors(page = 1, signal?: AbortSignal) {
  return getReadResponse(
    systemErrorsList(
      { page, page_size: PAGE_SIZE, unresolved_only: true },
      cookieSessionReadOptions(signal),
    ),
    parseSystemErrorPage,
  );
}

export function getSystemMaintenance(page = 1, signal?: AbortSignal) {
  return getReadResponse(
    systemMaintenanceList(
      { page, page_size: PAGE_SIZE },
      cookieSessionReadOptions(signal),
    ),
    parseMaintenancePage,
  );
}

export function getSystemReleaseMetadata(signal?: AbortSignal) {
  return getReadResponse(
    generatedReleaseMetadata(cookieSessionReadOptions(signal)),
    (value) => (isReleaseMetadata(value) ? value : null),
  );
}

export function getSystemEnvironmentSummary(signal?: AbortSignal) {
  return getReadResponse(
    generatedEnvironmentSummary(cookieSessionReadOptions(signal)),
    (value) => (isEnvironmentSummary(value) ? value : null),
  );
}

export function getSystemOperationsCatalog(signal?: AbortSignal) {
  return getReadResponse(
    systemOperationsCatalog(cookieSessionReadOptions(signal)),
    (value) => (isOperationsCatalog(value) ? value : null),
  );
}

export function getSystemOperationRuns(page = 1, signal?: AbortSignal) {
  return getReadResponse(
    systemOperationsRuns(
      { page, page_size: PAGE_SIZE },
      cookieSessionReadOptions(signal),
    ),
    parseOperationRunPage,
  );
}

export function resolveSystemError(
  errorId: string,
  payload: DiagnosticTransitionSchema,
  idempotencyKey: IdempotencyKey,
  signal?: AbortSignal,
) {
  return getMutationResponse(
    (options) => systemErrorResolve(errorId, payload, options),
    idempotencyKey,
    isDiagnosticTransitionResult,
    signal,
  );
}

export function reopenSystemError(
  errorId: string,
  payload: DiagnosticTransitionSchema,
  idempotencyKey: IdempotencyKey,
  signal?: AbortSignal,
) {
  return getMutationResponse(
    (options) => systemErrorReopen(errorId, payload, options),
    idempotencyKey,
    isDiagnosticTransitionResult,
    signal,
  );
}

export function scheduleSystemMaintenance(
  payload: MaintenanceScheduleSchema,
  idempotencyKey: IdempotencyKey,
  signal?: AbortSignal,
) {
  return getMutationResponse(
    (options) => systemMaintenanceSchedule(payload, options),
    idempotencyKey,
    isMaintenanceResult,
    signal,
  );
}

export function activateSystemMaintenance(
  windowId: string,
  payload: MaintenanceTransitionSchema,
  idempotencyKey: IdempotencyKey,
  signal?: AbortSignal,
) {
  return getMutationResponse(
    (options) => systemMaintenanceActivate(windowId, payload, options),
    idempotencyKey,
    isMaintenanceResult,
    signal,
  );
}

export function extendSystemMaintenance(
  windowId: string,
  payload: MaintenanceTransitionSchema,
  idempotencyKey: IdempotencyKey,
  signal?: AbortSignal,
) {
  return getMutationResponse(
    (options) => systemMaintenanceExtend(windowId, payload, options),
    idempotencyKey,
    isMaintenanceResult,
    signal,
  );
}

export function completeSystemMaintenance(
  windowId: string,
  payload: MaintenanceTransitionSchema,
  idempotencyKey: IdempotencyKey,
  signal?: AbortSignal,
) {
  return getMutationResponse(
    (options) => systemMaintenanceComplete(windowId, payload, options),
    idempotencyKey,
    isMaintenanceResult,
    signal,
  );
}

export function cancelSystemMaintenance(
  windowId: string,
  payload: MaintenanceTransitionSchema,
  idempotencyKey: IdempotencyKey,
  signal?: AbortSignal,
) {
  return getMutationResponse(
    (options) => systemMaintenanceCancel(windowId, payload, options),
    idempotencyKey,
    isMaintenanceResult,
    signal,
  );
}
