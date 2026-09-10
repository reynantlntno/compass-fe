import { CompassFrame } from "@/components/compass/compass-frame";
import type { CompassSurfaceProps } from "@/components/compass/compass-surface";
import { cn } from "@/lib/utils";

export function PortalCollectionFrame({
  as = "section",
  className,
  ...props
}: CompassSurfaceProps) {
  return (
    <CompassFrame
      {...props}
      as={as}
      className={cn("portal-collection-frame", className)}
    />
  );
}
