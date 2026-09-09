"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { AuthLoadingState } from "@/components/auth/auth-loading-state";
import { PasswordField } from "@/components/auth/password-field";
import { TurnstileField } from "@/components/public/turnstile-field";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import {
  activateStaffAccount,
  activateStudentAccount,
  AuthApiError,
} from "@/lib/api/auth";

const MAX_ACTIVATION_TOKEN_LENGTH = 512;

type ActivationState = "checking" | "ready" | "success" | "unavailable";
type ActivationField = "password" | "confirmation";
type ActivationFieldErrors = Partial<Record<ActivationField, string>>;

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function isSafeActivationToken(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_ACTIVATION_TOKEN_LENGTH &&
    value.trim() === value &&
    /^[\x21-\x7e]+$/.test(value)
  );
}

function activationErrorMessage(error: unknown): string {
  if (!(error instanceof AuthApiError)) {
    return "Activation is temporarily unavailable. Please try again shortly.";
  }

  switch (error.kind) {
    case "challenge_required":
      return "Complete the quick verification before activating your account.";
    case "conflict":
      return "This activation could not be completed. Please use the latest invitation.";
    case "invalid_activation":
      return "This activation link is invalid or no longer available.";
    case "rate_limited":
      return "Too many attempts. Please wait before trying again.";
    case "unavailable":
      return "Activation is temporarily unavailable. Please try again shortly.";
    case "validation":
      return "Check your password entries and try again. The link may also be no longer available.";
    default:
      return "We couldn’t activate this account. Please try again.";
  }
}

function validateForm(password: string, confirmation: string): ActivationFieldErrors {
  const errors: ActivationFieldErrors = {};

  if (!password) {
    errors.password = "Enter a password.";
  } else if (password.length > MAX_ACTIVATION_TOKEN_LENGTH) {
    errors.password = "Your password is too long.";
  }

  if (!confirmation) {
    errors.confirmation = "Confirm your password.";
  } else if (confirmation.length > MAX_ACTIVATION_TOKEN_LENGTH) {
    errors.confirmation = "Your password confirmation is too long.";
  } else if (password && password !== confirmation) {
    errors.confirmation = "The passwords must match.";
  }

  return errors;
}

export function ActivationPage({ kind }: { kind: "student" | "staff" }) {
  const [state, setState] = useState<ActivationState>("checking");
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ActivationFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaUnavailable, setCaptchaUnavailable] = useState(false);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [pending, setPending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const values = params.getAll("token");
    const candidate = values.length === 1 ? values[0] ?? "" : "";

    window.history.replaceState(null, document.title, window.location.pathname);

    const stateTimer = window.setTimeout(() => {
      if (!isSafeActivationToken(candidate)) {
        setState("unavailable");
        return;
      }

      setToken(candidate);
      setState("ready");
    }, 0);

    return () => window.clearTimeout(stateTimer);
  }, []);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  function resetCaptchaWidget() {
    setCaptchaToken(null);
    setCaptchaResetKey((current) => current + 1);
  }

  function clearSensitiveState() {
    setToken(null);
    setPassword("");
    setConfirmation("");
    setCaptchaToken(null);
    setCaptchaRequired(false);
    setCaptchaUnavailable(false);
    setCaptchaResetKey((current) => current + 1);
  }

  function updatePassword(value: string) {
    setPassword(value);
    setFieldErrors((current) => ({ ...current, password: undefined }));
    setFormError(null);
    if (captchaRequired && captchaToken) resetCaptchaWidget();
    setCaptchaUnavailable(false);
  }

  function updateConfirmation(value: string) {
    setConfirmation(value);
    setFieldErrors((current) => ({ ...current, confirmation: undefined }));
    setFormError(null);
    if (captchaRequired && captchaToken) resetCaptchaWidget();
    setCaptchaUnavailable(false);
  }

  async function submitActivation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !token) return;

    const nextFieldErrors = validateForm(password, confirmation);
    setFieldErrors(nextFieldErrors);
    setFormError(null);
    if (Object.keys(nextFieldErrors).length > 0) return;

    if (captchaRequired && !captchaToken) {
      setFormError(
        captchaUnavailable
          ? "Verification is temporarily unavailable. Please try again later."
          : "Complete the quick verification before activating your account.",
      );
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPending(true);

    try {
      const input = {
        token,
        password,
        password_confirmation: confirmation,
        captchaResponse: captchaToken,
      };

      if (kind === "student") {
        await activateStudentAccount(input, controller.signal);
      } else {
        await activateStaffAccount(input, controller.signal);
      }

      clearSensitiveState();
      setFieldErrors({});
      setFormError(null);
      setState("success");
    } catch (error) {
      if (isAbortError(error)) return;

      resetCaptchaWidget();
      if (
        error instanceof AuthApiError &&
        error.kind === "challenge_required" &&
        error.challengeAction === "activation"
      ) {
        setCaptchaRequired(true);
        setCaptchaUnavailable(false);
        setFormError("Complete the quick verification before activating your account.");
      } else if (error instanceof AuthApiError && error.kind === "invalid_activation") {
        clearSensitiveState();
        setState("unavailable");
      } else {
        setFormError(activationErrorMessage(error));
      }
    } finally {
      setPending(false);
    }
  }

  if (state === "checking") {
    return <AuthLoadingState label="Checking this activation link…" />;
  }

  if (state === "unavailable") {
    return (
      <section aria-live="polite" className="auth-result" role="status">
        <p className="auth-eyebrow">Activation link unavailable</p>
        <h1>We can’t use this link.</h1>
        <p>
          This link may be missing, expired, already used, or temporarily unavailable.
          Request a new invitation if you need to try again.
        </p>
        <Link className="auth-primary-link" href="/login">
          Continue to sign in
        </Link>
      </section>
    );
  }

  if (state === "success") {
    return (
      <section aria-live="polite" className="auth-result" role="status">
        <p className="auth-eyebrow">Account activated</p>
        <h1>Your account is ready.</h1>
        <p>You can now sign in to COMPASS with your new password.</p>
        <Link className="auth-primary-link" href="/login">
          Continue to sign in
        </Link>
      </section>
    );
  }

  const accountLabel = kind === "student" ? "student" : "staff";
  const passwordErrorId = "activation-password-error";
  const confirmationErrorId = "activation-confirmation-error";

  return (
    <form
      aria-busy={pending}
      className="auth-form"
      noValidate
      onSubmit={submitActivation}
    >
      <header className="auth-form__header">
        <p className="auth-eyebrow">
          {kind === "student" ? "Student account activation" : "Staff account activation"}
        </p>
        <h1>Set your COMPASS password.</h1>
        <p>Choose a password to finish activating your {accountLabel} account.</p>
      </header>

      {formError ? (
        <p className="auth-form__error" role="alert">
          {formError}
        </p>
      ) : null}

      {captchaRequired ? (
        <div aria-live="polite" className="auth-challenge">
          <p>Complete the quick verification, then we’ll try activation again.</p>
          <TurnstileField
            action="activation"
            disabled={pending}
            key={captchaResetKey}
            onError={() => {
              setCaptchaToken(null);
              setCaptchaUnavailable(true);
              setFormError("Verification is temporarily unavailable. Please try again later.");
            }}
            onToken={(nextToken) => {
              setCaptchaToken(nextToken);
              if (nextToken) {
                setCaptchaUnavailable(false);
                setFormError(null);
              }
            }}
            onUnavailable={() => {
              setCaptchaToken(null);
              setCaptchaUnavailable(true);
              setFormError("Verification is temporarily unavailable. Please try again later.");
            }}
            resetKey={captchaResetKey}
          />
          {captchaUnavailable ? (
            <button
              className="auth-text-button"
              onClick={() => {
                setCaptchaUnavailable(false);
                setFormError(null);
                resetCaptchaWidget();
              }}
              type="button"
            >
              Try verification again
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="auth-field">
        <Label htmlFor="activation-password">New password</Label>
        <PasswordField
          aria-describedby={fieldErrors.password ? passwordErrorId : undefined}
          aria-invalid={Boolean(fieldErrors.password)}
          autoComplete="new-password"
          autoFocus
          disabled={pending}
          id="activation-password"
          maxLength={MAX_ACTIVATION_TOKEN_LENGTH}
          name="new-password"
          onChange={(event) => updatePassword(event.target.value)}
          required
          value={password}
        />
        {fieldErrors.password ? (
          <FieldError id={passwordErrorId}>{fieldErrors.password}</FieldError>
        ) : null}
        <p className="auth-field__hint">Use a password you do not use elsewhere.</p>
      </div>

      <div className="auth-field">
        <Label htmlFor="activation-confirmation">Confirm password</Label>
        <PasswordField
          aria-describedby={fieldErrors.confirmation ? confirmationErrorId : undefined}
          aria-invalid={Boolean(fieldErrors.confirmation)}
          autoComplete="new-password"
          disabled={pending}
          id="activation-confirmation"
          maxLength={MAX_ACTIVATION_TOKEN_LENGTH}
          name="password-confirmation"
          onChange={(event) => updateConfirmation(event.target.value)}
          required
          value={confirmation}
        />
        {fieldErrors.confirmation ? (
          <FieldError id={confirmationErrorId}>{fieldErrors.confirmation}</FieldError>
        ) : null}
      </div>

      <div className="auth-form__actions">
        <Button
          disabled={pending || captchaUnavailable || (captchaRequired && !captchaToken)}
          type="submit"
        >
          {pending ? "Activating account…" : "Activate account"}
        </Button>
      </div>

      <p className="auth-secondary-copy">
        Already activated? <Link href="/login">Continue to sign in</Link>
      </p>
    </form>
  );
}
