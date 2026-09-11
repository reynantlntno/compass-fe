import {
  counselingEcounselingDetail,
  counselingEcounselingJoin,
  counselingEcounselingRecordingStart,
  counselingEcounselingRecordingStatus,
  counselingEcounselingRecordingStop,
  counselingNoteDetail,
  counselingSessionWorkspace,
} from "@/lib/api/generated/counseling/counseling";
import type {
  CounselingNoteProjectionSchema,
  CounselingSessionWorkspaceContextSchema,
  ECounselingJoinContextSchema,
  RecordingMutationResponseSchema,
  RecordingStatusSchema,
} from "@/lib/api/generated/model";
import {
  cookieSessionMutationOptions,
  cookieSessionReadOptions,
} from "@/lib/api/auth";
import { withIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";
import {
  COUNSELING_SESSION_MODES,
  COUNSELING_SESSION_SOURCES,
  COUNSELING_SESSION_STATUSES,
  COUNSELING_SESSION_TYPES,
  CounselingApiError,
} from "@/lib/api/counseling";

export type PortalCounselingSessionWorkspace = {
  reference_code: string;
  session_type: string;
  session_mode: string;
  session_source: string;
  status: string;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  actual_started_at: string | null;
  actual_ended_at: string | null;
  completed_at: string | null;
  finalized_at: string | null;
  locked_at: string | null;
  student_display_name: string | null;
  student_number: string | null;
  assignment_state: string | null;
  routine_interview_available: boolean;
  ecounseling_reference_code: string | null;
  ecounseling_join_code: string | null;
  ecounseling_join_available: boolean;
  ecounseling_next_action: string | null;
  recording_consent_status: string | null;
  recording_requested: boolean | null;
  recording_controls_enabled: boolean;
};

export type PortalCounselingNote = {
  student_visible_summary: string;
  counselor_narrative: string;
  recommendations: string;
  special_concerns: string;
  follow_up_needed: boolean;
  follow_up_notes: string;
};

export type PortalEcounselingJoinState = {
  code: string;
  message: string;
  next_action: string;
  scheduled_start_at: string | null;
};

export type PortalEcounselingJoinContext = ECounselingJoinContextSchema;
export type PortalRecordingStatus = RecordingStatusSchema;
export type PortalRecordingMutationResponse = RecordingMutationResponseSchema;

const MAX_REFERENCE_LENGTH = 25;
const MAX_MESSAGE_LENGTH = 500;
const MAX_TEXT_LENGTH = 8_000;
const SESSION_STATUSES = new Set<string>(COUNSELING_SESSION_STATUSES);
const SESSION_TYPES = new Set<string>(COUNSELING_SESSION_TYPES);
const SESSION_MODES = new Set<string>(COUNSELING_SESSION_MODES);
const SESSION_SOURCES = new Set<string>(COUNSELING_SESSION_SOURCES);

type GeneratedResponse = { data: unknown; status: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function boundedString(value: unknown, max = MAX_TEXT_LENGTH): value is string {
  return typeof value === "string" && value.length <= max;
}

function optionalTimestamp(value: unknown): value is string | null | undefined {
  return value === null || value === undefined || (
    typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value))
  );
}

function optionalBoundedString(value: unknown, max = MAX_MESSAGE_LENGTH): value is string | null | undefined {
  return value === null || value === undefined || boundedString(value, max);
}

function safeReference(referenceCode: string) {
  const value = referenceCode.trim();
  if (!value || value.length > MAX_REFERENCE_LENGTH || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new CounselingApiError("validation");
  }
  return value;
}

function errorKind(status: number): ConstructorParameters<typeof CounselingApiError>[0] {
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 422) return "validation";
  if (status === 401 || status === 403 || status === 404) return "permission";
  return "unavailable";
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

function parseWorkspace(value: unknown): PortalCounselingSessionWorkspace | null {
  if (!isRecord(value)) return null;
  if (
    !boundedString(value.reference_code, MAX_REFERENCE_LENGTH) ||
    typeof value.session_type !== "string" || !SESSION_TYPES.has(value.session_type) ||
    typeof value.session_mode !== "string" || !SESSION_MODES.has(value.session_mode) ||
    typeof value.session_source !== "string" || !SESSION_SOURCES.has(value.session_source) ||
    typeof value.status !== "string" || !SESSION_STATUSES.has(value.status) ||
    !optionalTimestamp(value.scheduled_start_at) || !optionalTimestamp(value.scheduled_end_at) ||
    !optionalTimestamp(value.actual_started_at) || !optionalTimestamp(value.actual_ended_at) ||
    !optionalTimestamp(value.completed_at) || !optionalTimestamp(value.finalized_at) ||
    !optionalTimestamp(value.locked_at) ||
    !optionalBoundedString(value.student_display_name, 160) ||
    !optionalBoundedString(value.student_number, 50) ||
    !optionalBoundedString(value.assignment_state, 80) ||
    typeof value.routine_interview_available !== "boolean" ||
    !optionalBoundedString(value.ecounseling_reference_code, MAX_REFERENCE_LENGTH) ||
    !optionalBoundedString(value.ecounseling_join_code, 80) ||
    typeof value.ecounseling_join_available !== "boolean" ||
    !optionalBoundedString(value.ecounseling_next_action, 80) ||
    !optionalBoundedString(value.recording_consent_status, 40) ||
    (value.recording_requested !== null && value.recording_requested !== undefined && typeof value.recording_requested !== "boolean") ||
    typeof value.recording_controls_enabled !== "boolean"
  ) return null;
  return {
    reference_code: value.reference_code,
    session_type: value.session_type,
    session_mode: value.session_mode,
    session_source: value.session_source,
    status: value.status,
    scheduled_start_at: value.scheduled_start_at ?? null,
    scheduled_end_at: value.scheduled_end_at ?? null,
    actual_started_at: value.actual_started_at ?? null,
    actual_ended_at: value.actual_ended_at ?? null,
    completed_at: value.completed_at ?? null,
    finalized_at: value.finalized_at ?? null,
    locked_at: value.locked_at ?? null,
    student_display_name: value.student_display_name ?? null,
    student_number: value.student_number ?? null,
    assignment_state: value.assignment_state ?? null,
    routine_interview_available: value.routine_interview_available,
    ecounseling_reference_code: value.ecounseling_reference_code ?? null,
    ecounseling_join_code: value.ecounseling_join_code ?? null,
    ecounseling_join_available: value.ecounseling_join_available,
    ecounseling_next_action: value.ecounseling_next_action ?? null,
    recording_consent_status: value.recording_consent_status ?? null,
    recording_requested: value.recording_requested ?? null,
    recording_controls_enabled: value.recording_controls_enabled,
  };
}

function parseNote(value: unknown): PortalCounselingNote | null {
  if (!isRecord(value)) return null;
  const textFields = ["student_visible_summary", "counselor_narrative", "recommendations", "special_concerns", "follow_up_notes"] as const;
  if (textFields.some((field) => !boundedString(value[field]))) return null;
  if (typeof value.follow_up_needed !== "boolean") return null;
  return {
    student_visible_summary: value.student_visible_summary as string,
    counselor_narrative: value.counselor_narrative as string,
    recommendations: value.recommendations as string,
    special_concerns: value.special_concerns as string,
    follow_up_needed: value.follow_up_needed,
    follow_up_notes: value.follow_up_notes as string,
  };
}

function parseJoinState(value: unknown): PortalEcounselingJoinState | null {
  if (!isRecord(value) || !boundedString(value.code, 80) || !boundedString(value.message, MAX_MESSAGE_LENGTH) || !boundedString(value.next_action, 80) || !optionalTimestamp(value.scheduled_start_at)) return null;
  return {
    code: value.code,
    message: value.message,
    next_action: value.next_action,
    scheduled_start_at: value.scheduled_start_at ?? null,
  };
}

function parseJoinContext(value: unknown): PortalEcounselingJoinContext | null {
  if (!isRecord(value)) return null;
  if (
    !boundedString(value.provider, 80) || !boundedString(value.provider_mode, 80) ||
    !boundedString(value.room_url, 500) || !boundedString(value.public_base_url, 500) ||
    !boundedString(value.room_slug, 120) || !boundedString(value.meeting_token, 4_096) ||
    !boundedString(value.display_name, 160) || typeof value.recording_allowed !== "boolean" ||
    typeof value.recording_controls_enabled !== "boolean" || typeof value.provider_auth_enabled !== "boolean" ||
    typeof value.production_ready !== "boolean"
  ) return null;
  return value as unknown as PortalEcounselingJoinContext;
}

function parseRecordingStatus(value: unknown): PortalRecordingStatus | null {
  if (!isRecord(value) || !boundedString(value.reference_code, MAX_REFERENCE_LENGTH) || !boundedString(value.status, 60)) return null;
  if (value.run !== null && value.run !== undefined && !isRecord(value.run)) return null;
  return value as unknown as PortalRecordingStatus;
}

function parseMutation(value: unknown): PortalRecordingMutationResponse | null {
  return isRecord(value) ? value as PortalRecordingMutationResponse : null;
}

export function getPortalCounselingSessionWorkspace(referenceCode: string, signal?: AbortSignal) {
  return readRequest(counselingSessionWorkspace(safeReference(referenceCode), cookieSessionReadOptions(signal)), parseWorkspace);
}

export function getPortalCounselorNote(referenceCode: string, signal?: AbortSignal) {
  return readRequest(counselingNoteDetail(safeReference(referenceCode), cookieSessionReadOptions(signal)), parseNote);
}

export function getPortalEcounselingJoinState(referenceCode: string, signal?: AbortSignal) {
  return readRequest(counselingEcounselingDetail(safeReference(referenceCode), cookieSessionReadOptions(signal)), parseJoinState);
}

export async function joinPortalEcounseling(referenceCode: string, signal?: AbortSignal) {
  return readRequest(
    counselingEcounselingJoin(
      safeReference(referenceCode),
      null,
      await cookieSessionMutationOptions(signal),
    ),
    parseJoinContext,
  );
}

export function getPortalRecordingStatus(referenceCode: string, signal?: AbortSignal) {
  return readRequest(counselingEcounselingRecordingStatus(safeReference(referenceCode), cookieSessionReadOptions(signal)), parseRecordingStatus);
}

async function runRecordingMutation(
  request: (options: RequestInit) => Promise<GeneratedResponse>,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  try {
    const response = await request(withIdempotencyKey(key, await cookieSessionMutationOptions(signal)));
    if (response.status === 200) {
      const parsed = parseMutation(response.data);
      if (parsed) return parsed;
    }
    throw new CounselingApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof CounselingApiError) throw error;
    throw new CounselingApiError("unavailable");
  }
}

export function startPortalRecording(referenceCode: string, scopeCode: string, key: IdempotencyKey, signal?: AbortSignal) {
  const scope = scopeCode.trim().slice(0, 40);
  if (!scope) throw new CounselingApiError("validation");
  return runRecordingMutation(
    (options) => counselingEcounselingRecordingStart(safeReference(referenceCode), { scope_code: scope }, options),
    key,
    signal,
  );
}

export function stopPortalRecording(referenceCode: string, runId: string, key: IdempotencyKey, signal?: AbortSignal) {
  const safeRunId = runId.trim().slice(0, 80);
  if (!safeRunId) throw new CounselingApiError("validation");
  return runRecordingMutation(
    (options) => counselingEcounselingRecordingStop(safeReference(referenceCode), safeRunId, { safe_reason_code: "COUNSELOR_STOPPED" }, options),
    key,
    signal,
  );
}

export type GeneratedCounselingSessionWorkspace = CounselingSessionWorkspaceContextSchema;
export type GeneratedCounselingNoteProjection = CounselingNoteProjectionSchema;
