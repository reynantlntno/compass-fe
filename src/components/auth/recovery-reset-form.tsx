"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { TurnstileField } from "@/components/public/turnstile-field";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { AuthApiError, resetPassword } from "@/lib/api/auth";

type ResetState = "checking" | "ready" | "invalid" | "unavailable";
type ResetFieldErrors = { password?: string; confirmation?: string };

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function resetErrorMessage(error: unknown): string {
  if (!(error instanceof AuthApiError)) {
    return "Password reset is temporarily unavailable. Please try again shortly.";
  }

  switch (error.kind) {
    case "validation":
      return "Choose a valid password and make sure both entries match.";
    case "rate_limited":
      return "Please wait a little while before trying again.";
    case "unavailable":
      return "Password reset is temporarily unavailable. Please try again shortly.";
    default:
      return "We couldn’t complete the password reset. Please try again.";
  }
}

function isSafeRecoveryToken(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 512 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

export function RecoveryResetForm() {
  const router = useRouter();
  const [state, setState] = useState<ResetState>("checking");
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ResetFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaUnavailable, setCaptchaUnavailable] = useState(false);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const checkTimer = window.setTimeout(() => {
      const rawSearch = window.location.search;
      const params = new URLSearchParams(rawSearch);
      const values = params.getAll("token");
      const candidate = values.length === 1 ? values[0] ?? "" : "";

      window.history.replaceState(null, document.title, window.location.pathname);

      if (!isSafeRecoveryToken(candidate)) {
        setState("invalid");
        return;
      }

      setToken(candidate);
      setState("ready");
    }, 0);

    return () => window.clearTimeout(checkTimer);
  }, []);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  function resetCaptchaWidget() {
    setCaptchaToken(null);
    setCaptchaResetKey((current) => current + 1);
  }

  function validateForm(): ResetFieldErrors {
    const errors: ResetFieldErrors = {};
    if (!password) errors.password = "Enter a new password.";
    if (password.length > 512) errors.password = "Your password is too long.";
    if (!confirmation) errors.confirmation = "Confirm your new password.";
    if (password && confirmation && password !== confirmation) {
      errors.confirmation = "The passwords must match.";
    }
    return errors;
  }

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!token) {
      setState("invalid");
      return;
    }

    const nextFieldErrors = validateForm();
    setFieldErrors(nextFieldErrors);
    setFormError(null);
    if (Object.keys(nextFieldErrors).length > 0) return;

    if (captchaRequired && !captchaToken) {
      setFormError(
        captchaUnavailable
          ? "Verification is temporarily unavailable. Please try again later."
          : "Complete the quick verification before resetting your password.",
      );
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPending(true);
    try {
      await resetPassword(
        {
          token,
          new_password: password,
          password_confirmation: confirmation,
          captchaResponse: captchaToken,
        },
        controller.signal,
      );
      setToken(null);
      setPassword("");
      setConfirmation("");
      setState("unavailable");
      setFormError(null);
      router.replace("/login?reset=complete");
    } catch (requestError) {
      if (isAbortError(requestError)) return;

      resetCaptchaWidget();
      if (requestError instanceof AuthApiError && requestError.kind === "invalid_recovery") {
        setToken(null);
        setState("invalid");
        setFormError(null);
      } else if (
        requestError instanceof AuthApiError &&
        requestError.kind === "challenge_required" &&
        requestError.challengeAction === "recovery"
      ) {
        setCaptchaRequired(true);
        setCaptchaUnavailable(false);
        setFormError("Please complete the quick verification before resetting your password.");
      } else {
        setFormError(resetErrorMessage(requestError));
      }
    } finally {
      setPending(false);
    }
  }

  if (state === "checking") {
    return (
      <div className="auth-inline-status" role="status" aria-live="polite">
        <Spinner aria-hidden="true" />
        Checking this recovery link…
      </div>
    );
  }

  if (state === "invalid" || state === "unavailable") {
    return (
      <section className="auth-result" role="status" aria-live="polite">
        <p className="auth-eyebrow">Recovery link</p>
        <h1>We can’t use this link.</h1>
        <p>
          The link may be missing, expired, already used, or temporarily unavailable. Request a
          new link to continue.
        </p>
        <Link className="auth-primary-link" href="/account/recovery">
          Request a new link
        </Link>
      </section>
    );
  }

  return (
    <form aria-busy={pending} className="auth-form" noValidate onSubmit={submitReset}>
      <header className="auth-form__header">
        <p className="auth-eyebrow">Password reset</p>
        <h1>Choose a new password.</h1>
        <p>Use a password you do not use elsewhere.</p>
      </header>

      {formError ? (
        <p className="auth-form__error" role="alert">
          {formError}
        </p>
      ) : null}

      {captchaRequired ? (
        <div className="auth-challenge" aria-live="polite">
          <p>Complete the quick verification, then we’ll try the reset again.</p>
          <TurnstileField
            action="recovery"
            disabled={pending}
            key={captchaResetKey}
            onError={() => {
              setCaptchaToken(null);
              setCaptchaUnavailable(true);
              setFormError("Verification is temporarily unavailable. Please try again later.");
            }}
            onToken={(nextToken) => {
              setCaptchaToken(nextToken);
              setCaptchaUnavailable(false);
              setFormError(null);
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
        <Label htmlFor="reset-password">New password</Label>
        <PasswordField
          aria-describedby={fieldErrors.password ? "reset-password-error" : undefined}
          aria-invalid={Boolean(fieldErrors.password)}
          autoComplete="new-password"
          autoFocus
          disabled={pending}
          id="reset-password"
          maxLength={512}
          name="new-password"
          onChange={(event) => {
            setPassword(event.target.value);
            setFieldErrors((current) => ({ ...current, password: undefined }));
            setFormError(null);
          }}
          required
          value={password}
        />
        {fieldErrors.password ? (
          <FieldError id="reset-password-error">{fieldErrors.password}</FieldError>
        ) : null}
      </div>

      <div className="auth-field">
        <Label htmlFor="reset-confirmation">Confirm new password</Label>
        <PasswordField
          aria-describedby={fieldErrors.confirmation ? "reset-confirmation-error" : undefined}
          aria-invalid={Boolean(fieldErrors.confirmation)}
          autoComplete="new-password"
          disabled={pending}
          id="reset-confirmation"
          maxLength={512}
          name="new-password-confirmation"
          onChange={(event) => {
            setConfirmation(event.target.value);
            setFieldErrors((current) => ({ ...current, confirmation: undefined }));
            setFormError(null);
          }}
          required
          value={confirmation}
        />
        {fieldErrors.confirmation ? (
          <FieldError id="reset-confirmation-error">{fieldErrors.confirmation}</FieldError>
        ) : null}
      </div>

      <div className="auth-form__actions">
        <Button
          disabled={pending || captchaUnavailable || (captchaRequired && !captchaToken)}
          type="submit"
        >
          {pending ? "Updating password…" : "Set new password"}
        </Button>
      </div>

      <p className="auth-secondary-copy">
        Need a new recovery link? <Link href="/account/recovery">Start again</Link>
      </p>
    </form>
  );
}
