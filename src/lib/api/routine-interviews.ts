import {
  counselingRoutineComplete,
  counselingRoutineEvaluationSave,
  counselingRoutineFinalize,
  counselingRoutineInterviewDetail,
  counselingRoutineInterviewSensitiveDetail,
  counselingRoutineInterviewsList,
  counselingRoutineInterviewsDocumentDownload,
  counselingRoutineInterviewsDocumentGenerate,
  counselingRoutineInterviewsDocumentPreview,
  counselingRoutineLock,
  counselingRoutineReopen,
} from "@/lib/api/generated/counseling/counseling";
import type {
  CounselingMutationResponseSchema,
  EvaluationSchema,
  ReopenSchema,
  RoutineInterviewProjectionSchema,
  RoutineInterviewQueueProjectionSchema,
  RoutineInterviewSensitiveDetailSchema,
  RoutineDocumentGenerateSchema,
} from "@/lib/api/generated/model";
import { cookieSessionMutationOptions, cookieSessionReadOptions } from "@/lib/api/auth";
import { withIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";
import { CounselingApiError } from "@/lib/api/counseling";

export const ROUTINE_INTERVIEW_PAGE_SIZE = 20;

export const ROUTINE_INTERVIEW_STATUSES = [
  "NOT_STARTED",
  "INTAKE_DRAFT",
  "INTAKE_SUBMITTED",
  "EVALUATION_DRAFT",
  "COMPLETED",
  "FINALIZED",
  "LOCKED",
  "REOPENED_FOR_CORRECTION",
] as const;

export type RoutineInterviewStatus = (typeof ROUTINE_INTERVIEW_STATUSES)[number];

export function parseRoutineInterviewStatuses(value: string | null | undefined) {
  if (!value) return [] as RoutineInterviewStatus[];
  return [...new Set(value.split(",").map((item) => item.trim().toUpperCase()))].filter(
    (item): item is RoutineInterviewStatus => STATUS_SET.has(item),
  );
}

export function routineInterviewHref(page = 1, statuses: readonly RoutineInterviewStatus[] = []) {
  const params = new URLSearchParams({ section: "routine-interviews" });
  if (statuses.length) params.set("status", statuses.join(","));
  if (page > 1) params.set("page", String(page));
  return `/portal/counseling?${params.toString()}`;
}

export type PortalRoutineInterview = {
  session_reference_code: string;
  status: RoutineInterviewStatus;
  student_display_name: string | null;
  student_number: string | null;
  assignment_state: "Assigned to you" | "Assigned" | "Unassigned" | null;
  visit_date: string | null;
  visit_time: string | null;
  duration_minutes: number | null;
  nature_of_visit: string | null;
  submitted_at: string | null;
  evaluated_at: string | null;
  completed_at: string | null;
  finalized_at: string | null;
  locked_at: string | null;
  reopened_at: string | null;
  updated_at: string | null;
};

export type PortalRoutineInterviewPage = {
  items: PortalRoutineInterview[];
  page: number;
  page_size: number;
  total: number;
};

export type PortalRoutineInterviewDetail = {
  session_reference_code: string;
  status: RoutineInterviewStatus;
  visit_date: string | null;
  visit_time: string | null;
  duration_minutes: number | null;
  nature_of_visit: string | null;
  submitted_at: string | null;
  evaluated_at: string | null;
  completed_at: string | null;
  finalized_at: string | null;
  locked_at: string | null;
  reopened_at: string | null;
};

export type PortalRoutineInterviewSensitiveDetail = {
  session_reference_code: string;
  status: RoutineInterviewStatus;
  visit_date: string | null;
  visit_time: string | null;
  duration_minutes: number | null;
  nature_of_visit: string | null;
  concern_academic: boolean | null;
  concern_friends: boolean | null;
  concern_classmates: boolean | null;
  concern_vices: boolean | null;
  concern_love_life: boolean | null;
  concern_sleeping_problems: boolean | null;
  concern_family: boolean | null;
  concern_financial: boolean | null;
  concern_suicidal_thought: boolean | null;
  concern_dorm_boarding_house: boolean | null;
  concern_past_painful_experience: boolean | null;
  concern_others: boolean | null;
  concern_others_text: string | null;
  rating_emotionally: number | null;
  rating_academically: number | null;
  rating_physically: number | null;
  rating_socially: number | null;
  rating_spiritually: number | null;
  rating_financially: number | null;
  rating_others: number | null;
  rating_others_label: string | null;
  evaluation_date: string | null;
  submitted_at: string | null;
  evaluated_at: string | null;
  completed_at: string | null;
  finalized_at: string | null;
  locked_at: string | null;
  reopened_at: string | null;
  coping_challenges: string | null;
  coping_remarks: string | null;
  ucn_experience: string | null;
  reason_for_coming: string | null;
  difficulties_encountered: string | null;
  stress_anxiety_causes: string | null;
  stress_anxiety_management: string | null;
  family_background_notes: string | null;
  concerns_explanation: string | null;
  college_adjustment: string | null;
  academic_goals: string | null;
  career_goals: string | null;
  special_concern: string | null;
  recommendations: string | null;
};

export type PortalGeneratedRoutineDocument = {
  content_type: string;
  document_status: string;
  generated_at: string | null;
  output_format: string;
  reference_code: string;
  released_at: string | null;
  template_key: string;
  template_version: string;
};

type GeneratedResponse = { data: unknown; status: number };

const MAX_PAGE = 100_000;
const MAX_REFERENCE_LENGTH = 25;
const MAX_TEXT_LENGTH = 8_000;
const MAX_DISPLAY_NAME_LENGTH = 160;
const MAX_STUDENT_NUMBER_LENGTH = 50;
const STATUS_SET = new Set<string>(ROUTINE_INTERVIEW_STATUSES);
const ASSIGNMENT_STATES = new Set(["Assigned to you", "Assigned", "Unassigned"]);

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

function optionalInteger(value: unknown): value is number | null | undefined {
  return value === null || value === undefined || (typeof value === "number" && Number.isSafeInteger(value));
}

function optionalBoolean(value: unknown): value is boolean | null | undefined {
  return value === null || value === undefined || typeof value === "boolean";
}

function isStatus(value: unknown): value is RoutineInterviewStatus {
  return typeof value === "string" && STATUS_SET.has(value);
}

function isQueueProjection(value: unknown): value is RoutineInterviewQueueProjectionSchema {
  if (!isRecord(value)) return false;
  return (
    typeof value.session_reference_code === "string" && value.session_reference_code.length > 0 && value.session_reference_code.length <= MAX_REFERENCE_LENGTH &&
    isStatus(value.status) &&
    optionalString(value.student_display_name, MAX_DISPLAY_NAME_LENGTH) &&
    optionalString(value.student_number, MAX_STUDENT_NUMBER_LENGTH) &&
    (value.assignment_state === null || value.assignment_state === undefined || (typeof value.assignment_state === "string" && ASSIGNMENT_STATES.has(value.assignment_state))) &&
    optionalString(value.visit_date, 20) && optionalString(value.visit_time, 20) && optionalInteger(value.duration_minutes) &&
    optionalString(value.nature_of_visit, 80) &&
    optionalTimestamp(value.submitted_at) && optionalTimestamp(value.evaluated_at) && optionalTimestamp(value.completed_at) &&
    optionalTimestamp(value.finalized_at) && optionalTimestamp(value.locked_at) && optionalTimestamp(value.reopened_at) &&
    optionalTimestamp(value.updated_at)
  );
}

function parseQueueProjection(value: unknown): PortalRoutineInterview | null {
  if (!isQueueProjection(value)) return null;
  return {
    session_reference_code: value.session_reference_code,
    status: value.status as RoutineInterviewStatus,
    student_display_name: value.student_display_name ?? null,
    student_number: value.student_number ?? null,
    assignment_state: (value.assignment_state as PortalRoutineInterview["assignment_state"]) ?? null,
    visit_date: value.visit_date ?? null,
    visit_time: value.visit_time ?? null,
    duration_minutes: value.duration_minutes ?? null,
    nature_of_visit: value.nature_of_visit ?? null,
    submitted_at: value.submitted_at ?? null,
    evaluated_at: value.evaluated_at ?? null,
    completed_at: value.completed_at ?? null,
    finalized_at: value.finalized_at ?? null,
    locked_at: value.locked_at ?? null,
    reopened_at: value.reopened_at ?? null,
    updated_at: value.updated_at ?? null,
  };
}

function isPage(value: unknown): value is { items: unknown[]; page: number; page_size: number; total: number } {
  return isRecord(value) && Array.isArray(value.items) &&
    typeof value.page === "number" && Number.isSafeInteger(value.page) && value.page >= 1 && value.page <= MAX_PAGE &&
    typeof value.page_size === "number" && Number.isSafeInteger(value.page_size) && value.page_size === ROUTINE_INTERVIEW_PAGE_SIZE &&
    typeof value.total === "number" && Number.isSafeInteger(value.total) && value.total >= 0 && value.items.length <= value.page_size;
}

function parsePage(value: unknown): PortalRoutineInterviewPage | null {
  if (!isPage(value)) return null;
  return {
    items: value.items.map(parseQueueProjection).filter((item): item is PortalRoutineInterview => item !== null),
    page: value.page,
    page_size: value.page_size,
    total: value.total,
  };
}

function isSafeDetail(value: unknown): value is RoutineInterviewProjectionSchema {
  if (!isRecord(value)) return false;
  return (
    typeof value.session_reference_code === "string" && value.session_reference_code.length > 0 && value.session_reference_code.length <= MAX_REFERENCE_LENGTH &&
    isStatus(value.status) && optionalString(value.visit_date, 20) && optionalString(value.visit_time, 20) && optionalInteger(value.duration_minutes) &&
    optionalString(value.nature_of_visit, 80) && optionalTimestamp(value.submitted_at) && optionalTimestamp(value.evaluated_at) &&
    optionalTimestamp(value.completed_at) && optionalTimestamp(value.finalized_at) && optionalTimestamp(value.locked_at) && optionalTimestamp(value.reopened_at)
  );
}

function parseDetail(value: unknown): PortalRoutineInterviewDetail | null {
  if (!isSafeDetail(value)) return null;
  return {
    session_reference_code: value.session_reference_code,
    status: value.status as RoutineInterviewStatus,
    visit_date: value.visit_date ?? null,
    visit_time: value.visit_time ?? null,
    duration_minutes: value.duration_minutes ?? null,
    nature_of_visit: value.nature_of_visit ?? null,
    submitted_at: value.submitted_at ?? null,
    evaluated_at: value.evaluated_at ?? null,
    completed_at: value.completed_at ?? null,
    finalized_at: value.finalized_at ?? null,
    locked_at: value.locked_at ?? null,
    reopened_at: value.reopened_at ?? null,
  };
}

function parseSensitiveDetail(value: unknown): PortalRoutineInterviewSensitiveDetail | null {
  if (!isRecord(value) || typeof value.session_reference_code !== "string" || !isStatus(value.status)) return null;
  const stringFields = [
    "visit_date", "visit_time", "nature_of_visit", "concern_others_text", "rating_others_label", "evaluation_date",
    "submitted_at", "evaluated_at", "completed_at", "finalized_at", "locked_at", "reopened_at", "coping_challenges",
    "coping_remarks", "ucn_experience", "reason_for_coming", "difficulties_encountered", "stress_anxiety_causes",
    "stress_anxiety_management", "family_background_notes", "concerns_explanation", "college_adjustment", "academic_goals",
    "career_goals", "special_concern", "recommendations",
  ] as const;
  const booleanFields = [
    "concern_academic", "concern_friends", "concern_classmates", "concern_vices", "concern_love_life", "concern_sleeping_problems",
    "concern_family", "concern_financial", "concern_suicidal_thought", "concern_dorm_boarding_house", "concern_past_painful_experience", "concern_others",
  ] as const;
  const numberFields = [
    "duration_minutes", "rating_emotionally", "rating_academically", "rating_physically", "rating_socially", "rating_spiritually", "rating_financially", "rating_others",
  ] as const;
  if (!optionalString(value.session_reference_code, MAX_REFERENCE_LENGTH) || value.session_reference_code.length === 0) return null;
  if (!stringFields.every((field) => optionalString(value[field]))) return null;
  if (!booleanFields.every((field) => optionalBoolean(value[field]))) return null;
  if (!numberFields.every((field) => optionalInteger(value[field]))) return null;
  const detail = { session_reference_code: value.session_reference_code, status: value.status } as unknown as PortalRoutineInterviewSensitiveDetail;
  const mutable = detail as unknown as Record<string, unknown>;
  for (const field of stringFields) mutable[field] = (value[field] as string | null | undefined) ?? null;
  for (const field of booleanFields) mutable[field] = (value[field] as boolean | null | undefined) ?? null;
  for (const field of numberFields) mutable[field] = (value[field] as number | null | undefined) ?? null;
  return detail;
}

function parseGeneratedDocument(value: unknown): PortalGeneratedRoutineDocument | null {
  if (!isRecord(value) || typeof value.content_type !== "string" || value.content_type.length > 120 || typeof value.document_status !== "string" || value.document_status.length > 80 || !optionalTimestamp(value.generated_at) || typeof value.output_format !== "string" || value.output_format.length > 40 || typeof value.reference_code !== "string" || value.reference_code.length === 0 || value.reference_code.length > MAX_REFERENCE_LENGTH || !optionalTimestamp(value.released_at) || typeof value.template_key !== "string" || value.template_key.length > 120 || typeof value.template_version !== "string" || value.template_version.length > 80) return null;
  return {
    content_type: value.content_type,
    document_status: value.document_status,
    generated_at: value.generated_at ?? null,
    output_format: value.output_format,
    reference_code: value.reference_code,
    released_at: value.released_at ?? null,
    template_key: value.template_key,
    template_version: value.template_version,
  };
}

function errorKind(status: number) {
  if (status === 409) return "conflict" as const;
  if (status === 429) return "rate_limited" as const;
  if (status === 400 || status === 422) return "validation" as const;
  if (status === 401 || status === 403 || status === 404) return "permission" as const;
  return "unavailable" as const;
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

function safePage(page: number) {
  return Number.isSafeInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1;
}

function safeReference(referenceCode: string) {
  const value = referenceCode.trim().slice(0, MAX_REFERENCE_LENGTH);
  if (!value) throw new CounselingApiError("validation");
  return value;
}

async function readBlobRequest(request: Promise<GeneratedResponse>) {
  try {
    const response = await request;
    if (response.status === 200 && response.data instanceof Blob) return response.data;
    throw new CounselingApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof CounselingApiError) throw error;
    throw new CounselingApiError("unavailable");
  }
}

export function getPortalRoutineInterviews(page = 1, status?: string | null, signal?: AbortSignal) {
  const statuses = parseRoutineInterviewStatuses(status);
  return readRequest(
    counselingRoutineInterviewsList({ page: safePage(page), page_size: ROUTINE_INTERVIEW_PAGE_SIZE, ...(statuses.length ? { status: statuses.join(",") } : {}) }, cookieSessionReadOptions(signal)),
    parsePage,
  );
}

export function getPortalRoutineInterviewDetail(referenceCode: string, signal?: AbortSignal) {
  return readRequest(counselingRoutineInterviewDetail(safeReference(referenceCode), cookieSessionReadOptions(signal)), parseDetail);
}

export function getPortalRoutineInterviewSensitiveDetail(referenceCode: string, signal?: AbortSignal) {
  return readRequest(counselingRoutineInterviewSensitiveDetail(safeReference(referenceCode), cookieSessionReadOptions(signal)), parseSensitiveDetail);
}

export function previewPortalRoutineInterviewDocument(referenceCode: string, signal?: AbortSignal) {
  return readBlobRequest(counselingRoutineInterviewsDocumentPreview(safeReference(referenceCode), cookieSessionReadOptions(signal)));
}

export function downloadPortalRoutineInterviewDocument(referenceCode: string, signal?: AbortSignal) {
  return readBlobRequest(counselingRoutineInterviewsDocumentDownload(safeReference(referenceCode), cookieSessionReadOptions(signal)));
}

export async function generatePortalRoutineInterviewDocument(referenceCode: string, expectedUpdatedAt: string | null, key: IdempotencyKey, signal?: AbortSignal) {
  const payload: RoutineDocumentGenerateSchema = expectedUpdatedAt ? { expected_updated_at: expectedUpdatedAt } : {};
  const options = withIdempotencyKey(key, await cookieSessionMutationOptions(signal));
  return readRequest(counselingRoutineInterviewsDocumentGenerate(safeReference(referenceCode), payload, options), parseGeneratedDocument);
}

async function runMutation(
  request: (options: RequestInit) => Promise<GeneratedResponse>,
  key: IdempotencyKey,
  signal?: AbortSignal,
): Promise<CounselingMutationResponseSchema> {
  try {
    const response = await request(withIdempotencyKey(key, await cookieSessionMutationOptions(signal)));
    if (response.status === 200 && isRecord(response.data)) return response.data as CounselingMutationResponseSchema;
    throw new CounselingApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof CounselingApiError) throw error;
    throw new CounselingApiError("unavailable");
  }
}

export function savePortalRoutineEvaluation(referenceCode: string, payload: EvaluationSchema, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => counselingRoutineEvaluationSave(safeReference(referenceCode), payload, options), key, signal);
}

export function completePortalRoutineInterview(referenceCode: string, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => counselingRoutineComplete(safeReference(referenceCode), null, options), key, signal);
}

export function finalizePortalRoutineInterview(referenceCode: string, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => counselingRoutineFinalize(safeReference(referenceCode), null, options), key, signal);
}

export function lockPortalRoutineInterview(referenceCode: string, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => counselingRoutineLock(safeReference(referenceCode), null, options), key, signal);
}

export function reopenPortalRoutineInterview(referenceCode: string, payload: ReopenSchema & { correction_target: string }, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => counselingRoutineReopen(safeReference(referenceCode), payload, options), key, signal);
}

export type GeneratedRoutineInterviewProjection = RoutineInterviewQueueProjectionSchema;
export type GeneratedRoutineInterviewSensitiveDetail = RoutineInterviewSensitiveDetailSchema;
