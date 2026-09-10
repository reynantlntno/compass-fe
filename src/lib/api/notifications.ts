import {
  notificationsArchiveBulk,
  notificationsArchive,
  notificationsList,
  notificationsRead,
  notificationsUnreadCount,
} from "@/lib/api/generated/notifications/notifications";
import type {
  NotificationPageSchema,
  NotificationSchema,
} from "@/lib/api/generated/model";
import {
  cookieSessionMutationOptions,
  cookieSessionReadOptions,
} from "@/lib/api/auth";
import {
  withIdempotencyKey,
  type IdempotencyKey,
} from "@/lib/api/idempotency";

export type PortalNotificationFilter = "all" | "unread" | "archived";

export type PortalNotificationsPageState =
  | { kind: "ready"; page: NotificationPageSchema }
  | { kind: "unavailable" };

export type PortalNotificationMutationState =
  | { kind: "success"; notification: NotificationSchema }
  | { kind: "conflict" }
  | { kind: "unavailable" };

export type PortalNotificationBulkArchiveItem = {
  notification_id: string;
  expected_status: "unread" | "read";
};

export type PortalNotificationBulkArchiveState =
  | { kind: "success"; count: number; notifications: NotificationSchema[] }
  | { kind: "conflict" }
  | { kind: "unavailable" };

const NOTIFICATION_STATUSES = new Set(["unread", "read", "archived"]);
const NOTIFICATION_PRIORITIES = new Set(["normal", "high", "urgent"]);
const MAX_NOTIFICATION_TYPE_LENGTH = 100;
const MAX_NOTIFICATION_TITLE_LENGTH = 255;
const MAX_NOTIFICATION_PREVIEW_LENGTH = 500;
const MAX_CHANNEL_LENGTH = 50;
const MAX_ID_LENGTH = 128;
const MAX_DATE_LENGTH = 80;

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeOptionalDate(value: unknown): value is string | null | undefined {
  if (value === null || value === undefined) return true;
  if (typeof value !== "string" || value.length > MAX_DATE_LENGTH) return false;

  return !Number.isNaN(new Date(value).getTime());
}

function isNotification(value: unknown): value is NotificationSchema {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    value.id.trim().length > 0 &&
    value.id.length <= MAX_ID_LENGTH &&
    typeof value.notification_type === "string" &&
    value.notification_type.trim().length > 0 &&
    value.notification_type.length <= MAX_NOTIFICATION_TYPE_LENGTH &&
    typeof value.title === "string" &&
    value.title.trim().length > 0 &&
    value.title.length <= MAX_NOTIFICATION_TITLE_LENGTH &&
    typeof value.body_preview === "string" &&
    value.body_preview.trim().length > 0 &&
    value.body_preview.length <= MAX_NOTIFICATION_PREVIEW_LENGTH &&
    typeof value.status === "string" &&
    NOTIFICATION_STATUSES.has(value.status) &&
    typeof value.priority === "string" &&
    NOTIFICATION_PRIORITIES.has(value.priority) &&
    typeof value.channel_intent === "string" &&
    value.channel_intent.trim().length > 0 &&
    value.channel_intent.length <= MAX_CHANNEL_LENGTH &&
    isSafeOptionalDate(value.created_at) &&
    isSafeOptionalDate(value.read_at) &&
    isSafeOptionalDate(value.archived_at)
  );
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === "number" && value >= 0;
}

function isNotificationPage(value: unknown): value is NotificationPageSchema {
  if (!isRecord(value)) return false;

  return (
    isSafeNonNegativeInteger(value.page) &&
    value.page > 0 &&
    isSafeNonNegativeInteger(value.page_size) &&
    value.page_size > 0 &&
    value.page_size <= 100 &&
    isSafeNonNegativeInteger(value.total) &&
    Array.isArray(value.items) &&
    value.items.length <= value.page_size &&
    value.items.every(isNotification)
  );
}

function isUnreadCount(value: unknown): value is number {
  return isSafeNonNegativeInteger(value);
}

function isNotificationBulkArchiveResult(
  value: unknown,
): value is { items: NotificationSchema[]; count: number } {
  if (!isRecord(value)) return false;
  if (!isSafeNonNegativeInteger(value.count) || value.count < 1 || value.count > 100) {
    return false;
  }

  return (
    Array.isArray(value.items) &&
    value.items.length === value.count &&
    value.items.every(
      (notification) => isNotification(notification) && notification.status === "archived",
    )
  );
}

export async function getPortalUnreadNotificationCount(
  signal?: AbortSignal,
): Promise<number | null> {
  try {
    const response = await notificationsUnreadCount(
      cookieSessionReadOptions(signal),
    );

    if (
      response.status !== 200 ||
      !isRecord(response.data) ||
      !isUnreadCount(response.data.unread_count)
    ) {
      return null;
    }

    return response.data.unread_count;
  } catch (error) {
    if (isAbortError(error)) throw error;
    return null;
  }
}

export async function getPortalNotifications(
  filter: PortalNotificationFilter,
  page: number,
  signal?: AbortSignal,
): Promise<PortalNotificationsPageState> {
  try {
    const response = await notificationsList(
      {
        page,
        page_size: 20,
        ...(filter === "all" ? {} : { status: filter }),
      },
      cookieSessionReadOptions(signal),
    );

    if (response.status !== 200 || !isNotificationPage(response.data)) {
      return { kind: "unavailable" };
    }

    return { kind: "ready", page: response.data };
  } catch (error) {
    if (isAbortError(error)) throw error;
    return { kind: "unavailable" };
  }
}

async function mutatePortalNotification(
  operation: typeof notificationsRead | typeof notificationsArchive,
  notificationId: string,
  expectedStatus: string,
  idempotencyKey: IdempotencyKey,
  signal?: AbortSignal,
): Promise<PortalNotificationMutationState> {
  try {
    const options = await cookieSessionMutationOptions(signal);
    const response = await operation(
      notificationId,
      { expected_status: expectedStatus },
      withIdempotencyKey(idempotencyKey, options),
    );

    if (response.status === 200 && isNotification(response.data)) {
      return { kind: "success", notification: response.data };
    }

    if (response.status === 409) return { kind: "conflict" };
    return { kind: "unavailable" };
  } catch (error) {
    if (isAbortError(error)) throw error;
    return { kind: "unavailable" };
  }
}

export function markPortalNotificationRead(
  notificationId: string,
  expectedStatus: string,
  idempotencyKey: IdempotencyKey,
  signal?: AbortSignal,
) {
  return mutatePortalNotification(
    notificationsRead,
    notificationId,
    expectedStatus,
    idempotencyKey,
    signal,
  );
}

export function archivePortalNotification(
  notificationId: string,
  expectedStatus: string,
  idempotencyKey: IdempotencyKey,
  signal?: AbortSignal,
) {
  return mutatePortalNotification(
    notificationsArchive,
    notificationId,
    expectedStatus,
    idempotencyKey,
    signal,
  );
}

export async function archivePortalNotifications(
  items: readonly PortalNotificationBulkArchiveItem[],
  idempotencyKey: IdempotencyKey,
  signal?: AbortSignal,
): Promise<PortalNotificationBulkArchiveState> {
  try {
    const options = await cookieSessionMutationOptions(signal);
    const response = await notificationsArchiveBulk(
      { items: [...items] },
      withIdempotencyKey(idempotencyKey, options),
    );

    if (response.status === 200 && isNotificationBulkArchiveResult(response.data)) {
      return {
        kind: "success",
        count: response.data.count,
        notifications: response.data.items,
      };
    }

    if (response.status === 409) return { kind: "conflict" };
    return { kind: "unavailable" };
  } catch (error) {
    if (isAbortError(error)) throw error;
    return { kind: "unavailable" };
  }
}
