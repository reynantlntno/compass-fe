"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { usePortalAccess } from "@/components/portal/portal-access-provider";
import { PortalHomeWidget } from "@/components/portal/portal-home-widget";
import { PORTAL_CAPABILITIES } from "@/components/portal/portal-navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  APPOINTMENT_STATUSES,
  getPortalAppointments,
  type PortalAppointment,
  type PortalAppointmentPage,
} from "@/lib/api/appointments";

const ACTIVE_STATUSES = APPOINTMENT_STATUSES.filter((status) =>
  [
    "APPROVED",
    "SCHEDULED",
    "LATE_CANCELLATION_REQUESTED",
    "LATE_CANCELLATION_DECLINED",
  ].includes(status),
).join(",");

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatAppointmentDate(appointment: PortalAppointment | null) {
  const date = appointment?.confirmed_date ?? appointment?.requested_date;
  if (!date) return "Schedule not set";
  const formattedDate = new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
  }).format(new Date(`${date}T00:00:00`));
  const time = appointment?.confirmed_start_time ?? appointment?.requested_start_time;
  return time ? `${formattedDate} at ${time.slice(0, 5)}` : formattedDate;
}

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

type SourceState =
  | { kind: "loading" }
  | { kind: "ready"; page: PortalAppointmentPage }
  | { kind: "unavailable" };

function useAppointmentsSource(
  enabled: boolean,
  loader: (signal: AbortSignal) => Promise<PortalAppointmentPage>,
) {
  const [state, setState] = useState<SourceState>({ kind: "loading" });
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
      .then((page) => {
        if (page && active && !controller.signal.aborted) {
          setState({ kind: "ready", page });
        }
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        if (active && !controller.signal.aborted) setState({ kind: "unavailable" });
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

function AppointmentSourceValue({
  label,
  onRetry,
  render,
  state,
}: {
  label: string;
  onRetry: () => void;
  render: (page: PortalAppointmentPage) => ReactNode;
  state: SourceState;
}) {
  if (state.kind === "loading") {
    return <Skeleton aria-hidden="true" className="portal-home__operations-skeleton" />;
  }
  if (state.kind === "unavailable") {
    return (
      <span className="portal-home__operations-unavailable">
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
      </span>
    );
  }
  return render(state.page);
}

function AppointmentFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="portal-home__operations-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function PortalHomeAppointmentsOverview() {
  const { hasCapability, status: accessStatus } = usePortalAccess();
  const accessReady = accessStatus === "ready";
  const canQueue = accessReady && hasCapability(PORTAL_CAPABILITIES.appointmentsQueueView);
  const canReview = canQueue && hasCapability(PORTAL_CAPABILITIES.appointmentsReview);
  const today = dateKey(new Date());
  const tomorrowDate = new Date(`${today}T00:00:00`);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = dateKey(tomorrowDate);
  const todayLoader = useMemo(
    () => (signal: AbortSignal) =>
      getPortalAppointments(1, {
        status: ACTIVE_STATUSES,
        dateFrom: today,
        dateTo: today,
        order: "upcoming",
      }, signal),
    [today],
  );
  const upcomingLoader = useMemo(
    () => (signal: AbortSignal) =>
      getPortalAppointments(1, {
        status: ACTIVE_STATUSES,
        dateFrom: tomorrow,
        order: "upcoming",
      }, signal),
    [tomorrow],
  );
  const nextLoader = useMemo(
    () => (signal: AbortSignal) =>
      getPortalAppointments(1, {
        status: ACTIVE_STATUSES,
        dateFrom: today,
        order: "upcoming",
      }, signal),
    [today],
  );
  const reviewLoader = useMemo(
    () => (signal: AbortSignal) =>
      getPortalAppointments(1, { status: "PENDING_REVIEW", order: "recent" }, signal),
    [],
  );

  const todaySource = useAppointmentsSource(canQueue, todayLoader);
  const upcomingSource = useAppointmentsSource(canQueue, upcomingLoader);
  const nextSource = useAppointmentsSource(canQueue, nextLoader);
  const reviewSource = useAppointmentsSource(canReview, reviewLoader);

  if (!accessReady || !canQueue) return null;

  return (
    <PortalHomeWidget
      aria-labelledby="portal-home-appointments-heading"
      className="portal-home__operations-card portal-home__appointments-card"
      tone="surface"
      watermarkIcon={CalendarDays}
    >
      <div className="portal-home__operations-card-header">
        <h3 id="portal-home-appointments-heading">Appointments</h3>
        <Link className="portal-home__section-link" href="/portal/appointments">
          <span>Open appointments</span>
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
      <dl className="portal-home__operations-facts">
        <AppointmentFact label="Today">
          <AppointmentSourceValue
            label="today's appointments"
            onRetry={todaySource.retry}
            render={(page) => String(page.total)}
            state={todaySource.state}
          />
        </AppointmentFact>
        <AppointmentFact label="Upcoming">
          <AppointmentSourceValue
            label="upcoming appointments"
            onRetry={upcomingSource.retry}
            render={(page) => String(page.total)}
            state={upcomingSource.state}
          />
        </AppointmentFact>
        <AppointmentFact label="Next appointment">
          <AppointmentSourceValue
            label="next appointment"
            onRetry={nextSource.retry}
            render={(page) => formatAppointmentDate(page.items[0] ?? null)}
            state={nextSource.state}
          />
        </AppointmentFact>
        {canReview ? (
          <AppointmentFact label="Needs review">
            <AppointmentSourceValue
              label="appointments needing review"
              onRetry={reviewSource.retry}
              render={(page) => (
                <Badge className="portal-home__operations-badge" variant="outline">
                  {page.total} {page.total === 1 ? "appointment" : "appointments"}
                </Badge>
              )}
              state={reviewSource.state}
            />
          </AppointmentFact>
        ) : null}
      </dl>
      {nextSource.state.kind === "ready" && nextSource.state.page.items[0] ? (
        <p className="portal-home__appointments-status">
          Next: {statusLabel(nextSource.state.page.items[0].status)}
        </p>
      ) : null}
    </PortalHomeWidget>
  );
}
