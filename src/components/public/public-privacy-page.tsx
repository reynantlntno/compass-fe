import { ContentRetryButton } from "@/components/public/content-retry-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

export function PublicPrivacyUnavailable() {
  return (
    <div className="public-content-state public-privacy-page__state" role="status" aria-live="polite">
      <p className="public-eyebrow">Privacy</p>
      <h2>We can’t show this right now</h2>
      <p>Please try again later.</p>
      <ContentRetryButton />
    </div>
  );
}

export function PublicPrivacyLoading() {
  return (
    <section
      aria-busy="true"
      className="public-section public-content-page public-content-loading public-privacy-page__loading"
    >
      <div className="public-shell public-reading-width">
        <div className="public-content-loading__status" role="status" aria-live="polite">
          <Spinner aria-hidden="true" className="size-4" />
          <span>Loading privacy notice…</span>
        </div>
        <div aria-hidden="true">
          <Skeleton className="public-content-skeleton__heading" />
          <Skeleton className="public-content-skeleton__summary" />
          <div className="public-content-skeleton-detail__body">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton className="public-content-skeleton__line" key={index} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function PublicPrivacyError({ reset }: { reset: () => void }) {
  return (
    <section className="public-section public-content-page public-content-page--state">
      <div className="public-shell public-reading-width">
        <div className="public-content-state" role="alert">
          <p className="public-eyebrow">Privacy</p>
          <h1>We can’t show this right now</h1>
          <p>Try again, or come back later.</p>
          <Button type="button" variant="outline" onClick={reset}>
            Try again
          </Button>
        </div>
      </div>
    </section>
  );
}
