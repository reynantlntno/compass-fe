import { CompassLoader } from "@/components/feedback/compass-loader";
import { cn } from "@/lib/utils";

export function PageLoader({
  label = "Loading COMPASS…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("compass-page-loader", className)} role="status" aria-live="polite">
      <CompassLoader label={label} size="lg" />
      <p aria-hidden="true" className="compass-page-loader__label">
        {label}
      </p>
    </div>
  );
}
