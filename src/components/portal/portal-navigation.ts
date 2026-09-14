import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardList,
  DatabaseBackup,
  FileText,
  HeartHandshake,
  House,
  LifeBuoy,
  Mail,
  ScrollText,
  ShieldCheck,
  Settings2,
  UsersRound,
} from "lucide-react";
import type { AuthorityMeProjectionSchemaAuditPlanesItem } from "@/lib/api/generated/model";

export const PORTAL_CAPABILITIES = {
  backupsOperate: "backups.operate",
  backupsView: "backups.view",
  notificationsDeliveryOperate: "notifications.delivery.operate",
  appointmentsQueueView: "appointments.queue.view",
  counselingSessionsQueueView: "counseling.sessions.queue.view",
  studentRecordsViewScoped: "student_support_needs.view_scoped",
  inventoryQueueView: "inventory.queue.view",
  exitInterviewsQueueView: "exit_interviews.queue.view",
  graduateTracerQueueView: "graduate_tracer.queue.view",
  reportsProfilingView: "reports.profiling.view",
  reportsCsmView: "reports.csm.view",
  reportsGraduateTracerView: "reports.graduate_tracer.view",
  organizationGovernanceManage: "organization_governance.manage",
  documentTemplatesManage: "document_templates.manage",
  counselorCoverageManage: "counselor_coverage.manage",
  workflowAuthorityManage: "workflow_authority.manage",
  appointmentsAvailabilityManage: "appointments.availability.manage",
  officeClosuresManage: "office_closures.manage",
  supportNeedsQueueView: "support_needs.queue.view",
  supportNeedsVerify: "support_needs.verify",
  supportNeedsDispute: "support_needs.dispute",
  supportNeedsArchive: "support_needs.archive",
  goodMoralQueueView: "good_moral.queue.view",
  goodMoralReview: "good_moral.review",
  goodMoralReject: "good_moral.reject",
  goodMoralApprove: "good_moral.approve",
  goodMoralVoid: "good_moral.void",
  goodMoralSupersede: "good_moral.supersede",
  goodMoralArchive: "good_moral.archive",
  goodMoralReceiptEncode: "good_moral.receipt.encode",
  goodMoralReceiptVerify: "good_moral.receipt.verify",
  goodMoralCancel: "good_moral.cancel",
  goodMoralDocumentGenerate: "good_moral.document.generate",
  goodMoralPrint: "good_moral.print",
  goodMoralRegistrarSealConfirm: "good_moral.registrar_seal.confirm",
  goodMoralRelease: "good_moral.release",
  assessmentsQueueView: "assessments.queue.view",
  assessmentsReview: "assessments.review",
  assessmentsRelease: "assessments.release",
  assessmentsLifecycleManage: "assessments.lifecycle.manage",
  referralsQueueView: "referrals.queue.view",
  callSlipsQueueView: "call_slips.queue.view",
  referralsAssign: "referrals.assign",
  referralsReassign: "referrals.reassign",
  referralsClose: "referrals.close",
  referralsReopen: "referrals.reopen",
  referralsCancel: "referrals.cancel",
  callSlipsAssign: "call_slips.assign",
  callSlipsReassign: "call_slips.reassign",
  callSlipsIssue: "call_slips.issue",
  callSlipsAttendanceRecord: "call_slips.attendance.record",
  callSlipsCancel: "call_slips.cancel",
  inventoryReopen: "inventory.reopen",
  graduateTracerReopen: "graduate_tracer.reopen",
  graduateTracerVoid: "graduate_tracer.void",
  graduateTracerArchive: "graduate_tracer.archive",
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
      PORTAL_CAPABILITIES.graduateTracerQueueView,
    ],
  },
  {
    kind: "link",
    id: "students",
    href: "/portal/students",
    label: "Student directory",
    icon: UsersRound,
    keywords: ["students", "directory", "profiles", "roster"],
    requiredCapability: PORTAL_CAPABILITIES.studentRecordsViewScoped,
  },
  {
    kind: "link",
    id: "assessments",
    href: "/portal/assessments",
    label: "Assessments",
    icon: ClipboardList,
    keywords: ["assessment", "interpretation", "review", "results", "scores"],
    requiredCapability: PORTAL_CAPABILITIES.assessmentsQueueView,
  },
  {
    kind: "link",
    id: "support-needs",
    href: "/portal/support-needs",
    label: "Support needs",
    icon: LifeBuoy,
    keywords: ["student support", "needs", "verification", "review"],
    requiredCapability: PORTAL_CAPABILITIES.supportNeedsQueueView,
  },
  {
    kind: "link",
    id: "reports",
    href: "/portal/reports?section=profiling",
    label: "Reports & profiling",
    icon: BarChart3,
    keywords: ["reports", "profiling", "aggregate", "privacy"],
    requiredCapabilitiesAny: [
      PORTAL_CAPABILITIES.reportsProfilingView,
      PORTAL_CAPABILITIES.reportsCsmView,
      PORTAL_CAPABILITIES.reportsGraduateTracerView,
    ],
  },
  {
    kind: "link",
    id: "requests",
    href: "/portal/requests?section=good-moral",
    label: "Requests & Certificates",
    icon: FileText,
    keywords: ["good moral", "certificate", "requests", "document"],
    requiredCapability: PORTAL_CAPABILITIES.goodMoralQueueView,
  },
  {
    kind: "link",
    id: "guidance-settings",
    href: "/portal/guidance-settings?section=academic-context",
    label: "Guidance settings",
    icon: Settings2,
    keywords: ["academic context", "institution", "documents", "coverage", "forms", "instruments", "governance", "terms"],
    requiredCapabilitiesAny: [
      PORTAL_CAPABILITIES.organizationGovernanceManage,
      PORTAL_CAPABILITIES.documentTemplatesManage,
      PORTAL_CAPABILITIES.counselorCoverageManage,
      PORTAL_CAPABILITIES.workflowAuthorityManage,
      PORTAL_CAPABILITIES.appointmentsAvailabilityManage,
      PORTAL_CAPABILITIES.officeClosuresManage,
    ],
  },
  {
    kind: "link",
    id: "privacy-governance",
    href: "/portal/privacy-governance?section=dpo-appointment",
    label: "Privacy & Governance",
    icon: ShieldCheck,
    keywords: ["privacy", "dpo", "data protection", "governance"],
    requiredCapability: PORTAL_CAPABILITIES.organizationGovernanceManage,
  },
  {
    kind: "link",
    id: "referrals",
    href: "/portal/referrals?section=referrals",
    label: "Referrals & Call Slips",
    icon: FileText,
    keywords: ["referral", "call slip", "intake", "issuance"],
    requiredCapabilitiesAny: [
      PORTAL_CAPABILITIES.referralsQueueView,
      PORTAL_CAPABILITIES.callSlipsQueueView,
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
    group: "destination",
    href: "/portal/students",
    id: "students",
    keywords: ["students", "directory", "profiles", "roster", "scope"],
    label: "Student directory",
    requiredCapability: PORTAL_CAPABILITIES.studentRecordsViewScoped,
  },
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
    group: "section",
    href: "/portal/forms?section=graduate-tracer",
    id: "forms-graduate-tracer",
    keywords: ["graduate tracer", "alumni", "survey", "employment", "submissions"],
    label: "Graduate Tracer",
    parentLabel: "Forms & submissions",
    requiredCapability: PORTAL_CAPABILITIES.graduateTracerQueueView,
  },
  {
    group: "destination",
    href: "/portal/assessments",
    id: "assessments",
    keywords: ["assessment", "interpretation", "review", "results", "scores", "files"],
    label: "Assessments",
    requiredCapability: PORTAL_CAPABILITIES.assessmentsQueueView,
  },
  {
    group: "destination",
    href: "/portal/support-needs",
    id: "support-needs",
    keywords: ["student support", "needs", "verification", "review"],
    label: "Support needs",
    requiredCapability: PORTAL_CAPABILITIES.supportNeedsQueueView,
  },
  {
    group: "section",
    href: "/portal/requests?section=good-moral",
    id: "requests-good-moral",
    keywords: ["requests", "certificate", "good moral", "document"],
    label: "Good Moral Certificate",
    parentLabel: "Requests & Certificates",
    requiredCapability: PORTAL_CAPABILITIES.goodMoralQueueView,
  },
  {
    group: "section",
    href: "/portal/reports?section=profiling",
    id: "reports-profiling",
    keywords: ["reports", "profiling", "aggregate", "cohort", "privacy"],
    label: "Profiling",
    parentLabel: "Reports & profiling",
    requiredCapability: PORTAL_CAPABILITIES.reportsProfilingView,
  },
  {
    group: "section",
    href: "/portal/reports?section=csm-feedback",
    id: "reports-csm-feedback",
    keywords: ["reports", "csm", "service feedback", "satisfaction", "aggregate"],
    label: "CSM / Service Feedback",
    parentLabel: "Reports & profiling",
    requiredCapability: PORTAL_CAPABILITIES.reportsCsmView,
  },
  {
    group: "section",
    href: "/portal/reports?section=graduate-tracer",
    id: "reports-graduate-tracer",
    keywords: ["reports", "graduate tracer", "alumni", "employment", "outcomes", "aggregate"],
    label: "Graduate Tracer summaries",
    parentLabel: "Reports & profiling",
    requiredCapability: PORTAL_CAPABILITIES.reportsGraduateTracerView,
  },
  {
    group: "section",
    href: "/portal/guidance-settings?section=academic-context",
    id: "guidance-settings-academic-context",
    keywords: ["academic year", "term", "institution", "office", "governance"],
    label: "Academic context",
    parentLabel: "Guidance settings",
    requiredCapability: PORTAL_CAPABILITIES.organizationGovernanceManage,
  },
  {
    group: "section",
    href: "/portal/guidance-settings?section=forms-instruments",
    id: "guidance-settings-forms-instruments",
    keywords: ["forms", "revisions", "instruments", "scoring guide", "governance"],
    label: "Forms & instruments",
    parentLabel: "Guidance settings",
    requiredCapability: PORTAL_CAPABILITIES.organizationGovernanceManage,
  },
  {
    group: "section",
    href: "/portal/guidance-settings?section=institution-documents",
    id: "guidance-settings-institution-documents",
    keywords: ["branding", "documents", "templates", "institution"],
    label: "Institution & documents",
    parentLabel: "Guidance settings",
    requiredCapabilitiesAny: [
      PORTAL_CAPABILITIES.organizationGovernanceManage,
      PORTAL_CAPABILITIES.documentTemplatesManage,
    ],
  },
  {
    group: "section",
    href: "/portal/guidance-settings?section=counselor-coverage",
    id: "guidance-settings-counselor-coverage",
    keywords: ["counselor", "coverage", "scope", "assignment"],
    label: "Counselor coverage",
    parentLabel: "Guidance settings",
    requiredCapability: PORTAL_CAPABILITIES.counselorCoverageManage,
  },
  {
    group: "section",
    href: "/portal/guidance-settings?section=workflow-access",
    id: "guidance-settings-workflow-access",
    keywords: ["workflow", "access", "grant", "capability", "authority"],
    label: "Workflow access",
    parentLabel: "Guidance settings",
    requiredCapability: PORTAL_CAPABILITIES.workflowAuthorityManage,
  },
  {
    group: "section",
    href: "/portal/guidance-settings?section=scheduling",
    id: "guidance-settings-scheduling",
    keywords: ["availability", "schedule", "office closure", "calendar"],
    label: "Scheduling",
    parentLabel: "Guidance settings",
    requiredCapabilitiesAny: [
      PORTAL_CAPABILITIES.appointmentsAvailabilityManage,
      PORTAL_CAPABILITIES.officeClosuresManage,
    ],
  },
  {
    group: "section",
    href: "/portal/privacy-governance?section=dpo-appointment",
    id: "privacy-governance-dpo-appointment",
    keywords: ["privacy", "dpo", "appointment", "data protection"],
    label: "DPO appointment",
    parentLabel: "Privacy & Governance",
    requiredCapability: PORTAL_CAPABILITIES.organizationGovernanceManage,
  },
  {
    group: "section",
    href: "/portal/referrals?section=referrals",
    id: "referrals-referrals",
    keywords: ["referral", "intake", "route", "review", "assignment"],
    label: "Referrals",
    parentLabel: "Referrals & Call Slips",
    requiredCapability: PORTAL_CAPABILITIES.referralsQueueView,
  },
  {
    group: "section",
    href: "/portal/referrals?section=call-slips",
    id: "referrals-call-slips",
    keywords: ["call slip", "issue", "attendance", "no-show", "reschedule"],
    label: "Call Slips",
    parentLabel: "Referrals & Call Slips",
    requiredCapability: PORTAL_CAPABILITIES.callSlipsQueueView,
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
