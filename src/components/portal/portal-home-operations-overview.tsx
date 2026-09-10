"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  DatabaseBackup,
  RefreshCw,
  Wrench,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { PortalHomeWidget } from "@/components/portal/portal-home-widget";
import { usePortalAccess } from "@/components/portal/portal-access-provider";
import { PORTAL_CAPABILITIES } from "@/components/portal/portal-navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  BackupDashboardSchema,
  MaintenancePageSchema,
  SystemErrorPageSchema,
  TechnicalDeliveryPageSchema,
} from "@/lib/api/generated/model";
import { getBackupsDashboard } from "@/lib/api/backups";
import { getPortalNotificationDelivery as getDeliveryPage } from "@/lib/api/notification-delivery";
import {
  getSystemMaintenance,
  getUnresolvedSystemErrors,
} from "@/lib/api/system-operations";

type HomeSourceState<T> =
  | { kind: "loading" }
  | { kind: "ready"; data: T }
  | { kind: "unavailable" };

type HomeSource<T> = {
  retry: () => void;
  state: HomeSourceState<T>;
};

type MaintenanceWindow = MaintenancePageSchema["items"][number];

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function useHomeSource<T>(
  enabled: boolean,
  loader: (signal: AbortSignal) => Promise<T>,
) {
  const [state, setState] = useState<HomeSourceState<T>>({ kind: "loading" });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    let active = true;

    void Promise.resolve()
      .then(() => {
        if (!active) return null;
        setState({ kind: "loading" });
        return loader(controller.signal);
      })
      .then((data) => {
        if (active && data) setState({ kind: "ready", data });
      })
      .catch((error: unknown) => {
        if (active && !isAbortError(error)) setState({ kind: "unavailable" });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [enabled, loader, retryCount]);

  return {
    retry: () => {
      setState({ kind: "loading" });
      setRetryCount((value) => value + 1);
    },
    state,
  };
}

function loadUnresolvedErrors(signal: AbortSignal) {
  return getUnresolvedSystemErrors(1, signal);
}

function loadFailedDeliveries(signal: AbortSignal) {
  return getDeliveryPage(1, { status: "failed" }, signal);
}

function loadDeadDeliveries(signal: AbortSignal) {
  return getDeliveryPage(1, { status: "dead" }, signal);
}

function loadBackups(signal: AbortSignal) {
  return getBackupsDashboard(signal);
}

function loadMaintenance(signal: AbortSignal) {
  return getSystemMaintenance(1, signal);
}

function formatLabel(value: string) {
  const words = value
    .trim()
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ");
  if (!words) return "Unavailable";
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function selectMaintenanceWindow(data: MaintenancePageSchema) {
  const now = Date.now();
  const active =
    data.items.find(
      (item) => item.status === "active" && !item.is_expired,
    ) ?? null;
  const nextScheduled = data.items
    .filter((item) => {
      if (item.status !== "scheduled" || !item.starts_at) return false;
      const startsAt = new Date(item.starts_at).getTime();
      return !Number.isNaN(startsAt) && startsAt >= now;
    })
    .sort((left, right) => {
      const leftStart = left.starts_at ? new Date(left.starts_at).getTime() : Infinity;
      const rightStart = right.starts_at ? new Date(right.starts_at).getTime() : Infinity;
      return leftStart - rightStart;
    })[0] ?? null;

  return { active, nextScheduled };
}

function formatWindow(window: MaintenanceWindow | null) {
  if (!window) return "No scheduled window";

  const start = formatTimestamp(window.starts_at);
  const end = formatTimestamp(window.ends_at);
  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  if (end) return `Ends ${end}`;
  return "Time unavailable";
}

function OperationsFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="portal-home__operations-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function SourceValue<T>({
  label,
  onRetry,
  render,
  state,
}: {
  label: string;
  onRetry: () => void;
  render: (data: T) => ReactNode;
  state: HomeSourceState<T>;
}) {
  if (state.kind === "loading") {
    return (
      <Skeleton
        aria-hidden="true"
        className="portal-home__operations-skeleton"
      />
    );
  }

  if (state.kind === "unavailable") {
    return (
      <div className="portal-home__operations-unavailable">
        <span>Unavailable</span>
        <Button
          aria-label={`Try again: ${label}`}
          className="portal-home__operations-retry"
          onClick={onRetry}
          size="xs"
          type="button"
          variant="outline"
        >
          <RefreshCw aria-hidden="true" />
          Try again
        </Button>
      </div>
    );
  }

  return render(state.data);
}

function SourceUnavailable({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="portal-home__operations-unavailable">
      <span>{label} unavailable</span>
      <Button
        aria-label={`Try again: ${label}`}
        className="portal-home__operations-retry"
        onClick={onRetry}
        size="xs"
        type="button"
        variant="outline"
      >
        <RefreshCw aria-hidden="true" />
        Try again
      </Button>
    </div>
  );
}

function OperationsCardHeader({
  actionLabel,
  headingId,
  href,
  title,
}: {
  actionLabel: string;
  headingId: string;
  href: string;
  title: string;
}) {
  return (
    <div className="portal-home__operations-card-header">
      <h3 id={headingId}>{title}</h3>
      <Link className="portal-home__section-link" href={href}>
        <span>{actionLabel}</span>
        <ArrowRight aria-hidden="true" />
      </Link>
    </div>
  );
}

function OperationalAttentionCard({
  backups,
  canBackups,
  canDelivery,
  canErrors,
  deadDeliveries,
  errors,
  failedDeliveries,
  onRetryBackups,
  onRetryDeadDeliveries,
  onRetryErrors,
  onRetryFailedDeliveries,
}: {
  backups: HomeSource<BackupDashboardSchema>;
  canBackups: boolean;
  canDelivery: boolean;
  canErrors: boolean;
  deadDeliveries: HomeSource<TechnicalDeliveryPageSchema>;
  errors: HomeSource<SystemErrorPageSchema>;
  failedDeliveries: HomeSource<TechnicalDeliveryPageSchema>;
  onRetryBackups: () => void;
  onRetryDeadDeliveries: () => void;
  onRetryErrors: () => void;
  onRetryFailedDeliveries: () => void;
}) {
  const href = canErrors
    ? "/portal/system-operations?section=errors"
    : canDelivery
      ? "/portal/notification-delivery?status=failed"
      : "/portal/backups?section=jobs";

  return (
    <PortalHomeWidget
      aria-labelledby="portal-home-operations-attention-heading"
      className="portal-home__operations-card"
      tone="surface"
      watermarkIcon={AlertTriangle}
    >
      <OperationsCardHeader
        actionLabel="Review attention"
        headingId="portal-home-operations-attention-heading"
        href={href}
        title="Operational attention"
      />
      <dl className="portal-home__operations-facts">
        {canErrors ? (
          <OperationsFact label="Unresolved errors">
            <SourceValue<SystemErrorPageSchema>
              label="unresolved errors"
              onRetry={onRetryErrors}
              render={(data) => String(data.total)}
              state={errors.state}
            />
          </OperationsFact>
        ) : null}
        {canDelivery ? (
          <OperationsFact label="Failed deliveries">
            <SourceValue<TechnicalDeliveryPageSchema>
              label="failed deliveries"
              onRetry={onRetryFailedDeliveries}
              render={(data) => String(data.total)}
              state={failedDeliveries.state}
            />
          </OperationsFact>
        ) : null}
        {canDelivery ? (
          <OperationsFact label="Dead deliveries">
            <SourceValue<TechnicalDeliveryPageSchema>
              label="dead deliveries"
              onRetry={onRetryDeadDeliveries}
              render={(data) => String(data.total)}
              state={deadDeliveries.state}
            />
          </OperationsFact>
        ) : null}
        {canBackups ? (
          <OperationsFact label="Failed backup jobs">
            <SourceValue<BackupDashboardSchema>
              label="failed backup jobs"
              onRetry={onRetryBackups}
              render={(data) => String(data.backups.failed_count)}
              state={backups.state}
            />
          </OperationsFact>
        ) : null}
      </dl>
    </PortalHomeWidget>
  );
}

function BackupsRestoreCard({
  backups,
  onRetry,
}: {
  backups: HomeSource<BackupDashboardSchema>;
  onRetry: () => void;
}) {
  return (
    <PortalHomeWidget
      aria-labelledby="portal-home-operations-backups-heading"
      className="portal-home__operations-card"
      tone="surface"
      watermarkIcon={DatabaseBackup}
    >
      <OperationsCardHeader
        actionLabel="Open backups"
        headingId="portal-home-operations-backups-heading"
        href="/portal/backups?section=overview"
        title="Backups & restore"
      />
      {backups.state.kind === "unavailable" ? (
        <SourceUnavailable label="Backup summary" onRetry={onRetry} />
      ) : (
        <dl className="portal-home__operations-facts">
          <OperationsFact label="Latest backup">
            <SourceValue<BackupDashboardSchema>
              label="latest backup"
              onRetry={onRetry}
              render={(data) =>
                data.backups.latest_job ? (
                  <Badge
                    className="portal-home__operations-badge"
                    data-operations-status={data.backups.latest_job.status}
                    variant="outline"
                  >
                    {formatLabel(data.backups.latest_job.status)}
                  </Badge>
                ) : (
                  "No backup jobs yet"
                )
              }
              state={backups.state}
            />
          </OperationsFact>
          <OperationsFact label="Queued or running">
            <SourceValue<BackupDashboardSchema>
              label="queued or running backups"
              onRetry={onRetry}
              render={(data) => String(data.backups.queued_or_running_count)}
              state={backups.state}
            />
          </OperationsFact>
          <OperationsFact label="Failed jobs">
            <SourceValue<BackupDashboardSchema>
              label="failed backup jobs"
              onRetry={onRetry}
              render={(data) => String(data.backups.failed_count)}
              state={backups.state}
            />
          </OperationsFact>
          {backups.state.kind === "ready" && backups.state.data.restores ? (
            <OperationsFact label="Active restores">
              {String(backups.state.data.restores.active_count)}
            </OperationsFact>
          ) : backups.state.kind === "loading" ? (
            <OperationsFact label="Active restores">
              <SourceValue<BackupDashboardSchema>
                label="active restores"
                onRetry={onRetry}
                render={(data) =>
                  data.restores ? String(data.restores.active_count) : "Not available"
                }
                state={backups.state}
              />
            </OperationsFact>
          ) : null}
        </dl>
      )}
    </PortalHomeWidget>
  );
}

function MaintenanceCard({
  maintenance,
  onRetry,
}: {
  maintenance: HomeSource<MaintenancePageSchema>;
  onRetry: () => void;
}) {
  return (
    <PortalHomeWidget
      aria-labelledby="portal-home-operations-maintenance-heading"
      className="portal-home__operations-card"
      tone="surface"
      watermarkIcon={Wrench}
    >
      <OperationsCardHeader
        actionLabel="Open maintenance"
        headingId="portal-home-operations-maintenance-heading"
        href="/portal/system-operations?section=maintenance"
        title="Maintenance"
      />
      {maintenance.state.kind === "unavailable" ? (
        <SourceUnavailable label="Maintenance summary" onRetry={onRetry} />
      ) : (
        <dl className="portal-home__operations-facts">
          <OperationsFact label="Current status">
            <SourceValue<MaintenancePageSchema>
              label="maintenance status"
              onRetry={onRetry}
              render={(data) => {
                const summary = selectMaintenanceWindow(data);
                return (
                  <Badge
                    className="portal-home__operations-badge"
                    data-operations-status={summary.active ? "active" : "none"}
                    variant="outline"
                  >
                    {summary.active ? "Active" : "No active window"}
                  </Badge>
                );
              }}
              state={maintenance.state}
            />
          </OperationsFact>
          {maintenance.state.kind === "ready" &&
          selectMaintenanceWindow(maintenance.state.data).active ? (
            <OperationsFact label="Active window">
              <SourceValue<MaintenancePageSchema>
                label="active maintenance window"
                onRetry={onRetry}
                render={(data) => formatWindow(selectMaintenanceWindow(data).active)}
                state={maintenance.state}
              />
            </OperationsFact>
          ) : null}
          <OperationsFact label="Next window">
            <SourceValue<MaintenancePageSchema>
              label="next maintenance window"
              onRetry={onRetry}
              render={(data) => formatWindow(selectMaintenanceWindow(data).nextScheduled)}
              state={maintenance.state}
            />
          </OperationsFact>
          <OperationsFact label="Public message">
            <SourceValue<MaintenancePageSchema>
              label="maintenance message"
              onRetry={onRetry}
              render={(data) => {
                const summary = selectMaintenanceWindow(data);
                return (
                  summary.active?.safe_public_message ||
                  summary.nextScheduled?.safe_public_message ||
                  "No message provided"
                );
              }}
              state={maintenance.state}
            />
          </OperationsFact>
        </dl>
      )}
    </PortalHomeWidget>
  );
}

export function PortalHomeOperationsOverview() {
  const { hasCapability, status } = usePortalAccess();
  const accessReady = status === "ready";
  const canBackups = accessReady && hasCapability(PORTAL_CAPABILITIES.backupsView);
  const canDelivery =
    accessReady &&
    hasCapability(PORTAL_CAPABILITIES.notificationsDeliveryOperate);
  const canOperations =
    accessReady && hasCapability(PORTAL_CAPABILITIES.systemOperationsManage);
  const canErrors =
    canOperations && hasCapability(PORTAL_CAPABILITIES.systemErrorsView);
  const showAttention = canErrors || canDelivery || canBackups;
  const showBackups = canBackups;
  const showMaintenance = canOperations;

  const errors = useHomeSource(canErrors, loadUnresolvedErrors);
  const failedDeliveries = useHomeSource(canDelivery, loadFailedDeliveries);
  const deadDeliveries = useHomeSource(canDelivery, loadDeadDeliveries);
  const backups = useHomeSource(canBackups, loadBackups);
  const maintenance = useHomeSource(showMaintenance, loadMaintenance);
  const isLoading =
    (canErrors && errors.state.kind === "loading") ||
    (canDelivery &&
      (failedDeliveries.state.kind === "loading" ||
        deadDeliveries.state.kind === "loading")) ||
    (canBackups && backups.state.kind === "loading") ||
    (showMaintenance && maintenance.state.kind === "loading");

  if (!accessReady || (!showAttention && !showBackups && !showMaintenance)) {
    return null;
  }

  return (
    <section
      aria-labelledby="portal-home-operations-heading"
      aria-busy={isLoading || undefined}
      className="portal-home__operations"
    >
      <h2 className="sr-only" id="portal-home-operations-heading">
        IT admin overview: Operations at a glance
      </h2>
      <div className="portal-home__operations-grid">
        {showAttention ? (
          <OperationalAttentionCard
            backups={backups}
            canBackups={canBackups}
            canDelivery={canDelivery}
            canErrors={canErrors}
            deadDeliveries={deadDeliveries}
            errors={errors}
            failedDeliveries={failedDeliveries}
            onRetryBackups={backups.retry}
            onRetryDeadDeliveries={deadDeliveries.retry}
            onRetryErrors={errors.retry}
            onRetryFailedDeliveries={failedDeliveries.retry}
          />
        ) : null}
        {showBackups ? <BackupsRestoreCard backups={backups} onRetry={backups.retry} /> : null}
        {showMaintenance ? (
          <MaintenanceCard maintenance={maintenance} onRetry={maintenance.retry} />
        ) : null}
      </div>
    </section>
  );
}
