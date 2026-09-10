"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { AuthBrand } from "@/components/auth/auth-brand";
import { AuthCard } from "@/components/auth/auth-card";
import { PortalAccessProvider } from "@/components/portal/portal-access-provider";
import { PortalNotificationsProvider } from "@/components/portal/portal-notifications-provider";
import { PortalShell } from "@/components/portal/portal-shell";
import { PageLoader } from "@/components/feedback/page-loader";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/components/auth/auth-session-provider";
import type { BrandingConfig } from "@/lib/branding";

export function PortalGate({
  branding,
  children,
}: {
  branding: BrandingConfig;
  children: ReactNode;
}) {
  const router = useRouter();
  const { status, user, refreshSession, signOut } = useAuthSession();
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.replace("/login");
    } finally {
      setIsSigningOut(false);
    }
  }, [router, signOut]);

  if (status === "unknown") {
    return <PageLoader label={`Checking your ${branding.productName} session…`} />;
  }

  if (status === "unauthenticated") {
    return (
      <main className="portal-gate portal-gate--redirect" role="status" aria-live="polite">
        Taking you to {branding.productName} sign in…
      </main>
    );
  }

  if (status === "unavailable" || !user) {
    return (
      <main className="portal-gate" aria-labelledby="portal-unavailable-heading">
        <section
          aria-label={`${branding.productName} session access`}
          className="portal-gate__stack"
        >
          <AuthCard as="header" variant="identity">
            <AuthBrand branding={branding} />
          </AuthCard>
          <AuthCard as="section" className="portal-gate__state" variant="state">
            <h1 id="portal-unavailable-heading">We couldn’t check your session.</h1>
            <p>Try again when the connection is ready.</p>
            <Button onClick={() => void refreshSession()} type="button">
              Try again
            </Button>
            <Link className="portal-gate__back-link" href="/">
              Back to {branding.productName}
            </Link>
          </AuthCard>
          <AuthCard as="footer" variant="notice">
            <p>
              {branding.productName} handles account information as described in the{" "}
              <Link href="/privacy">COMPASS Privacy Notice</Link>.
            </p>
          </AuthCard>
        </section>
      </main>
    );
  }

  return (
    <PortalAccessProvider>
      <PortalNotificationsProvider>
        <PortalShell
          branding={branding}
          isSigningOut={isSigningOut}
          onSignOut={handleSignOut}
        >
          {children}
        </PortalShell>
      </PortalNotificationsProvider>
    </PortalAccessProvider>
  );
}
