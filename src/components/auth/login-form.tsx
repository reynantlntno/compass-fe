"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { TurnstileField } from "@/components/public/turnstile-field";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AuthApiError,
  loginWithPassword,
  resendLoginOtp,
  verifyLogin,
} from "@/lib/api/auth";
import { useAuthSession } from "@/components/auth/auth-session-provider";

const OTP_RESEND_COOLDOWN_SECONDS = 60;

type LoginStage = "credentials" | "verification";

type LoginChallenge = {
  challengeId: string;
  pendingNonce: string;
  expiresAt: number;
};

type LoginField = "email" | "password" | "otp";
type LoginFieldErrors = Partial<Record<LoginField, string>>;

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function errorMessage(error: unknown, stage: LoginStage): string {
  if (!(error instanceof AuthApiError)) {
    return stage === "verification"
      ? "We couldn’t verify that code. Please try again."
      : "We couldn’t complete sign-in. Please try again.";
  }

  if (stage === "verification") {
    switch (error.kind) {
      case "invalid_credentials":
        return "That code didn’t work. Request a new code and try again.";
      case "rate_limited":
        return "Too many attempts. Please wait before trying again.";
      case "validation":
        return "Enter the verification code from the message we sent.";
      case "unavailable":
        return "Verification is temporarily unavailable. Please try again shortly.";
      default:
        return "We couldn’t verify that code. Please try again.";
    }
  }

  switch (error.kind) {
    case "invalid_credentials":
      return "We couldn’t sign you in with those details.";
    case "rate_limited":
      return "Too many attempts. Please wait a little while before trying again.";
    case "validation":
      return "Please check the information you entered and try again.";
    case "unavailable":
      return "Sign-in is temporarily unavailable. Please try again shortly.";
    default:
      return "We couldn’t complete sign-in. Please try again.";
  }
}

function validationErrors(email: string, password: string): LoginFieldErrors {
  const errors: LoginFieldErrors = {};
  const normalizedEmail = email.trim();

  if (!normalizedEmail) {
    errors.email = "Enter your email address.";
  } else if (normalizedEmail.length > 254 || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    errors.email = "Enter a valid email address.";
  }

  if (!password) errors.password = "Enter your password.";
  if (password.length > 512) errors.password = "Your password is too long.";

  return errors;
}

function otpValidationError(otp: string): string | undefined {
  const normalized = otp.trim();
  if (!normalized) return "Enter the verification code from the message we sent.";
  if (!/^\d{6}$/.test(normalized)) return "Enter the six-digit verification code.";
  return undefined;
}

export function LoginForm() {
  const router = useRouter();
  const { status: authStatus, refreshSession } = useAuthSession();
  const [stage, setStage] = useState<LoginStage>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [challenge, setChallenge] = useState<LoginChallenge | null>(null);
  const [challengeSeconds, setChallengeSeconds] = useState(0);
  const [resendUntil, setResendUntil] = useState(0);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaUnavailable, setCaptchaUnavailable] = useState(false);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") router.replace("/portal");
  }, [authStatus, router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reset") !== "complete") return;

    const noticeTimer = window.setTimeout(() => {
      window.history.replaceState(null, document.title, window.location.pathname);
      setNotice("Your password was updated. You can sign in with the new password.");
    }, 0);

    return () => window.clearTimeout(noticeTimer);
  }, []);

  useEffect(() => {
    if (stage !== "verification" || !challenge) return;

    const updateCountdown = () => {
      const now = Date.now();
      const nextChallengeSeconds = Math.max(
        0,
        Math.ceil((challenge.expiresAt - now) / 1000),
      );
      const nextResendSeconds = Math.max(
        0,
        Math.ceil((resendUntil - now) / 1000),
      );

      setChallengeSeconds(nextChallengeSeconds);
      setResendSeconds(nextResendSeconds);

      if (nextChallengeSeconds === 0) {
        setStage("credentials");
        setChallenge(null);
        setOtp("");
        setTrustDevice(false);
        setResendUntil(0);
        setFormError("Your verification window expired. Please sign in again.");
        setNotice(null);
      }
    };

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [challenge, resendUntil, stage]);

  function beginRequest() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    return controller.signal;
  }

  function resetCaptchaWidget() {
    setCaptchaToken(null);
    setCaptchaResetKey((current) => current + 1);
  }

  function clearSensitiveState() {
    setPassword("");
    setOtp("");
    setTrustDevice(false);
    setChallenge(null);
    setStage("credentials");
    resetCaptchaWidget();
    setCaptchaRequired(false);
  }

  function updateEmail(value: string) {
    setEmail(value);
    setFieldErrors((current) => ({ ...current, email: undefined }));
    setFormError(null);
    if (captchaRequired) resetCaptchaWidget();
    setCaptchaUnavailable(false);
  }

  function updatePassword(value: string) {
    setPassword(value);
    setFieldErrors((current) => ({ ...current, password: undefined }));
    setFormError(null);
    if (captchaRequired) resetCaptchaWidget();
    setCaptchaUnavailable(false);
  }

  async function continueToPortal() {
    const nextStatus = await refreshSession();
    if (nextStatus !== "authenticated") {
      throw new AuthApiError("unavailable");
    }
    router.replace("/portal");
  }

  async function submitCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const nextFieldErrors = validationErrors(email, password);
    setFieldErrors(nextFieldErrors);
    setFormError(null);
    setNotice(null);
    if (Object.keys(nextFieldErrors).length > 0) return;

    if (captchaRequired && !captchaToken) {
      setFormError(
        captchaUnavailable
          ? "Verification is temporarily unavailable. Please try again later."
          : "Complete the quick verification before signing in.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await loginWithPassword(
        {
          email,
          password,
          captchaResponse: captchaToken,
        },
        beginRequest(),
      );

      if (result.kind === "signed-in") {
        clearSensitiveState();
        await continueToPortal();
        return;
      }

      setPassword("");
      setChallenge({
        challengeId: result.challenge.challenge_id,
        pendingNonce: result.challenge.pending_nonce,
        expiresAt: Date.now() + result.challenge.expires_in * 1000,
      });
      setOtp("");
      setTrustDevice(false);
      setResendUntil(Date.now() + OTP_RESEND_COOLDOWN_SECONDS * 1000);
      setStage("verification");
      setNotice("A verification code was sent to your approved contact channel.");
      setCaptchaRequired(false);
      resetCaptchaWidget();
    } catch (error) {
      if (isAbortError(error)) return;

      resetCaptchaWidget();
      if (
        error instanceof AuthApiError &&
        error.kind === "challenge_required" &&
        error.challengeAction === "login"
      ) {
        setCaptchaRequired(true);
        setCaptchaUnavailable(false);
        setFormError("Please complete the quick verification before signing in.");
      } else {
        setFormError(errorMessage(error, "credentials"));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge || isSubmitting) return;

    const otpError = otpValidationError(otp);
    setFieldErrors(otpError ? { otp: otpError } : {});
    setFormError(null);
    setNotice(null);
    if (otpError) return;

    setIsSubmitting(true);
    try {
      await verifyLogin(
        {
          challenge_id: challenge.challengeId,
          pending_nonce: challenge.pendingNonce,
          otp: otp.trim(),
          trust_device: trustDevice,
        },
        beginRequest(),
      );
      clearSensitiveState();
      await continueToPortal();
    } catch (error) {
      if (isAbortError(error)) return;
      setFormError(errorMessage(error, "verification"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendCode() {
    if (!challenge || resendSeconds > 0 || isSubmitting) return;

    setIsSubmitting(true);
    setFormError(null);
    setNotice(null);
    try {
      await resendLoginOtp(
        {
          challenge_id: challenge.challengeId,
          pending_nonce: challenge.pendingNonce,
        },
        beginRequest(),
      );
      setResendUntil(Date.now() + OTP_RESEND_COOLDOWN_SECONDS * 1000);
      setNotice("A new verification code was requested.");
      setOtp("");
      setFieldErrors({});
    } catch (error) {
      if (!isAbortError(error)) setFormError(errorMessage(error, "verification"));
    } finally {
      setIsSubmitting(false);
    }
  }

  function useDifferentAccount() {
    clearSensitiveState();
    setEmail("");
    setFormError(null);
    setNotice(null);
    setFieldErrors({});
    setResendUntil(0);
  }

  if (authStatus === "authenticated") {
    return (
      <div className="auth-inline-status" role="status" aria-live="polite">
        Opening COMPASS…
      </div>
    );
  }

  if (stage === "verification" && challenge) {
    return (
      <form
        aria-busy={isSubmitting}
        className="auth-form"
        noValidate
        onSubmit={submitVerification}
      >
        <header className="auth-form__header">
          <p className="auth-eyebrow">One more step</p>
          <h1 id="login-heading">Check your code.</h1>
          <p>Enter the six-digit code sent to your approved contact channel.</p>
        </header>

        {notice ? (
          <p className="auth-form__notice" role="status" aria-live="polite">
            {notice}
          </p>
        ) : null}
        {formError ? (
          <p className="auth-form__error" role="alert">
            {formError}
          </p>
        ) : null}

        <div className="auth-field">
          <Label htmlFor="login-otp">Verification code</Label>
          <Input
            aria-describedby={fieldErrors.otp ? "login-otp-error" : undefined}
            aria-invalid={Boolean(fieldErrors.otp)}
            autoComplete="one-time-code"
            autoFocus
            disabled={isSubmitting}
            id="login-otp"
            inputMode="numeric"
            maxLength={6}
            name="otp"
            onChange={(event) => {
              setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
              setFieldErrors((current) => ({ ...current, otp: undefined }));
            }}
            pattern="[0-9]{6}"
            required
            value={otp}
          />
          {fieldErrors.otp ? (
            <FieldError id="login-otp-error">{fieldErrors.otp}</FieldError>
          ) : null}
        </div>

        <div className="auth-choice">
          <Checkbox
            checked={trustDevice}
            disabled={isSubmitting}
            id="login-trust-device"
            onCheckedChange={setTrustDevice}
          />
          <div>
            <Label htmlFor="login-trust-device">Trust this browser for future sign-ins</Label>
            <p>The account’s security policy decides whether this can be used.</p>
          </div>
        </div>

        <div className="auth-form__actions">
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? "Checking…" : "Continue"}
          </Button>
          <button
            className="auth-text-button"
            disabled={isSubmitting}
            onClick={resendCode}
            type="button"
          >
            {resendSeconds > 0
              ? `Resend code in ${resendSeconds}s`
              : "Resend verification code"}
          </button>
          <button
            className="auth-text-button"
            disabled={isSubmitting}
            onClick={useDifferentAccount}
            type="button"
          >
            Use a different account
          </button>
        </div>

        <p className="auth-form__countdown" role="status" aria-live="polite">
          This code expires in {challengeSeconds}s.
        </p>
      </form>
    );
  }

  return (
    <form
      aria-busy={isSubmitting}
      className="auth-form"
      noValidate
      onSubmit={submitCredentials}
    >
      <header className="auth-form__header">
        <p className="auth-eyebrow">Sign in</p>
        <h1 id="login-heading">Sign in to COMPASS.</h1>
        <p>Use the email address and password for your COMPASS account.</p>
      </header>

      {notice ? (
        <p className="auth-form__notice" role="status" aria-live="polite">
          {notice}
        </p>
      ) : null}
      {formError ? (
        <p className="auth-form__error" role="alert">
          {formError}
        </p>
      ) : null}

      {captchaRequired ? (
        <div className="auth-challenge" aria-live="polite">
          <p>Complete the quick verification, then we’ll try sign-in again.</p>
          <TurnstileField
            action="login"
            disabled={isSubmitting}
            key={captchaResetKey}
            onError={() => {
              setCaptchaToken(null);
              setCaptchaUnavailable(true);
              setFormError("Verification is temporarily unavailable. Please try again later.");
            }}
            onToken={(token) => {
              setCaptchaToken(token);
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
        <Label htmlFor="login-email">Email address</Label>
        <Input
          aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
          aria-invalid={Boolean(fieldErrors.email)}
          autoComplete="username"
          autoFocus
          disabled={isSubmitting}
          id="login-email"
          inputMode="email"
          maxLength={254}
          name="email"
          onChange={(event) => updateEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
        {fieldErrors.email ? (
          <FieldError id="login-email-error">{fieldErrors.email}</FieldError>
        ) : null}
      </div>

      <div className="auth-field">
        <div className="auth-field__label-row">
          <Label htmlFor="login-password">Password</Label>
          <Link className="auth-field__link" href="/account/recovery">
            Forgot password?
          </Link>
        </div>
        <PasswordField
          aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
          aria-invalid={Boolean(fieldErrors.password)}
          autoComplete="current-password"
          disabled={isSubmitting}
          id="login-password"
          maxLength={512}
          name="password"
          onChange={(event) => updatePassword(event.target.value)}
          required
          value={password}
        />
        {fieldErrors.password ? (
          <FieldError id="login-password-error">{fieldErrors.password}</FieldError>
        ) : null}
      </div>

      <div className="auth-form__actions">
        <Button
          disabled={
            isSubmitting ||
            captchaUnavailable ||
            (captchaRequired && !captchaToken)
          }
          type="submit"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </div>
    </form>
  );
}
