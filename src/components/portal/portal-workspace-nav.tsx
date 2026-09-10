import Link from "next/link";

import { CompassSurface } from "@/components/compass/compass-surface";
import { cn } from "@/lib/utils";

export type PortalWorkspaceNavItem = {
  href: string;
  label: string;
  value: string;
};

type PortalWorkspaceNavProps = {
  activeValue: string;
  ariaLabel: string;
  className?: string;
  items: readonly PortalWorkspaceNavItem[];
};

export function PortalWorkspaceNav({
  activeValue,
  ariaLabel,
  className,
  items,
}: PortalWorkspaceNavProps) {
  return (
    <CompassSurface
      aria-label={ariaLabel}
      as="nav"
      className={cn("portal-workspace-nav", className)}
      tone="subtle"
    >
      <ul className="portal-workspace-nav__list">
        {items.map((item) => {
          const isCurrent = item.value === activeValue;

          return (
            <li key={item.value}>
              <Link
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "portal-workspace-nav__link",
                  isCurrent && "is-current",
                )}
                href={item.href}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </CompassSurface>
  );
}
