"use client";

import Link from "next/link";
import { Archive, Bell, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { usePortalNotifications } from "@/components/portal/portal-notifications-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  NotificationPageSchema,
  NotificationSchema,
} from "@/lib/api/generated/model";
import {
  archivePortalNotification,
  getPortalNotifications,
  markPortalNotificationRead,
  type PortalNotificationFilter,
} from "@/lib/api/notifications";
import {
  createIdempotencyKey,
  type IdempotencyKey,
} from "@/lib/api/idempotency";

const FILTERS: readonly {
  value: PortalNotificationFilter;
  label: string;
  emptyTitle: string;
  emptyDescription: string;
}[] = [
  {
    value: "all",
    label: "All",
    emptyTitle: "No notifications yet.",
    emptyDescription: "Updates sent to your COMPASS account will appear here.",
  },
  {
    value: "unread",
    label: "Unread",
    emptyTitle: "You’re all caught up.",
    emptyDescription: "There are no unread notifications right now.",
  },
  {
    value: "archived",
    label: "Archived",
    emptyTitle: "No archived notifications.",
    emptyDescription: "Notifications you archive will appear here.",
  },
];

type NotificationLoadState =
  | { kind: "loading" }
  | { kind: "ready"; page: NotificationPageSchema }
  | { kind: "unavailable" };

type NotificationMutation = {
  kind: "read" | "archive";
  notificationId: string;
  expectedStatus: string;
  key: IdempotencyKey | null;
  state: "pending" | "error";
  message?: string;
};

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function parseFilter(value: string | null): PortalNotificationFilter {
  if (value === "unread" || value === "archived") return value;
  return "all";
}

function parsePage(value: string | null) {
  const page = Number(value);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10_000) return 1;
  return page;
}

function filterDefinition(filter: PortalNotificationFilter) {
  return FILTERS.find((entry) => entry.value === filter) ?? FILTERS[0];
}

function filterHref(filter: PortalNotificationFilter, page = 1) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("status", filter);
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `/portal/notifications?${query}` : "/portal/notifications";
}

function notificationStatusLabel(status: NotificationSchema["status"]) {
  switch (status) {
    case "unread":
      return "Unread";
    case "read":
      return "Read";
    case "archived":
      return "Archived";
    default:
      return "Notification";
  }
}

function notificationPriorityLabel(priority: NotificationSchema["priority"]) {
  switch (priority) {
    case "urgent":
      return "Urgent priority";
    case "high":
      return "High priority";
    default:
      return "Normal priority";
  }
}

function formatNotificationDate(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function NotificationsLoading() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading notifications"
      className="portal-notifications portal-notifications--loading"
      role="status"
    >
      <span className="sr-only">Loading notifications…</span>
      <Skeleton aria-hidden="true" className="portal-notifications__skeleton-heading" />
      <Skeleton aria-hidden="true" className="portal-notifications__skeleton-summary" />
      <div aria-hidden="true" className="portal-notifications__skeleton-filters">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
      <div aria-hidden="true" className="portal-notifications__skeleton-list">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="portal-notifications__skeleton-row" key={index}>
            <Skeleton />
            <Skeleton />
          </div>
        ))}
      </div>
    </section>
  );
}

export function PortalNotificationsLoading() {
  return <NotificationsLoading />;
}

function NotificationsUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <section
      aria-labelledby="portal-notifications-unavailable-heading"
      className="portal-notifications portal-notifications--state"
    >
      <h1 id="portal-notifications-unavailable-heading">
        Notifications are unavailable right now.
      </h1>
      <p>Try again when the connection is ready.</p>
      <Button onClick={onRetry} type="button" variant="outline">
        <RefreshCw aria-hidden="true" />
        Try again
      </Button>
    </section>
  );
}

function NotificationsEmpty({ filter }: { filter: PortalNotificationFilter }) {
  const definition = filterDefinition(filter);

  return (
    <section
      aria-labelledby="portal-notifications-empty-heading"
      className="portal-notifications__empty"
      role="status"
    >
      <Bell aria-hidden="true" className="portal-notifications__empty-icon" />
      <h2 id="portal-notifications-empty-heading">{definition.emptyTitle}</h2>
      <p>{definition.emptyDescription}</p>
    </section>
  );
}

function NotificationRow({
  expanded,
  mutation,
  notification,
  onArchive,
  onRetry,
  onToggle,
}: {
  expanded: boolean;
  mutation: NotificationMutation | null;
  notification: NotificationSchema;
  onArchive: (notification: NotificationSchema) => void;
  onRetry: (notification: NotificationSchema) => void;
  onToggle: (notification: NotificationSchema) => void;
}) {
  const formattedDate = formatNotificationDate(notification.created_at);
  const statusLabel = notificationStatusLabel(notification.status);
  const priorityLabel = notificationPriorityLabel(notification.priority);
  const detailsId = `notification-details-${notification.id}`;
  const mutationForRow =
    mutation?.notificationId === notification.id ? mutation : null;
  const isUpdating = mutationForRow?.state === "pending";

  return (
    <li
      className={`portal-notification${notification.status === "unread" ? " is-unread" : ""}`}
      data-status={notification.status}
    >
      <button
        aria-controls={detailsId}
        aria-expanded={expanded}
        className="portal-notification__toggle"
        onClick={() => onToggle(notification)}
        type="button"
      >
        <span className="portal-notification__toggle-copy">
          <span className="portal-notification__meta">
            <span className="portal-notification__status">{statusLabel}</span>
            <span>{priorityLabel}</span>
          </span>
          <span className="portal-notification__title">{notification.title}</span>
          <span className="portal-notification__preview">
            {notification.body_preview}
          </span>
        </span>
        <span className="portal-notification__toggle-date">
          {formattedDate ? (
            <time dateTime={notification.created_at ?? undefined}>
              {formattedDate}
            </time>
          ) : null}
          <span aria-hidden="true" className="portal-notification__toggle-indicator">
            {expanded ? "−" : "+"}
          </span>
        </span>
      </button>

      {expanded ? (
        <div className="portal-notification__details" id={detailsId}>
          <p>{notification.body_preview}</p>
          {mutationForRow?.state === "pending" ? (
            <p aria-live="polite" className="portal-notification__status-message" role="status">
              Updating notification…
            </p>
          ) : null}
          {mutationForRow?.state === "error" ? (
            <div className="portal-notification__mutation-error" role="alert">
              <p>{mutationForRow.message}</p>
              <Button
                disabled={isUpdating}
                onClick={() => onRetry(notification)}
                type="button"
                variant="outline"
              >
                Try again
              </Button>
            </div>
          ) : null}
          {notification.status !== "archived" && !isUpdating ? (
            <Button
              disabled={isUpdating}
              onClick={() => onArchive(notification)}
              type="button"
              variant="outline"
            >
              <Archive aria-hidden="true" />
              Archive
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function PortalNotificationsPage() {
  const searchParams = useSearchParams();
  const filter = parseFilter(searchParams.get("status"));
  const pageNumber = parsePage(searchParams.get("page"));
  const [loadState, setLoadState] = useState<NotificationLoadState>({
    kind: "loading",
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mutation, setMutation] = useState<NotificationMutation | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const mutationRequestRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const { refreshUnreadCount } = usePortalNotifications();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      mutationRequestRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (mountedRef.current && !controller.signal.aborted) {
        setLoadState({ kind: "loading" });
      }
    });

    void getPortalNotifications(filter, pageNumber, controller.signal)
      .then((nextState) => {
        if (mountedRef.current && !controller.signal.aborted) {
          setLoadState(nextState);
        }
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        if (mountedRef.current && !controller.signal.aborted) {
          setLoadState({ kind: "unavailable" });
        }
      });

    return () => controller.abort();
  }, [filter, pageNumber, reloadKey]);

  const page = loadState.kind === "ready" ? loadState.page : null;
  const notifications = page?.items ?? [];
  const filterDefinitionValue = useMemo(() => filterDefinition(filter), [filter]);
  const hasPreviousPage = pageNumber > 1;
  const hasNextPage = page
    ? pageNumber * page.page_size < page.total
    : false;
  const expandedNotification = notifications.find(
    (notification) => notification.id === expandedId,
  );

  const applyNotification = (nextNotification: NotificationSchema) => {
    setLoadState((currentState) => {
      if (currentState.kind !== "ready") return currentState;

      return {
        kind: "ready",
        page: {
          ...currentState.page,
          items: currentState.page.items.map((notification) =>
            notification.id === nextNotification.id
              ? nextNotification
              : notification,
          ),
        },
      };
    });
  };

  const runMutation = async (
    kind: "read" | "archive",
    notification: NotificationSchema,
  ) => {
    if (mutation?.state === "pending") return;

    const expectedStatus = notification.status;
    const previousMutation = mutation;
    let idempotencyKey: IdempotencyKey | null;

    try {
      idempotencyKey =
        previousMutation?.notificationId === notification.id &&
        previousMutation.kind === kind &&
        previousMutation.expectedStatus === expectedStatus &&
        previousMutation.key
          ? previousMutation.key
          : createIdempotencyKey();
    } catch {
      setMutation({
        kind,
        notificationId: notification.id,
        expectedStatus,
        key: null,
        state: "error",
        message: "This action is temporarily unavailable. Please try again later.",
      });
      return;
    }

    if (!idempotencyKey) return;

    setMutation({
      kind,
      notificationId: notification.id,
      expectedStatus,
      key: idempotencyKey,
      state: "pending",
    });
    mutationRequestRef.current?.abort();
    const controller = new AbortController();
    mutationRequestRef.current = controller;

    let result;
    try {
      result =
        kind === "read"
          ? await markPortalNotificationRead(
              notification.id,
              expectedStatus,
              idempotencyKey,
              controller.signal,
            )
          : await archivePortalNotification(
              notification.id,
              expectedStatus,
              idempotencyKey,
              controller.signal,
            );
    } catch (error) {
      if (isAbortError(error)) return;
      if (!mountedRef.current || controller.signal.aborted) return;
      if (mutationRequestRef.current === controller) {
        mutationRequestRef.current = null;
      }
      setMutation({
        kind,
        notificationId: notification.id,
        expectedStatus,
        key: idempotencyKey,
        state: "error",
        message: "We couldn’t update this notification. Try again.",
      });
      return;
    }

    if (!mountedRef.current || controller.signal.aborted) return;
    if (mutationRequestRef.current === controller) {
      mutationRequestRef.current = null;
    }

    if (result.kind === "success") {
      applyNotification(result.notification);
      setMutation(null);
      void refreshUnreadCount();
      if (kind === "archive" || (kind === "read" && filter === "unread")) {
        setExpandedId(null);
        setReloadKey((value) => value + 1);
      }
      return;
    }

    if (result.kind === "conflict") {
      setMutation(null);
      setReloadKey((value) => value + 1);
      return;
    }

    setMutation({
      kind,
      notificationId: notification.id,
      expectedStatus,
      key: idempotencyKey,
      state: "error",
      message: "We couldn’t update this notification. Try again.",
    });
  };

  const handleToggle = (notification: NotificationSchema) => {
    const isOpening = expandedId !== notification.id;
    setExpandedId(isOpening ? notification.id : null);

    if (isOpening && notification.status === "unread") {
      void runMutation("read", notification);
    }
  };

  const handleArchive = (notification: NotificationSchema) => {
    void runMutation("archive", notification);
  };

  const handleRetry = (notification: NotificationSchema) => {
    const retryKind =
      mutation?.notificationId === notification.id ? mutation.kind : "read";
    void runMutation(retryKind, notification);
  };

  if (loadState.kind === "loading") return <NotificationsLoading />;
  if (loadState.kind === "unavailable") {
    return (
      <NotificationsUnavailable
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return (
    <section aria-labelledby="portal-notifications-heading" className="portal-notifications">
      <header className="portal-notifications__header">
        <h1 id="portal-notifications-heading">Notifications</h1>
        <p>Updates sent to your COMPASS account.</p>
      </header>

      <nav aria-label="Notification views" className="portal-notifications__filters">
        {FILTERS.map((entry) => (
          <Link
            aria-current={entry.value === filter ? "page" : undefined}
            className={`portal-notifications__filter${entry.value === filter ? " is-current" : ""}`}
            href={filterHref(entry.value)}
            key={entry.value}
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      {notifications.length === 0 ? (
        <NotificationsEmpty filter={filter} />
      ) : (
        <>
          <ul aria-label={`${filterDefinitionValue.label} notifications`} className="portal-notifications__list">
            {notifications.map((notification) => (
              <NotificationRow
                expanded={notification.id === expandedId}
                key={notification.id}
                mutation={mutation}
                notification={notification}
                onArchive={handleArchive}
                onRetry={handleRetry}
                onToggle={handleToggle}
              />
            ))}
          </ul>

          {page && (hasPreviousPage || hasNextPage) ? (
            <nav aria-label="Notification pages" className="portal-notifications__pagination">
              {hasPreviousPage ? (
                <Link className="portal-notifications__pagination-link" href={filterHref(filter, pageNumber - 1)}>
                  <ChevronLeft aria-hidden="true" />
                  Previous
                </Link>
              ) : (
                <span aria-hidden="true" />
              )}
              <span aria-current="page" className="portal-notifications__pagination-current">
                Page {pageNumber} of {Math.max(1, Math.ceil(page.total / page.page_size))}
              </span>
              {hasNextPage ? (
                <Link className="portal-notifications__pagination-link" href={filterHref(filter, pageNumber + 1)}>
                  Next
                  <ChevronRight aria-hidden="true" />
                </Link>
              ) : (
                <span aria-hidden="true" />
              )}
            </nav>
          ) : null}
        </>
      )}

      {expandedNotification ? <span className="sr-only">Notification expanded.</span> : null}
    </section>
  );
}
