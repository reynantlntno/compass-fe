"use client";

import { RefreshCw } from "lucide-react";

import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
import { PortalPageHeader } from "@/components/portal/portal-page-header";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section aria-labelledby="portal-requests-error-heading" className="portal-counseling portal-requests portal-counseling--state" role="alert">
      <PortalPageHeader
        className="portal-counseling__page-header"
        current="Requests & Certificates"
        description="Manage authorized Good Moral Certificate requests within your workspace scope."
        headingId="portal-requests-error-heading"
        title="Requests & Certificates"
      />
      <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state">
        <h2>We couldn’t load Requests &amp; Certificates.</h2>
        <p>Try again when the connection is ready.</p>
        <Button onClick={reset} type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button>
      </PortalCollectionFrame>
    </section>
  );
}
