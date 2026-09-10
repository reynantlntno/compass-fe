import {
  backupsArtifactsList,
  backupsDashboard,
  backupsJobCancel,
  backupsJobDetail,
  backupsJobQueue,
  backupsJobRequest,
  backupsJobVerify,
  backupsRestoreAuthorize,
  backupsRestoreCancel,
  backupsRestoreDetail,
  backupsRestoreDryRun,
  backupsRestoreRequest,
  backupsRestoresList,
  backupsJobsList,
} from "@/lib/api/generated/backups/backups";
import {
  cookieSessionMutationOptions,
  cookieSessionReadOptions,
} from "@/lib/api/auth";
import { withIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";
import type {
  BackupArtifactPageSchema,
  BackupArtifactProjectionSchema,
  BackupDashboardSchema,
  BackupDashboardSummarySchema,
  BackupJobPageSchema,
  BackupJobProjectionSchema,
  BackupRequestSchema,
  LifecycleSchema,
  RestoreAuthorizationSchema,
  RestoreChecklistProjectionSchema,
  RestoreDashboardSummarySchema,
  RestoreDryRunSchema,
  RestoreRequestPageSchema,
  RestoreRequestProjectionSchema,
  RestoreRequestSchema,
  RestoreTransitionSchema,
} from "@/lib/api/generated/model";

export type BackupsApiErrorKind =
  | "conflict"
  | "permission"
  | "rate_limited"
  | "unavailable"
  | "validation";

export class BackupsApiError extends Error {
  readonly kind: BackupsApiErrorKind;

  constructor(kind: BackupsApiErrorKind) {
    super("The backups request could not be completed.");
    this.name = "BackupsApiError";
    this.kind = kind;
  }
}

export const BACKUPS_PAGE_SIZE = 20;

const MAX_PAGE_SIZE = 100;
const MAX_ID_LENGTH = 160;
const MAX_SHORT_TEXT_LENGTH = 160;
const MAX_TEXT_LENGTH = 500;
const MAX_TIMESTAMP_LENGTH = 80;
const MAX_SAFE_BYTES = Number.MAX_SAFE_INTEGER;

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
  allowEmpty = false,
): value is string {
  return (
    typeof value === "string" &&
    value.length <= maximum &&
    (allowEmpty || value.trim().length > 0)
  );
}

function isOptionalString(
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

function isOptionalTimestamp(value: unknown): value is string | null | undefined {
  return value === null || value === undefined || isTimestamp(value);
}

function isSafeInteger(
  value: unknown,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
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
    isSafeInteger(value.page_size, 1, MAX_PAGE_SIZE) &&
    isSafeInteger(value.total) &&
    value.items.length <= value.page_size
  );
}

function parsePage<T>(
  value: unknown,
  isItem: (item: unknown) => item is T,
): { items: T[]; page: number; page_size: number; total: number } | null {
  if (!isPageEnvelope(value)) return null;

  return {
    items: value.items.filter(isItem),
    page: value.page,
    page_size: value.page_size,
    total: value.total,
  };
}

function isBackupJob(value: unknown): value is BackupJobProjectionSchema {
  if (!isRecord(value)) return false;

  return (
    isSafeInteger(value.artifact_count) &&
    isOptionalTimestamp(value.cancelled_at) &&
    isOptionalTimestamp(value.completed_at) &&
    typeof value.encrypted_at_rest === "boolean" &&
    isBoundedString(value.environment) &&
    isOptionalTimestamp(value.expires_at) &&
    isOptionalTimestamp(value.failed_at) &&
    isBoundedString(value.id, MAX_ID_LENGTH) &&
    typeof value.includes_database === "boolean" &&
    typeof value.includes_manifest === "boolean" &&
    typeof value.includes_media === "boolean" &&
    typeof value.includes_protected_files === "boolean" &&
    isOptionalTimestamp(value.queued_at) &&
    isOptionalTimestamp(value.requested_at) &&
    isOptionalTimestamp(value.resource_version) &&
    isBoundedString(value.retention_class) &&
    isOptionalString(value.safe_failure_reason_code, MAX_TEXT_LENGTH) &&
    isBoundedString(value.scope) &&
    isOptionalTimestamp(value.started_at) &&
    isBoundedString(value.status) &&
    isBoundedString(value.storage_target_type) &&
    isSafeInteger(value.total_size_bytes, 0, MAX_SAFE_BYTES) &&
    isOptionalTimestamp(value.verified_at)
  );
}

function isBackupArtifact(
  value: unknown,
): value is BackupArtifactProjectionSchema {
  if (!isRecord(value)) return false;

  return (
    isBoundedString(value.artifact_type) &&
    isBoundedString(value.backup_job_id, MAX_ID_LENGTH) &&
    isOptionalTimestamp(value.created_at) &&
    isBoundedString(value.encryption_status) &&
    isBoundedString(value.id, MAX_ID_LENGTH) &&
    isSafeInteger(value.size_bytes, 0, MAX_SAFE_BYTES)
  );
}

function isRestoreChecklist(
  value: unknown,
): value is RestoreChecklistProjectionSchema {
  if (!isRecord(value)) return false;

  return (
    isBoundedString(value.id, MAX_ID_LENGTH) &&
    isOptionalTimestamp(value.recorded_at) &&
    isOptionalString(value.safe_message_code, MAX_TEXT_LENGTH) &&
    isBoundedString(value.status) &&
    isBoundedString(value.step_key)
  );
}

function isRestoreRequest(
  value: unknown,
): value is RestoreRequestProjectionSchema {
  if (!isRecord(value) || !Array.isArray(value.checklist)) return false;

  return (
    isOptionalTimestamp(value.authorization_recorded_at) &&
    isOptionalTimestamp(value.cancelled_at) &&
    value.checklist.length <= 100 &&
    value.checklist.every(isRestoreChecklist) &&
    isOptionalTimestamp(value.completed_at) &&
    isOptionalTimestamp(value.created_at) &&
    isOptionalString(value.dry_run_result_code, MAX_TEXT_LENGTH) &&
    isOptionalTimestamp(value.failed_at) &&
    isBoundedString(value.id, MAX_ID_LENGTH) &&
    isBoundedString(value.institutional_authorization_type, MAX_SHORT_TEXT_LENGTH, true) &&
    isBoundedString(value.restore_scope) &&
    isBoundedString(value.safe_reason_code, MAX_TEXT_LENGTH, true) &&
    isOptionalTimestamp(value.started_at) &&
    isBoundedString(value.status) &&
    isBoundedString(value.target_backup_job_id, MAX_ID_LENGTH) &&
    isOptionalTimestamp(value.updated_at)
  );
}

function isBackupDashboardSummary(
  value: unknown,
): value is BackupDashboardSummarySchema {
  if (!isRecord(value)) return false;

  return (
    isSafeInteger(value.archive_count) &&
    isSafeInteger(value.failed_count) &&
    (value.latest_job === null ||
      value.latest_job === undefined ||
      isBackupJob(value.latest_job)) &&
    isSafeInteger(value.queued_or_running_count) &&
    isSafeInteger(value.total_jobs) &&
    isSafeInteger(value.verified_archive_count)
  );
}

function isRestoreDashboardSummary(
  value: unknown,
): value is RestoreDashboardSummarySchema {
  if (!isRecord(value)) return false;

  return (
    isSafeInteger(value.active_count) &&
    isSafeInteger(value.completed_count) &&
    (value.latest_request === null ||
      value.latest_request === undefined ||
      isRestoreRequest(value.latest_request)) &&
    isSafeInteger(value.total_requests)
  );
}

function isDashboard(value: unknown): value is BackupDashboardSchema {
  if (!isRecord(value)) return false;

  return (
    isBackupDashboardSummary(value.backups) &&
    (value.restores === null ||
      value.restores === undefined ||
      isRestoreDashboardSummary(value.restores))
  );
}

function parseJobPage(value: unknown): BackupJobPageSchema | null {
  return parsePage(value, isBackupJob);
}

function parseArtifactPage(value: unknown): BackupArtifactPageSchema | null {
  return parsePage(value, isBackupArtifact);
}

function parseRestorePage(value: unknown): RestoreRequestPageSchema | null {
  return parsePage(value, isRestoreRequest);
}

function errorKind(status: number): BackupsApiErrorKind {
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
    throw new BackupsApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof BackupsApiError) throw error;
    throw new BackupsApiError("unavailable");
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
    throw new BackupsApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof BackupsApiError) throw error;
    throw new BackupsApiError("unavailable");
  }
}

export function getBackupsDashboard(signal?: AbortSignal) {
  return getReadResponse(
    backupsDashboard(cookieSessionReadOptions(signal)),
    (value) => (isDashboard(value) ? value : null),
  );
}

export function getBackupJobs(page = 1, signal?: AbortSignal) {
  return getReadResponse(
    backupsJobsList(
      { page, page_size: BACKUPS_PAGE_SIZE },
      cookieSessionReadOptions(signal),
    ),
    parseJobPage,
  );
}

export function getBackupJobDetail(jobId: string, signal?: AbortSignal) {
  return getReadResponse(
    backupsJobDetail(jobId, cookieSessionReadOptions(signal)),
    (value) => (isBackupJob(value) ? value : null),
  );
}

export function getBackupArtifacts(
  jobId: string,
  page = 1,
  signal?: AbortSignal,
) {
  return getReadResponse(
    backupsArtifactsList(
      jobId,
      { page, page_size: BACKUPS_PAGE_SIZE },
      cookieSessionReadOptions(signal),
    ),
    parseArtifactPage,
  );
}

export function getBackupRestores(page = 1, signal?: AbortSignal) {
  return getReadResponse(
    backupsRestoresList(
      { page, page_size: BACKUPS_PAGE_SIZE },
      cookieSessionReadOptions(signal),
    ),
    parseRestorePage,
  );
}

export function getBackupRestoreDetail(
  requestId: string,
  signal?: AbortSignal,
) {
  return getReadResponse(
    backupsRestoreDetail(requestId, cookieSessionReadOptions(signal)),
    (value) => (isRestoreRequest(value) ? value : null),
  );
}

function lifecyclePayload(expectedUpdatedAt?: string | null): LifecycleSchema {
  return expectedUpdatedAt ? { expected_updated_at: expectedUpdatedAt } : {};
}

export function requestBackup(
  payload: BackupRequestSchema,
  idempotencyKey: IdempotencyKey,
  signal?: AbortSignal,
) {
  return getMutationResponse(
    (options) => backupsJobRequest(payload, options),
    idempotencyKey,
    isBackupJob,
    signal,
  );
}

export function queueBackup(
  jobId: string,
  expectedUpdatedAt: string | null | undefined,
  idempotencyKey: IdempotencyKey,
  signal?: AbortSignal,
) {
  return getMutationResponse(
    (options) => backupsJobQueue(jobId, lifecyclePayload(expectedUpdatedAt), options),
    idempotencyKey,
    isBackupJob,
    signal,
  );
}

export function verifyBackup(
  jobId: string,
  expectedUpdatedAt: string | null | undefined,
  idempotencyKey: IdempotencyKey,
  signal?: AbortSignal,
) {
  return getMutationResponse(
    (options) => backupsJobVerify(jobId, lifecyclePayload(expectedUpdatedAt), options),
    idempotencyKey,
    isBackupJob,
    signal,
  );
}

export function cancelBackup(
  jobId: string,
  expectedUpdatedAt: string | null | undefined,
  idempotencyKey: IdempotencyKey,
  signal?: AbortSignal,
) {
  return getMutationResponse(
    (options) => backupsJobCancel(jobId, lifecyclePayload(expectedUpdatedAt), options),
    idempotencyKey,
    isBackupJob,
    signal,
  );
}

export function requestRestore(
  payload: RestoreRequestSchema,
  idempotencyKey: IdempotencyKey,
  signal?: AbortSignal,
) {
  return getMutationResponse(
    (options) => backupsRestoreRequest(payload, options),
    idempotencyKey,
    isRestoreRequest,
    signal,
  );
}

export function authorizeBackupRestore(
  requestId: string,
  payload: RestoreAuthorizationSchema,
  idempotencyKey: IdempotencyKey,
  signal?: AbortSignal,
) {
  return getMutationResponse(
    (options) => backupsRestoreAuthorize(requestId, payload, options),
    idempotencyKey,
    isRestoreRequest,
    signal,
  );
}

export function dryRunBackupRestore(
  requestId: string,
  payload: RestoreDryRunSchema,
  idempotencyKey: IdempotencyKey,
  signal?: AbortSignal,
) {
  return getMutationResponse(
    (options) => backupsRestoreDryRun(requestId, payload, options),
    idempotencyKey,
    isRestoreRequest,
    signal,
  );
}

export function cancelBackupRestore(
  requestId: string,
  payload: RestoreTransitionSchema,
  idempotencyKey: IdempotencyKey,
  signal?: AbortSignal,
) {
  return getMutationResponse(
    (options) => backupsRestoreCancel(requestId, payload, options),
    idempotencyKey,
    isRestoreRequest,
    signal,
  );
}
