"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { useEffect, useState, type ComponentPropsWithoutRef } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PortalHomeWidget } from "@/components/portal/portal-home-widget";
import { usePortalAccess } from "@/components/portal/portal-access-provider";
import { PORTAL_CAPABILITIES } from "@/components/portal/portal-navigation";
import type {
  HealthComponentSchema,
  HealthProjectionSchema,
} from "@/lib/api/generated/model";
import {
  getPortalSystemHealth,
  type PortalSystemHealthState,
} from "@/lib/api/portal";

function healthStatusLabel(status: string) {
  switch (status) {
    case "ok":
      return "Operational";
    case "warning":
      return "Needs attention";
    case "error":
      return "Action needed";
    case "skipped":
      return "Not checked";
    default:
      return "Status unavailable";
  }
}

function formatCheckedAt(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function HealthFacts({ health }: { health: HealthProjectionSchema }) {
  return (
    <dl className="portal-health__facts">
      <div>
        <dt>Overall status</dt>
        <dd data-health-status={health.status}>{healthStatusLabel(health.status)}</dd>
      </div>
      <div>
        <dt>Components checked</dt>
        <dd>{health.component_count}</dd>
      </div>
      <div>
        <dt>Warnings</dt>
        <dd data-health-status={health.warning_count > 0 ? "warning" : "ok"}>
          {health.warning_count}
        </dd>
      </div>
      <div>
        <dt>Failures</dt>
        <dd data-health-status={health.failed_count > 0 ? "error" : "ok"}>
          {health.failed_count}
        </dd>
      </div>
    </dl>
  );
}

function HealthComponentRow({ component }: { component: HealthComponentSchema }) {
  const checkedAt = formatCheckedAt(component.checked_at);

  return (
    <li className="portal-health__component">
      <div className="portal-health__component-heading">
        <h2>{component.label}</h2>
        <span data-health-status={component.status}>
          {healthStatusLabel(component.status)}
        </span>
      </div>
      <p>{component.message}</p>
      {checkedAt ? <time dateTime={component.checked_at ?? undefined}>Checked {checkedAt}</time> : null}
    </li>
  );
}

function HealthSurface({
  children,
  className,
  detail,
  ...props
}: ComponentPropsWithoutRef<"section"> & { detail: boolean }) {
  if (detail) {
    return (
      <section {...props} className={className}>
        {children}
      </section>
    );
  }

  return (
    <PortalHomeWidget
      {...props}
      className={className}
      variant="overview"
    >
      {children}
    </PortalHomeWidget>
  );
}

export function PortalSystemHealthSkeleton({ detail = false }: { detail?: boolean }) {
  return (
    <HealthSurface
      aria-busy="true"
      aria-label="Checking system health"
      className={`portal-health portal-health--loading${detail ? " portal-health--detail" : " portal-health--summary"}`}
      detail={detail}
      role="status"
    >
      <span className="sr-only">
        Checking system health…
      </span>
      <Skeleton aria-hidden="true" className="portal-health__skeleton-line portal-health__skeleton-line--short" />
      <Skeleton aria-hidden="true" className="portal-health__skeleton-line portal-health__skeleton-line--heading" />
      <div aria-hidden="true" className="portal-health__skeleton-facts">
        <Skeleton className="portal-health__skeleton-line" />
        <Skeleton className="portal-health__skeleton-line" />
        <Skeleton className="portal-health__skeleton-line" />
      </div>
    </HealthSurface>
  );
}

function HealthUnavailable({ detail, onRetry }: { detail: boolean; onRetry: () => void }) {
  const Heading = detail ? "h1" : "h2";

  return (
    <HealthSurface
      aria-labelledby={detail ? "portal-health-unavailable-heading" : "portal-home-health-heading"}
      className={`portal-health portal-health--unavailable${detail ? " portal-health--detail" : " portal-health--summary"}`}
      detail={detail}
    >
      <Heading id={detail ? "portal-health-unavailable-heading" : "portal-home-health-heading"}>
        System health is unavailable right now.
      </Heading>
      <p>Try again when the connection is ready.</p>
      <Button onClick={onRetry} type="button" variant="outline">
        <RefreshCw aria-hidden="true" />
        Try again
      </Button>
    </HealthSurface>
  );
}

function HealthForbidden() {
  return (
    <section aria-labelledby="portal-health-forbidden-heading" className="portal-health portal-health--detail">
      <h1 id="portal-health-forbidden-heading">This page isn’t available for this account.</h1>
      <p>Return to your workspace to continue.</p>
      <Link className="portal-health__back-link" href="/portal">
        <ArrowLeft aria-hidden="true" />
        Back to portal home
      </Link>
    </section>
  );
}

function usePortalSystemHealth(enabled = true) {
  const [state, setState] = useState<
    PortalSystemHealthState | { kind: "idle" } | { kind: "loading" }
  >({
    kind: enabled ? "loading" : "idle",
  });
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    let active = true;

    void getPortalSystemHealth(controller.signal).then((nextState) => {
      if (active) setState(nextState);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [enabled, requestKey]);

  return {
    state,
    retry: () => {
      setState({ kind: "loading" });
      setRequestKey((value) => value + 1);
    },
  };
}

export function PortalSystemHealthSummary() {
  const { status, hasCapability } = usePortalAccess();
  const enabled =
    status === "ready" &&
    hasCapability(PORTAL_CAPABILITIES.systemHealthView);
  const { state, retry } = usePortalSystemHealth(enabled);

  if (!enabled) return null;
  if (state.kind === "idle") return <PortalSystemHealthSkeleton />;
  if (state.kind === "loading") return <PortalSystemHealthSkeleton />;
  if (state.kind === "forbidden") return null;
  if (state.kind === "unavailable") {
    return <HealthUnavailable detail={false} onRetry={retry} />;
  }
  if (state.kind !== "ready") return null;

  return (
    <HealthSurface
      aria-labelledby="portal-home-health-heading"
      className="portal-health portal-health--summary"
      detail={false}
    >
      <div className="portal-health__heading">
        <h2 id="portal-home-health-heading">System health</h2>
        <Link className="portal-home__section-link portal-health__action" href="/portal/system-health">
          <span>Open system health</span>
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
      <HealthFacts health={state.health} />
    </HealthSurface>
  );
}

export function PortalSystemHealthPage() {
  const { state, retry } = usePortalSystemHealth();

  if (state.kind === "idle") return null;
  if (state.kind === "loading") return <PortalSystemHealthSkeleton detail />;
  if (state.kind === "unavailable") {
    return <HealthUnavailable detail onRetry={retry} />;
  }
  if (state.kind === "forbidden") return <HealthForbidden />;

  return (
    <section aria-labelledby="portal-health-heading" className="portal-health portal-health--detail">
      <div className="portal-health__detail-heading">
        <Link className="portal-health__back-link" href="/portal">
          <ArrowLeft aria-hidden="true" />
          Back to portal home
        </Link>
        <h1 id="portal-health-heading">System health</h1>
        <p>A read-only view of the latest checks available to this workspace.</p>
      </div>

      <HealthFacts health={state.health} />

      <div className="portal-health__components-heading">
        <p className="portal-eyebrow">Checks</p>
        <h2>Components</h2>
      </div>
      <ul className="portal-health__components">
        {state.health.components.map((component) => (
          <HealthComponentRow component={component} key={component.component} />
        ))}
      </ul>
    </section>
  );
}
