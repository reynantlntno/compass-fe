import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function ExternalLink({
  href,
  children,
  className,
  ariaLabel,
  showArrow = true,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  showArrow?: boolean;
}) {
  return (
    <a
      aria-label={ariaLabel}
      className={cn("public-external-link", className)}
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {children}
      {showArrow ? (
        <ArrowUpRight aria-hidden="true" className="public-external-link__icon" />
      ) : null}
    </a>
  );
}
