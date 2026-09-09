import type { LucideIcon } from "lucide-react";
import { Activity, Bell, House } from "lucide-react";

export const PORTAL_CAPABILITIES = {
  systemHealthView: "system.health.view",
} as const;

export type PortalNavigationLink = {
  kind: "link";
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  requiredCapability?: string;
};

export type PortalNavigationMenu = {
  kind: "menu";
  id: string;
  label: string;
  icon: LucideIcon;
  items: readonly PortalNavigationLink[];
  requiredCapability?: string;
};

export type PortalNavigationItem =
  | PortalNavigationLink
  | PortalNavigationMenu;

/**
 * This registry describes implemented portal destinations only. Visibility is
 * a presentation concern; every destination remains protected by its backend
 * endpoint when it is opened directly.
 */
export const PORTAL_NAVIGATION: readonly PortalNavigationItem[] = [
  {
    kind: "link",
    id: "home",
    href: "/portal",
    label: "Home",
    icon: House,
  },
  {
    kind: "link",
    id: "notifications",
    href: "/portal/notifications",
    label: "Notifications",
    icon: Bell,
  },
  {
    kind: "link",
    id: "system-health",
    href: "/portal/system-health",
    label: "System health",
    icon: Activity,
    requiredCapability: PORTAL_CAPABILITIES.systemHealthView,
  },
];

function hasRequiredCapability(
  item: PortalNavigationItem | PortalNavigationLink,
  capabilities: readonly string[],
) {
  return (
    !item.requiredCapability || capabilities.includes(item.requiredCapability)
  );
}

export function getVisiblePortalNavigation(
  capabilities: readonly string[],
): PortalNavigationItem[] {
  const visibleItems: PortalNavigationItem[] = [];

  for (const item of PORTAL_NAVIGATION) {
    if (!hasRequiredCapability(item, capabilities)) continue;

    if (item.kind === "menu") {
      const visibleChildren = item.items.filter((child) =>
        hasRequiredCapability(child, capabilities),
      );
      if (visibleChildren.length === 0) continue;
      visibleItems.push({ ...item, items: visibleChildren });
      continue;
    }

    visibleItems.push(item);
  }

  return visibleItems;
}

export function isPortalNavigationItemActive(
  pathname: string | null,
  item: PortalNavigationItem | PortalNavigationLink,
): boolean {
  if (!pathname) return false;

  if (item.kind === "menu") {
    return item.items.some((child) =>
      isPortalNavigationItemActive(pathname, child),
    );
  }

  if (item.href === "/portal") return pathname === item.href;

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
