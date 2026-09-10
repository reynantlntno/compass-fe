import { cn } from "@/lib/utils";

import {
  CompassSurface,
  type CompassSurfaceProps,
} from "@/components/compass/compass-surface";

export function CompassFrame({ className, ...props }: CompassSurfaceProps) {
  return (
    <CompassSurface
      {...props}
      className={cn("compass-frame", className)}
    />
  );
}
