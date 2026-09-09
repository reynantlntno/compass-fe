import { authorityMeCoverage } from "@/lib/api/generated/authority/authority";
import { policiesDpoAppointmentMe } from "@/lib/api/generated/policies/policies";
import { profilesMe } from "@/lib/api/generated/profiles/profiles";
import { cookieSessionReadOptions } from "@/lib/api/auth";
import type {
  CounselorCoveragePageSchema,
  CounselorCoverageProjectionSchema,
  CurrentDPOAppointmentSchema,
  SelfProfileSchema,
} from "@/lib/api/generated/model";

const MAX_PROFILE_TEXT_LENGTH = 255;
const MAX_APPOINTMENT_LABEL_LENGTH = 40;
const MAX_COVERAGE_LABEL_LENGTH = 240;
const MAX_COVERAGE_PAGE_SIZE = 100;

export type AccountProfileState =
  | { kind: "ready"; profile: SelfProfileSchema }
  | { kind: "absent" }
  | { kind: "unavailable" };

export type AccountAppointmentState =
  | { kind: "ready"; appointment: CurrentDPOAppointmentSchema }
  | { kind: "absent" }
  | { kind: "unavailable" };

export type AccountCoverageState =
  | { kind: "ready"; coverage: CounselorCoveragePageSchema }
  | { kind: "absent" }
  | { kind: "unavailable" };

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedText(value: unknown, maximum = MAX_PROFILE_TEXT_LENGTH) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maximum
  );
}

function isOptionalProfileText(
  value: unknown,
  maximum = MAX_PROFILE_TEXT_LENGTH,
) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.length <= maximum)
  );
}

function isSelfProfile(value: unknown): value is SelfProfileSchema {
  if (!isRecord(value)) return false;

  const profile = value as Record<string, unknown>;
  const userId = profile.user_id;
  return (
    typeof userId === "number" &&
    Number.isSafeInteger(userId) &&
    userId > 0 &&
    isBoundedText(profile.display_name) &&
    isBoundedText(profile.role, 80) &&
    isOptionalProfileText(profile.campus) &&
    isOptionalProfileText(profile.college) &&
    isOptionalProfileText(profile.department) &&
    isOptionalProfileText(profile.designation) &&
    isOptionalProfileText(profile.lifecycle_status, 80) &&
    isOptionalProfileText(profile.profile_type, 80) &&
    isOptionalProfileText(profile.program) &&
    isOptionalProfileText(profile.student_number, 80) &&
    isOptionalProfileText(profile.year_level, 80) &&
    (profile.is_head_guidance === null ||
      profile.is_head_guidance === undefined ||
      typeof profile.is_head_guidance === "boolean")
  );
}

function isCurrentDPOAppointment(
  value: unknown,
): value is CurrentDPOAppointmentSchema {
  return (
    isRecord(value) &&
    isBoundedText(value.label, MAX_APPOINTMENT_LABEL_LENGTH)
  );
}

function isCoverageProjection(
  value: unknown,
): value is CounselorCoverageProjectionSchema {
  if (!isRecord(value)) return false;

  return (
    isBoundedText(value.scope_label, MAX_COVERAGE_LABEL_LENGTH) &&
    isOptionalProfileText(value.campus, 100) &&
    isOptionalProfileText(value.college, 100) &&
    isOptionalProfileText(value.department, 100) &&
    isOptionalProfileText(value.program, 100) &&
    typeof value.is_primary === "boolean"
  );
}

function isCounselorCoveragePage(
  value: unknown,
): value is CounselorCoveragePageSchema {
  if (!isRecord(value)) return false;

  const page = value.page;
  const pageSize = value.page_size;
  const total = value.total;
  const items = value.items;

  if (
    typeof page !== "number" ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    typeof pageSize !== "number" ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > MAX_COVERAGE_PAGE_SIZE ||
    typeof total !== "number" ||
    !Number.isSafeInteger(total) ||
    total < 0 ||
    !Array.isArray(items)
  ) {
    return false;
  }

  return items.length <= pageSize && items.length <= total && items.every(isCoverageProjection);
}

export async function getAccountProfile(
  userId: number,
  signal?: AbortSignal,
): Promise<AccountProfileState> {
  try {
    const response = await profilesMe(cookieSessionReadOptions(signal));
    if (response.status === 404) return { kind: "absent" };
    if (
      response.status !== 200 ||
      !isSelfProfile(response.data) ||
      response.data.user_id !== userId
    ) {
      return { kind: "unavailable" };
    }

    return { kind: "ready", profile: response.data };
  } catch (error) {
    if (isAbortError(error)) throw error;
    return { kind: "unavailable" };
  }
}

export async function getAccountAppointment(
  signal?: AbortSignal,
): Promise<AccountAppointmentState> {
  try {
    const response = await policiesDpoAppointmentMe(
      cookieSessionReadOptions(signal),
    );
    if (response.status === 404) return { kind: "absent" };
    if (
      response.status !== 200 ||
      !isCurrentDPOAppointment(response.data)
    ) {
      return { kind: "unavailable" };
    }

    return { kind: "ready", appointment: response.data };
  } catch (error) {
    if (isAbortError(error)) throw error;
    return { kind: "unavailable" };
  }
}

export async function getAccountCoverage(
  page = 1,
  signal?: AbortSignal,
): Promise<AccountCoverageState> {
  try {
    const response = await authorityMeCoverage(
      { page, page_size: MAX_COVERAGE_PAGE_SIZE },
      cookieSessionReadOptions(signal),
    );
    if (response.status === 404) return { kind: "absent" };
    if (response.status !== 200 || !isCounselorCoveragePage(response.data)) {
      return { kind: "unavailable" };
    }

    return response.data.total > 0
      ? { kind: "ready", coverage: response.data }
      : { kind: "absent" };
  } catch (error) {
    if (isAbortError(error)) throw error;
    return { kind: "unavailable" };
  }
}
