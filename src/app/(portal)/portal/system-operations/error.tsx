"use client";

import { RefreshCw } from "lucide-react";

import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
import { PortalPageHeader } from "@/components/portal/portal-page-header";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <section
      aria-labelledby="portal-operations-error-heading"
      className="portal-operations portal-operations--state"
      role="alert"
    >
      <PortalPageHeader
        current="System operations"
        description="Try again, or return to your workspace."
        headingId="portal-operations-error-heading"
        title="We couldn’t load system operations."
      />
      <PortalCollectionFrame as="div" className="portal-operations__frame portal-operations__frame--state">
        <Button onClick={reset} type="button" variant="outline">
          <RefreshCw aria-hidden="true" />
          Try again
        </Button>
      </PortalCollectionFrame>
    </section>
  );
}
