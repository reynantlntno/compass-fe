import { createElement, type HTMLAttributes, type ReactNode } from "react";

import {
  CompassSurface,
  type CompassSurfaceTone,
} from "@/components/compass/compass-surface";
import { cn } from "@/lib/utils";

type AuthCardElement = "div" | "footer" | "header" | "section";
type AuthCardVariant = "content" | "identity" | "notice" | "state";

export function AuthCard({
  as = "div",
  children,
  className,
  variant,
  ...props
}: {
  as?: AuthCardElement;
  children: ReactNode;
  className?: string;
  variant: AuthCardVariant;
} & Omit<HTMLAttributes<HTMLElement>, "children" | "className">) {
  const tone: CompassSurfaceTone = variant === "notice" ? "muted" : "surface";

  return createElement(
    CompassSurface,
    {
      as,
      ...props,
      tone,
      className: cn("auth-card", `auth-card--${variant}`, className),
    },
    children,
  );
}
