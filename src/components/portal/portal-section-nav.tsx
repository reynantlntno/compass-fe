import Link from "next/link";

import { cn } from "@/lib/utils";

export type PortalSectionNavItem = {
  href: string;
  label: string;
  value: string;
};

type PortalSectionNavProps = {
  activeValue: string;
  ariaLabel: string;
  items: readonly PortalSectionNavItem[];
};

export function PortalSectionNav({
  activeValue,
  ariaLabel,
  items,
}: PortalSectionNavProps) {
  return (
    <nav aria-label={ariaLabel} className="portal-section-nav">
      {items.map((item) => {
        const isCurrent = item.value === activeValue;

        return (
          <Link
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              "portal-section-nav__item",
              isCurrent && "is-current",
            )}
            href={item.href}
            key={item.value}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
