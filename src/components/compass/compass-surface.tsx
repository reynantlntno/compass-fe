import { createElement, type HTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type CompassSurfaceTone =
  | "muted"
  | "raised"
  | "sage"
  | "subtle"
  | "surface";

export type CompassSurfaceElement =
  | "article"
  | "aside"
  | "div"
  | "footer"
  | "header"
  | "nav"
  | "section";

export type CompassSurfaceProps = {
  as?: CompassSurfaceElement;
  children?: ReactNode;
  className?: string;
  tone?: CompassSurfaceTone;
} & Omit<HTMLAttributes<HTMLElement>, "children" | "className">;

export function CompassSurface({
  as = "div",
  children,
  className,
  tone = "surface",
  ...props
}: CompassSurfaceProps) {
  return createElement(
    as,
    {
      ...props,
      className: cn("compass-surface", className),
      "data-tone": tone,
    },
    children,
  );
}
