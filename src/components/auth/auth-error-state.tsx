"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export function AuthErrorState({
  kind,
  reset,
}: {
  kind: "student" | "staff";
  reset: () => void;
}) {
  const accountLabel = kind === "student" ? "student" : "staff";

  return (
    <section aria-live="assertive" className="auth-result" role="alert">
      <p className="auth-eyebrow">Account activation</p>
      <h1>We couldn’t open this page.</h1>
      <p>
        Please try again, or return to sign in and use your {accountLabel} invitation
        link again.
      </p>
      <div className="auth-result__actions">
        <Button onClick={reset} type="button">
          Try again
        </Button>
        <Link className="auth-secondary-link" href="/login">
          Continue to sign in
        </Link>
      </div>
    </section>
  );
}
