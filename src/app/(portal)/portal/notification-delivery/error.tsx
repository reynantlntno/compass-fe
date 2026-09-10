"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
import { PortalPageHeader } from "@/components/portal/portal-page-header";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <section
      aria-labelledby="portal-delivery-error-heading"
      className="portal-delivery portal-delivery--state"
      role="alert"
    >
      <PortalPageHeader
        className="portal-delivery__page-header"
        current="Notification delivery"
        description="Try again, or return to your workspace."
        headingId="portal-delivery-error-heading"
        title="We couldn’t load notification delivery."
      />
      <PortalCollectionFrame className="portal-delivery__frame portal-delivery__frame--state">
        <div className="portal-delivery__state-actions">
          <Button onClick={reset} type="button" variant="outline">
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
          <Button render={<Link href="/portal" />} type="button" variant="ghost">
            Return to portal
          </Button>
        </div>
      </PortalCollectionFrame>
    </section>
  );
}
