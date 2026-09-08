import { Compass } from "lucide-react";

import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "size-7",
  md: "size-12",
  lg: "size-24",
} as const;

type CompassLoaderSize = keyof typeof sizeClasses;

export function CompassLoader({
  size = "md",
  label = "Loading COMPASS",
  className,
}: {
  size?: CompassLoaderSize;
  label?: string;
  className?: string;
}) {
  return (
    <div
      aria-live="polite"
      className={cn("inline-flex flex-col items-center gap-2", className)}
      role="status"
    >
      <div aria-hidden="true" className={cn("compass-loader", sizeClasses[size])}>
        <span className="compass-loader__ring" />
        <Compass className="relative z-10 size-full" strokeWidth={1.7} />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
