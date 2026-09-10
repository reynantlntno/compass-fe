import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  DatabaseBackup,
  House,
  Mail,
  ScrollText,
  Settings2,
} from "lucide-react";

export const PORTAL_CAPABILITIES = {
  backupsOperate: "backups.operate",
  backupsView: "backups.view",
  auditView: "audit.view",
  notificationsDeliveryOperate: "notifications.delivery.operate",
  restoresOperate: "restores.operate",
  systemHealthView: "system.health.view",
  systemOperationsManage: "system.operations.manage",
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
    id: "notification-delivery",
    href: "/portal/notification-delivery",
    label: "Notification delivery",
    icon: Mail,
    requiredCapability: PORTAL_CAPABILITIES.notificationsDeliveryOperate,
  },
  {
    kind: "link",
    id: "system-health",
    href: "/portal/system-health",
    label: "System health",
    icon: Activity,
    requiredCapability: PORTAL_CAPABILITIES.systemHealthView,
  },
  {
    kind: "link",
    id: "system-operations",
    href: "/portal/system-operations",
    label: "System operations",
    icon: Settings2,
    requiredCapability: PORTAL_CAPABILITIES.systemOperationsManage,
  },
  {
    kind: "link",
    id: "backups",
    href: "/portal/backups",
    label: "Backups & restore",
    icon: DatabaseBackup,
    requiredCapability: PORTAL_CAPABILITIES.backupsView,
  },
  {
    kind: "link",
    id: "audit",
    href: "/portal/audit",
    label: "Audit trail",
    icon: ScrollText,
    requiredCapability: PORTAL_CAPABILITIES.auditView,
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
