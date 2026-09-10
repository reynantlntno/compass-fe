"use client";

import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";
import { useEffect, useState, type ComponentPropsWithoutRef } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { PortalBreadcrumb } from "@/components/portal/portal-breadcrumb";
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
      {detail ? <PortalBreadcrumb current="System health" /> : null}
      <span className="sr-only">Checking system health…</span>
      {detail ? (
        <>
          <div className="portal-health__detail-heading portal-health__detail-heading--loading">
            <Skeleton
              aria-hidden="true"
              className="portal-health__skeleton-line portal-health__skeleton-line--short"
            />
            <Skeleton
              aria-hidden="true"
              className="portal-health__skeleton-line portal-health__skeleton-line--heading"
            />
            <Skeleton
              aria-hidden="true"
              className="portal-health__skeleton-line portal-health__skeleton-line--summary"
            />
          </div>
          <div className="portal-health__detail-cards">
            <section
              aria-hidden="true"
              className="portal-health__detail-card portal-health__summary-card"
            >
              <div className="portal-health__skeleton-facts">
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton className="portal-health__skeleton-line" key={index} />
                ))}
              </div>
            </section>
            <section
              aria-hidden="true"
              className="portal-health__detail-card portal-health__checks-card"
            >
              <div className="portal-health__components-heading">
                <Skeleton className="portal-health__skeleton-line portal-health__skeleton-line--short" />
                <Skeleton className="portal-health__skeleton-line portal-health__skeleton-line--heading" />
              </div>
              <div className="portal-health__skeleton-components">
                {Array.from({ length: 3 }, (_, index) => (
                  <div className="portal-health__skeleton-component" key={index}>
                    <Skeleton className="portal-health__skeleton-line portal-health__skeleton-line--short" />
                    <Skeleton className="portal-health__skeleton-line portal-health__skeleton-line--summary" />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      ) : (
        <>
          <Skeleton
            aria-hidden="true"
            className="portal-health__skeleton-line portal-health__skeleton-line--short"
          />
          <Skeleton
            aria-hidden="true"
            className="portal-health__skeleton-line portal-health__skeleton-line--heading"
          />
          <div aria-hidden="true" className="portal-health__skeleton-facts">
            <Skeleton className="portal-health__skeleton-line" />
            <Skeleton className="portal-health__skeleton-line" />
            <Skeleton className="portal-health__skeleton-line" />
          </div>
        </>
      )}
    </HealthSurface>
  );
}

function HealthUnavailable({ detail, onRetry }: { detail: boolean; onRetry: () => void }) {
  return (
    <HealthSurface
      aria-labelledby={detail ? "portal-health-unavailable-heading" : "portal-home-health-heading"}
      className={`portal-health portal-health--unavailable${detail ? " portal-health--detail" : " portal-health--summary"}`}
      detail={detail}
    >
      {detail ? <PortalBreadcrumb current="System health" /> : null}
      {detail ? (
        <div className="portal-health__frame portal-health__frame--state">
          <h1 id="portal-health-unavailable-heading">
            System health is unavailable right now.
          </h1>
          <p>Try again when the connection is ready.</p>
          <Button onClick={onRetry} type="button" variant="outline">
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        </div>
      ) : (
        <>
          <h2 id="portal-home-health-heading">
            System health is unavailable right now.
          </h2>
          <p>Try again when the connection is ready.</p>
          <Button onClick={onRetry} type="button" variant="outline">
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        </>
      )}
    </HealthSurface>
  );
}

function HealthForbidden() {
  return (
    <section aria-labelledby="portal-health-forbidden-heading" className="portal-health portal-health--detail">
      <PortalBreadcrumb current="System health" />
      <div className="portal-health__frame portal-health__frame--state">
        <h1 id="portal-health-forbidden-heading">This page isn’t available for this account.</h1>
        <p>Return to your workspace to continue.</p>
      </div>
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
      <PortalBreadcrumb current="System health" />
      <div className="portal-health__detail-heading">
        <h1 id="portal-health-heading">System health</h1>
        <p>A read-only view of the latest checks available to this workspace.</p>
      </div>

      <div className="portal-health__detail-cards">
        <section
          aria-label="Current health summary"
          className="portal-health__detail-card portal-health__summary-card"
        >
          <HealthFacts health={state.health} />
        </section>

        <section
          aria-labelledby="portal-health-checks-heading"
          className="portal-health__detail-card portal-health__checks-card"
        >
          <div className="portal-health__components-heading">
            <p className="portal-eyebrow">Checks</p>
            <h2 id="portal-health-checks-heading">Components</h2>
          </div>
          <ul className="portal-health__components">
            {state.health.components.map((component) => (
              <HealthComponentRow component={component} key={component.component} />
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
