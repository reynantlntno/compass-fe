"use client";

import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuthSession } from "@/components/auth/auth-session-provider";
import { PortalBreadcrumb } from "@/components/portal/portal-breadcrumb";
import {
  cleanPortalValue,
  getPortalAccountName,
  getPortalRoleLabel,
} from "@/components/portal/portal-identity";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getAccountAppointment,
  getAccountCoverage,
  getAccountProfile,
  type AccountAppointmentState,
  type AccountCoverageState,
  type AccountProfileState,
} from "@/lib/api/account";
import type { CounselorCoverageProjectionSchema } from "@/lib/api/generated/model";

type ProfileViewState =
  | { kind: "loading"; userId: number | null; requestKey: number }
  | (AccountProfileState & { userId: number; requestKey: number });

type AppointmentViewState =
  | { kind: "loading"; userId: number | null; requestKey: number }
  | (AccountAppointmentState & { userId: number; requestKey: number });

type CoverageViewState =
  | { kind: "loading"; userId: number | null; requestKey: string }
  | (AccountCoverageState & { userId: number; requestKey: string });

const COVERAGE_FIELDS = [
  { label: "Campus", key: "campus" },
  { label: "College", key: "college" },
  { label: "Department", key: "department" },
  { label: "Program", key: "program" },
] as const satisfies ReadonlyArray<{
  label: string;
  key: keyof CounselorCoverageProjectionSchema;
}>;

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function AccountEnrichmentSkeleton({ label }: { label: string }) {
  return (
    <section
      aria-busy="true"
      aria-label={`Loading ${label.toLowerCase()}`}
      className="portal-account__section portal-account__section--loading"
      role="status"
    >
      <p className="portal-eyebrow">{label}</p>
      <Skeleton aria-hidden="true" className="portal-account__skeleton-heading" />
      <div aria-hidden="true" className="portal-account__skeleton-lines">
        <Skeleton />
        <Skeleton />
      </div>
    </section>
  );
}

function fieldEntries(
  fields: ReadonlyArray<{ label: string; value: string | null | undefined }>,
) {
  return fields.flatMap(({ label, value }) => {
    const normalized = cleanPortalValue(value);
    return normalized ? [{ label, value: normalized }] : [];
  });
}

function AccountIdentity({
  accountName,
  email,
  role,
}: {
  accountName: string;
  email: string;
  role: string;
}) {
  return (
    <section
      aria-labelledby="portal-account-identity-heading"
      className="portal-account__section portal-account__identity"
    >
      <div className="portal-account__section-heading">
        <p className="portal-eyebrow">Identity</p>
        <h2 id="portal-account-identity-heading">Your account</h2>
      </div>
      <dl className="portal-account__details">
        <div>
          <dt>Full name</dt>
          <dd>{accountName}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{email}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{role}</dd>
        </div>
      </dl>
    </section>
  );
}

function ProfileDetails({
  fields,
}: {
  fields: ReadonlyArray<{ label: string; value: string }>;
}) {
  if (fields.length === 0) return null;

  return (
    <section
      aria-labelledby="portal-account-profile-heading"
      className="portal-account__section"
    >
      <div className="portal-account__section-heading">
        <p className="portal-eyebrow">Profile</p>
        <h2 id="portal-account-profile-heading">Additional details</h2>
      </div>
      <dl className="portal-account__details portal-account__details--profile">
        {fields.map(({ label, value }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function CurrentAppointment({ label }: { label: string }) {
  return (
    <section
      aria-labelledby="portal-account-appointment-heading"
      className="portal-account__section"
    >
      <div className="portal-account__section-heading">
        <p className="portal-eyebrow">Governance</p>
        <h2 id="portal-account-appointment-heading">Current appointment</h2>
      </div>
      <dl className="portal-account__details">
        <div>
          <dt>Appointment</dt>
          <dd>{label}</dd>
        </div>
      </dl>
    </section>
  );
}

function CoverageRow({ coverage }: { coverage: CounselorCoverageProjectionSchema }) {
  const fields = fieldEntries(
    COVERAGE_FIELDS.map(({ label, key }) => ({
      label,
      value: coverage[key] as string | null | undefined,
    })),
  );

  return (
    <li className="portal-account__coverage-row">
      <div className="portal-account__coverage-heading">
        <h3>{coverage.scope_label}</h3>
        {coverage.is_primary ? (
          <span className="portal-account__coverage-primary">Primary</span>
        ) : null}
      </div>
      {fields.length > 0 ? (
        <dl className="portal-account__coverage-fields">
          {fields.map(({ label, value }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </li>
  );
}

function CurrentCoverage({
  coverage,
  onNext,
  onPrevious,
}: {
  coverage: Extract<CoverageViewState, { kind: "ready" }>['coverage'];
  onNext: () => void;
  onPrevious: () => void;
}) {
  const pageCount = Math.max(1, Math.ceil(coverage.total / coverage.page_size));
  const hasPagination = pageCount > 1;

  return (
    <section
      aria-labelledby="portal-account-coverage-heading"
      className="portal-account__section portal-account__coverage"
    >
      <div className="portal-account__section-heading">
        <p className="portal-eyebrow">Counselor scope</p>
        <h2 id="portal-account-coverage-heading">Current coverage</h2>
        <p>Coverage currently connected to this account.</p>
      </div>
      <ul className="portal-account__coverage-list">
        {coverage.items.map((item, index) => (
          <CoverageRow
            coverage={item}
            key={`${item.scope_label}-${index}`}
          />
        ))}
      </ul>
      {hasPagination ? (
        <div className="portal-account__pagination">
          <Button
            disabled={coverage.page <= 1}
            onClick={onPrevious}
            type="button"
            variant="ghost"
          >
            <ArrowLeft aria-hidden="true" />
            Previous
          </Button>
          <span aria-live="polite">
            Page {coverage.page} of {pageCount}
          </span>
          <Button
            disabled={coverage.page >= pageCount}
            onClick={onNext}
            type="button"
            variant="ghost"
          >
            Next
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </section>
  );
}

export function PortalAccountLoading() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading account information"
      className="portal-account portal-account--loading"
      role="status"
    >
      <PortalBreadcrumb current="Account information" />
      <Skeleton aria-hidden="true" className="portal-account__skeleton-eyebrow" />
      <Skeleton aria-hidden="true" className="portal-account__skeleton-title" />
      <Skeleton aria-hidden="true" className="portal-account__skeleton-summary" />
      <div className="portal-account__frame">
        <AccountEnrichmentSkeleton label="Account" />
      </div>
    </section>
  );
}

export function PortalAccountInformation() {
  const { user } = useAuthSession();
  const userId = user?.id ?? null;
  const [retryKey, setRetryKey] = useState(0);
  const [coveragePage, setCoveragePage] = useState(1);
  const [profileState, setProfileState] = useState<ProfileViewState>({
    kind: "loading",
    userId,
    requestKey: 0,
  });
  const [appointmentState, setAppointmentState] =
    useState<AppointmentViewState>({ kind: "loading", userId, requestKey: 0 });
  const [coverageState, setCoverageState] = useState<CoverageViewState>({
    kind: "loading",
    userId,
    requestKey: "0:1",
  });

  useEffect(() => {
    if (userId === null) return;

    const controller = new AbortController();
    let active = true;

    void getAccountProfile(userId, controller.signal)
      .then((state) => {
        if (active) setProfileState({ ...state, requestKey: retryKey, userId });
      })
      .catch((error) => {
        if (active && !isAbortError(error)) {
          setProfileState({ kind: "unavailable", requestKey: retryKey, userId });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [retryKey, userId]);

  useEffect(() => {
    if (userId === null) return;

    const controller = new AbortController();
    let active = true;

    void getAccountAppointment(controller.signal)
      .then((state) => {
        if (active) {
          setAppointmentState({ ...state, requestKey: retryKey, userId });
        }
      })
      .catch((error) => {
        if (active && !isAbortError(error)) {
          setAppointmentState({ kind: "unavailable", requestKey: retryKey, userId });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [retryKey, userId]);

  useEffect(() => {
    if (userId === null) return;

    const controller = new AbortController();
    let active = true;
    const requestKey = `${retryKey}:${coveragePage}`;

    void getAccountCoverage(coveragePage, controller.signal)
      .then((state) => {
        if (active) setCoverageState({ ...state, requestKey, userId });
      })
      .catch((error) => {
        if (active && !isAbortError(error)) {
          setCoverageState({ kind: "unavailable", requestKey, userId });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [coveragePage, retryKey, userId]);

  if (!user) return null;

  const currentProfileState =
    profileState.userId === user.id && profileState.requestKey === retryKey
      ? profileState
      : { kind: "loading" as const, userId: user.id, requestKey: retryKey };
  const currentAppointmentState =
    appointmentState.userId === user.id && appointmentState.requestKey === retryKey
      ? appointmentState
      : { kind: "loading" as const, userId: user.id, requestKey: retryKey };
  const coverageRequestKey = `${retryKey}:${coveragePage}`;
  const currentCoverageState =
    coverageState.userId === user.id && coverageState.requestKey === coverageRequestKey
      ? coverageState
      : { kind: "loading" as const, userId: user.id, requestKey: coverageRequestKey };

  const profile =
    currentProfileState.kind === "ready" ? currentProfileState.profile : null;
  const profileFields = fieldEntries([
    { label: "Designation", value: profile?.designation },
    { label: "Campus", value: profile?.campus },
    { label: "College", value: profile?.college },
    { label: "Department", value: profile?.department },
    { label: "Program", value: profile?.program },
    { label: "Year level", value: profile?.year_level },
    { label: "Lifecycle status", value: profile?.lifecycle_status },
  ]);
  const hasUnavailableEnrichment = [
    currentProfileState,
    currentAppointmentState,
    currentCoverageState,
  ].some((state) => state.kind === "unavailable");

  return (
    <section aria-labelledby="portal-account-heading" className="portal-account">
      <PortalBreadcrumb current="Account information" />
      <header className="portal-account__header">
        <h1 id="portal-account-heading">Account information</h1>
        <p>Review the information currently connected to your COMPASS account.</p>
      </header>

      <div className="portal-account__frame">
        {hasUnavailableEnrichment ? (
          <div className="portal-account__status" role="status" aria-live="polite">
            <p>Some account information is unavailable right now.</p>
            <Button
              onClick={() => {
                setCoveragePage(1);
                setRetryKey((value) => value + 1);
              }}
              type="button"
              variant="outline"
            >
              <RefreshCw aria-hidden="true" />
              Try again
            </Button>
          </div>
        ) : null}

        <div className="portal-account__sections">
          <AccountIdentity
            accountName={getPortalAccountName(user)}
            email={user.email}
            role={getPortalRoleLabel(user.role)}
          />

          {currentProfileState.kind === "loading" ? (
            <AccountEnrichmentSkeleton label="Profile" />
          ) : currentProfileState.kind === "ready" ? (
            <ProfileDetails fields={profileFields} />
          ) : null}

          {currentAppointmentState.kind === "loading" ? (
            <AccountEnrichmentSkeleton label="Current appointment" />
          ) : currentAppointmentState.kind === "ready" ? (
            <CurrentAppointment label={currentAppointmentState.appointment.label} />
          ) : null}

          {currentCoverageState.kind === "loading" ? (
            <AccountEnrichmentSkeleton label="Current coverage" />
          ) : currentCoverageState.kind === "ready" ? (
            <CurrentCoverage
              coverage={currentCoverageState.coverage}
              onNext={() => setCoveragePage((page) => page + 1)}
              onPrevious={() => setCoveragePage((page) => Math.max(1, page - 1))}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
