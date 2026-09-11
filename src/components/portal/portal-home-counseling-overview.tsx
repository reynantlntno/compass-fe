"use client";

import Link from "next/link";
import { ArrowRight, HeartHandshake, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { usePortalAccess } from "@/components/portal/portal-access-provider";
import { PortalHomeWidget } from "@/components/portal/portal-home-widget";
import { PORTAL_CAPABILITIES } from "@/components/portal/portal-navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  COUNSELING_SESSION_STATUSES,
  getPortalCounselingSessions,
  getPortalRoutineInterviewCount,
  type PortalCounselingSessionPage,
} from "@/lib/api/counseling";

const ACTIVE_SESSION_STATUSES = COUNSELING_SESSION_STATUSES.filter((status) =>
  ["SCHEDULED", "IN_PROGRESS", "COUNSELOR_NOTES_DRAFT"].includes(status),
).join(",");

type SourceState =
  | { kind: "loading" }
  | { kind: "ready"; page: PortalCounselingSessionPage }
  | { kind: "unavailable" };

function useCounselingSource(
  enabled: boolean,
  loader: (signal: AbortSignal) => Promise<PortalCounselingSessionPage>,
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
        if (page && active && !controller.signal.aborted) setState({ kind: "ready", page });
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
      setRetryCount((current) => current + 1);
    },
    state,
  };
}

type RoutineState =
  | { kind: "loading" }
  | { kind: "ready"; count: number }
  | { kind: "unavailable" };

function useRoutineCount(enabled: boolean) {
  const [state, setState] = useState<RoutineState>({ kind: "loading" });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let active = true;
    void getPortalRoutineInterviewCount(controller.signal)
      .then((count) => {
        if (active && !controller.signal.aborted) setState({ kind: "ready", count });
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        if (active && !controller.signal.aborted) setState({ kind: "unavailable" });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [enabled, retryCount]);

  return {
    retry: () => {
      setState({ kind: "loading" });
      setRetryCount((current) => current + 1);
    },
    state,
  };
}

function SourceValue({
  label,
  onRetry,
  render,
  state,
}: {
  label: string;
  onRetry: () => void;
  render: (page: PortalCounselingSessionPage) => ReactNode;
  state: SourceState;
}) {
  if (state.kind === "loading") return <Skeleton aria-hidden="true" className="portal-home__operations-skeleton" />;
  if (state.kind === "unavailable") {
    return (
      <span className="portal-home__operations-unavailable">
        <span>Unavailable</span>
        <Button aria-label={`Try again: ${label}`} className="portal-home__operations-retry" onClick={onRetry} size="xs" type="button" variant="outline">
          <RefreshCw aria-hidden="true" />Try again
        </Button>
      </span>
    );
  }
  return render(state.page);
}

function RoutineValue({ state, onRetry }: { state: RoutineState; onRetry: () => void }) {
  if (state.kind === "loading") return <Skeleton aria-hidden="true" className="portal-home__operations-skeleton" />;
  if (state.kind === "unavailable") {
    return (
      <span className="portal-home__operations-unavailable">
        <span>Unavailable</span>
        <Button aria-label="Try again: routine interviews" className="portal-home__operations-retry" onClick={onRetry} size="xs" type="button" variant="outline">
          <RefreshCw aria-hidden="true" />Try again
        </Button>
      </span>
    );
  }
  return <Badge className="portal-home__operations-badge" variant="outline">{state.count}</Badge>;
}

function CounselingFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="portal-home__operations-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function formatSchedule(session: PortalCounselingSessionPage["items"][number] | null) {
  if (!session?.scheduled_start_at) return "Schedule not set";
  const date = new Date(session.scheduled_start_at);
  if (Number.isNaN(date.getTime())) return "Schedule not set";
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function PortalHomeCounselingOverview() {
  const { hasCapability, status: accessStatus } = usePortalAccess();
  const canQueue = accessStatus === "ready" && hasCapability(PORTAL_CAPABILITIES.counselingSessionsQueueView);
  const canReviewUrgentSupport = accessStatus === "ready" && hasCapability(PORTAL_CAPABILITIES.urgentSupportQueueReview);
  const nextLoader = useMemo(
    () => (signal: AbortSignal) => getPortalCounselingSessions(1, { status: ACTIVE_SESSION_STATUSES, order: "upcoming" }, signal),
    [],
  );
  const attentionLoader = useMemo(
    () => (signal: AbortSignal) => getPortalCounselingSessions(1, { status: "COUNSELOR_NOTES_DRAFT", order: "recent" }, signal),
    [],
  );
  const nextSource = useCounselingSource(canQueue, nextLoader);
  const attentionSource = useCounselingSource(canQueue, attentionLoader);
  const routine = useRoutineCount(canQueue);

  if (!canQueue) return null;

  return (
    <PortalHomeWidget
      aria-labelledby="portal-home-counseling-heading"
      className="portal-home__operations-card portal-home__counseling-card"
      tone="surface"
      watermarkIcon={HeartHandshake}
    >
      <div className="portal-home__operations-card-header">
        <h3 id="portal-home-counseling-heading">Counseling work</h3>
        <div className="portal-home__operations-card-links">
          <Link className="portal-home__section-link" href="/portal/counseling?section=sessions">
            <span>Open sessions</span><ArrowRight aria-hidden="true" />
          </Link>
          {nextSource.state.kind === "ready" && nextSource.state.page.items[0] ? (
            <Link className="portal-home__section-link portal-home__section-link--secondary" href={`/portal/counseling/sessions/${encodeURIComponent(nextSource.state.page.items[0].reference_code)}`}>
              <span>Open next session</span><ArrowRight aria-hidden="true" />
            </Link>
          ) : null}
          {routine.state.kind === "ready" && routine.state.count > 0 ? (
            <Link className="portal-home__section-link portal-home__section-link--secondary" href="/portal/counseling?section=routine-interviews&status=INTAKE_SUBMITTED">
              <span>Review interviews</span><ArrowRight aria-hidden="true" />
            </Link>
          ) : (
            <Link className="portal-home__section-link portal-home__section-link--secondary" href="/portal/counseling?section=routine-interviews">
              <span>Open routine interviews</span><ArrowRight aria-hidden="true" />
            </Link>
          )}
          {canReviewUrgentSupport ? (
            <Link className="portal-home__section-link portal-home__section-link--secondary" href="/portal/counseling?section=urgent-support">
              <span>Review urgent support</span><ArrowRight aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>
      <dl className="portal-home__operations-facts">
        <CounselingFact label="Next session">
          <SourceValue label="next session" onRetry={nextSource.retry} render={(page) => formatSchedule(page.items[0] ?? null)} state={nextSource.state} />
        </CounselingFact>
        <CounselingFact label="Needs attention">
          <SourceValue label="sessions needing attention" onRetry={attentionSource.retry} render={(page) => <Badge className="portal-home__operations-badge" variant="outline">{page.total}</Badge>} state={attentionSource.state} />
        </CounselingFact>
        <CounselingFact label="Routine interviews awaiting evaluation">
          <RoutineValue onRetry={routine.retry} state={routine.state} />
        </CounselingFact>
      </dl>
    </PortalHomeWidget>
  );
}
