"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { PortalBreadcrumb } from "@/components/portal/portal-breadcrumb";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <section
      aria-labelledby="portal-audit-route-error-heading"
      className="portal-audit portal-audit--state"
      role="alert"
    >
      <PortalBreadcrumb current="Audit trail" />
      <header className="portal-audit__header">
        <h1 id="portal-audit-route-error-heading">We couldn’t load the audit trail.</h1>
        <p>Try again, or return to your workspace.</p>
      </header>
      <div className="portal-audit__frame portal-audit__frame--state">
        <div className="portal-audit__state-actions">
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
