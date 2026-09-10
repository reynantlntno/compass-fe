"use client";

import { RefreshCw } from "lucide-react";

import { PortalBreadcrumb } from "@/components/portal/portal-breadcrumb";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <section
      aria-labelledby="portal-operations-error-heading"
      className="portal-operations portal-operations--state"
      role="alert"
    >
      <PortalBreadcrumb current="System operations" />
      <header className="portal-operations__header">
        <h1 id="portal-operations-error-heading">We couldn’t load system operations.</h1>
        <p>Try again, or return to your workspace.</p>
      </header>
      <div className="portal-operations__frame portal-operations__frame--state">
        <Button onClick={reset} type="button" variant="outline">
          <RefreshCw aria-hidden="true" />
          Try again
        </Button>
      </div>
    </section>
  );
}
