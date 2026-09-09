"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PageLoader } from "@/components/feedback/page-loader";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/components/auth/auth-session-provider";

function displayName(firstName: string, email: string) {
  const normalized = firstName.trim();
  return normalized || email;
}

export function PortalGate() {
  const router = useRouter();
  const { status, user, refreshSession, signOut } = useAuthSession();
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);

  if (status === "unknown") {
    return <PageLoader label="Checking your COMPASS session…" />;
  }

  if (status === "unauthenticated") {
    return (
      <main className="portal-gate portal-gate--redirect" role="status" aria-live="polite">
        Taking you to sign in…
      </main>
    );
  }

  if (status === "unavailable" || !user) {
    return (
      <main className="portal-gate" aria-labelledby="portal-unavailable-heading">
        <div className="portal-gate__panel">
          <p className="auth-eyebrow">COMPASS</p>
          <h1 id="portal-unavailable-heading">We couldn’t check your session.</h1>
          <p>Try again when the connection is ready.</p>
          <Button onClick={() => void refreshSession()} type="button">
            Try again
          </Button>
          <Link className="auth-secondary-link" href="/">
            Back to COMPASS
          </Link>
        </div>
      </main>
    );
  }

  const name = displayName(user.first_name, user.email);

  return (
    <main className="portal-gate" aria-labelledby="portal-heading">
      <div className="portal-gate__panel">
        <p className="auth-eyebrow">COMPASS</p>
        <h1 id="portal-heading">Welcome, {name}.</h1>
        <p>You’re signed in and ready to continue.</p>
        <dl className="portal-gate__identity">
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{user.role}</dd>
          </div>
        </dl>
        <Button
          disabled={isSigningOut}
          onClick={async () => {
            setIsSigningOut(true);
            await signOut();
            router.replace("/login");
          }}
          type="button"
          variant="outline"
        >
          {isSigningOut ? "Signing out…" : "Sign out"}
        </Button>
      </div>
    </main>
  );
}
