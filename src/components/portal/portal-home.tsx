"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuthSession } from "@/components/auth/auth-session-provider";
import { PortalDateTime } from "@/components/portal/portal-date-time";
import {
  cleanPortalValue,
  getPortalAccountName,
  getPortalInitials,
  getPortalRoleLabel,
} from "@/components/portal/portal-identity";
import { PortalHomeWidget } from "@/components/portal/portal-home-widget";
import { PortalSystemHealthSummary } from "@/components/portal/portal-system-health";
import type { SelfProfileSchema } from "@/lib/api/generated/model";
import { getCurrentPortalProfile } from "@/lib/api/portal";

type ProfileState =
  | { kind: "loading"; userId: number | null }
  | { kind: "ready"; profile: SelfProfileSchema; userId: number }
  | { kind: "unavailable"; userId: number };

export function PortalHome() {
  const { user } = useAuthSession();
  const [profileState, setProfileState] = useState<ProfileState>({
    kind: "loading",
    userId: null,
  });
  const userId = user?.id;

  useEffect(() => {
    if (userId === undefined) return;

    const controller = new AbortController();
    let active = true;

    void getCurrentPortalProfile(controller.signal).then((profile) => {
      if (!active) return;
      setProfileState(
        profile
          ? { kind: "ready", profile, userId }
          : { kind: "unavailable", userId },
      );
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [userId]);

  if (!user) return null;

  const currentProfileState =
    profileState.userId === user.id
      ? profileState
      : { kind: "loading" as const, userId: user.id };
  const profile = currentProfileState.kind === "ready" ? currentProfileState.profile : null;
  const displayName =
    cleanPortalValue(profile?.display_name) ?? getPortalAccountName(user);
  const roleLabel = getPortalRoleLabel(user.role);

  return (
    <section aria-labelledby="portal-home-heading" className="portal-home">
      <header className="portal-home__intro">
        <div className="portal-home__intro-copy">
          <h1 id="portal-home-heading">
            <span className="portal-home__greeting-accent">Welcome back,</span>{" "}
            {displayName}.
          </h1>
        </div>
      </header>
      <p className="portal-home__guidance">
        Use the dock below to move between available areas.
      </p>

      <div className="portal-home__widget-grid">
        <PortalHomeWidget
          aria-label="Local date and time"
          className="portal-home__time-widget"
        >
          <PortalDateTime compact />
        </PortalHomeWidget>

        <PortalHomeWidget
          aria-labelledby="portal-account-widget-heading"
          className="portal-home__account-widget"
        >
          <div className="portal-home__account-identity">
            <div aria-hidden="true" className="portal-home__account-avatar">
              {getPortalInitials(user)}
            </div>
            <div className="portal-home__account-copy">
              <h2 id="portal-account-widget-heading">{displayName}</h2>
              <p>{roleLabel}</p>
            </div>
          </div>
          <Link className="portal-home__account-link" href="/portal/account">
            <span>View account</span>
            <ArrowRight aria-hidden="true" />
          </Link>
        </PortalHomeWidget>

        <PortalSystemHealthSummary />
      </div>
    </section>
  );
}
