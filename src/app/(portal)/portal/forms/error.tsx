"use client";

import { RefreshCw } from "lucide-react";

import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
import { PortalPageHeader } from "@/components/portal/portal-page-header";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section aria-labelledby="portal-forms-error-heading" className="portal-counseling portal-counseling--state" role="alert">
      <PortalPageHeader
        className="portal-counseling__page-header"
        current="Forms & submissions"
        description="Review authorized student form submissions within your workspace scope."
        headingId="portal-forms-error-heading"
        title="Forms & submissions"
      />
      <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state">
        <h2>We couldn’t load forms and submissions.</h2>
        <p>Try again when the connection is ready.</p>
        <Button onClick={reset} type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button>
      </PortalCollectionFrame>
    </section>
  );
}
