"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
import { PortalPageHeader } from "@/components/portal/portal-page-header";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <section aria-labelledby="portal-counseling-error-heading" className="portal-counseling portal-counseling--state" role="alert">
      <PortalPageHeader
        className="portal-counseling__page-header"
        current="Counseling"
        description="Try again, or return to your workspace."
        headingId="portal-counseling-error-heading"
        title="We couldn’t load counseling."
      />
      <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state">
        <div className="portal-counseling__state-actions">
          <Button onClick={reset} type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button>
          <Button render={<Link href="/portal" />} type="button" variant="ghost">Return to portal</Button>
        </div>
      </PortalCollectionFrame>
    </section>
  );
}
