import { createElement, type HTMLAttributes, type ReactNode } from "react";

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
  return createElement(
    as,
    {
      ...props,
      className: cn("auth-card", `auth-card--${variant}`, className),
    },
    children,
  );
}
