"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
import { PortalPageHeader } from "@/components/portal/portal-page-header";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <section
      aria-labelledby="portal-audit-route-error-heading"
      className="portal-audit portal-audit--state"
      role="alert"
    >
      <PortalPageHeader
        current="Audit trail"
        description="Try again, or return to your workspace."
        headingId="portal-audit-route-error-heading"
        title="We couldn’t load the audit trail."
      />
      <PortalCollectionFrame className="portal-audit__frame portal-audit__frame--state">
        <div className="portal-audit__state-actions">
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
