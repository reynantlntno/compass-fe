import type { ComponentPropsWithoutRef } from "react";

type PortalHomeWidgetProps = ComponentPropsWithoutRef<"section"> & {
  variant?: "default" | "overview";
};

export function PortalHomeWidget({
  className,
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

  return <section {...props} className={widgetClassName} />;
}
