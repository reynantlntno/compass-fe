import type { ComponentPropsWithoutRef } from "react";
import type { LucideIcon } from "lucide-react";

import {
  CompassSurface,
  type CompassSurfaceTone,
} from "@/components/compass/compass-surface";

type PortalHomeWidgetProps = ComponentPropsWithoutRef<"section"> & {
  framed?: boolean;
  tone?: CompassSurfaceTone;
  variant?: "default" | "overview";
  watermarkIcon?: LucideIcon;
};

export function PortalHomeWidget({
  children,
  className,
  framed = true,
  tone,
  variant = "default",
  watermarkIcon: WatermarkIcon,
  ...props
}: PortalHomeWidgetProps) {
  const widgetClassName = [
    "portal-home__widget",
    `portal-home__widget--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {children}
      {WatermarkIcon ? (
        <WatermarkIcon
          aria-hidden="true"
          className="portal-home__widget-watermark"
          focusable="false"
          strokeWidth={1.35}
        />
      ) : null}
    </>
  );

  if (!framed) {
    return (
      <section {...props} className={widgetClassName}>
        {content}
      </section>
    );
  }

  return (
    <CompassSurface
      {...props}
      as="section"
      className={widgetClassName}
      tone={tone ?? (variant === "overview" ? "sage" : "surface")}
    >
      {content}
    </CompassSurface>
  );
}
