"use client";

import Link from "next/link";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <section
      aria-labelledby="portal-settings-error-heading"
      className="portal-settings-error"
      role="alert"
    >
      <h1 id="portal-settings-error-heading">We couldn’t load account settings.</h1>
      <p>Try again, or return to your workspace.</p>
      <div className="portal-settings-error__actions">
        <Button onClick={reset} type="button" variant="outline">
          <RefreshCw aria-hidden="true" />
          Try again
        </Button>
        <Button render={<Link href="/portal" />} type="button" variant="ghost">
          Back to portal home
        </Button>
      </div>
    </section>
  );
}
