import {
  notificationsDeliveryDeadLetter,
  notificationsDeliveryList,
  notificationsDeliveryRetry,
} from "@/lib/api/generated/notifications/notifications";
import type {
  DeadLetterSchema,
  TechnicalDeliveryPageSchema,
  TechnicalDeliverySchema,
} from "@/lib/api/generated/model";
import {
  cookieSessionMutationOptions,
  cookieSessionReadOptions,
} from "@/lib/api/auth";
import { withIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";

export type NotificationDeliveryErrorKind =
  | "conflict"
  | "permission"
  | "rate_limited"
  | "unavailable"
  | "validation";

export class NotificationDeliveryApiError extends Error {
  readonly kind: NotificationDeliveryErrorKind;

  constructor(kind: NotificationDeliveryErrorKind) {
    super("The notification delivery request could not be completed.");
    this.name = "NotificationDeliveryApiError";
    this.kind = kind;
  }
}

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_ID_LENGTH = 160;
const MAX_TEMPLATE_KEY_LENGTH = 100;
const MAX_STATUS_LENGTH = 40;
const MAX_ERROR_CODE_LENGTH = 120;
const MAX_ERROR_SUMMARY_LENGTH = 240;
const MAX_TIMESTAMP_LENGTH = 80;
const MAX_ATTEMPTS = 100_000;
const DELIVERY_STATUSES = new Set([
  "pending",
  "processing",
  "sent",
  "failed",
  "dead",
  "cancelled",
]);
const DELIVERY_STATES = new Set([
  "queued",
  "sending",
  "sent",
  "delayed",
  "failed",
  "retry_exhausted",
  "bounced",
  "cancelled",
]);

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

function isBoundedString(value: unknown, maximum: number, allowEmpty = false): value is string {
  return (
    typeof value === "string" &&
    value.length <= maximum &&
    (allowEmpty || value.trim().length > 0)
  );
}

function isOptionalTimestamp(value: unknown): value is string | null | undefined {
  if (value === null || value === undefined) return true;
  return (
    typeof value === "string" &&
    value.length <= MAX_TIMESTAMP_LENGTH &&
    !Number.isNaN(Date.parse(value))
  );
}

function isSafeInteger(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function isTechnicalDelivery(value: unknown): value is TechnicalDeliverySchema {
  if (!isRecord(value)) return false;

  return (
    isBoundedString(value.id, MAX_ID_LENGTH) &&
    isBoundedString(value.template_key, MAX_TEMPLATE_KEY_LENGTH) &&
    isBoundedString(value.status, MAX_STATUS_LENGTH) &&
    DELIVERY_STATUSES.has(value.status) &&
    isBoundedString(value.delivery_state, MAX_STATUS_LENGTH) &&
    DELIVERY_STATES.has(value.delivery_state) &&
    isSafeInteger(value.attempts, 0, MAX_ATTEMPTS) &&
    isSafeInteger(value.max_attempts, 1, MAX_ATTEMPTS) &&
    value.attempts <= value.max_attempts &&
    isBoundedString(value.last_error_safe_summary, MAX_ERROR_SUMMARY_LENGTH, true) &&
    (value.last_error_code === null ||
      value.last_error_code === undefined ||
      isBoundedString(value.last_error_code, MAX_ERROR_CODE_LENGTH, true)) &&
    isOptionalTimestamp(value.created_at) &&
    isOptionalTimestamp(value.next_retry_at) &&
    isOptionalTimestamp(value.sent_at) &&
    isOptionalTimestamp(value.provider_status_updated_at)
  );
}

function isDeliveryPage(value: unknown): value is TechnicalDeliveryPageSchema {
  if (!isRecord(value) || !Array.isArray(value.items)) return false;

  return (
    isSafeInteger(value.page, 1) &&
    isSafeInteger(value.page_size, 1, MAX_PAGE_SIZE) &&
    isSafeInteger(value.total) &&
    value.items.length <= value.page_size
  );
}

function parseDeliveryPage(value: unknown): TechnicalDeliveryPageSchema | null {
  if (!isDeliveryPage(value)) return null;

  return {
    items: value.items.filter(isTechnicalDelivery),
    page: value.page,
    page_size: value.page_size,
    total: value.total,
  };
}

function errorKind(status: number): NotificationDeliveryErrorKind {
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
    throw new NotificationDeliveryApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof NotificationDeliveryApiError) throw error;
    throw new NotificationDeliveryApiError("unavailable");
  }
}

async function getMutationResponse(
  request: (options: RequestInit) => Promise<GeneratedResponse>,
  idempotencyKey: IdempotencyKey,
  signal?: AbortSignal,
): Promise<TechnicalDeliverySchema> {
  try {
    const options = await cookieSessionMutationOptions(signal);
    const response = await request(withIdempotencyKey(idempotencyKey, options));
    if (response.status === 200 && isTechnicalDelivery(response.data)) {
      return response.data;
    }
    throw new NotificationDeliveryApiError(errorKind(response.status));
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof NotificationDeliveryApiError) throw error;
    throw new NotificationDeliveryApiError("unavailable");
  }
}

export function getPortalNotificationDelivery(
  page = 1,
  filters: {
    deliveryState?: string | null;
    status?: string | null;
    templateKey?: string | null;
  } = {},
  signal?: AbortSignal,
) {
  return getReadResponse(
    notificationsDeliveryList(
      {
        page,
        page_size: PAGE_SIZE,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.deliveryState ? { delivery_state: filters.deliveryState } : {}),
        ...(filters.templateKey ? { template_key: filters.templateKey } : {}),
      },
      cookieSessionReadOptions(signal),
    ),
    parseDeliveryPage,
  );
}

export function retryPortalNotificationDelivery(
  deliveryId: string,
  idempotencyKey: IdempotencyKey,
  signal?: AbortSignal,
) {
  return getMutationResponse(
    (options) => notificationsDeliveryRetry(deliveryId, options),
    idempotencyKey,
    signal,
  );
}

export function deadLetterPortalNotificationDelivery(
  deliveryId: string,
  payload: DeadLetterSchema,
  idempotencyKey: IdempotencyKey,
  signal?: AbortSignal,
) {
  return getMutationResponse(
    (options) => notificationsDeliveryDeadLetter(deliveryId, payload, options),
    idempotencyKey,
    signal,
  );
}
