"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
import { PortalPageHeader } from "@/components/portal/portal-page-header";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <section aria-labelledby="portal-appointments-error-heading" className="portal-appointments portal-appointments--state" role="alert">
      <PortalPageHeader
        className="portal-appointments__page-header"
        current="Appointments"
        description="Try again, or return to your workspace."
        headingId="portal-appointments-error-heading"
        title="We couldn’t load appointments."
      />
      <PortalCollectionFrame className="portal-appointments__frame portal-appointments__frame--state">
        <div className="portal-appointments__state-actions">
          <Button onClick={reset} type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button>
          <Button render={<Link href="/portal" />} type="button" variant="ghost">Return to portal</Button>
        </div>
      </PortalCollectionFrame>
    </section>
  );
}
