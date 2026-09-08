"use client";

import { CompassErrorPage } from "@/components/system/compass-error-page";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;

  return (
    <CompassErrorPage
      action={
        <button className="compass-status-action" onClick={reset} type="button">
          Try again
        </button>
      }
      code="500"
      description="Please try again, or return to the COMPASS home page."
      title="COMPASS couldn’t open this page."
    />
  );
}
