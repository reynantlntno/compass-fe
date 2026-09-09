"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { TurnstileField } from "@/components/public/turnstile-field";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthApiError, requestPasswordRecovery } from "@/lib/api/auth";

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function recoveryErrorMessage(error: unknown): string {
  if (!(error instanceof AuthApiError)) {
    return "Recovery is temporarily unavailable. Please try again shortly.";
  }

  switch (error.kind) {
    case "rate_limited":
      return "Please wait a little while before trying again.";
    case "validation":
      return "Enter a valid email address and try again.";
    case "unavailable":
      return "Recovery is temporarily unavailable. Please try again shortly.";
    default:
      return "We couldn’t complete the request. Please try again.";
  }
}

export function RecoveryRequestForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaUnavailable, setCaptchaUnavailable] = useState(false);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  function resetCaptchaWidget() {
    setCaptchaToken(null);
    setCaptchaResetKey((current) => current + 1);
  }

  function updateEmail(value: string) {
    setEmail(value);
    setFieldError(null);
    setError(null);
    if (captchaRequired) resetCaptchaWidget();
    setCaptchaUnavailable(false);
  }

  async function submitRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const normalizedEmail = email.trim();
    if (!normalizedEmail || normalizedEmail.length > 254 || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setFieldError("Enter a valid email address.");
      return;
    }

    if (captchaRequired && !captchaToken) {
      setError(
        captchaUnavailable
          ? "Verification is temporarily unavailable. Please try again later."
          : "Complete the quick verification before requesting recovery.",
      );
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPending(true);
    setError(null);
    setFieldError(null);

    try {
      await requestPasswordRecovery(normalizedEmail, captchaToken, controller.signal);
      setSubmitted(true);
      setEmail("");
      setCaptchaRequired(false);
      resetCaptchaWidget();
    } catch (requestError) {
      if (isAbortError(requestError)) return;

      resetCaptchaWidget();
      if (
        requestError instanceof AuthApiError &&
        requestError.kind === "challenge_required" &&
        requestError.challengeAction === "recovery"
      ) {
        setCaptchaRequired(true);
        setCaptchaUnavailable(false);
        setError("Please complete the quick verification before requesting recovery.");
      } else {
        setError(recoveryErrorMessage(requestError));
      }
    } finally {
      setPending(false);
    }
  }

  if (submitted) {
    return (
      <section className="auth-result" role="status" aria-live="polite">
        <p className="auth-eyebrow">Recovery request</p>
        <h1>Check your email.</h1>
        <p>
          If an account exists for that address, we’ll send recovery instructions. This message
          is the same either way to protect account privacy.
        </p>
        <div className="auth-result__actions">
          <Link className="auth-primary-link" href="/login">
            Return to sign in
          </Link>
          <Button
            onClick={() => {
              setSubmitted(false);
              setError(null);
            }}
            type="button"
            variant="ghost"
          >
            Try another address
          </Button>
        </div>
      </section>
    );
  }

  return (
    <form
      aria-busy={pending}
      className="auth-form"
      noValidate
      onSubmit={submitRecovery}
    >
      <header className="auth-form__header">
        <p className="auth-eyebrow">Account recovery</p>
        <h1>Find your way back in.</h1>
        <p>Enter the email address connected to your COMPASS account.</p>
      </header>

      {error ? (
        <p className="auth-form__error" role="alert">
          {error}
        </p>
      ) : null}

      {captchaRequired ? (
        <div className="auth-challenge" aria-live="polite">
          <p>Complete the quick verification, then we’ll try the request again.</p>
          <TurnstileField
            action="recovery"
            disabled={pending}
            key={captchaResetKey}
            onError={() => {
              setCaptchaToken(null);
              setCaptchaUnavailable(true);
              setError("Verification is temporarily unavailable. Please try again later.");
            }}
            onToken={(token) => {
              setCaptchaToken(token);
              setCaptchaUnavailable(false);
              setError(null);
            }}
            onUnavailable={() => {
              setCaptchaToken(null);
              setCaptchaUnavailable(true);
              setError("Verification is temporarily unavailable. Please try again later.");
            }}
            resetKey={captchaResetKey}
          />
          {captchaUnavailable ? (
            <button
              className="auth-text-button"
              onClick={() => {
                setCaptchaUnavailable(false);
                setError(null);
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
        <Label htmlFor="recovery-email">Email address</Label>
        <Input
          aria-describedby={fieldError ? "recovery-email-error" : undefined}
          aria-invalid={Boolean(fieldError)}
          autoComplete="email"
          autoFocus
          disabled={pending}
          id="recovery-email"
          inputMode="email"
          maxLength={254}
          name="email"
          onChange={(event) => updateEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
        {fieldError ? <FieldError id="recovery-email-error">{fieldError}</FieldError> : null}
      </div>

      <div className="auth-form__actions">
        <Button
          disabled={pending || captchaUnavailable || (captchaRequired && !captchaToken)}
          type="submit"
        >
          {pending ? "Sending request…" : "Send recovery instructions"}
        </Button>
      </div>

      <p className="auth-secondary-copy">
        Remembered your password? <Link href="/login">Return to sign in</Link>
      </p>
    </form>
  );
}
