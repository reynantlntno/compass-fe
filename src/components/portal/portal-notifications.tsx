"use client";

import Link from "next/link";
import {
  Archive,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
import { PortalListRow } from "@/components/portal/portal-list-row";
import { PortalPageHeader } from "@/components/portal/portal-page-header";
import { PortalViewMenu } from "@/components/portal/portal-view-menu";
import { usePortalNotifications } from "@/components/portal/portal-notifications-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  NotificationPageSchema,
  NotificationSchema,
} from "@/lib/api/generated/model";
import {
  archivePortalNotifications,
  archivePortalNotification,
  getPortalNotifications,
  markPortalNotificationRead,
  type PortalNotificationFilter,
  type PortalNotificationBulkArchiveItem,
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

type BulkNotificationMutation = {
  scope: string;
  items: PortalNotificationBulkArchiveItem[];
  key: IdempotencyKey | null;
  state: "pending" | "error";
  message: string;
};

type BulkNotificationNotice = {
  scope: string;
  kind: "success" | "error";
  message: string;
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

const NOTIFICATION_VIEW_ITEMS = FILTERS.map((entry) => ({
  href: filterHref(entry.value),
  label: entry.label,
  value: entry.value,
}));

function notificationPriorityLabel(priority: NotificationSchema["priority"]) {
  switch (priority) {
    case "urgent":
      return "Urgent";
    case "high":
      return "High";
    default:
      return null;
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
      <PortalPageHeader
        className="portal-notifications__header"
        current="Notifications"
        description={
          <Skeleton
            as="span"
            aria-hidden="true"
            className="portal-notifications__skeleton-summary"
          />
        }
        headingId="portal-notifications-heading"
        title={
          <Skeleton
            as="span"
            aria-hidden="true"
            className="portal-notifications__skeleton-heading"
          />
        }
      />
      <PortalViewMenu
        activeValue="all"
        ariaLabel="Notification views"
        className="portal-notifications__view-menu--loading"
        items={NOTIFICATION_VIEW_ITEMS}
      />
      <PortalCollectionFrame className="portal-notifications__inbox">
        <div aria-hidden="true" className="portal-notifications__skeleton-list">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="portal-notifications__skeleton-row" key={index}>
              <Skeleton />
              <Skeleton />
            </div>
          ))}
        </div>
      </PortalCollectionFrame>
    </section>
  );
}

export function PortalNotificationsLoading() {
  return <NotificationsLoading />;
}

function NotificationsUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <section
      aria-labelledby="portal-notifications-heading"
      className="portal-notifications"
    >
      <PortalPageHeader
        className="portal-notifications__header"
        current="Notifications"
        description="Updates sent to your COMPASS account."
        headingId="portal-notifications-heading"
        title="Notifications"
      />
      <PortalCollectionFrame className="portal-notifications__inbox">
        <div
          aria-labelledby="portal-notifications-unavailable-heading"
          className="portal-notifications__state"
          role="status"
        >
          <h2 id="portal-notifications-unavailable-heading">
            Notifications are unavailable right now.
          </h2>
          <p>Try again when the connection is ready.</p>
          <Button onClick={onRetry} type="button" variant="outline">
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        </div>
      </PortalCollectionFrame>
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
      <h2 id="portal-notifications-empty-heading">{definition.emptyTitle}</h2>
      <p>{definition.emptyDescription}</p>
    </section>
  );
}

function NotificationRow({
  expanded,
  mutation,
  notification,
  selected,
  selectionDisabled,
  onArchive,
  onRetry,
  onSelect,
  onToggle,
}: {
  expanded: boolean;
  mutation: NotificationMutation | null;
  notification: NotificationSchema;
  selected: boolean;
  selectionDisabled: boolean;
  onArchive: (notification: NotificationSchema) => void;
  onRetry: (notification: NotificationSchema) => void;
  onSelect: (selected: boolean) => void;
  onToggle: (notification: NotificationSchema) => void;
}) {
  const formattedDate = formatNotificationDate(notification.created_at);
  const priorityLabel = notificationPriorityLabel(notification.priority);
  const detailsId = `notification-details-${notification.id}`;
  const mutationForRow =
    mutation?.notificationId === notification.id ? mutation : null;
  const isUpdating = mutationForRow?.state === "pending";
  const isSelectable = notification.status !== "archived";

  return (
    <PortalListRow
      className={`portal-notification${notification.status === "unread" ? " is-unread" : ""}`}
      data-status={notification.status}
    >
      <div className="portal-notification__row">
        {isSelectable ? (
          <Checkbox
            aria-label={`Select notification: ${notification.title}`}
            checked={selected}
            className="portal-notification__selection-checkbox"
            disabled={selectionDisabled}
            onCheckedChange={(checked) => onSelect(checked === true)}
          />
        ) : (
          <span
            aria-hidden="true"
            className="portal-notification__selection-placeholder"
          />
        )}
        <button
          aria-controls={detailsId}
          aria-expanded={expanded}
          className="portal-notification__toggle"
          disabled={selectionDisabled}
          onClick={() => onToggle(notification)}
          type="button"
        >
          <span className="portal-notification__toggle-copy">
            {priorityLabel || notification.status === "archived" ? (
              <span className="portal-notification__meta">
                {priorityLabel ? (
                  <Badge className="portal-notification__priority" variant="outline">
                    {priorityLabel}
                  </Badge>
                ) : null}
                {notification.status === "archived" ? (
                  <Badge className="portal-notification__archived" variant="ghost">
                    Archived
                  </Badge>
                ) : null}
              </span>
            ) : null}
            <span className="portal-notification__title">
              {notification.status === "unread" ? (
                <span className="sr-only">Unread notification: </span>
              ) : null}
              {notification.title}
            </span>
            {!expanded ? (
              <span className="portal-notification__preview">
                {notification.body_preview}
              </span>
            ) : null}
          </span>
          <span className="portal-notification__toggle-date">
            {formattedDate ? (
              <time dateTime={notification.created_at ?? undefined}>
                {formattedDate}
              </time>
            ) : null}
            <span aria-hidden="true" className="portal-notification__toggle-indicator">
              <ChevronDown className={expanded ? "is-expanded" : undefined} />
            </span>
          </span>
        </button>
      </div>

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
    </PortalListRow>
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
  const [selection, setSelection] = useState<{
    scope: string;
    ids: Set<string>;
  }>({ scope: "", ids: new Set() });
  const [bulkMutation, setBulkMutation] = useState<BulkNotificationMutation | null>(null);
  const [bulkNotice, setBulkNotice] = useState<BulkNotificationNotice | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const mutationRequestRef = useRef<AbortController | null>(null);
  const bulkMutationRequestRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const {
    refreshUnreadCount,
    status: unreadCountStatus,
    unreadCount,
  } = usePortalNotifications();
  const visibleUnreadCount =
    unreadCountStatus === "ready" &&
    typeof unreadCount === "number" &&
    Number.isSafeInteger(unreadCount) &&
    unreadCount > 0
      ? unreadCount
      : null;
  const unreadCountLabel =
    visibleUnreadCount !== null && visibleUnreadCount > 99
      ? "99+"
      : visibleUnreadCount !== null
        ? String(visibleUnreadCount)
        : null;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      mutationRequestRef.current?.abort();
      bulkMutationRequestRef.current?.abort();
    };
  }, []);

  const viewScope = `${filter}:${pageNumber}`;
  const selectionScope = `${viewScope}:${reloadKey}`;
  const selectedIds =
    selection.scope === selectionScope ? selection.ids : new Set<string>();
  const currentBulkMutation =
    bulkMutation?.scope === selectionScope ? bulkMutation : null;
  const currentBulkNotice = bulkNotice?.scope === viewScope ? bulkNotice : null;

  useEffect(() => {
    bulkMutationRequestRef.current?.abort();
  }, [selectionScope]);

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
  const eligibleNotifications = notifications.filter(
    (notification) => notification.status === "unread" || notification.status === "read",
  );
  const selectedNotifications = eligibleNotifications.filter((notification) =>
    selectedIds.has(notification.id),
  );
  const selectedCount = selectedNotifications.length;
  const allSelected =
    eligibleNotifications.length > 0 &&
    selectedCount === eligibleNotifications.length;
  const partiallySelected = selectedCount > 0 && !allSelected;
  const selectedBulkItems = useMemo<PortalNotificationBulkArchiveItem[]>(
    () =>
      selectedNotifications
        .map((notification) => ({
          notification_id: notification.id,
          expected_status: notification.status as "unread" | "read",
        }))
        .sort((left, right) =>
          left.notification_id.localeCompare(right.notification_id),
        ),
    [selectedNotifications],
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

  const handleSelect = (notification: NotificationSchema, selected: boolean) => {
    if (notification.status === "archived" || currentBulkMutation?.state === "pending") return;
    setBulkMutation(null);
    setBulkNotice(null);
    setSelection((current) => {
      const next = new Set(current.scope === selectionScope ? current.ids : []);
      if (selected) next.add(notification.id);
      else next.delete(notification.id);
      return { scope: selectionScope, ids: next };
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (currentBulkMutation?.state === "pending") return;
    setBulkMutation(null);
    setBulkNotice(null);
    setSelection({
      scope: selectionScope,
      ids: selected
        ? new Set(eligibleNotifications.map((notification) => notification.id))
        : new Set(),
    });
  };

  const sameBulkItems = (
    left: readonly PortalNotificationBulkArchiveItem[],
    right: readonly PortalNotificationBulkArchiveItem[],
  ) =>
    left.length === right.length &&
    left.every(
      (item, index) =>
        item.notification_id === right[index]?.notification_id &&
        item.expected_status === right[index]?.expected_status,
    );

  const runBulkArchive = async () => {
    if (
      selectedBulkItems.length === 0 ||
      mutation?.state === "pending" ||
      currentBulkMutation?.state === "pending"
    ) {
      return;
    }

    const previousMutation = currentBulkMutation;
    let idempotencyKey: IdempotencyKey | null;
    try {
      idempotencyKey =
        previousMutation?.key && sameBulkItems(previousMutation.items, selectedBulkItems)
          ? previousMutation.key
          : createIdempotencyKey();
    } catch {
      setBulkMutation({
        scope: selectionScope,
        items: selectedBulkItems,
        key: null,
        state: "error",
        message: "This action is temporarily unavailable. Please try again later.",
      });
      return;
    }

    if (!idempotencyKey) return;

    setBulkMutation({
      scope: selectionScope,
      items: selectedBulkItems,
      key: idempotencyKey,
      state: "pending",
      message: "Archiving selected notifications…",
    });
    bulkMutationRequestRef.current?.abort();
    const controller = new AbortController();
    bulkMutationRequestRef.current = controller;

    let result;
    try {
      result = await archivePortalNotifications(
        selectedBulkItems,
        idempotencyKey,
        controller.signal,
      );
    } catch (error) {
      if (isAbortError(error)) return;
      if (!mountedRef.current || controller.signal.aborted) return;
      if (bulkMutationRequestRef.current === controller) {
        bulkMutationRequestRef.current = null;
      }
      setBulkMutation({
        scope: selectionScope,
        items: selectedBulkItems,
        key: idempotencyKey,
        state: "error",
        message: "We couldn’t archive the selected notifications. Try again.",
      });
      return;
    }

    if (!mountedRef.current || controller.signal.aborted) return;
    if (bulkMutationRequestRef.current === controller) {
      bulkMutationRequestRef.current = null;
    }

    if (result.kind === "success") {
      setSelection({ scope: selectionScope, ids: new Set() });
      setBulkMutation(null);
      setBulkNotice({
        scope: viewScope,
        kind: "success",
        message: `${result.count} notification${result.count === 1 ? "" : "s"} archived.`,
      });
      setExpandedId(null);
      setReloadKey((value) => value + 1);
      void refreshUnreadCount();
      return;
    }

    if (result.kind === "conflict") {
      setSelection({ scope: selectionScope, ids: new Set() });
      setBulkMutation(null);
      setBulkNotice({
        scope: viewScope,
        kind: "error",
        message: "Some selected notifications changed. Refresh the list and select them again.",
      });
      setExpandedId(null);
      setReloadKey((value) => value + 1);
      return;
    }

    setBulkMutation({
      scope: selectionScope,
      items: selectedBulkItems,
      key: idempotencyKey,
      state: "error",
      message: "We couldn’t archive the selected notifications. Try again.",
    });
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
      <PortalPageHeader
        className="portal-notifications__header"
        current="Notifications"
        description="Updates sent to your COMPASS account."
        headingId="portal-notifications-heading"
        meta={
          unreadCountLabel ? (
            <span
              aria-label={`${unreadCountLabel} unread notifications`}
              className="portal-notifications__unread-summary"
            >
              {unreadCountLabel} unread
            </span>
          ) : null
        }
        title="Notifications"
      />

      <PortalViewMenu
        activeValue={filter}
        ariaLabel="Notification views"
        items={NOTIFICATION_VIEW_ITEMS}
      />

      <PortalCollectionFrame className="portal-notifications__inbox">
        {notifications.length === 0 ? (
          <NotificationsEmpty filter={filter} />
        ) : (
          <>
            {eligibleNotifications.length > 0 ? (
              <div
                aria-busy={currentBulkMutation?.state === "pending"}
                aria-label="Notification selection"
                className="portal-notifications__selection-toolbar"
              >
                <label className="portal-notifications__selection-control">
                  <Checkbox
                    aria-label="Select all notifications on this page"
                    checked={allSelected}
                    className="portal-notifications__selection-checkbox"
                    disabled={currentBulkMutation?.state === "pending"}
                    indeterminate={partiallySelected}
                    onCheckedChange={(checked) => handleSelectAll(checked === true)}
                  />
                  <span>Select all on this page</span>
                </label>
                <div className="portal-notifications__selection-actions">
                  {selectedCount > 0 ? (
                    <span className="portal-notifications__selection-count">
                      {selectedCount} selected
                    </span>
                  ) : null}
                  {selectedCount > 0 ? (
                    <Button
                      disabled={
                        mutation?.state === "pending" ||
                        currentBulkMutation?.state === "pending"
                      }
                      onClick={() => void runBulkArchive()}
                      type="button"
                      variant="outline"
                    >
                      <Archive aria-hidden="true" />
                      Archive selected
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {currentBulkMutation?.state === "error" ? (
              <div
                aria-live="polite"
                className="portal-notifications__bulk-error"
                role="alert"
              >
                <p>{currentBulkMutation.message}</p>
                <Button onClick={() => void runBulkArchive()} type="button" variant="outline">
                  Try again
                </Button>
              </div>
            ) : null}
            {currentBulkNotice ? (
              <p
                aria-live="polite"
                className={`portal-notifications__bulk-notice is-${currentBulkNotice.kind}`}
                role={currentBulkNotice.kind === "error" ? "alert" : "status"}
              >
                {currentBulkNotice.message}
              </p>
            ) : null}
            <ul aria-label={`${filterDefinitionValue.label} notifications`} className="portal-notifications__list">
              {notifications.map((notification) => (
                <NotificationRow
                  expanded={notification.id === expandedId}
                  key={notification.id}
                  mutation={mutation}
                  notification={notification}
                  selected={selectedIds.has(notification.id)}
                  selectionDisabled={currentBulkMutation?.state === "pending"}
                  onArchive={handleArchive}
                  onRetry={handleRetry}
                  onSelect={(selected) => handleSelect(notification, selected)}
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
      </PortalCollectionFrame>

      {expandedNotification ? <span className="sr-only">Notification expanded.</span> : null}
    </section>
  );
}
