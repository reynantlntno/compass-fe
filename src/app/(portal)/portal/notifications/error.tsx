"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <section
      aria-labelledby="portal-notifications-error-heading"
      className="portal-notifications portal-notifications--state"
      role="alert"
    >
      <h1 id="portal-notifications-error-heading">We couldn’t load notifications.</h1>
      <p>Try again, or return to your workspace.</p>
      <Button onClick={reset} type="button" variant="outline">
        Try again
      </Button>
    </section>
  );
}
