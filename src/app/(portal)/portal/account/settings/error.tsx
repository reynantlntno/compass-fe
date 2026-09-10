"use client";

import Link from "next/link";

import { RefreshCw } from "lucide-react";

import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
import { PortalPageHeader } from "@/components/portal/portal-page-header";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <section
      aria-labelledby="portal-settings-error-heading"
      className="portal-settings-error"
      role="alert"
    >
      <PortalPageHeader
        current="Account settings"
        description="Manage sign-in security, active access, trusted browsers, notifications, and recent security activity."
        headingId="portal-settings-error-page-heading"
        title="Account settings"
      />
      <PortalCollectionFrame
        aria-labelledby="portal-settings-error-heading"
        as="div"
        className="portal-settings-error__frame"
      >
        <h2 id="portal-settings-error-heading">We couldn’t load account settings.</h2>
        <p>Try again, or return to your workspace.</p>
        <div className="portal-settings-error__actions">
          <Button onClick={reset} type="button" variant="outline">
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
          <Button render={<Link href="/portal" />} type="button" variant="ghost">
            Back to portal home
          </Button>
        </div>
      </PortalCollectionFrame>
    </section>
  );
}
