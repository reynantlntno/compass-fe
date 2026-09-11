"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
import { PortalPageHeader } from "@/components/portal/portal-page-header";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <section
      aria-labelledby="portal-counseling-session-error-heading"
      className="portal-session-workspace portal-session-workspace--state"
      role="alert"
    >
      <PortalPageHeader
        current="Counseling session"
        description="Try again, or return to the Counseling workspace."
        headingId="portal-counseling-session-error-heading"
        title="We couldn’t load this session."
      />
      <PortalCollectionFrame className="portal-session-workspace__loading">
        <div className="portal-session-workspace__state-actions">
          <Button onClick={reset} type="button" variant="outline">
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
          <Button render={<Link href="/portal/counseling?section=sessions" />} type="button" variant="ghost">
            Back to sessions
          </Button>
        </div>
      </PortalCollectionFrame>
    </section>
  );
}
