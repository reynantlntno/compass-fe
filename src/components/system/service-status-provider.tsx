"use client";

import { CalendarClock, CircleAlert, Construction, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { systemPublicStatus } from "@/lib/api/generated/system/system";
import {
  normalizePublicServiceStatusResponse,
  type ServiceStatusView,
} from "@/lib/system-status";

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function formatMaintenanceWindow(startsAt: string, endsAt: string): string {
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `${formatter.format(new Date(startsAt))}–${formatter.format(new Date(endsAt))}`;
}

async function requestStatus(signal: AbortSignal): Promise<ServiceStatusView> {
  if (!navigator.onLine) return { kind: "offline" };

  const response = await systemPublicStatus({
    cache: "no-store",
    credentials: "omit",
    signal,
  });

  return normalizePublicServiceStatusResponse(response);
}

function StatusIcon({ kind }: { kind: "scheduled" | "offline" | "unavailable" }) {
  if (kind === "scheduled") return <CalendarClock aria-hidden="true" />;
  if (kind === "offline") return <WifiOff aria-hidden="true" />;
  return <CircleAlert aria-hidden="true" />;
}

function ServiceStatusBanner({ status }: { status: ServiceStatusView }) {
  if (
    status.kind !== "maintenance_scheduled" &&
    status.kind !== "offline" &&
    status.kind !== "unavailable"
  ) {
    return null;
  }

  const isScheduled = status.kind === "maintenance_scheduled";
  const iconKind = isScheduled
    ? "scheduled"
    : status.kind === "offline"
      ? "offline"
      : "unavailable";

  return (
    <aside
      aria-live="polite"
      className={`compass-status-banner compass-status-banner--${iconKind}`}
      role="status"
    >
      <div className="compass-status-banner__inner">
        <StatusIcon kind={iconKind} />
        <div>
          <p className="compass-status-banner__title">
            {isScheduled
              ? "Scheduled maintenance"
              : status.kind === "offline"
                ? "You’re offline"
                : "COMPASS is temporarily unavailable"}
          </p>
          <p className="compass-status-banner__copy">
            {status.kind === "maintenance_scheduled"
              ? `${status.message} ${formatMaintenanceWindow(status.startsAt, status.endsAt)}`
              : status.kind === "offline"
                ? "Check your connection. We’ll reconnect when you’re back online."
                : "Some pages may be unavailable. Please try again shortly."}
          </p>
        </div>
      </div>
    </aside>
  );
}

function MaintenanceScreen({
  status,
  onRetry,
}: {
  status: Extract<ServiceStatusView, { kind: "maintenance_active" }>;
  onRetry: () => void;
}) {
  return (
    <main aria-labelledby="maintenance-heading" className="compass-maintenance-screen">
      <div className="compass-maintenance-screen__content">
        <Construction aria-hidden="true" className="compass-maintenance-screen__icon" />
        <p className="compass-maintenance-screen__eyebrow">COMPASS</p>
        <h1 id="maintenance-heading">We’ll be back soon.</h1>
        <p>{status.message}</p>
        <p className="compass-maintenance-screen__schedule">
          Current maintenance window: {formatMaintenanceWindow(status.startsAt, status.endsAt)}
        </p>
        <button className="compass-status-action" onClick={onRetry} type="button">
          Check again
        </button>
      </div>
    </main>
  );
}

export function ServiceStatusProvider({
  children,
  initialStatus,
}: {
  children: React.ReactNode;
  initialStatus: ServiceStatusView;
}) {
  const [status, setStatus] = useState<ServiceStatusView>(initialStatus);
  const activeController = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const failureCount = useRef(0);

  useEffect(() => {
    document.documentElement.dataset.compassServiceStatus = status.kind;

    return () => {
      delete document.documentElement.dataset.compassServiceStatus;
    };
  }, [status.kind]);

  const probe = useCallback(() => {
    const currentSequence = sequence.current + 1;
    sequence.current = currentSequence;
    activeController.current?.abort();

    if (!navigator.onLine) {
      failureCount.current = 0;
      setStatus({ kind: "offline" });
      return;
    }

    const controller = new AbortController();
    activeController.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 5_000);

    requestStatus(controller.signal)
      .then((nextStatus) => {
        if (sequence.current !== currentSequence) return;
        failureCount.current =
          nextStatus.kind === "unavailable"
            ? Math.min(failureCount.current + 1, 5)
            : 0;
        setStatus(nextStatus);
      })
      .catch((error: unknown) => {
        if (isAbortError(error) || sequence.current !== currentSequence) return;
        failureCount.current = Math.min(failureCount.current + 1, 5);
        setStatus({ kind: "unavailable" });
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        if (activeController.current === controller) activeController.current = null;
      });
  }, []);

  useEffect(() => {
    const handleOffline = () => {
      sequence.current += 1;
      activeController.current?.abort();
      failureCount.current = 0;
      setStatus({ kind: "offline" });
    };
    const handleOnline = () => probe();
    const handleRecovery = () => {
      if (document.visibilityState === "visible") probe();
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleRecovery);
    document.addEventListener("visibilitychange", handleRecovery);

    const initialProbeId = window.setTimeout(probe, 0);

    return () => {
      sequence.current += 1;
      activeController.current?.abort();
      window.clearTimeout(initialProbeId);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleRecovery);
      document.removeEventListener("visibilitychange", handleRecovery);
    };
  }, [probe]);

  useEffect(() => {
    if (status.kind === "unknown" || status.kind === "operational" || status.kind === "offline") {
      return undefined;
    }

    const delay =
      status.kind === "maintenance_scheduled" || status.kind === "maintenance_active"
        ? 60_000
        : Math.min(300_000, 15_000 * 2 ** failureCount.current);
    const timeoutId = window.setTimeout(probe, delay);

    return () => window.clearTimeout(timeoutId);
  }, [probe, status]);

  if (status.kind === "maintenance_active") {
    return <MaintenanceScreen onRetry={probe} status={status} />;
  }

  return (
    <>
      <ServiceStatusBanner status={status} />
      {children}
    </>
  );
}
