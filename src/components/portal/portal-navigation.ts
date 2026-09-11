import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  CalendarDays,
  DatabaseBackup,
  HeartHandshake,
  House,
  Mail,
  ScrollText,
  Settings2,
} from "lucide-react";
import type { AuthorityMeProjectionSchemaAuditPlanesItem } from "@/lib/api/generated/model";

export const PORTAL_CAPABILITIES = {
  backupsOperate: "backups.operate",
  backupsView: "backups.view",
  notificationsDeliveryOperate: "notifications.delivery.operate",
  appointmentsQueueView: "appointments.queue.view",
  counselingSessionsQueueView: "counseling.sessions.queue.view",
  counselingSessionLock: "counseling_sessions.lock",
  counselingRoutineReopen: "routine_interviews.reopen",
  appointmentsReview: "appointments.review",
  appointmentsSchedule: "appointments.schedule",
  appointmentsCancel: "appointments.cancel",
  appointmentsOutcomeManage: "appointments.outcome.manage",
  restoresOperate: "restores.operate",
  systemErrorsView: "system.errors.view",
  systemHealthView: "system.health.view",
  systemOperationsManage: "system.operations.manage",
} as const;

export type PortalAuditPlane = AuthorityMeProjectionSchemaAuditPlanesItem;

export const PORTAL_AUDIT_PLANE_ORDER: readonly PortalAuditPlane[] = [
  "technical",
  "business",
  "privacy",
];

export type PortalNavigationLink = {
  kind: "link";
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  keywords?: readonly string[];
  requiredCapability?: string;
  requiresAuditAccess?: boolean;
};

export type PortalNavigationMenu = {
  kind: "menu";
  id: string;
  label: string;
  icon: LucideIcon;
  items: readonly PortalNavigationLink[];
  requiredCapability?: string;
  requiresAuditAccess?: boolean;
};

export type PortalNavigationItem =
  | PortalNavigationLink
  | PortalNavigationMenu;

export type PortalSearchItem = {
  group: "destination" | "section";
  href: string;
  id: string;
  keywords?: readonly string[];
  label: string;
  parentLabel?: string;
  requiredCapability?: string;
  requiresAuditAccess?: boolean;
};

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
    id: "appointments",
    href: "/portal/appointments",
    label: "Appointments",
    icon: CalendarDays,
    keywords: ["schedule", "queue", "sessions", "counseling"],
    requiredCapability: PORTAL_CAPABILITIES.appointmentsQueueView,
  },
  {
    kind: "link",
    id: "counseling",
    href: "/portal/counseling?section=sessions",
    label: "Counseling",
    icon: HeartHandshake,
    keywords: ["sessions", "routine interview", "e-counseling"],
    requiredCapability: PORTAL_CAPABILITIES.counselingSessionsQueueView,
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
    requiresAuditAccess: true,
  },
];

const PORTAL_SEARCH_ADDITIONS: readonly PortalSearchItem[] = [
  {
    group: "section",
    href: "/portal/counseling?section=sessions",
    id: "counseling-sessions",
    keywords: ["counselor", "session", "e-counseling", "routine interview"],
    label: "Sessions",
    parentLabel: "Counseling",
    requiredCapability: PORTAL_CAPABILITIES.counselingSessionsQueueView,
  },
  {
    group: "section",
    href: "/portal/counseling?section=routine-interviews",
    id: "counseling-routine-interviews",
    keywords: ["counselor", "intake", "evaluation", "interview", "review"],
    label: "Routine interviews",
    parentLabel: "Counseling",
    requiredCapability: PORTAL_CAPABILITIES.counselingSessionsQueueView,
  },
  {
    group: "destination",
    href: "/portal/account",
    id: "account-information",
    keywords: ["profile", "identity", "appointment", "coverage"],
    label: "Account information",
  },
  {
    group: "destination",
    href: "/portal/account/settings",
    id: "account-settings",
    keywords: ["password", "two-factor", "sessions", "preferences"],
    label: "Account settings",
  },
  {
    group: "section",
    href: "/portal/notifications",
    id: "notifications-all",
    keywords: ["inbox", "updates"],
    label: "All",
    parentLabel: "Notifications",
  },
  {
    group: "section",
    href: "/portal/notifications?status=unread",
    id: "notifications-unread",
    keywords: ["inbox", "new"],
    label: "Unread",
    parentLabel: "Notifications",
  },
  {
    group: "section",
    href: "/portal/notifications?status=archived",
    id: "notifications-archived",
    keywords: ["inbox", "history"],
    label: "Archived",
    parentLabel: "Notifications",
  },
  {
    group: "section",
    href: "/portal/account/settings?section=security",
    id: "account-settings-security",
    keywords: ["password", "two-factor", "2fa", "sign in"],
    label: "Security",
    parentLabel: "Account settings",
  },
  {
    group: "section",
    href: "/portal/account/settings?section=access",
    id: "account-settings-access",
    keywords: ["sessions", "trusted browsers", "devices"],
    label: "Access",
    parentLabel: "Account settings",
  },
  {
    group: "section",
    href: "/portal/account/settings?section=preferences",
    id: "account-settings-preferences",
    keywords: ["notifications", "settings"],
    label: "Preferences",
    parentLabel: "Account settings",
  },
  {
    group: "section",
    href: "/portal/account/settings?section=activity",
    id: "account-settings-activity",
    keywords: ["security", "history", "events"],
    label: "Activity",
    parentLabel: "Account settings",
  },
  {
    group: "section",
    href: "/portal/system-operations?section=errors",
    id: "system-operations-errors",
    keywords: ["unresolved", "application", "incidents"],
    label: "Errors",
    parentLabel: "System operations",
    requiredCapability: PORTAL_CAPABILITIES.systemOperationsManage,
  },
  {
    group: "section",
    href: "/portal/system-operations?section=maintenance",
    id: "system-operations-maintenance",
    keywords: ["window", "scheduled", "maintenance"],
    label: "Maintenance",
    parentLabel: "System operations",
    requiredCapability: PORTAL_CAPABILITIES.systemOperationsManage,
  },
  {
    group: "section",
    href: "/portal/system-operations?section=release",
    id: "system-operations-release",
    keywords: ["environment", "deployment", "build"],
    label: "Release & environment",
    parentLabel: "System operations",
    requiredCapability: PORTAL_CAPABILITIES.systemOperationsManage,
  },
  {
    group: "section",
    href: "/portal/system-operations?section=history",
    id: "system-operations-history",
    keywords: ["runs", "commands", "operations"],
    label: "History",
    parentLabel: "System operations",
    requiredCapability: PORTAL_CAPABILITIES.systemOperationsManage,
  },
  {
    group: "section",
    href: "/portal/notification-delivery",
    id: "notification-delivery-all",
    keywords: ["messages", "outbound", "delivery"],
    label: "All",
    parentLabel: "Notification delivery",
    requiredCapability: PORTAL_CAPABILITIES.notificationsDeliveryOperate,
  },
  {
    group: "section",
    href: "/portal/notification-delivery?status=pending",
    keywords: ["queued", "waiting"],
    id: "notification-delivery-pending",
    label: "Pending",
    parentLabel: "Notification delivery",
    requiredCapability: PORTAL_CAPABILITIES.notificationsDeliveryOperate,
  },
  {
    group: "section",
    href: "/portal/notification-delivery?status=processing",
    keywords: ["sending", "in progress"],
    id: "notification-delivery-processing",
    label: "Processing",
    parentLabel: "Notification delivery",
    requiredCapability: PORTAL_CAPABILITIES.notificationsDeliveryOperate,
  },
  {
    group: "section",
    href: "/portal/notification-delivery?status=sent",
    keywords: ["delivered", "complete"],
    id: "notification-delivery-sent",
    label: "Sent",
    parentLabel: "Notification delivery",
    requiredCapability: PORTAL_CAPABILITIES.notificationsDeliveryOperate,
  },
  {
    group: "section",
    href: "/portal/notification-delivery?status=failed",
    keywords: ["error", "retry"],
    id: "notification-delivery-failed",
    label: "Failed",
    parentLabel: "Notification delivery",
    requiredCapability: PORTAL_CAPABILITIES.notificationsDeliveryOperate,
  },
  {
    group: "section",
    href: "/portal/notification-delivery?status=dead",
    keywords: ["dead letter", "retry exhausted"],
    id: "notification-delivery-dead",
    label: "Dead",
    parentLabel: "Notification delivery",
    requiredCapability: PORTAL_CAPABILITIES.notificationsDeliveryOperate,
  },
  {
    group: "section",
    href: "/portal/notification-delivery?status=cancelled",
    keywords: ["canceled", "stopped"],
    id: "notification-delivery-cancelled",
    label: "Cancelled",
    parentLabel: "Notification delivery",
    requiredCapability: PORTAL_CAPABILITIES.notificationsDeliveryOperate,
  },
  {
    group: "section",
    href: "/portal/backups?section=overview",
    id: "backups-overview",
    keywords: ["restore", "summary"],
    label: "Overview",
    parentLabel: "Backups & restore",
    requiredCapability: PORTAL_CAPABILITIES.backupsView,
  },
  {
    group: "section",
    href: "/portal/backups?section=jobs",
    id: "backups-jobs",
    keywords: ["backup", "artifacts", "verification"],
    label: "Jobs",
    parentLabel: "Backups & restore",
    requiredCapability: PORTAL_CAPABILITIES.backupsView,
  },
  {
    group: "section",
    href: "/portal/backups?section=restores",
    id: "backups-restores",
    keywords: ["restore", "authorization", "dry run"],
    label: "Restores",
    parentLabel: "Backups & restore",
    requiredCapability: PORTAL_CAPABILITIES.backupsView,
  },
];

function hasRequiredCapability(
  item: PortalNavigationItem | PortalNavigationLink,
  capabilities: readonly string[],
  auditPlanes: readonly PortalAuditPlane[],
) {
  return (
    (!item.requiredCapability || capabilities.includes(item.requiredCapability)) &&
    (!item.requiresAuditAccess || auditPlanes.length > 0)
  );
}

export function getVisiblePortalNavigation(
  capabilities: readonly string[],
  auditPlanes: readonly PortalAuditPlane[] = [],
): PortalNavigationItem[] {
  const visibleItems: PortalNavigationItem[] = [];

  for (const item of PORTAL_NAVIGATION) {
    if (!hasRequiredCapability(item, capabilities, auditPlanes)) continue;

    if (item.kind === "menu") {
      const visibleChildren = item.items.filter((child) =>
        hasRequiredCapability(child, capabilities, auditPlanes),
      );
      if (visibleChildren.length === 0) continue;
      visibleItems.push({ ...item, items: visibleChildren });
      continue;
    }

    visibleItems.push(item);
  }

  return visibleItems;
}

function navigationSearchItems(item: PortalNavigationItem): PortalSearchItem[] {
  if (item.kind === "link") {
    return [
      {
        group: "destination",
        href: item.href,
        id: item.id,
        keywords: item.keywords,
        label: item.label,
        requiredCapability: item.requiredCapability,
        requiresAuditAccess: item.requiresAuditAccess,
      },
    ];
  }

  return item.items.map((child) => ({
    group: "section" as const,
    href: child.href,
    id: `${item.id}-${child.id}`,
    label: child.label,
    parentLabel: item.label,
    requiredCapability: child.requiredCapability ?? item.requiredCapability,
    requiresAuditAccess: child.requiresAuditAccess ?? item.requiresAuditAccess,
  }));
}

export function getVisiblePortalSearchItems(
  capabilities: readonly string[],
  auditPlanes: readonly PortalAuditPlane[] = [],
): PortalSearchItem[] {
  const items = PORTAL_NAVIGATION.flatMap(navigationSearchItems).concat(
    PORTAL_SEARCH_ADDITIONS,
  );

  return items.filter(
    (item) =>
      (!item.requiredCapability || capabilities.includes(item.requiredCapability)) &&
      (!item.requiresAuditAccess || auditPlanes.length > 0),
  );
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
