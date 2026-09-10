import type { ComponentPropsWithoutRef } from "react";

import {
  CompassSurface,
  type CompassSurfaceTone,
} from "@/components/compass/compass-surface";

type PortalHomeWidgetProps = ComponentPropsWithoutRef<"section"> & {
  framed?: boolean;
  tone?: CompassSurfaceTone;
  variant?: "default" | "overview";
};

export function PortalHomeWidget({
  className,
  framed = true,
  tone,
  variant = "default",
  ...props
}: PortalHomeWidgetProps) {
  const widgetClassName = [
    "portal-home__widget",
    `portal-home__widget--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (!framed) {
    return <section {...props} className={widgetClassName} />;
  }

  return (
    <CompassSurface
      {...props}
      as="section"
      className={widgetClassName}
      tone={tone ?? (variant === "overview" ? "sage" : "surface")}
    />
  );
}
