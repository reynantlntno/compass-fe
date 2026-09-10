"use client";

import { Button } from "@/components/ui/button";
import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
import { PortalPageHeader } from "@/components/portal/portal-page-header";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <section
      aria-labelledby="portal-account-error-heading"
      className="portal-account portal-account--state"
      role="alert"
    >
      <PortalPageHeader
        current="Account information"
        description="Review the information currently connected to your COMPASS account."
        headingId="portal-account-error-page-heading"
        title="Account information"
      />
      <PortalCollectionFrame
        aria-labelledby="portal-account-error-heading"
        as="div"
        className="portal-account__frame portal-account__frame--state"
      >
        <h2 id="portal-account-error-heading">We couldn’t load account information.</h2>
        <p>Try again, or return to your workspace.</p>
        <Button onClick={reset} type="button" variant="outline">
          Try again
        </Button>
      </PortalCollectionFrame>
    </section>
  );
}
