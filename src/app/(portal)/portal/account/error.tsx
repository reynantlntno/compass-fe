"use client";

import { Button } from "@/components/ui/button";
import { PortalBreadcrumb } from "@/components/portal/portal-breadcrumb";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <section
      aria-labelledby="portal-account-error-heading"
      className="portal-account portal-account--state"
      role="alert"
    >
      <PortalBreadcrumb current="Account information" />
      <div className="portal-account__frame portal-account__frame--state">
        <h1 id="portal-account-error-heading">We couldn’t load account information.</h1>
        <p>Try again, or return to your workspace.</p>
        <Button onClick={reset} type="button" variant="outline">
          Try again
        </Button>
      </div>
    </section>
  );
}
