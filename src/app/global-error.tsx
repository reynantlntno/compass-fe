"use client";

import { CompassErrorPage } from "@/components/system/compass-error-page";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;

  return (
    <html lang="en">
      <head>
        <meta content="noindex, nofollow, noarchive" name="robots" />
      </head>
      <body>
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
      </body>
    </html>
  );
}
