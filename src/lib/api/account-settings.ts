import {
  meActivityList,
  mePasswordChange,
  meSessionRevoke,
  meSessionsList,
  meSessionsRevokeOthers,
  meTrustedDeviceRevoke,
  meTrustedDevicesList,
  meTrustedDevicesRevokeAll,
  meTwoFactorChangeRequest,
  meTwoFactorChangeResend,
  meTwoFactorChangeVerify,
  meTwoFactorStatus,
} from "@/lib/api/generated/account-security/account-security";
import {
  notificationsPreferenceUpdate,
  notificationsPreferencesList,
} from "@/lib/api/generated/notifications/notifications";
import { cookieSessionMutationOptions, cookieSessionReadOptions } from "@/lib/api/auth";
import { withIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";
import type {
  ActivityPageSchema,
  AssuranceChallengeSchema,
  NotificationPreferencePageSchema,
  NotificationPreferenceSchema,
  NotificationPreferenceUpdateSchema,
  PasswordChangeRequestSchema,
  PasswordChangedResponseSchema,
  RevocationResponseSchema,
  SessionPageSchema,
  TrustedDevicePageSchema,
  TwoFactorChangeRequestSchema,
  TwoFactorChangeVerifyRequestSchema,
  TwoFactorStatusSchema,
  OtpResendRequestSchema,
} from "@/lib/api/generated/model";

export type AccountSettingsErrorKind =
  | "conflict"
  | "permission"
  | "rate_limited"
  | "unavailable"
  | "validation";

export class AccountSettingsApiError extends Error {
  readonly kind: AccountSettingsErrorKind;

  constructor(kind: AccountSettingsErrorKind) {
    super("The account settings request could not be completed.");
    this.name = "AccountSettingsApiError";
    this.kind = kind;
  }
}

const MAX_PAGE_SIZE = 100;
const MAX_OPAQUE_TOKEN_LENGTH = 512;
const MAX_TEXT_LENGTH = 255;
const MAX_STATE_LABEL_LENGTH = 120;
const MAX_METHOD_LENGTH = 80;
const MAX_STATUS_LENGTH = 80;
const MAX_PREFERENCE_CHANNEL_LENGTH = 20;
const MAX_PREFERENCE_POLICY_LENGTH = 80;

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedText(value: unknown, maximum = MAX_TEXT_LENGTH) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maximum
  );
}

function isOptionalTimestamp(value: unknown) {
  return (
    value === null ||
    (typeof value === "string" &&
      value.length <= 80 &&
      !Number.isNaN(Date.parse(value)))
  );
}

function isDisplayState(value: unknown) {
  return (
    isRecord(value) &&
    isBoundedText(value.state, MAX_STATUS_LENGTH) &&
    isBoundedText(value.label, MAX_STATE_LABEL_LENGTH)
  );
}

function isPageEnvelope(value: unknown): value is {
  items: unknown[];
  page: number;
  page_size: number;
  total: number;
} {
  if (!isRecord(value) || !Array.isArray(value.items)) return false;

  const page = value.page;
  const pageSize = value.page_size;
  const total = value.total;

  return (
    typeof page === "number" &&
    Number.isSafeInteger(page) &&
    page >= 1 &&
    typeof pageSize === "number" &&
    Number.isSafeInteger(pageSize) &&
    pageSize >= 1 &&
    pageSize <= MAX_PAGE_SIZE &&
    typeof total === "number" &&
    Number.isSafeInteger(total) &&
    total >= 0 &&
    value.items.length <= pageSize &&
    value.items.length <= total
  );
}

function isActivityPage(value: unknown): value is ActivityPageSchema {
  if (!isPageEnvelope(value)) return false;

  return value.items.every((item) => {
    if (!isRecord(item)) return false;

    return (
      isBoundedText(item.activity_type, 100) &&
      isBoundedText(item.category, 80) &&
      isBoundedText(item.label, MAX_TEXT_LENGTH) &&
      isOptionalTimestamp(item.created_at) &&
      isBoundedText(item.status_label, MAX_STATUS_LENGTH) &&
      isBoundedText(item.status_tone, MAX_STATUS_LENGTH) &&
      (item.reference_code === null ||
        item.reference_code === undefined ||
        isBoundedText(item.reference_code, 50)) &&
      (item.device === null ||
        item.device === undefined ||
        isDisplayState(item.device)) &&
      (item.network === null ||
        item.network === undefined ||
        isDisplayState(item.network))
    );
  });
}

function isSessionPage(value: unknown): value is SessionPageSchema {
  if (!isPageEnvelope(value)) return false;

  return value.items.every((item) => {
    if (!isRecord(item)) return false;

    return (
      isBoundedText(item.session_token, MAX_OPAQUE_TOKEN_LENGTH) &&
      typeof item.is_current === "boolean" &&
      isDisplayState(item.device) &&
      isDisplayState(item.network) &&
      isOptionalTimestamp(item.started_at) &&
      isOptionalTimestamp(item.last_activity_at) &&
      isOptionalTimestamp(item.expires_at) &&
      isBoundedText(item.authentication_method, MAX_METHOD_LENGTH)
    );
  });
}

function isTrustedDevicePage(value: unknown): value is TrustedDevicePageSchema {
  if (!isPageEnvelope(value)) return false;

  return value.items.every((item) => {
    if (!isRecord(item)) return false;

    return (
      isBoundedText(item.id, MAX_OPAQUE_TOKEN_LENGTH) &&
      isDisplayState(item.device) &&
      isBoundedText(item.status, MAX_STATUS_LENGTH) &&
      isOptionalTimestamp(item.trusted_until) &&
      isOptionalTimestamp(item.last_used_at) &&
      isOptionalTimestamp(item.revoked_at) &&
      (item.is_current === undefined || typeof item.is_current === "boolean")
    );
  });
}

function isTwoFactorStatus(value: unknown): value is TwoFactorStatusSchema {
  return (
    isRecord(value) &&
    typeof value.enabled === "boolean" &&
    typeof value.required === "boolean" &&
    typeof value.can_change === "boolean"
  );
}

function isAssuranceChallenge(value: unknown): value is AssuranceChallengeSchema {
  if (!isRecord(value)) return false;

  const expiresIn = value.expires_in;

  return (
    isBoundedText(value.challenge_id, 100) &&
    isBoundedText(value.pending_nonce, MAX_OPAQUE_TOKEN_LENGTH) &&
    typeof expiresIn === "number" &&
    Number.isSafeInteger(expiresIn) &&
    expiresIn > 0 &&
    expiresIn <= 3600 &&
    typeof value.requires_verification === "boolean"
  );
}

function isNotificationPreference(value: unknown): value is NotificationPreferenceSchema {
  if (!isRecord(value)) return false;

  const channel = value.channel;

  return (
    isBoundedText(value.notification_type, MAX_TEXT_LENGTH) &&
    isBoundedText(value.category, MAX_TEXT_LENGTH) &&
    isBoundedText(value.label, MAX_TEXT_LENGTH) &&
    isBoundedText(value.description, 500) &&
    isBoundedText(channel, MAX_PREFERENCE_CHANNEL_LENGTH) &&
    typeof channel === "string" &&
    ["both", "in_app", "email"].includes(channel) &&
    isBoundedText(value.priority, MAX_STATUS_LENGTH) &&
    isBoundedText(value.preference_policy, MAX_PREFERENCE_POLICY_LENGTH) &&
    typeof value.in_app_enabled === "boolean" &&
    typeof value.email_enabled === "boolean" &&
    typeof value.overridden === "boolean" &&
    typeof value.mandatory === "boolean"
  );
}

function isNotificationPreferencePage(
  value: unknown,
): value is NotificationPreferencePageSchema {
  if (!isPageEnvelope(value)) return false;
  return value.items.every(isNotificationPreference);
}

function isRevocationResponse(value: unknown): value is RevocationResponseSchema {
  return isRecord(value) && typeof value.revoked === "boolean";
}

function isPasswordChangedResponse(
  value: unknown,
): value is PasswordChangedResponseSchema {
  return isRecord(value) && value.changed === true;
}

function errorKind(status: number): AccountSettingsErrorKind {
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if ([400, 422].includes(status)) return "validation";
  if ([401, 403, 404].includes(status)) return "permission";
  return "unavailable";
}

function throwResponseError(status: number): never {
  throw new AccountSettingsApiError(errorKind(status));
}

function throwTransportError(error: unknown): never {
  if (isAbortError(error)) throw error;
  throw new AccountSettingsApiError("unavailable");
}

function assertOpaqueValue(value: string) {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > MAX_OPAQUE_TOKEN_LENGTH
  ) {
    throw new AccountSettingsApiError("validation");
  }
}

async function getReadResponse<T>(
  request: Promise<{ data: unknown; status: number }>,
  validate: (value: unknown) => value is T,
): Promise<T> {
  let response;
  try {
    response = await request;
  } catch (error) {
    return throwTransportError(error);
  }

  if (response.status !== 200 || !validate(response.data)) {
    throwResponseError(response.status);
  }

  return response.data;
}

async function getMutationOptions(
  key: IdempotencyKey | null,
  signal?: AbortSignal,
) {
  const options = await cookieSessionMutationOptions(signal);
  return key ? withIdempotencyKey(key, options) : options;
}

export async function getTwoFactorStatus(signal?: AbortSignal) {
  return getReadResponse(
    meTwoFactorStatus(cookieSessionReadOptions(signal)),
    isTwoFactorStatus,
  );
}

export async function getAccountSessions(
  page = 1,
  signal?: AbortSignal,
) {
  return getReadResponse(
    meSessionsList(
      { page, page_size: MAX_PAGE_SIZE },
      cookieSessionReadOptions(signal),
    ),
    isSessionPage,
  );
}

export async function getTrustedDevices(
  page = 1,
  signal?: AbortSignal,
) {
  return getReadResponse(
    meTrustedDevicesList(
      { page, page_size: MAX_PAGE_SIZE },
      cookieSessionReadOptions(signal),
    ),
    isTrustedDevicePage,
  );
}

export async function getNotificationPreferences(
  page = 1,
  signal?: AbortSignal,
) {
  return getReadResponse(
    notificationsPreferencesList(
      { page, page_size: MAX_PAGE_SIZE },
      cookieSessionReadOptions(signal),
    ),
    isNotificationPreferencePage,
  );
}

export async function getSecurityActivity(
  page = 1,
  signal?: AbortSignal,
) {
  return getReadResponse(
    meActivityList(
      { category: "security", page, page_size: MAX_PAGE_SIZE },
      cookieSessionReadOptions(signal),
    ),
    isActivityPage,
  );
}

export async function changeAccountPassword(
  payload: PasswordChangeRequestSchema,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  let response;
  try {
    response = await mePasswordChange(
      payload,
      await getMutationOptions(key, signal),
    );
  } catch (error) {
    return throwTransportError(error);
  }

  if (response.status !== 200 || !isPasswordChangedResponse(response.data)) {
    throwResponseError(response.status);
  }
}

export async function requestTwoFactorChange(
  payload: TwoFactorChangeRequestSchema,
  signal?: AbortSignal,
) {
  let response;
  try {
    response = await meTwoFactorChangeRequest(
      payload,
      await getMutationOptions(null, signal),
    );
  } catch (error) {
    return throwTransportError(error);
  }

  if (response.status !== 200 || !isAssuranceChallenge(response.data)) {
    throwResponseError(response.status);
  }

  return response.data;
}

export async function verifyTwoFactorChange(
  payload: TwoFactorChangeVerifyRequestSchema,
  signal?: AbortSignal,
) {
  let response;
  try {
    response = await meTwoFactorChangeVerify(
      payload,
      await getMutationOptions(null, signal),
    );
  } catch (error) {
    return throwTransportError(error);
  }

  if (response.status !== 200) throwResponseError(response.status);
}

export async function resendTwoFactorChange(
  payload: OtpResendRequestSchema,
  signal?: AbortSignal,
) {
  let response;
  try {
    response = await meTwoFactorChangeResend(
      payload,
      await getMutationOptions(null, signal),
    );
  } catch (error) {
    return throwTransportError(error);
  }

  if (response.status !== 200) throwResponseError(response.status);
}

export async function revokeAccountSession(
  sessionToken: string,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  assertOpaqueValue(sessionToken);
  let response;
  try {
    response = await meSessionRevoke(
      sessionToken,
      await getMutationOptions(key, signal),
    );
  } catch (error) {
    return throwTransportError(error);
  }

  if (response.status !== 200 || !isRevocationResponse(response.data)) {
    throwResponseError(response.status);
  }
}

export async function revokeOtherSessions(
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  let response;
  try {
    response = await meSessionsRevokeOthers(
      await getMutationOptions(key, signal),
    );
  } catch (error) {
    return throwTransportError(error);
  }

  if (response.status !== 200 || !isRevocationResponse(response.data)) {
    throwResponseError(response.status);
  }
}

export async function revokeTrustedDevice(
  deviceId: string,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  assertOpaqueValue(deviceId);
  let response;
  try {
    response = await meTrustedDeviceRevoke(
      deviceId,
      await getMutationOptions(key, signal),
    );
  } catch (error) {
    return throwTransportError(error);
  }

  if (response.status !== 200 || !isRevocationResponse(response.data)) {
    throwResponseError(response.status);
  }
}

export async function revokeAllTrustedDevices(
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  let response;
  try {
    response = await meTrustedDevicesRevokeAll(
      await getMutationOptions(key, signal),
    );
  } catch (error) {
    return throwTransportError(error);
  }

  if (response.status !== 200 || !isRevocationResponse(response.data)) {
    throwResponseError(response.status);
  }
}

export async function updateNotificationPreference(
  notificationType: string,
  payload: NotificationPreferenceUpdateSchema,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  assertOpaqueValue(notificationType);
  let response;
  try {
    response = await notificationsPreferenceUpdate(
      notificationType,
      payload,
      await getMutationOptions(key, signal),
    );
  } catch (error) {
    return throwTransportError(error);
  }

  if (response.status !== 200 || !isNotificationPreference(response.data)) {
    throwResponseError(response.status);
  }

  return response.data;
}
