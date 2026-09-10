"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { PortalBreadcrumb } from "@/components/portal/portal-breadcrumb";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <section
      aria-labelledby="portal-backups-error-heading"
      className="portal-backups portal-backups--state"
      role="alert"
    >
      <PortalBreadcrumb current="Backups & restore" />
      <header className="portal-backups__header">
        <h1 id="portal-backups-error-heading">We couldn’t load backups &amp; restore.</h1>
        <p>Try again, or return to your workspace.</p>
      </header>
      <div className="portal-backups__frame portal-backups__frame--state">
        <div className="portal-backups__state-actions">
          <Button onClick={reset} type="button" variant="outline">
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
          <Button render={<Link href="/portal" />} type="button" variant="ghost">
            Return to portal
          </Button>
        </div>
      </div>
    </section>
  );
}
