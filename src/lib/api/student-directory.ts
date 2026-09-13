import {
  profilesStaffStudentContext,
  profilesStaffStudentDirectory,
  profilesStaffStudentDirectoryOptions,
} from "@/lib/api/generated/profiles/profiles";
import { cookieSessionMutationOptions, cookieSessionReadOptions } from "@/lib/api/auth";

export const STUDENT_DIRECTORY_PAGE_SIZE = 20;

export const STUDENT_DIRECTORY_STATUSES = [
  "ACTIVE",
  "GRADUATING",
  "GRADUATED",
  "ALUMNI",
  "TRANSFERRED",
  "DROPPED_INACTIVE",
  "SUSPENDED_RESTRICTED",
  "ARCHIVED",
] as const;

export const STUDENT_DIRECTORY_ORDERS = ["name", "recent"] as const;

export type StudentDirectoryStatus = (typeof STUDENT_DIRECTORY_STATUSES)[number];
export type StudentDirectoryOrder = (typeof STUDENT_DIRECTORY_ORDERS)[number];

export type StudentDirectoryFilters = {
  q: string | null;
  statuses: StudentDirectoryStatus[];
  campus: string | null;
  college: string | null;
  department: string | null;
  program: string | null;
  yearLevel: number | null;
  order: StudentDirectoryOrder;
};

export type StudentDirectoryOption = {
  value: string;
  label: string;
};

export type StudentDirectoryYearLevelOption = {
  value: number;
  label: string;
};

export type StudentDirectoryOptions = {
  statuses: StudentDirectoryOption[];
  campuses: StudentDirectoryOption[];
  colleges: StudentDirectoryOption[];
  departments: StudentDirectoryOption[];
  programs: StudentDirectoryOption[];
  year_levels: StudentDirectoryYearLevelOption[];
};

export type StudentDirectoryStudent = {
  display_name: string;
  student_number_masked: string;
  lifecycle_status: StudentDirectoryStatus;
  campus: string | null;
  college: string | null;
  department: string | null;
  program: string | null;
  year_level: number | null;
  updated_at: string;
};

export type StudentDirectoryPage = {
  items: StudentDirectoryStudent[];
  page: number;
  page_size: number;
  total: number;
};

export type StudentDirectoryRelatedRecord = {
  record_type: string;
  reference_code: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type StudentDirectoryRelatedWork = {
  record_type: string;
  visible_count: number;
  latest_status: string | null;
  latest_updated_at: string | null;
  records: StudentDirectoryRelatedRecord[];
};

export type StudentDirectoryProfile = StudentDirectoryStudent;

export type StudentDirectoryContext = {
  profile: StudentDirectoryProfile;
  related_work: StudentDirectoryRelatedWork[];
};

export type StudentDirectoryApiErrorKind =
  | "conflict"
  | "permission"
  | "rate_limited"
  | "unavailable"
  | "validation";

export class StudentDirectoryApiError extends Error {
  readonly kind: StudentDirectoryApiErrorKind;

  constructor(kind: StudentDirectoryApiErrorKind) {
    super("The student directory request could not be completed.");
    this.name = "StudentDirectoryApiError";
    this.kind = kind;
  }
}

type GeneratedResponse = { data: unknown; status: number };

const MAX_PAGE = 100_000;
const MAX_QUERY_LENGTH = 120;
const MAX_FILTER_LENGTH = 100;
const MAX_LABEL_LENGTH = 240;
const MAX_RELATED_WORK = 20;
const MAX_RELATED_RECORDS = 10;
const STATUS_SET = new Set<string>(STUDENT_DIRECTORY_STATUSES);
const ORDER_SET = new Set<string>(STUDENT_DIRECTORY_ORDERS);
const RELATED_WORK_TYPES = new Set([
  "appointments",
  "counseling_sessions",
  "routine_interviews",
  "counseling_cases",
  "urgent_support",
  "individual_inventory",
  "exit_interviews",
  "graduate_tracer",
  "assessments",
  "support_needs",
  "referrals",
  "call_slips",
]);
const RELATED_RECORD_TYPES = new Set([
  "appointment",
  "counseling_session",
  "routine_interview",
  "counseling_case",
  "urgent_support",
  "exit_interview",
  "graduate_tracer",
  "support_need",
  "referral",
  "call_slip",
]);
const SAFE_REFERENCE = /^[^\x00-\x1f/?#\\]{1,240}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}

function boundedString(value: unknown, max: number, required = true): value is string {
  return typeof value === "string" && value.length <= max && (!required || value.trim().length > 0);
}

function nullableString(value: unknown, max: number): value is string | null | undefined {
  return value === null || value === undefined || boundedString(value, max, false);
}

function nullableTimestamp(value: unknown): value is string | null | undefined {
  return value === null || value === undefined || (
    typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value))
  );
}

function requiredTimestamp(value: unknown) {
  return typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value));
}

function safePage(value: number) {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_PAGE) {
    throw new StudentDirectoryApiError("validation");
  }
  return value;
}

function safeFilter(value: string | null | undefined, max = MAX_FILTER_LENGTH) {
  const normalized = value?.trim() ?? "";
  if (normalized.length > max) throw new StudentDirectoryApiError("validation");
  return normalized || null;
}

function parseFilter(value: string | null | undefined, max = MAX_FILTER_LENGTH) {
  const normalized = value?.trim() ?? "";
  return normalized.length > max ? null : normalized || null;
}

function safeReference(value: string) {
  const normalized = value.trim();
  if (!SAFE_REFERENCE.test(normalized)) throw new StudentDirectoryApiError("validation");
  return normalized;
}

function parseOption(value: unknown): StudentDirectoryOption | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["value", "label"]) ||
      !boundedString(value.value, MAX_FILTER_LENGTH) || !boundedString(value.label, MAX_LABEL_LENGTH)) {
    return null;
  }
  return { value: value.value, label: value.label };
}

function parseYearLevelOption(value: unknown): StudentDirectoryYearLevelOption | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["value", "label"]) ||
      typeof value.value !== "number" || !Number.isSafeInteger(value.value) ||
      value.value < 1 || value.value > 100 || !boundedString(value.label, MAX_LABEL_LENGTH)) {
    return null;
  }
  return { value: value.value, label: value.label };
}

function parseOptions(value: unknown): StudentDirectoryOptions | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["statuses", "campuses", "colleges", "departments", "programs", "year_levels"]) ||
      !Array.isArray(value.statuses) || !Array.isArray(value.campuses) || !Array.isArray(value.colleges) ||
      !Array.isArray(value.departments) || !Array.isArray(value.programs) || !Array.isArray(value.year_levels) ||
      value.statuses.length > STUDENT_DIRECTORY_STATUSES.length || value.campuses.length > 500 ||
      value.colleges.length > 500 || value.departments.length > 500 || value.programs.length > 500 ||
      value.year_levels.length > 100) {
    return null;
  }
  const statuses = value.statuses.map(parseOption);
  const campuses = value.campuses.map(parseOption);
  const colleges = value.colleges.map(parseOption);
  const departments = value.departments.map(parseOption);
  const programs = value.programs.map(parseOption);
  const yearLevels = value.year_levels.map(parseYearLevelOption);
  if ([statuses, campuses, colleges, departments, programs, yearLevels].some((items) => items.some((item) => item === null))) {
    return null;
  }
  if (statuses.some((item) => !STATUS_SET.has(item!.value)) ||
      new Set(statuses.map((item) => item!.value)).size !== statuses.length ||
      new Set(yearLevels.map((item) => item!.value)).size !== yearLevels.length) {
    return null;
  }
  return {
    statuses: statuses as StudentDirectoryOption[],
    campuses: campuses as StudentDirectoryOption[],
    colleges: colleges as StudentDirectoryOption[],
    departments: departments as StudentDirectoryOption[],
    programs: programs as StudentDirectoryOption[],
    year_levels: yearLevels as StudentDirectoryYearLevelOption[],
  };
}

function parseStudent(value: unknown, includeToken: boolean): { student: StudentDirectoryStudent; token?: string } | null {
  const keys = [
    "display_name",
    "student_number_masked",
    "lifecycle_status",
    "campus",
    "college",
    "department",
    "program",
    "year_level",
    "updated_at",
    ...(includeToken ? ["student_selection_token"] : []),
  ];
  if (!isRecord(value) || !hasOnlyKeys(value, keys) || !boundedString(value.display_name, MAX_LABEL_LENGTH) ||
      typeof value.student_number_masked !== "string" || !/^\*{4}.{0,8}$/.test(value.student_number_masked) ||
      typeof value.lifecycle_status !== "string" || !STATUS_SET.has(value.lifecycle_status) ||
      !nullableString(value.campus, MAX_FILTER_LENGTH) || !nullableString(value.college, MAX_FILTER_LENGTH) ||
      !nullableString(value.department, MAX_FILTER_LENGTH) || !nullableString(value.program, MAX_FILTER_LENGTH) ||
      !(value.year_level === null || value.year_level === undefined || (typeof value.year_level === "number" && Number.isSafeInteger(value.year_level) && value.year_level >= 1 && value.year_level <= 100)) ||
      !requiredTimestamp(value.updated_at) ||
      (includeToken && (!boundedString(value.student_selection_token, 4096) || /[\x00-\x1f]/.test(value.student_selection_token)))) {
    return null;
  }
  return {
    student: {
      display_name: value.display_name,
      student_number_masked: value.student_number_masked,
      lifecycle_status: value.lifecycle_status as StudentDirectoryStatus,
      campus: value.campus ?? null,
      college: value.college ?? null,
      department: value.department ?? null,
      program: value.program ?? null,
      year_level: value.year_level ?? null,
      updated_at: value.updated_at as string,
    },
    ...(includeToken ? { token: value.student_selection_token as string } : {}),
  };
}

function parsePage(value: unknown, selectionTokens: WeakMap<StudentDirectoryStudent, string>): StudentDirectoryPage | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["items", "page", "page_size", "total"]) || !Array.isArray(value.items) ||
      typeof value.page !== "number" || !Number.isSafeInteger(value.page) || value.page < 1 || value.page > MAX_PAGE ||
      typeof value.page_size !== "number" || value.page_size !== STUDENT_DIRECTORY_PAGE_SIZE ||
      typeof value.total !== "number" || !Number.isSafeInteger(value.total) || value.total < 0 ||
      value.items.length > STUDENT_DIRECTORY_PAGE_SIZE) {
    return null;
  }
  const items = value.items.map((item) => parseStudent(item, true));
  if (items.some((item) => item === null)) return null;
  const students = items.map((item) => {
    const student = item!.student;
    selectionTokens.set(student, item!.token!);
    return student;
  });
  return { items: students, page: value.page, page_size: value.page_size, total: value.total };
}

function parseRelatedRecord(value: unknown): StudentDirectoryRelatedRecord | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["record_type", "reference_code", "status", "created_at", "updated_at"]) ||
      !boundedString(value.record_type, 80) || !RELATED_RECORD_TYPES.has(value.record_type) || !nullableString(value.reference_code, 240) ||
      (value.reference_code !== null && value.reference_code !== undefined && !SAFE_REFERENCE.test(value.reference_code)) ||
      !nullableString(value.status, 100) || !nullableTimestamp(value.created_at) || !nullableTimestamp(value.updated_at)) {
    return null;
  }
  return {
    record_type: value.record_type,
    reference_code: value.reference_code ?? null,
    status: value.status ?? null,
    created_at: value.created_at ?? null,
    updated_at: value.updated_at ?? null,
  };
}

function parseRelatedWork(value: unknown): StudentDirectoryRelatedWork | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["record_type", "visible_count", "latest_status", "latest_updated_at", "records"]) ||
      typeof value.record_type !== "string" || !RELATED_WORK_TYPES.has(value.record_type) ||
      typeof value.visible_count !== "number" || !Number.isSafeInteger(value.visible_count) || value.visible_count < 0 ||
      !nullableString(value.latest_status, 100) || !nullableTimestamp(value.latest_updated_at) ||
      !Array.isArray(value.records) || value.records.length > MAX_RELATED_RECORDS) {
    return null;
  }
  const records = value.records.map(parseRelatedRecord);
  if (records.some((item) => item === null)) return null;
  return {
    record_type: value.record_type,
    visible_count: value.visible_count,
    latest_status: value.latest_status ?? null,
    latest_updated_at: value.latest_updated_at ?? null,
    records: records as StudentDirectoryRelatedRecord[],
  };
}

function parseContext(value: unknown): StudentDirectoryContext | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["profile", "related_work"]) || !Array.isArray(value.related_work) ||
      value.related_work.length > MAX_RELATED_WORK) return null;
  const profile = parseStudent(value.profile, false)?.student;
  const relatedWork = value.related_work.map(parseRelatedWork);
  if (!profile || relatedWork.some((item) => item === null)) return null;
  return { profile, related_work: relatedWork as StudentDirectoryRelatedWork[] };
}

function errorKind(status: number): StudentDirectoryApiErrorKind {
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 422) return "validation";
  if (status === 401 || status === 403 || status === 404) return "permission";
  return "unavailable";
}

async function readRequest<T>(request: Promise<GeneratedResponse>, parse: (value: unknown) => T | null): Promise<T> {
  try {
    const response = await request;
    if (response.status >= 200 && response.status < 300) {
      const value = parse(response.data);
      if (value !== null) return value;
    }
    throw new StudentDirectoryApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof StudentDirectoryApiError) throw error;
    throw new StudentDirectoryApiError("unavailable");
  }
}

function normalizeStatuses(value: string | null | undefined) {
  const values = [...new Set((value ?? "").split(",").map((item) => item.trim().toUpperCase()).filter(Boolean))];
  return values.filter((item): item is StudentDirectoryStatus => STATUS_SET.has(item));
}

export function parseStudentDirectoryFilters(params: { get: (name: string) => string | null }): StudentDirectoryFilters {
  const rawYearLevel = params.get("year_level")?.trim() ?? "";
  const parsedYearLevel = /^\d{1,3}$/.test(rawYearLevel) ? Number(rawYearLevel) : null;
  return {
    q: parseFilter(params.get("q"), MAX_QUERY_LENGTH),
    statuses: normalizeStatuses(params.get("status")),
    campus: parseFilter(params.get("campus")),
    college: parseFilter(params.get("college")),
    department: parseFilter(params.get("department")),
    program: parseFilter(params.get("program")),
    yearLevel: parsedYearLevel !== null && parsedYearLevel >= 1 && parsedYearLevel <= 100 ? parsedYearLevel : null,
    order: ORDER_SET.has(params.get("order") ?? "") ? params.get("order") as StudentDirectoryOrder : "name",
  };
}

export function studentDirectoryHref(page: number, filters: StudentDirectoryFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.statuses.length) params.set("status", filters.statuses.join(","));
  if (filters.campus) params.set("campus", filters.campus);
  if (filters.college) params.set("college", filters.college);
  if (filters.department) params.set("department", filters.department);
  if (filters.program) params.set("program", filters.program);
  if (filters.yearLevel !== null) params.set("year_level", String(filters.yearLevel));
  if (filters.order !== "name") params.set("order", filters.order);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/portal/students?${query}` : "/portal/students";
}

function listParams(page: number, filters: StudentDirectoryFilters) {
  const safeStatuses = filters.statuses.map((status) => {
    if (!STATUS_SET.has(status)) throw new StudentDirectoryApiError("validation");
    return status;
  });
  const order = filters.order || "name";
  if (!ORDER_SET.has(order)) throw new StudentDirectoryApiError("validation");
  return {
    page: safePage(page),
    page_size: STUDENT_DIRECTORY_PAGE_SIZE,
    ...(safeFilter(filters.q, MAX_QUERY_LENGTH) ? { q: safeFilter(filters.q, MAX_QUERY_LENGTH)! } : {}),
    ...(safeStatuses.length ? { status: safeStatuses.join(",") } : {}),
    ...(safeFilter(filters.campus) ? { campus: safeFilter(filters.campus)! } : {}),
    ...(safeFilter(filters.college) ? { college: safeFilter(filters.college)! } : {}),
    ...(safeFilter(filters.department) ? { department: safeFilter(filters.department)! } : {}),
    ...(safeFilter(filters.program) ? { program: safeFilter(filters.program)! } : {}),
    ...(filters.yearLevel !== null ? { year_level: filters.yearLevel } : {}),
    ...(order !== "name" ? { order } : {}),
  };
}

const selectionTokens = new WeakMap<StudentDirectoryStudent, string>();

export function getStudentDirectoryPage(page: number, filters: StudentDirectoryFilters, signal?: AbortSignal) {
  return readRequest(
    profilesStaffStudentDirectory(listParams(page, filters), cookieSessionReadOptions(signal)),
    (value) => parsePage(value, selectionTokens),
  );
}

export function getStudentDirectoryOptions(signal?: AbortSignal) {
  return readRequest(profilesStaffStudentDirectoryOptions(cookieSessionReadOptions(signal)), parseOptions);
}

export async function getStudentDirectoryContext(student: StudentDirectoryStudent, signal?: AbortSignal) {
  const token = selectionTokens.get(student);
  if (!token) throw new StudentDirectoryApiError("unavailable");
  const options = await cookieSessionMutationOptions(signal);
  return readRequest(
    profilesStaffStudentContext(
      { student_selection_token: safeReference(token) },
      options,
    ),
    parseContext,
  );
}
