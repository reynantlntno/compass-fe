import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  CalendarDays,
  ClipboardList,
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
  inventoryQueueView: "inventory.queue.view",
  exitInterviewsQueueView: "exit_interviews.queue.view",
  inventoryReopen: "inventory.reopen",
  exitInterviewsAcknowledge: "exit_interviews.acknowledge",
  exitInterviewsReopen: "exit_interviews.reopen",
  exitInterviewsVoid: "exit_interviews.void",
  exitInterviewsArchive: "exit_interviews.archive",
  counselingSessionLock: "counseling_sessions.lock",
  counselingRoutineReopen: "routine_interviews.reopen",
  counselingCasesClose: "counseling_cases.close",
  counselingCasesReopen: "counseling_cases.reopen",
  urgentSupportQueueReview: "urgent_support.queue.review",
  urgentSupportAssign: "urgent_support.assign",
  urgentSupportLifecycleManage: "urgent_support.lifecycle.manage",
  urgentSupportTemporaryAccessManage: "urgent_support.temporary_access.manage",
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
  requiredCapabilitiesAny?: readonly string[];
  requiresAuditAccess?: boolean;
};

export type PortalNavigationMenu = {
  kind: "menu";
  id: string;
  label: string;
  icon: LucideIcon;
  items: readonly PortalNavigationLink[];
  requiredCapability?: string;
  requiredCapabilitiesAny?: readonly string[];
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
  requiredCapabilitiesAny?: readonly string[];
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
    requiredCapabilitiesAny: [
      PORTAL_CAPABILITIES.counselingSessionsQueueView,
      PORTAL_CAPABILITIES.urgentSupportQueueReview,
    ],
  },
  {
    kind: "link",
    id: "forms",
    href: "/portal/forms?section=inventory",
    label: "Forms & submissions",
    icon: ClipboardList,
    keywords: ["inventory", "exit interview", "submissions", "forms"],
    requiredCapabilitiesAny: [
      PORTAL_CAPABILITIES.inventoryQueueView,
      PORTAL_CAPABILITIES.exitInterviewsQueueView,
    ],
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
    group: "section",
    href: "/portal/counseling?section=cases",
    id: "counseling-cases",
    keywords: ["counselor", "case", "concern", "monitoring", "follow-up"],
    label: "Cases",
    parentLabel: "Counseling",
    requiredCapability: PORTAL_CAPABILITIES.counselingSessionsQueueView,
  },
  {
    group: "section",
    href: "/portal/counseling?section=urgent-support",
    id: "counseling-urgent-support",
    keywords: ["triage", "urgent", "review", "temporary access"],
    label: "Urgent support",
    parentLabel: "Counseling",
    requiredCapability: PORTAL_CAPABILITIES.urgentSupportQueueReview,
  },
  {
    group: "section",
    href: "/portal/forms?section=inventory",
    id: "forms-inventory",
    keywords: ["individual inventory", "student profile", "submission", "form"],
    label: "Individual Inventory",
    parentLabel: "Forms & submissions",
    requiredCapability: PORTAL_CAPABILITIES.inventoryQueueView,
  },
  {
    group: "section",
    href: "/portal/forms?section=exit-interviews",
    id: "forms-exit-interviews",
    keywords: ["exit interview", "graduate", "submission", "form"],
    label: "Exit Interviews",
    parentLabel: "Forms & submissions",
    requiredCapability: PORTAL_CAPABILITIES.exitInterviewsQueueView,
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
  item: PortalNavigationItem | PortalNavigationLink | PortalSearchItem,
  capabilities: readonly string[],
  auditPlanes: readonly PortalAuditPlane[],
) {
  const hasAnyRequiredCapability =
    !item.requiredCapabilitiesAny ||
    item.requiredCapabilitiesAny.some((capability) => capabilities.includes(capability));
  return (
    (!item.requiredCapability || capabilities.includes(item.requiredCapability)) &&
    hasAnyRequiredCapability &&
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
        requiredCapabilitiesAny: item.requiredCapabilitiesAny,
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
    requiredCapabilitiesAny: child.requiredCapabilitiesAny ?? item.requiredCapabilitiesAny,
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
    (item) => hasRequiredCapability(item, capabilities, auditPlanes),
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

  const itemPath = item.href.split("?")[0];
  if (itemPath === "/portal") return pathname === itemPath;

  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}
