"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Laptop,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { CompassFrame } from "@/components/compass/compass-frame";
import { useAuthSession } from "@/components/auth/auth-session-provider";
import { PasswordField } from "@/components/auth/password-field";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { PortalBreadcrumb } from "@/components/portal/portal-breadcrumb";
import { PortalViewMenu } from "@/components/portal/portal-view-menu";
import {
  AccountSettingsApiError,
  changeAccountPassword,
  getAccountSessions,
  getNotificationPreferences,
  getSecurityActivity,
  getTrustedDevices,
  getTwoFactorStatus,
  requestTwoFactorChange,
  resendTwoFactorChange,
  revokeAccountSession,
  revokeAllTrustedDevices,
  revokeOtherSessions,
  revokeTrustedDevice,
  updateNotificationPreference,
  verifyTwoFactorChange,
  type AccountSettingsErrorKind,
} from "@/lib/api/account-settings";
import {
  createIdempotencyKey,
  type IdempotencyKey,
} from "@/lib/api/idempotency";
import type {
  ActivityPageSchema,
  AssuranceChallengeSchema,
  NotificationPreferencePageSchema,
  NotificationPreferenceSchema,
  SessionPageSchema,
  TrustedDevicePageSchema,
  TwoFactorStatusSchema,
} from "@/lib/api/generated/model";

type ReadState<T> =
  | { kind: "loading" }
  | { kind: "ready"; data: T }
  | { kind: "unavailable"; error: AccountSettingsErrorKind };

type SettingsSectionId =
  | "twoFactor"
  | "sessions"
  | "trustedDevices"
  | "preferences"
  | "activity";

type SettingsAreaId = "security" | "access" | "preferences" | "activity";

const SETTINGS_AREA_IDS: readonly SettingsAreaId[] = [
  "security",
  "access",
  "preferences",
  "activity",
];

const SETTINGS_AREA_NAV_ITEMS = [
  {
    href: "/portal/account/settings?section=security",
    label: "Security",
    value: "security",
  },
  {
    href: "/portal/account/settings?section=access",
    label: "Access",
    value: "access",
  },
  {
    href: "/portal/account/settings?section=preferences",
    label: "Preferences",
    value: "preferences",
  },
  {
    href: "/portal/account/settings?section=activity",
    label: "Activity",
    value: "activity",
  },
] as const;

type PasswordFieldName = "current" | "new" | "confirmation";
type PasswordValues = Record<PasswordFieldName, string>;
type PasswordErrors = Partial<Record<PasswordFieldName, string>>;

type TwoFactorBusyState = "request" | "verify" | "resend" | null;

type ConfirmAction =
  | { kind: "session"; sessionToken: string }
  | { kind: "sessions" }
  | { kind: "trusted"; deviceId: string }
  | { kind: "trusted-all" };

type FailedConfirmAction = {
  action: ConfirmAction;
  message: string;
};

type PreferenceMutation = {
  kind: "pending" | "error";
  message?: string;
};

const PASSWORD_MAX_LENGTH = 512;
const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;
const INITIAL_RETRIES: Record<SettingsSectionId, number> = {
  twoFactor: 0,
  sessions: 0,
  trustedDevices: 0,
  preferences: 0,
  activity: 0,
};

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function getErrorKind(error: unknown): AccountSettingsErrorKind {
  return error instanceof AccountSettingsApiError ? error.kind : "unavailable";
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

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function getPageCount(page: { page: number; page_size: number; total: number }) {
  return Math.max(1, Math.ceil(page.total / page.page_size));
}

function readErrorMessage(kind: AccountSettingsErrorKind) {
  if (kind === "permission") return "This section isn’t available for this account.";
  return "We couldn’t load this section right now.";
}

function isSettingsAreaId(value: string | null): value is SettingsAreaId {
  return value !== null && SETTINGS_AREA_IDS.includes(value as SettingsAreaId);
}

function mutationErrorMessage(
  kind: AccountSettingsErrorKind,
  subject: string,
) {
  switch (kind) {
    case "permission":
      return `This ${subject} action isn’t available for this account.`;
    case "validation":
      return `Check the ${subject} details and try again.`;
    case "rate_limited":
      return `Too many ${subject} attempts. Please wait before trying again.`;
    case "conflict":
      return `This ${subject} change could not be completed. Try again.`;
    default:
      return `${subject.charAt(0).toUpperCase()}${subject.slice(1)} changes are temporarily unavailable. Please try again.`;
  }
}

function SettingsSection({
  children,
  description,
  id,
  title,
}: {
  children: ReactNode;
  description?: string;
  id: string;
  title: string;
}) {
  return (
    <section aria-labelledby={id} className="portal-settings__subsection">
      <div className="portal-settings__subsection-heading">
        <h3 id={id}>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="portal-settings__subsection-body">{children}</div>
    </section>
  );
}

function SettingsArea({
  children,
  description,
  id,
  title,
}: {
  children: ReactNode;
  description: string;
  id: string;
  title: string;
}) {
  return (
    <CompassFrame as="section" aria-labelledby={id} className="portal-settings__area">
      <header className="portal-settings__area-heading">
        <h2 id={id}>{title}</h2>
        <p>{description}</p>
      </header>
      <div className="portal-settings__area-body">{children}</div>
    </CompassFrame>
  );
}

function SettingsSectionLoading({ label }: { label: string }) {
  return (
    <div
      aria-busy="true"
      aria-label={`Loading ${label.toLowerCase()}`}
      className="portal-settings__loading"
      role="status"
    >
      <span className="sr-only">Loading {label.toLowerCase()}…</span>
      <Skeleton aria-hidden="true" className="portal-settings__skeleton-line portal-settings__skeleton-line--short" />
      <Skeleton aria-hidden="true" className="portal-settings__skeleton-line" />
      <Skeleton aria-hidden="true" className="portal-settings__skeleton-line portal-settings__skeleton-line--long" />
    </div>
  );
}

function SettingsSectionUnavailable({
  error,
  label,
  onRetry,
}: {
  error: AccountSettingsErrorKind;
  label: string;
  onRetry: () => void;
}) {
  return (
    <div className="portal-settings__unavailable" role="status">
      <p>{readErrorMessage(error)}</p>
      <Button onClick={onRetry} type="button" variant="outline">
        <RefreshCw aria-hidden="true" />
        Try again
      </Button>
      <span className="sr-only">Retry loading {label.toLowerCase()}</span>
    </div>
  );
}

function SettingsPagination({
  onNext,
  onPrevious,
  page,
  pageSize,
  total,
}: {
  onNext: () => void;
  onPrevious: () => void;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = getPageCount({ page, page_size: pageSize, total });
  if (pages <= 1) return null;

  return (
    <div className="portal-settings__pagination">
      <Button
        disabled={page <= 1}
        onClick={onPrevious}
        type="button"
        variant="ghost"
      >
        <ChevronLeft aria-hidden="true" />
        Previous
      </Button>
      <span aria-live="polite">
        Page {page} of {pages}
      </span>
      <Button
        disabled={page >= pages}
        onClick={onNext}
        type="button"
        variant="ghost"
      >
        Next
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  );
}

function methodLabel(value: string) {
  switch (value.trim().toLowerCase()) {
    case "password":
      return "Password";
    case "otp":
      return "One-time code";
    case "trusted_device":
    case "trusted device":
      return "Trusted browser";
    default:
      return "Sign-in method";
  }
}

function trustedDeviceStatusLabel(value: string) {
  switch (value.trim().toLowerCase()) {
    case "active":
      return "Active";
    case "revoked":
      return "Revoked";
    case "expired":
      return "Expired";
    default:
      return "Status unavailable";
  }
}

function supportsPreferenceChannel(channel: string, target: "in_app" | "email") {
  return channel === "both" || channel === target;
}

function preferenceChannelLabel(channel: string) {
  switch (channel) {
    case "both":
      return "In-app and email";
    case "in_app":
      return "In-app";
    case "email":
      return "Email";
    default:
      return "Available channels";
  }
}

function statusLabel(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized ? value : "Status unavailable";
}

function DeviceIcon({ label }: { label: string }) {
  const normalized = label.toLowerCase();
  if (normalized.includes("phone") || normalized.includes("mobile")) {
    return <Smartphone aria-hidden="true" />;
  }
  return <Laptop aria-hidden="true" />;
}

export function PortalAccountSettingsLoading() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading account settings"
      className="portal-settings portal-settings--loading"
      role="status"
    >
      <span className="sr-only">Loading account settings…</span>
      <PortalBreadcrumb current="Account settings" />
      <header className="portal-settings__header">
        <Skeleton aria-hidden="true" className="portal-settings__skeleton-title" />
        <Skeleton aria-hidden="true" className="portal-settings__skeleton-summary" />
      </header>
      <div aria-hidden="true" className="portal-settings__loading-layout">
        <div className="portal-view-menu portal-settings__loading-navigation">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton className="portal-settings__skeleton-tab" key={index} />
          ))}
        </div>
        <CompassFrame className="portal-settings__loading-area">
          <Skeleton className="portal-settings__skeleton-line portal-settings__skeleton-line--short" />
          <Skeleton className="portal-settings__skeleton-line" />
          <Skeleton className="portal-settings__skeleton-line portal-settings__skeleton-line--long" />
        </CompassFrame>
      </div>
    </section>
  );
}

export function PortalAccountSettings() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshSession, user } = useAuthSession();
  const userId = user?.id ?? null;
  const requestedArea = searchParams.get("section");
  const activeArea: SettingsAreaId = isSettingsAreaId(requestedArea)
    ? requestedArea
    : "security";

  const [retryCounts, setRetryCounts] = useState(INITIAL_RETRIES);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [trustedDevicesPage, setTrustedDevicesPage] = useState(1);
  const [preferencesPage, setPreferencesPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);

  const [twoFactorState, setTwoFactorState] = useState<ReadState<TwoFactorStatusSchema>>({ kind: "loading" });
  const [sessionsState, setSessionsState] = useState<ReadState<SessionPageSchema>>({ kind: "loading" });
  const [trustedDevicesState, setTrustedDevicesState] = useState<ReadState<TrustedDevicePageSchema>>({ kind: "loading" });
  const [preferencesState, setPreferencesState] = useState<ReadState<NotificationPreferencePageSchema>>({ kind: "loading" });
  const [activityState, setActivityState] = useState<ReadState<ActivityPageSchema>>({ kind: "loading" });

  const mutationKeysRef = useRef(
    new Map<string, { fingerprint: string; key: IdempotencyKey }>(),
  );

  const getMutationKey = (scope: string, fingerprint: string) => {
    const existing = mutationKeysRef.current.get(scope);
    if (existing?.fingerprint === fingerprint) return existing.key;

    const key = createIdempotencyKey();
    mutationKeysRef.current.set(scope, { fingerprint, key });
    return key;
  };

  const discardMutationKey = (scope: string) => {
    mutationKeysRef.current.delete(scope);
  };

  const retrySection = useCallback((section: SettingsSectionId) => {
    setRetryCounts((current) => ({
      ...current,
      [section]: current[section] + 1,
    }));
  }, []);

  const retrySections = useCallback((sections: readonly SettingsSectionId[]) => {
    setRetryCounts((current) => {
      const next = { ...current };
      for (const section of sections) next[section] += 1;
      return next;
    });
  }, []);

  useEffect(() => {
    if (userId === null) return;

    const controller = new AbortController();
    let active = true;

    void getTwoFactorStatus(controller.signal)
      .then((data) => {
        if (active) setTwoFactorState({ kind: "ready", data });
      })
      .catch((error: unknown) => {
        if (active && !isAbortError(error)) {
          setTwoFactorState({ kind: "unavailable", error: getErrorKind(error) });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [retryCounts.twoFactor, userId]);

  useEffect(() => {
    if (userId === null) return;

    const controller = new AbortController();
    let active = true;

    void getAccountSessions(sessionsPage, controller.signal)
      .then((data) => {
        if (active) setSessionsState({ kind: "ready", data });
      })
      .catch((error: unknown) => {
        if (active && !isAbortError(error)) {
          setSessionsState({ kind: "unavailable", error: getErrorKind(error) });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [retryCounts.sessions, sessionsPage, userId]);

  useEffect(() => {
    if (userId === null) return;

    const controller = new AbortController();
    let active = true;

    void getTrustedDevices(trustedDevicesPage, controller.signal)
      .then((data) => {
        if (active) setTrustedDevicesState({ kind: "ready", data });
      })
      .catch((error: unknown) => {
        if (active && !isAbortError(error)) {
          setTrustedDevicesState({ kind: "unavailable", error: getErrorKind(error) });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [retryCounts.trustedDevices, trustedDevicesPage, userId]);

  useEffect(() => {
    if (userId === null) return;

    const controller = new AbortController();
    let active = true;

    void getNotificationPreferences(preferencesPage, controller.signal)
      .then((data) => {
        if (active) setPreferencesState({ kind: "ready", data });
      })
      .catch((error: unknown) => {
        if (active && !isAbortError(error)) {
          setPreferencesState({ kind: "unavailable", error: getErrorKind(error) });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [preferencesPage, retryCounts.preferences, userId]);

  useEffect(() => {
    if (userId === null) return;

    const controller = new AbortController();
    let active = true;

    void getSecurityActivity(activityPage, controller.signal)
      .then((data) => {
        if (active) setActivityState({ kind: "ready", data });
      })
      .catch((error: unknown) => {
        if (active && !isAbortError(error)) {
          setActivityState({ kind: "unavailable", error: getErrorKind(error) });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [activityPage, retryCounts.activity, userId]);

  const [passwordValues, setPasswordValues] = useState<PasswordValues>({
    current: "",
    new: "",
    confirmation: "",
  });
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});
  const [passwordStatus, setPasswordStatus] = useState<{
    kind: "idle" | "submitting" | "error";
    message?: string;
  }>({ kind: "idle" });

  const updatePassword = (field: PasswordFieldName, value: string) => {
    discardMutationKey("password");
    setPasswordValues((current) => ({ ...current, [field]: value }));
    setPasswordErrors((current) => {
      const next = { ...current };
      delete next[field];
      if (field === "new") delete next.confirmation;
      return next;
    });
    setPasswordStatus((current) =>
      current.kind === "error" ? { kind: "idle" } : current,
    );
  };

  const validatePassword = () => {
    const errors: PasswordErrors = {};
    if (!passwordValues.current) errors.current = "Enter your current password.";
    if (!passwordValues.new) errors.new = "Enter a new password.";
    if (!passwordValues.confirmation) {
      errors.confirmation = "Confirm your new password.";
    }
    if (passwordValues.current.length > PASSWORD_MAX_LENGTH) {
      errors.current = "Use 512 characters or fewer.";
    }
    if (passwordValues.new.length > PASSWORD_MAX_LENGTH) {
      errors.new = "Use 512 characters or fewer.";
    }
    if (passwordValues.confirmation.length > PASSWORD_MAX_LENGTH) {
      errors.confirmation = "Use 512 characters or fewer.";
    }
    if (
      passwordValues.new &&
      passwordValues.confirmation &&
      passwordValues.new !== passwordValues.confirmation
    ) {
      errors.confirmation = "The passwords do not match.";
    }
    return errors;
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validatePassword();
    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      setPasswordStatus({ kind: "idle" });
      return;
    }

    const fingerprint = [
      passwordValues.current,
      passwordValues.new,
      passwordValues.confirmation,
    ].join("\u0000");
    const key = getMutationKey("password", fingerprint);
    setPasswordStatus({ kind: "submitting" });

    try {
      await changeAccountPassword(
        {
          current_password: passwordValues.current,
          new_password: passwordValues.new,
          password_confirmation: passwordValues.confirmation,
        },
        key,
      );
      discardMutationKey("password");
      setPasswordValues({ current: "", new: "", confirmation: "" });
      setPasswordErrors({});
      await refreshSession();
      router.replace("/login?reset=complete");
    } catch (error: unknown) {
      setPasswordStatus({
        kind: "error",
        message: mutationErrorMessage(getErrorKind(error), "password"),
      });
    }
  };

  const [twoFactorPassword, setTwoFactorPassword] = useState("");
  const [twoFactorOtp, setTwoFactorOtp] = useState("");
  const [twoFactorTarget, setTwoFactorTarget] = useState<boolean | null>(null);
  const [twoFactorChallenge, setTwoFactorChallenge] = useState<AssuranceChallengeSchema | null>(null);
  const [twoFactorDeadline, setTwoFactorDeadline] = useState<number | null>(null);
  const [twoFactorResendAvailableAt, setTwoFactorResendAvailableAt] = useState<number | null>(null);
  const [twoFactorSeconds, setTwoFactorSeconds] = useState(0);
  const [twoFactorResendSeconds, setTwoFactorResendSeconds] = useState(0);
  const [twoFactorBusy, setTwoFactorBusy] = useState<TwoFactorBusyState>(null);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [twoFactorMessage, setTwoFactorMessage] = useState<string | null>(null);

  const twoFactorChallengeId = twoFactorChallenge?.challenge_id ?? null;

  useEffect(() => {
    if (!twoFactorChallengeId || twoFactorDeadline === null) {
      setTwoFactorSeconds(0);
      return;
    }

    const update = () => {
      const remaining = Math.max(
        0,
        Math.ceil((twoFactorDeadline - Date.now()) / 1000),
      );
      setTwoFactorSeconds(remaining);
      if (remaining === 0) {
        setTwoFactorChallenge(null);
        setTwoFactorDeadline(null);
        setTwoFactorTarget(null);
        setTwoFactorPassword("");
        setTwoFactorOtp("");
        setTwoFactorError("This verification code has expired. Start again.");
      }
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [twoFactorChallengeId, twoFactorDeadline]);

  useEffect(() => {
    if (twoFactorResendAvailableAt === null || !twoFactorChallengeId) {
      setTwoFactorResendSeconds(0);
      return;
    }

    const update = () => {
      setTwoFactorResendSeconds(
        Math.max(0, Math.ceil((twoFactorResendAvailableAt - Date.now()) / 1000)),
      );
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [twoFactorChallengeId, twoFactorResendAvailableAt]);

  const startTwoFactorChange = (enabled: boolean) => {
    setTwoFactorTarget(enabled);
    setTwoFactorPassword("");
    setTwoFactorOtp("");
    setTwoFactorChallenge(null);
    setTwoFactorDeadline(null);
    setTwoFactorError(null);
    setTwoFactorMessage(null);
  };

  const handleTwoFactorRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (twoFactorTarget === null) return;
    if (!twoFactorPassword || twoFactorPassword.length > PASSWORD_MAX_LENGTH) {
      setTwoFactorError(
        twoFactorPassword
          ? "Use 512 characters or fewer."
          : "Enter your current password.",
      );
      return;
    }

    setTwoFactorBusy("request");
    setTwoFactorError(null);
    setTwoFactorMessage(null);
    try {
      const challenge = await requestTwoFactorChange({
        current_password: twoFactorPassword,
        enabled: twoFactorTarget,
      });
      setTwoFactorChallenge(challenge);
      setTwoFactorDeadline(Date.now() + challenge.expires_in * 1000);
      setTwoFactorResendAvailableAt(
        Date.now() + RESEND_COOLDOWN_SECONDS * 1000,
      );
      setTwoFactorPassword("");
      setTwoFactorOtp("");
    } catch (error: unknown) {
      setTwoFactorError(
        mutationErrorMessage(getErrorKind(error), "two-factor"),
      );
    } finally {
      setTwoFactorBusy(null);
    }
  };

  const handleTwoFactorVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!twoFactorChallenge || twoFactorTarget === null) return;
    if (!/^\d{6}$/.test(twoFactorOtp)) {
      setTwoFactorError("Enter the six-digit verification code.");
      return;
    }
    if (twoFactorSeconds <= 0) {
      setTwoFactorError("This verification code has expired. Start again.");
      return;
    }

    setTwoFactorBusy("verify");
    setTwoFactorError(null);
    try {
      await verifyTwoFactorChange({
        challenge_id: twoFactorChallenge.challenge_id,
        pending_nonce: twoFactorChallenge.pending_nonce,
        otp: twoFactorOtp,
      });
      setTwoFactorChallenge(null);
      setTwoFactorDeadline(null);
      setTwoFactorTarget(null);
      setTwoFactorPassword("");
      setTwoFactorOtp("");
      setTwoFactorMessage("Two-factor authentication was updated.");
      retrySections(["twoFactor", "sessions", "trustedDevices", "activity"]);
      await refreshSession();
    } catch (error: unknown) {
      setTwoFactorOtp("");
      setTwoFactorError(
        mutationErrorMessage(getErrorKind(error), "two-factor"),
      );
    } finally {
      setTwoFactorBusy(null);
    }
  };

  const handleTwoFactorResend = async () => {
    if (
      !twoFactorChallenge ||
      twoFactorResendSeconds > 0 ||
      twoFactorBusy !== null
    ) {
      return;
    }

    setTwoFactorBusy("resend");
    setTwoFactorError(null);
    try {
      await resendTwoFactorChange({
        challenge_id: twoFactorChallenge.challenge_id,
        pending_nonce: twoFactorChallenge.pending_nonce,
      });
      setTwoFactorResendAvailableAt(
        Date.now() + RESEND_COOLDOWN_SECONDS * 1000,
      );
      setTwoFactorMessage("A new verification code was sent.");
    } catch (error: unknown) {
      setTwoFactorError(
        mutationErrorMessage(getErrorKind(error), "two-factor"),
      );
    } finally {
      setTwoFactorBusy(null);
    }
  };

  const [sessionsMutationError, setSessionsMutationError] = useState<FailedConfirmAction | null>(null);
  const [trustedMutationError, setTrustedMutationError] = useState<FailedConfirmAction | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const openConfirm = (action: ConfirmAction) => {
    if (action.kind === "session" || action.kind === "sessions") {
      setSessionsMutationError(null);
    } else {
      setTrustedMutationError(null);
    }
    setConfirmAction(action);
  };

  const handleConfirmMutation = async () => {
    const action = confirmAction;
    if (!action) return;

    setConfirmBusy(true);
    try {
      if (action.kind === "session") {
        const scope = `session:${action.sessionToken}`;
        const key = getMutationKey(scope, "revoke");
        await revokeAccountSession(action.sessionToken, key);
        discardMutationKey(scope);
        setSessionsMutationError(null);
        retrySections(["sessions", "activity"]);
      } else if (action.kind === "sessions") {
        const key = getMutationKey("sessions:others", "revoke");
        await revokeOtherSessions(key);
        discardMutationKey("sessions:others");
        setSessionsMutationError(null);
        retrySections(["sessions", "activity"]);
      } else if (action.kind === "trusted") {
        const scope = `trusted-device:${action.deviceId}`;
        const key = getMutationKey(scope, "revoke");
        await revokeTrustedDevice(action.deviceId, key);
        discardMutationKey(scope);
        setTrustedMutationError(null);
        retrySections(["trustedDevices", "activity"]);
      } else {
        const key = getMutationKey("trusted-devices:all", "revoke");
        await revokeAllTrustedDevices(key);
        discardMutationKey("trusted-devices:all");
        setTrustedMutationError(null);
        retrySections(["trustedDevices", "activity"]);
      }
    } catch (error: unknown) {
      const failed = {
        action,
        message: mutationErrorMessage(
          getErrorKind(error),
          action.kind === "session" || action.kind === "sessions"
            ? "session"
            : "trusted browser",
        ),
      } satisfies FailedConfirmAction;
      if (action.kind === "session" || action.kind === "sessions") {
        setSessionsMutationError(failed);
      } else {
        setTrustedMutationError(failed);
      }
    } finally {
      setConfirmBusy(false);
      setConfirmAction(null);
    }
  };

  const [preferenceMutations, setPreferenceMutations] = useState<Record<string, PreferenceMutation>>({});
  const preferencePreviousRef = useRef<Record<string, NotificationPreferenceSchema | undefined>>({});

  const startPreferenceUpdate = async (
    preference: NotificationPreferenceSchema,
    nextValue: { email_enabled: boolean; in_app_enabled: boolean },
    replaceKey: boolean,
  ) => {
    if (preference.mandatory) return;

    const scope = `preference:${preference.notification_type}`;
    const fingerprint = `${nextValue.in_app_enabled}:${nextValue.email_enabled}`;
    if (replaceKey) discardMutationKey(scope);
    const key = getMutationKey(scope, fingerprint);
    preferencePreviousRef.current[preference.notification_type] = preference;

    setPreferencesState((current) => {
      if (current.kind !== "ready") return current;
      return {
        kind: "ready",
        data: {
          ...current.data,
          items: current.data.items.map((item) =>
            item.notification_type === preference.notification_type
              ? { ...item, ...nextValue }
              : item,
          ),
        },
      };
    });
    setPreferenceMutations((current) => ({
      ...current,
      [preference.notification_type]: { kind: "pending" },
    }));

    try {
      const updated = await updateNotificationPreference(
        preference.notification_type,
        nextValue,
        key,
      );
      if (updated.notification_type !== preference.notification_type) {
        throw new AccountSettingsApiError("unavailable");
      }
      discardMutationKey(scope);
      delete preferencePreviousRef.current[preference.notification_type];
      setPreferencesState((current) => {
        if (current.kind !== "ready") return current;
        return {
          kind: "ready",
          data: {
            ...current.data,
            items: current.data.items.map((item) =>
              item.notification_type === updated.notification_type ? updated : item,
            ),
          },
        };
      });
      setPreferenceMutations((current) => {
        const next = { ...current };
        delete next[preference.notification_type];
        return next;
      });
    } catch (error: unknown) {
      const previous = preferencePreviousRef.current[preference.notification_type];
      if (previous) {
        setPreferencesState((current) => {
          if (current.kind !== "ready") return current;
          return {
            kind: "ready",
            data: {
              ...current.data,
              items: current.data.items.map((item) =>
                item.notification_type === previous.notification_type ? previous : item,
              ),
            },
          };
        });
      }
      setPreferenceMutations((current) => ({
        ...current,
        [preference.notification_type]: {
          kind: "error",
          message: mutationErrorMessage(getErrorKind(error), "preference"),
        },
      }));
    }
  };

  if (!user) return null;

  const sessions = sessionsState.kind === "ready" ? sessionsState.data : null;
  const trustedDevices =
    trustedDevicesState.kind === "ready" ? trustedDevicesState.data : null;
  const preferences =
    preferencesState.kind === "ready" ? preferencesState.data : null;
  const activity = activityState.kind === "ready" ? activityState.data : null;

  const confirmationTitle =
    confirmAction?.kind === "sessions"
      ? "Sign out other sessions?"
      : confirmAction?.kind === "trusted-all"
        ? "Revoke all trusted browsers?"
        : confirmAction?.kind === "trusted"
          ? "Revoke this trusted browser?"
          : "Sign out this session?";
  const confirmationDescription =
    confirmAction?.kind === "sessions"
      ? "Other active sessions will be signed out. This browser will stay signed in."
      : confirmAction?.kind === "trusted-all"
        ? "All trusted browsers will need to verify again before they can skip the one-time code."
        : confirmAction?.kind === "trusted"
          ? "This browser will need to verify again before it can skip the one-time code."
          : "The selected session will be signed out. This browser cannot be selected here.";

  return (
    <section aria-labelledby="portal-settings-heading" className="portal-settings">
      <PortalBreadcrumb current="Account settings" />
      <header className="portal-settings__header">
        <h1 id="portal-settings-heading">Account settings</h1>
        <p>
          Manage sign-in security, active access, trusted browsers, notifications,
          and recent security activity.
        </p>
      </header>

      <div className="portal-settings__workspace">
        <PortalViewMenu
          activeValue={activeArea}
          ariaLabel="Account settings sections"
          items={SETTINGS_AREA_NAV_ITEMS}
          label="Section"
        />
        <div className="portal-settings__panel">
        {activeArea === "security" ? (
          <SettingsArea
            description="Manage your password and two-factor sign-in checks."
            id="portal-settings-security-heading"
            title="Security"
          >
            <SettingsSection
              description="Change the password used to sign in to COMPASS."
              id="portal-settings-password-heading"
              title="Password"
            >
          <form
            aria-busy={passwordStatus.kind === "submitting"}
            className="portal-settings__form"
            onSubmit={(event) => void handlePasswordSubmit(event)}
          >
            <div className="portal-settings__form-grid">
              <div className="portal-settings__field">
                <Label htmlFor="settings-current-password">Current password</Label>
                <PasswordField
                  aria-describedby={passwordErrors.current ? "settings-current-password-error" : undefined}
                  aria-invalid={passwordErrors.current ? true : undefined}
                  autoComplete="current-password"
                  id="settings-current-password"
                  onChange={(event) => updatePassword("current", event.target.value)}
                  value={passwordValues.current}
                />
                {passwordErrors.current ? (
                  <p className="portal-settings__field-error" id="settings-current-password-error">
                    {passwordErrors.current}
                  </p>
                ) : null}
              </div>
              <div className="portal-settings__field">
                <Label htmlFor="settings-new-password">New password</Label>
                <PasswordField
                  aria-describedby={passwordErrors.new ? "settings-new-password-error" : undefined}
                  aria-invalid={passwordErrors.new ? true : undefined}
                  autoComplete="new-password"
                  id="settings-new-password"
                  maxLength={PASSWORD_MAX_LENGTH}
                  onChange={(event) => updatePassword("new", event.target.value)}
                  value={passwordValues.new}
                />
                {passwordErrors.new ? (
                  <p className="portal-settings__field-error" id="settings-new-password-error">
                    {passwordErrors.new}
                  </p>
                ) : null}
              </div>
              <div className="portal-settings__field">
                <Label htmlFor="settings-password-confirmation">Confirm new password</Label>
                <PasswordField
                  aria-describedby={passwordErrors.confirmation ? "settings-password-confirmation-error" : undefined}
                  aria-invalid={passwordErrors.confirmation ? true : undefined}
                  autoComplete="new-password"
                  id="settings-password-confirmation"
                  maxLength={PASSWORD_MAX_LENGTH}
                  onChange={(event) => updatePassword("confirmation", event.target.value)}
                  value={passwordValues.confirmation}
                />
                {passwordErrors.confirmation ? (
                  <p className="portal-settings__field-error" id="settings-password-confirmation-error">
                    {passwordErrors.confirmation}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="portal-settings__action-row">
              <Button disabled={passwordStatus.kind === "submitting"} type="submit">
                <LockKeyhole aria-hidden="true" />
                {passwordStatus.kind === "submitting" ? "Changing password…" : "Change password"}
              </Button>
            </div>
            {passwordStatus.kind === "error" ? (
              <p aria-live="polite" className="portal-settings__status portal-settings__status--error" role="status">
                {passwordStatus.message}
              </p>
            ) : null}
          </form>
        </SettingsSection>

        <SettingsSection
          description="Use a one-time code as an additional sign-in check when the account policy allows changes."
          id="portal-settings-two-factor-heading"
          title="Two-factor authentication"
        >
          {twoFactorState.kind === "loading" ? (
            <SettingsSectionLoading label="two-factor authentication" />
          ) : twoFactorState.kind === "unavailable" ? (
            <SettingsSectionUnavailable
              error={twoFactorState.error}
              label="two-factor authentication"
              onRetry={() => retrySection("twoFactor")}
            />
          ) : (
            <div className="portal-settings__two-factor">
              <div className="portal-settings__status-line">
                <ShieldCheck aria-hidden="true" />
                <div>
                  <strong>
                    {twoFactorState.data.required
                      ? "Required by account policy"
                      : twoFactorState.data.enabled
                        ? "Enabled"
                        : "Not enabled"}
                  </strong>
                  <p>
                    {twoFactorState.data.required
                      ? "This setting is required for this account."
                      : "Your current two-factor setting is shown by the account security service."}
                  </p>
                </div>
              </div>

              {twoFactorState.data.can_change && twoFactorTarget === null ? (
                <Button
                  onClick={() => startTwoFactorChange(!twoFactorState.data.enabled)}
                  type="button"
                  variant="outline"
                >
                  {twoFactorState.data.enabled ? "Turn off two-factor authentication" : "Turn on two-factor authentication"}
                </Button>
              ) : null}

              {!twoFactorState.data.can_change && twoFactorTarget === null ? (
                <p className="portal-settings__muted">This setting is managed for this account.</p>
              ) : null}

              {twoFactorTarget !== null && !twoFactorChallenge ? (
                <form
                  aria-busy={twoFactorBusy === "request"}
                  className="portal-settings__form portal-settings__form--narrow"
                  onSubmit={(event) => void handleTwoFactorRequest(event)}
                >
                  <div className="portal-settings__field">
                    <Label htmlFor="settings-two-factor-password">Current password</Label>
                    <PasswordField
                      aria-describedby={twoFactorError ? "settings-two-factor-error" : undefined}
                      aria-invalid={twoFactorError ? true : undefined}
                      autoComplete="current-password"
                      id="settings-two-factor-password"
                      maxLength={PASSWORD_MAX_LENGTH}
                      onChange={(event) => setTwoFactorPassword(event.target.value)}
                      value={twoFactorPassword}
                    />
                  </div>
                  <div className="portal-settings__action-row">
                    <Button disabled={twoFactorBusy !== null} type="submit">
                      {twoFactorBusy === "request" ? "Preparing verification…" : "Continue"}
                    </Button>
                    <Button
                      onClick={() => {
                        if (twoFactorTarget !== null) startTwoFactorChange(twoFactorTarget);
                      }}
                      type="button"
                      variant="ghost"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : null}

              {twoFactorChallenge ? (
                <form
                  aria-busy={twoFactorBusy === "verify"}
                  className="portal-settings__form portal-settings__form--narrow"
                  onSubmit={(event) => void handleTwoFactorVerify(event)}
                >
                  <div className="portal-settings__field">
                    <Label htmlFor="settings-two-factor-otp">Verification code</Label>
                    <Input
                      aria-describedby={twoFactorError ? "settings-two-factor-error" : undefined}
                      aria-invalid={twoFactorError ? true : undefined}
                      autoComplete="one-time-code"
                      id="settings-two-factor-otp"
                      inputMode="numeric"
                      maxLength={OTP_LENGTH}
                      onChange={(event) => setTwoFactorOtp(event.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))}
                      pattern="[0-9]{6}"
                      value={twoFactorOtp}
                    />
                  </div>
                  <div className="portal-settings__two-factor-timing">
                    <span>
                      <Clock3 aria-hidden="true" />
                      Expires in {formatCountdown(twoFactorSeconds)}
                    </span>
                    <Button
                      disabled={twoFactorBusy !== null || twoFactorResendSeconds > 0}
                      onClick={() => void handleTwoFactorResend()}
                      type="button"
                      variant="ghost"
                    >
                      {twoFactorResendSeconds > 0 ? `Resend in ${twoFactorResendSeconds}s` : "Resend code"}
                    </Button>
                  </div>
                  <div className="portal-settings__action-row">
                    <Button disabled={twoFactorBusy !== null} type="submit">
                      {twoFactorBusy === "verify" ? "Verifying…" : "Verify and update"}
                    </Button>
                    <Button
                      onClick={() => {
                        if (twoFactorTarget !== null) startTwoFactorChange(twoFactorTarget);
                      }}
                      type="button"
                      variant="ghost"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : null}

              {twoFactorError ? (
                <p aria-live="polite" className="portal-settings__status portal-settings__status--error" id="settings-two-factor-error" role="status">
                  {twoFactorError}
                </p>
              ) : null}
              {twoFactorMessage ? (
                <p aria-live="polite" className="portal-settings__status portal-settings__status--success" role="status">
                  <Check aria-hidden="true" />
                  {twoFactorMessage}
                </p>
              ) : null}
            </div>
          )}
            </SettingsSection>
          </SettingsArea>
        ) : null}

        {activeArea === "access" ? (
          <SettingsArea
            description="Review active sign-ins and trusted browsers."
            id="portal-settings-access-heading"
            title="Access"
          >
            <SettingsSection
              description="Review active sign-ins and end sessions you no longer use."
              id="portal-settings-sessions-heading"
              title="Active sessions"
            >
          {sessionsState.kind === "loading" ? (
            <SettingsSectionLoading label="active sessions" />
          ) : sessionsState.kind === "unavailable" ? (
            <SettingsSectionUnavailable
              error={sessionsState.error}
              label="active sessions"
              onRetry={() => retrySection("sessions")}
            />
          ) : (
            <div className="portal-settings__list-wrap">
              {sessions && sessions.total > 1 ? (
                <div className="portal-settings__action-row portal-settings__action-row--top">
                  <Button onClick={() => openConfirm({ kind: "sessions" })} type="button" variant="outline">
                    <Trash2 aria-hidden="true" />
                    Sign out other sessions
                  </Button>
                </div>
              ) : null}
              {sessionsMutationError ? (
                <div className="portal-settings__status portal-settings__status--error" role="status">
                  <span>{sessionsMutationError.message}</span>
                  <Button onClick={() => setConfirmAction(sessionsMutationError.action)} type="button" variant="ghost">
                    Try again
                  </Button>
                </div>
              ) : null}
              {sessions?.items.length ? (
                <ul className="portal-settings__list">
                  {sessions.items.map((session, index) => {
                    const startedAt = formatTimestamp(session.started_at);
                    const lastActivity = formatTimestamp(session.last_activity_at);
                    const expiresAt = formatTimestamp(session.expires_at);
                    return (
                      <li className="portal-settings__row" key={`session-${index}`}>
                        <div className="portal-settings__row-copy">
                          <div className="portal-settings__row-heading">
                            <DeviceIcon label={session.device.label} />
                            <h3>{session.is_current ? "Current browser" : "Signed-in browser"}</h3>
                            {session.is_current ? <span className="portal-settings__badge">Current</span> : null}
                          </div>
                          <p>{session.device.label}</p>
                          <p>{session.network.label}</p>
                        </div>
                        <dl className="portal-settings__row-meta">
                          <div>
                            <dt>Method</dt>
                            <dd>{methodLabel(session.authentication_method)}</dd>
                          </div>
                          {startedAt ? (
                            <div>
                              <dt>Started</dt>
                              <dd>{startedAt}</dd>
                            </div>
                          ) : null}
                          {lastActivity ? (
                            <div>
                              <dt>Last active</dt>
                              <dd>{lastActivity}</dd>
                            </div>
                          ) : null}
                          {expiresAt ? (
                            <div>
                              <dt>Expires</dt>
                              <dd>{expiresAt}</dd>
                            </div>
                          ) : null}
                        </dl>
                        {!session.is_current ? (
                          <div className="portal-settings__row-actions">
                            <Button
                              aria-label="Sign out this session"
                              onClick={() => openConfirm({ kind: "session", sessionToken: session.session_token })}
                              size="sm"
                              type="button"
                              variant="ghost"
                            >
                              Sign out
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="portal-settings__empty">No active sessions are available to show.</p>
              )}
              {sessions ? (
                <SettingsPagination
                  onNext={() => setSessionsPage((page) => page + 1)}
                  onPrevious={() => setSessionsPage((page) => Math.max(1, page - 1))}
                  page={sessions.page}
                  pageSize={sessions.page_size}
                  total={sessions.total}
                />
              ) : null}
            </div>
          )}
        </SettingsSection>

        <SettingsSection
          description="A trusted browser can skip the one-time code according to the account security policy."
          id="portal-settings-trusted-heading"
          title="Trusted browsers"
        >
          {trustedDevicesState.kind === "loading" ? (
            <SettingsSectionLoading label="trusted browsers" />
          ) : trustedDevicesState.kind === "unavailable" ? (
            <SettingsSectionUnavailable
              error={trustedDevicesState.error}
              label="trusted browsers"
              onRetry={() => retrySection("trustedDevices")}
            />
          ) : (
            <div className="portal-settings__list-wrap">
              {trustedDevices && trustedDevices.items.some((device) => !device.revoked_at) ? (
                <div className="portal-settings__action-row portal-settings__action-row--top">
                  <Button onClick={() => openConfirm({ kind: "trusted-all" })} type="button" variant="outline">
                    <Trash2 aria-hidden="true" />
                    Revoke all trusted browsers
                  </Button>
                </div>
              ) : null}
              {trustedMutationError ? (
                <div className="portal-settings__status portal-settings__status--error" role="status">
                  <span>{trustedMutationError.message}</span>
                  <Button onClick={() => setConfirmAction(trustedMutationError.action)} type="button" variant="ghost">
                    Try again
                  </Button>
                </div>
              ) : null}
              {trustedDevices?.items.length ? (
                <ul className="portal-settings__list">
                  {trustedDevices.items.map((device, index) => {
                    const trustedUntil = formatTimestamp(device.trusted_until);
                    const lastUsed = formatTimestamp(device.last_used_at);
                    const revoked = Boolean(device.revoked_at);
                    return (
                      <li className="portal-settings__row" key={`trusted-${index}`}>
                        <div className="portal-settings__row-copy">
                          <div className="portal-settings__row-heading">
                            <DeviceIcon label={device.device.label} />
                            <h3>{device.is_current ? "Current browser" : "Trusted browser"}</h3>
                            {device.is_current ? <span className="portal-settings__badge">Current</span> : null}
                          </div>
                          <p>{device.device.label}</p>
                          <p>{trustedDeviceStatusLabel(device.status)}</p>
                        </div>
                        <dl className="portal-settings__row-meta">
                          {trustedUntil ? (
                            <div>
                              <dt>Trusted until</dt>
                              <dd>{trustedUntil}</dd>
                            </div>
                          ) : null}
                          {lastUsed ? (
                            <div>
                              <dt>Last used</dt>
                              <dd>{lastUsed}</dd>
                            </div>
                          ) : null}
                        </dl>
                        {!revoked ? (
                          <div className="portal-settings__row-actions">
                            <Button
                              aria-label="Revoke this trusted browser"
                              onClick={() => openConfirm({ kind: "trusted", deviceId: device.id })}
                              size="sm"
                              type="button"
                              variant="ghost"
                            >
                              Revoke
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="portal-settings__empty">No trusted browsers are active.</p>
              )}
              {trustedDevices ? (
                <SettingsPagination
                  onNext={() => setTrustedDevicesPage((page) => page + 1)}
                  onPrevious={() => setTrustedDevicesPage((page) => Math.max(1, page - 1))}
                  page={trustedDevices.page}
                  pageSize={trustedDevices.page_size}
                  total={trustedDevices.total}
                />
              ) : null}
            </div>
          )}
            </SettingsSection>
          </SettingsArea>
        ) : null}

        {activeArea === "preferences" ? (
          <SettingsArea
            description="Choose how COMPASS sends supported notifications."
            id="portal-settings-preferences-area-heading"
            title="Preferences"
          >
            <SettingsSection
              description="Choose the supported channels for each notification. Required preferences stay enabled."
              id="portal-settings-preferences-heading"
              title="Notification preferences"
            >
          {preferencesState.kind === "loading" ? (
            <SettingsSectionLoading label="notification preferences" />
          ) : preferencesState.kind === "unavailable" ? (
            <SettingsSectionUnavailable
              error={preferencesState.error}
              label="notification preferences"
              onRetry={() => retrySection("preferences")}
            />
          ) : (
            <div className="portal-settings__list-wrap">
              {preferences?.items.length ? (
                <ul className="portal-settings__preference-list">
                  {preferences.items.map((preference) => {
                    const mutation = preferenceMutations[preference.notification_type];
                    const inAppAvailable = supportsPreferenceChannel(preference.channel, "in_app");
                    const emailAvailable = supportsPreferenceChannel(preference.channel, "email");
                    const inAppChecked = preference.mandatory || preference.in_app_enabled;
                    const emailChecked = preference.mandatory || preference.email_enabled;
                    return (
                      <li className="portal-settings__preference" key={preference.notification_type}>
                        <div className="portal-settings__preference-copy">
                          <div className="portal-settings__row-heading">
                            <h3>{preference.label}</h3>
                            {preference.mandatory ? <span className="portal-settings__badge">Required</span> : null}
                          </div>
                          <p>{preference.description}</p>
                          <span className="portal-settings__preference-meta">
                            {preference.category} · {preferenceChannelLabel(preference.channel)}
                          </span>
                        </div>
                        <div className="portal-settings__preference-controls">
                          {inAppAvailable ? (
                            <label className="portal-settings__preference-channel">
                              <Switch
                                aria-label={`${preference.label}: in-app notifications`}
                                checked={inAppChecked}
                                disabled={preference.mandatory || mutation?.kind === "pending"}
                                onCheckedChange={(checked) => {
                                  void startPreferenceUpdate(
                                    preference,
                                    { email_enabled: preference.email_enabled, in_app_enabled: checked },
                                    true,
                                  );
                                }}
                              />
                              <span>In-app</span>
                            </label>
                          ) : null}
                          {emailAvailable ? (
                            <label className="portal-settings__preference-channel">
                              <Switch
                                aria-label={`${preference.label}: email notifications`}
                                checked={emailChecked}
                                disabled={preference.mandatory || mutation?.kind === "pending"}
                                onCheckedChange={(checked) => {
                                  void startPreferenceUpdate(
                                    preference,
                                    { email_enabled: checked, in_app_enabled: preference.in_app_enabled },
                                    true,
                                  );
                                }}
                              />
                              <span>Email</span>
                            </label>
                          ) : null}
                        </div>
                        {mutation?.kind === "pending" ? (
                          <span aria-live="polite" className="portal-settings__preference-status" role="status">
                            Saving…
                          </span>
                        ) : null}
                        {mutation?.kind === "error" ? (
                          <div className="portal-settings__preference-error" role="status">
                            <span>{mutation.message}</span>
                            <Button
                              onClick={() =>
                                void startPreferenceUpdate(
                                  preference,
                                  { email_enabled: preference.email_enabled, in_app_enabled: preference.in_app_enabled },
                                  false,
                                )
                              }
                              size="sm"
                              type="button"
                              variant="ghost"
                            >
                              Try again
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="portal-settings__empty">No notification preferences are available.</p>
              )}
              {preferences ? (
                <SettingsPagination
                  onNext={() => setPreferencesPage((page) => page + 1)}
                  onPrevious={() => setPreferencesPage((page) => Math.max(1, page - 1))}
                  page={preferences.page}
                  pageSize={preferences.page_size}
                  total={preferences.total}
                />
              ) : null}
            </div>
          )}
            </SettingsSection>
          </SettingsArea>
        ) : null}

        {activeArea === "activity" ? (
          <SettingsArea
            description="Review recent security events."
            id="portal-settings-activity-area-heading"
            title="Activity"
          >
            <SettingsSection
              description="A read-only record of recent account security events."
              id="portal-settings-activity-heading"
              title="Security activity"
            >
          {activityState.kind === "loading" ? (
            <SettingsSectionLoading label="security activity" />
          ) : activityState.kind === "unavailable" ? (
            <SettingsSectionUnavailable
              error={activityState.error}
              label="security activity"
              onRetry={() => retrySection("activity")}
            />
          ) : (
            <div className="portal-settings__list-wrap">
              {activity?.items.length ? (
                <ul className="portal-settings__list">
                  {activity.items.map((entry, index) => {
                    const createdAt = formatTimestamp(entry.created_at);
                    return (
                      <li className="portal-settings__row portal-settings__activity-row" key={`activity-${index}`}>
                        <div className="portal-settings__row-copy">
                          <div className="portal-settings__row-heading">
                            <ShieldCheck aria-hidden="true" />
                            <h3>{entry.label}</h3>
                          </div>
                          <p>{statusLabel(entry.status_label)}</p>
                          {entry.device ? <p>{entry.device.label}</p> : null}
                          {entry.network ? <p>{entry.network.label}</p> : null}
                        </div>
                        {createdAt ? (
                          <time className="portal-settings__activity-time" dateTime={entry.created_at}>
                            {createdAt}
                          </time>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="portal-settings__empty">No security activity to show.</p>
              )}
              {activity ? (
                <SettingsPagination
                  onNext={() => setActivityPage((page) => page + 1)}
                  onPrevious={() => setActivityPage((page) => Math.max(1, page - 1))}
                  page={activity.page}
                  pageSize={activity.page_size}
                  total={activity.total}
                />
              ) : null}
            </div>
          )}
            </SettingsSection>
          </SettingsArea>
        ) : null}
        </div>
      </div>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !confirmBusy) setConfirmAction(null);
        }}
        open={confirmAction !== null}
      >
        <AlertDialogContent className="compass-surface portal-settings__dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmationTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmationDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={confirmBusy} onClick={() => void handleConfirmMutation()}>
              {confirmBusy ? "Updating…" : "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
