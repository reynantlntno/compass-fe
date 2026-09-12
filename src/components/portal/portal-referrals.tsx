"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { usePortalAccess } from "@/components/portal/portal-access-provider";
import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
import { PortalFilterPanel } from "@/components/portal/portal-filter-panel";
import { PortalPageHeader } from "@/components/portal/portal-page-header";
import { PORTAL_CAPABILITIES } from "@/components/portal/portal-navigation";
import { PortalStatusFilter } from "@/components/portal/portal-status-filter";
import { PortalWorkspaceNav } from "@/components/portal/portal-workspace-nav";
import { REFERRALS_NAV_ITEMS, getReferralsNavItems, type ReferralsSection } from "@/components/portal/portal-referrals-navigation";
import {
  REFERRAL_ASSIGNMENTS,
  REFERRAL_QUEUE_ORDERS,
  REFERRAL_QUEUE_STATUSES,
  REFERRAL_REASON_CATEGORIES,
  REFERRAL_SOURCE_TYPES,
  ReferralsApiError,
  assignPortalReferral,
  createPortalReferral,
  getPortalReferralCounselorOptions,
  getPortalReferralDetail,
  getPortalReferralQueue,
  getPortalStaffStudents,
  parseReferralsFilters,
  referralsHref,
  rememberReferralOptions,
  submitPortalReferral,
  transitionPortalReferral,
  type PortalReferralDetail,
  type PortalReferralsPage,
  type ReferralCounselorOption,
  type ReferralStaffQueueItem,
  type ReferralTransition,
  type ReferralsFilters,
  type StaffStudentOption,
} from "@/lib/api/referrals";
import {
  CALL_SLIP_ASSIGNMENTS,
  CALL_SLIP_DESTINATIONS,
  CALL_SLIP_MODES,
  CALL_SLIP_PURPOSES,
  CALL_SLIP_QUEUE_STATUSES,
  CallSlipsApiError,
  assignPortalCallSlip,
  callSlipReasonAction,
  callSlipsHref,
  createPortalCallSlip,
  createPortalCallSlipFromReferral,
  getPortalCallSlipCounselorOptions,
  getPortalCallSlipDetail,
  getPortalCallSlipQueue,
  issuePortalCallSlip,
  parseCallSlipsFilters,
  recordPortalCallSlipAttendance,
  rememberCallSlipOptions,
  type CallSlipStaffQueueItem,
  type CallSlipsFilters,
  type PortalCallSlipDetail,
  type PortalCallSlipsPage,
  type ReferralCounselorOptionLike,
} from "@/lib/api/call-slips";
import { createIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";

const PORTAL_VALUE_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  RECEIVED: "Received",
  UNDER_REVIEW: "Under review",
  ACTION_REQUIRED: "Action required",
  ESCALATED: "Escalated",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
  FACULTY: "Faculty",
  ADVISER: "Adviser",
  INSTITUTIONAL_STAFF: "Institutional staff",
  PARENT_GUARDIAN: "Parent/guardian",
  GCO: "GCO",
  OTHER: "Other",
  UNCATEGORIZED: "Uncategorized",
  ACADEMIC: "Academic",
  ATTENDANCE: "Attendance",
  BEHAVIOR_OR_CONDUCT: "Behavior or conduct",
  PERSONAL_OR_SOCIAL: "Personal or social",
  FAMILY_OR_HOME: "Family or home",
  FINANCIAL: "Financial",
  CAREER_OR_PLANNING: "Career or planning",
  ISSUED: "Issued",
  ACKNOWLEDGED: "Acknowledged",
  RESCHEDULE_REQUESTED: "Reschedule requested",
  ATTENDED: "Attended",
  NO_SHOW: "No-show",
  EXPIRED: "Expired",
  OFFICE_INITIATED: "Office initiated",
  REFERRAL: "Referral",
  APPOINTMENT: "Appointment",
  ROUTINE_INTERVIEW_REPORTING: "Routine interview reporting",
  COUNSELOR_FOLLOW_UP: "Counselor follow-up",
  GUIDANCE_INTERVIEW: "Guidance interview",
  APPOINTMENT_REPORTING: "Appointment reporting",
  GENERAL_OFFICE_REPORTING: "General office reporting",
  DOCUMENT_FOLLOW_UP: "Document follow-up",
  OTHER_APPROVED: "Other approved",
  ONSITE: "On-site",
  ONLINE: "Online",
  GUIDANCE_OFFICE: "Guidance office",
  ASSIGNED_COUNSELOR: "Assigned counselor",
  APPROVED_OFFICE_LOCATION: "Approved office location",
  AUTHENTICATED_ONLINE_ARRANGEMENT: "Authenticated online arrangement",
  WORKFLOW_PROGRESSION: "Workflow progression",
  HEAD_REVIEW: "Head review",
  WORK_COMPLETED: "Work completed",
  DUPLICATE: "Duplicate",
  INVALID_INTAKE: "Invalid intake",
  WRONG_STUDENT: "Wrong student",
  TRANSFER_REQUIRED: "Transfer required",
  OTHER_STRUCTURED: "Other structured",
  SCHEDULE_CHANGE: "Schedule change",
  ASSIGNMENT_CHANGE: "Assignment change",
  STUDENT_REQUEST_APPROVED: "Student request approved",
  STUDENT_REQUEST_DECLINED: "Student request declined",
  INVALID_NOTICE: "Invalid notice",
  OFFICE_CLOSURE: "Office closure",
  COUNSELOR_UNAVAILABLE: "Counselor unavailable",
  STUDENT_UNAVAILABLE: "Student unavailable",
  NO_RESPONSE: "No response",
  all: "All assignments",
  mine: "Assigned to me",
  unassigned: "Unassigned",
  recent: "Recently updated",
  oldest: "Oldest updated first",
};

function portalValueLabel(value: string) {
  const normalized = value.trim();
  if (!normalized) return "";
  return PORTAL_VALUE_LABELS[normalized] ?? normalized.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const REFERRAL_STATUS_OPTIONS = REFERRAL_QUEUE_STATUSES.map((value) => ({ label: portalValueLabel(value), value }));
const CALL_SLIP_STATUS_OPTIONS = CALL_SLIP_QUEUE_STATUSES.map((value) => ({ label: portalValueLabel(value), value }));
const SOURCE_TYPE_OPTIONS = REFERRAL_SOURCE_TYPES.map((value) => ({ label: portalValueLabel(value), value }));
const REASON_CATEGORY_OPTIONS = REFERRAL_REASON_CATEGORIES.map((value) => ({ label: portalValueLabel(value), value }));
const PURPOSE_OPTIONS = CALL_SLIP_PURPOSES.map((value) => ({ label: portalValueLabel(value), value }));
const MODE_OPTIONS = CALL_SLIP_MODES.map((value) => ({ label: portalValueLabel(value), value }));
const DESTINATION_OPTIONS = CALL_SLIP_DESTINATIONS.map((value) => ({ label: portalValueLabel(value), value }));
const ORDER_OPTIONS = REFERRAL_QUEUE_ORDERS.map((value) => ({ label: portalValueLabel(value), value }));
const ASSIGNMENT_OPTIONS = REFERRAL_ASSIGNMENTS.map((value) => ({ label: portalValueLabel(value), value }));
const SLIP_ASSIGNMENT_OPTIONS = CALL_SLIP_ASSIGNMENTS.map((value) => ({ label: portalValueLabel(value), value }));
const WORKFLOW_REASONS = ["WORKFLOW_PROGRESSION", "HEAD_REVIEW", "WORK_COMPLETED", "DUPLICATE", "INVALID_INTAKE", "WRONG_STUDENT", "TRANSFER_REQUIRED", "OTHER_STRUCTURED"];
const SLIP_WORKFLOW_REASONS = ["WORKFLOW_PROGRESSION", "SCHEDULE_CHANGE", "ASSIGNMENT_CHANGE", "STUDENT_REQUEST_APPROVED", "STUDENT_REQUEST_DECLINED", "DUPLICATE", "INVALID_NOTICE", "WRONG_STUDENT", "OFFICE_CLOSURE", "COUNSELOR_UNAVAILABLE", "STUDENT_UNAVAILABLE", "NO_RESPONSE", "OTHER_STRUCTURED"];
const MAX_PAGE = 100_000;
const MAX_QUERY_LENGTH = 120;

function safePage(value: string | null) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function toLocal(value: unknown) {
  if (typeof value !== "string" || !value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function optionList(options: { label: string; value: string }[]) {
  return options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>);
}

function errorMessage(error: unknown) {
  const kind = error instanceof ReferralsApiError
    ? error.kind
    : error instanceof CallSlipsApiError
      ? error.kind
      : null;
  if (kind === "conflict") return "This record changed. Refresh the workspace and try again.";
  if (kind === "permission") return "You don’t have permission to do that from this account.";
  if (kind === "validation") return "Check the entry details and try again.";
  if (kind === "rate_limited") return "Too many requests. Wait a moment and try again.";
  return "This couldn’t be saved. Try again when the connection is ready.";
}

export function PortalReferralsLoading({ section = "referrals" }: { section?: ReferralsSection }) {
  const isSlips = section === "call-slips";
  const label = isSlips ? "call slips" : "referrals";
  const action = isSlips ? "call-slips" : "referrals";
  return (
    <section aria-busy="true" aria-labelledby="portal-referrals-loading-heading" className="portal-counseling portal-counseling--loading" role="status">
      <span className="sr-only">Loading {label}…</span>
      <PortalPageHeader
        className="portal-counseling__page-header"
        current="Referrals & Call Slips"
        description="Review referrals and call slips within your workspace scope."
        headingId="portal-referrals-loading-heading"
        title="Referrals & Call Slips"
      />
      <div className="portal-counseling__workspace">
        <div aria-hidden="true" className="compass-surface portal-workspace-nav portal-counseling__nav-skeleton" data-tone="subtle">
          {REFERRALS_NAV_ITEMS.map((item) => (
            <Skeleton className="portal-counseling__nav-skeleton-line" key={item.value} />
          ))}
        </div>
        <div className="portal-counseling__content-skeleton">
          <PortalFilterPanel action={`/portal/referrals?section=${action}`} ariaBusy className="portal-counseling__filters" resetKey="referrals-loading" summary={<Skeleton as="span" aria-hidden="true" className="portal-counseling__skeleton-summary" />}>
            <div aria-hidden="true" className="portal-counseling__filter-skeleton-grid">
              {Array.from({ length: 7 }, (_, index) => (
                <Skeleton as="span" key={index} />
              ))}
            </div>
          </PortalFilterPanel>
          <PortalCollectionFrame className="portal-counseling__frame">
            <div aria-hidden="true" className="portal-counseling__table-skeleton">
              {Array.from({ length: 5 }, (_, row) => (
                <div className="portal-counseling__table-skeleton-row" key={row}>
                  {Array.from({ length: isSlips ? 8 : 6 }, (_, cell) => (
                    <Skeleton as="span" key={cell} />
                  ))}
                </div>
              ))}
            </div>
          </PortalCollectionFrame>
        </div>
      </div>
    </section>
  );
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pending,
  error,
  onCancel,
  onConfirm,
  reasonOptions,
  reason,
  setReason,
  detailText,
  setDetailText,
  needsReason,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  reasonOptions: readonly string[];
  reason: string;
  setReason: (value: string) => void;
  detailText: string;
  setDetailText: (value: string) => void;
  needsReason: boolean;
}) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="portal-counseling__dialog" size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {needsReason ? (
          <div className="portal-counseling__dialog-field">
            <Label htmlFor="portal-referrals-reason">Reason</Label>
            <select
              id="portal-referrals-reason"
              onChange={(event) => setReason(event.target.value)}
              value={reason}
            >
              <option value="">Select a reason…</option>
              {optionList(reasonOptions.map((value) => ({ label: portalValueLabel(value), value })))}
            </select>
          </div>
        ) : null}
        <div className="portal-counseling__dialog-field">
          <Label htmlFor="portal-referrals-detail">Detail (optional)</Label>
          <Textarea id="portal-referrals-detail" maxLength={500} onChange={(event) => setDetailText(event.target.value)} value={detailText} />
        </div>
        {error ? <p className="portal-counseling__dialog-error" role="alert">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} onClick={onCancel}>Keep record</AlertDialogCancel>
          <AlertDialogAction disabled={pending || (needsReason && !reason)} onClick={onConfirm}>{pending ? "Saving…" : confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ReferralDetailExpanded({
  detail,
  error,
  onRetry,
}: {
  detail: PortalReferralDetail | null;
  error: boolean;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <div className="portal-counseling__detail-state" role="status">
        <p>We couldn’t load the referral details.</p>
        <Button onClick={onRetry} size="sm" type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="portal-counseling__detail-state" role="status">
        <Skeleton as="span" />
        <Skeleton as="span" />
      </div>
    );
  }
  const callSlips = Array.isArray(detail.linked_call_slips) ? detail.linked_call_slips : [];
  return (
    <div className="portal-counseling__detail-content">
      <dl>
        <div><dt>Student</dt><dd>{String(detail.student_label ?? "Student details unavailable")}</dd></div>
        <div><dt>Source</dt><dd>{portalValueLabel(detail.source_type ?? "—")}</dd></div>
        <div><dt>Reason</dt><dd>{portalValueLabel(detail.reason_category ?? "—")}</dd></div>
        <div><dt>Status</dt><dd>{portalValueLabel(detail.status ?? "—")}</dd></div>
        <div><dt>Assignment</dt><dd>{portalValueLabel(detail.assignment_state ?? "—")}</dd></div>
        <div><dt>Updated</dt><dd>{toLocal(detail.updated_at)}</dd></div>
      </dl>
      <div className="portal-counseling__detail-sublist">
        <h3>Linked call slips</h3>
        {callSlips.length === 0 ? <p>No call slips linked to this referral.</p> : null}
        {callSlips.map((entry) => (
          <p key={entry.reference_code}>
            <Link href={`/portal/referrals?section=call-slips&q=${encodeURIComponent(entry.reference_code)}`}>
              {entry.reference_code}
            </Link>{" "}
            — {entry.status_label || portalValueLabel(entry.status_code)}
          </p>
        ))}
      </div>
    </div>
  );
}

function CallSlipDetailExpanded({
  detail,
  error,
  onRetry,
}: {
  detail: PortalCallSlipDetail | null;
  error: boolean;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <div className="portal-counseling__detail-state" role="status">
        <p>We couldn’t load the call slip details.</p>
        <Button onClick={onRetry} size="sm" type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="portal-counseling__detail-state" role="status">
        <Skeleton as="span" />
        <Skeleton as="span" />
      </div>
    );
  }
  const referral = typeof detail.referral_reference === "string" ? detail.referral_reference : null;
  const appointment = typeof detail.appointment_reference === "string" ? detail.appointment_reference : null;
  return (
    <div className="portal-counseling__detail-content">
      <dl>
        <div><dt>Student</dt><dd>{String(detail.student_label ?? "Student details unavailable")}</dd></div>
        <div><dt>Status</dt><dd>{String(detail.status_label ?? "—")}</dd></div>
        <div><dt>Purpose</dt><dd>{String(detail.purpose_label ?? "—")}</dd></div>
        <div><dt>Destination</dt><dd>{String(detail.destination_label ?? "—")}</dd></div>
        <div><dt>Mode</dt><dd>{String(detail.mode_label ?? "—")}</dd></div>
        <div><dt>Schedule</dt><dd>{typeof detail.scheduled_start_at === "string" && detail.scheduled_start_at ? toLocal(detail.scheduled_start_at) : "Unscheduled"}</dd></div>
      </dl>
      <div className="portal-counseling__detail-sublist">
        <h3>Related records</h3>
        {referral ? (
          <p>
            <Link href={`/portal/referrals?section=referrals&q=${encodeURIComponent(referral)}`}>Related referral {referral}</Link>
          </p>
        ) : <p>No related referral.</p>}
        {appointment ? (
          <p>
            <Link href={`/portal/appointments?q=${encodeURIComponent(appointment)}`}>Related appointment {appointment}</Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ReferralTable({
  items,
  expanded,
  details,
  onToggle,
  onRetry,
  onAction,
  hasCapability,
}: {
  items: ReferralStaffQueueItem[];
  expanded: Set<string>;
  details: Map<string, { detail: PortalReferralDetail | null; error: boolean }>;
  onToggle: (item: ReferralStaffQueueItem) => void;
  onRetry: (item: ReferralStaffQueueItem) => void;
  onAction: (action: string, item: ReferralStaffQueueItem) => void;
  hasCapability: (capability: string) => boolean;
}) {
  const referrralActions = (item: ReferralStaffQueueItem): string[] => {
    const actions: string[] = [];
    if (item.can_prepare_call_slip && !item.has_active_call_slip) actions.push("prepare-call-slip");
    if (item.status === "SUBMITTED") actions.push("receive");
    if (["RECEIVED", "ACTION_REQUIRED"].includes(item.status)) actions.push("review");
    if (["UNDER_REVIEW", "ACTION_REQUIRED"].includes(item.status)) {
      actions.push("action-required");
      actions.push("escalate");
      if (hasCapability(PORTAL_CAPABILITIES.referralsClose)) actions.push("close");
    }
    if (!["CLOSED", "CANCELLED"].includes(item.status) && hasCapability(PORTAL_CAPABILITIES.referralsCancel)) actions.push("cancel");
    if (item.status === "CLOSED" && hasCapability(PORTAL_CAPABILITIES.referralsReopen)) actions.push("reopen");
    if (!item.is_terminal) {
      if (item.assignment_state === "Assigned") {
        if (hasCapability(PORTAL_CAPABILITIES.referralsReassign)) actions.push("reassign");
      } else if (hasCapability(PORTAL_CAPABILITIES.referralsAssign)) {
        actions.push("assign");
      }
    }
    return actions;
  };
  const actionLabel: Record<string, string> = {
    "prepare-call-slip": "Prepare call slip",
    receive: "Receive",
    review: "Review",
    "action-required": "Action required",
    escalate: "Escalate",
    close: "Close",
    cancel: "Cancel",
    reopen: "Reopen",
    assign: "Assign",
    reassign: "Reassign",
  };
  return (
    <div className="portal-counseling__table-wrap">
      <table className="portal-counseling__table">
        <thead>
          <tr>
            <th scope="col">Student</th>
            <th scope="col">Reference</th>
            <th scope="col">Status</th>
            <th scope="col">Source</th>
            <th scope="col">Updated</th>
            <th scope="col">Details &amp; actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isExpanded = expanded.has(item.reference_code);
            const rowDetailId = `portal-referral-detail-${item.reference_code.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
            const actions = referrralActions(item);
            return (
              <Fragment key={item.reference_code}>
                <tr className={isExpanded ? "is-expanded" : undefined}>
                  <td data-label="Student">
                    <span className="portal-counseling__student-name">{item.student_display_name}</span>
                    {item.student_number ? <span className="portal-counseling__student-number">{item.student_number}</span> : null}
                  </td>
                  <td data-label="Reference"><span className="portal-counseling__reference">{item.reference_code}</span></td>
                  <td data-label="Status"><Badge data-tone={item.status.toLowerCase()} variant="outline">{item.status_label}</Badge></td>
                  <td data-label="Source">{item.source_type_label}</td>
                  <td data-label="Updated">{toLocal(item.updated_at)}</td>
                  <td data-label="Details & actions">
                    <div className="portal-counseling__details-actions">
                      <Button
                        aria-controls={rowDetailId}
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? "Hide" : "Show"} details for ${item.reference_code}`}
                        onClick={() => onToggle(item)}
                        size="xs"
                        type="button"
                        variant="outline"
                      >
                        {isExpanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                        <span className="sr-only">{isExpanded ? "Hide" : "Show"} details</span>
                      </Button>
                      {item.has_active_call_slip && item.active_call_slip_reference ? (
                        <Link className="portal-counseling__workspace-link" href={`/portal/referrals?section=call-slips&q=${encodeURIComponent(item.active_call_slip_reference)}`}>
                          Call slip {item.active_call_slip_reference}
                        </Link>
                      ) : null}
                      {actions.length > 0 ? (
                        <div aria-label={`Actions for ${item.reference_code}`} className="portal-counseling__row-actions">
                          {actions.map((action) => (
                            <Button
                              key={action}
                              onClick={() => onAction(action, item)}
                              size="xs"
                              type="button"
                              variant={action === "cancel" ? "outline" : "ghost"}
                            >
                              {actionLabel[action]}
                            </Button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
                {isExpanded ? (
                  <tr className="portal-counseling__detail-row">
                    <td colSpan={6} id={rowDetailId}>
                      <ReferralDetailExpanded
                        detail={details.get(item.reference_code)?.detail ?? null}
                        error={details.get(item.reference_code)?.error ?? false}
                        onRetry={() => onRetry(item)}
                      />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CallSlipTable({
  items,
  expanded,
  details,
  onToggle,
  onRetry,
  onAction,
  hasCapability,
}: {
  items: CallSlipStaffQueueItem[];
  expanded: Set<string>;
  details: Map<string, { detail: PortalCallSlipDetail | null; error: boolean }>;
  onToggle: (item: CallSlipStaffQueueItem) => void;
  onRetry: (item: CallSlipStaffQueueItem) => void;
  onAction: (action: string, item: CallSlipStaffQueueItem) => void;
  hasCapability: (capability: string) => boolean;
}) {
  const slipActions = (item: CallSlipStaffQueueItem): string[] => {
    const actions: string[] = [];
    if (item.status === "DRAFT" && hasCapability(PORTAL_CAPABILITIES.callSlipsIssue)) actions.push("issue");
    if (["ISSUED", "ACKNOWLEDGED"].includes(item.status)) {
      if (hasCapability(PORTAL_CAPABILITIES.callSlipsAttendanceRecord)) {
        actions.push("attendance");
        actions.push("no-show");
        actions.push("expire");
      }
      if (hasCapability(PORTAL_CAPABILITIES.callSlipsCancel)) actions.push("cancel");
    }
    if (item.status === "RESCHEDULE_REQUESTED" && hasCapability(PORTAL_CAPABILITIES.callSlipsCancel)) actions.push("cancel");
    if (item.assignment_state === "Assigned") {
      if (hasCapability(PORTAL_CAPABILITIES.callSlipsReassign)) actions.push("reassign");
    } else if (hasCapability(PORTAL_CAPABILITIES.callSlipsAssign)) {
      actions.push("assign");
    }
    return actions;
  };
  const actionLabel: Record<string, string> = {
    issue: "Issue",
    attendance: "Attendance",
    "no-show": "No show",
    expire: "Expire",
    cancel: "Cancel",
    assign: "Assign",
    reassign: "Reassign",
  };
  return (
    <div className="portal-counseling__table-wrap">
      <table className="portal-counseling__table">
        <thead>
          <tr>
            <th scope="col">Student</th>
            <th scope="col">Reference</th>
            <th scope="col">Purpose</th>
            <th scope="col">Status</th>
            <th scope="col">Schedule</th>
            <th scope="col">Related</th>
            <th scope="col">Updated</th>
            <th scope="col">Details &amp; actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isExpanded = expanded.has(item.reference_code);
            const rowDetailId = `portal-call-slip-detail-${item.reference_code.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
            const actions = slipActions(item);
            return (
              <Fragment key={item.reference_code}>
                <tr className={isExpanded ? "is-expanded" : undefined}>
                  <td data-label="Student">
                    <span className="portal-counseling__student-name">{item.student_display_name}</span>
                    {item.student_number ? <span className="portal-counseling__student-number">{item.student_number}</span> : null}
                  </td>
                  <td data-label="Reference"><span className="portal-counseling__reference">{item.reference_code}</span></td>
                  <td data-label="Purpose">{item.purpose_label}</td>
                  <td data-label="Status"><Badge data-tone={item.status.toLowerCase()} variant="outline">{item.status_label}</Badge></td>
                  <td data-label="Schedule">{item.scheduled_start_at ? toLocal(item.scheduled_start_at) : "Unscheduled"}</td>
                  <td data-label="Related">
                    {item.referral_reference ? (
                      <Link className="portal-counseling__workspace-link" href={`/portal/referrals?section=referrals&q=${encodeURIComponent(item.referral_reference)}`}>
                        {item.referral_reference}
                      </Link>
                    ) : "—"}
                  </td>
                  <td data-label="Updated">{toLocal(item.updated_at)}</td>
                  <td data-label="Details & actions">
                    <div className="portal-counseling__details-actions">
                      <Button
                        aria-controls={rowDetailId}
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? "Hide" : "Show"} details for ${item.reference_code}`}
                        onClick={() => onToggle(item)}
                        size="xs"
                        type="button"
                        variant="outline"
                      >
                        {isExpanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                        <span className="sr-only">{isExpanded ? "Hide" : "Show"} details</span>
                      </Button>
                      {actions.length > 0 ? (
                        <div aria-label={`Actions for ${item.reference_code}`} className="portal-counseling__row-actions">
                          {actions.map((action) => (
                            <Button
                              key={action}
                              onClick={() => onAction(action, item)}
                              size="xs"
                              type="button"
                              variant={action === "cancel" || action === "no-show" || action === "expire" ? "outline" : "ghost"}
                            >
                              {actionLabel[action]}
                            </Button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
                {isExpanded ? (
                  <tr className="portal-counseling__detail-row">
                    <td colSpan={8} id={rowDetailId}>
                      <CallSlipDetailExpanded
                        detail={details.get(item.reference_code)?.detail ?? null}
                        error={details.get(item.reference_code)?.error ?? false}
                        onRetry={() => onRetry(item)}
                      />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ section }: { section: ReferralsSection }) {
  return (
    <div className="portal-counseling__empty" role="status">
      <h2>{section === "referrals" ? "No referrals to show." : "No call slips to show."}</h2>
      <p>{section === "referrals" ? "Try changing the filters or create a referral to see records here." : "Try changing the filters or create a call slip to see records here."}</p>
    </div>
  );
}

function QueuePagination({ page, total, filters, section }: {
  page: number;
  total: number;
  filters: ReferralsFilters | CallSlipsFilters;
  section: ReferralsSection;
}) {
  const totalPages = Math.ceil(total / 20);
  if (totalPages <= 1) return null;
  const hrefForPage = (nextPage: number) => section === "call-slips"
    ? callSlipsHref("call-slips", nextPage, filters as CallSlipsFilters)
    : referralsHref("referrals", nextPage, filters as ReferralsFilters);
  return (
    <Pagination aria-label={`${section === "referrals" ? "Referral" : "Call slip"} pages`} className="portal-counseling__pagination">
      <PaginationContent>
        <PaginationItem>
          {page > 1
            ? <PaginationPrevious href={hrefForPage(page - 1)} text="Previous" />
            : <span aria-hidden="true" className="portal-counseling__pagination-spacer" />}
        </PaginationItem>
        <PaginationItem>
          <span aria-current="page" className="portal-counseling__pagination-current">Page {page} of {totalPages}</span>
        </PaginationItem>
        <PaginationItem>
          {page < totalPages
            ? <PaginationNext href={hrefForPage(page + 1)} text="Next" />
            : <span aria-hidden="true" className="portal-counseling__pagination-spacer" />}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

function CreateReferralDialog({
  open,
  onClose,
  students,
  studentsLoading,
  onSearch,
  pending,
  error,
  onCreated,
  onError,
  onPendingChange,
}: {
  open: boolean;
  onClose: () => void;
  students: StaffStudentOption[];
  studentsLoading: boolean;
  onSearch: (q: string, workflow: "referral" | "call_slip") => void;
  pending: boolean;
  error: string | null;
  onCreated: (referenceCode: string) => void;
  onError: (error: unknown) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const [studentSelectionToken, setStudentSelectionToken] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sourceType, setSourceType] = useState("FACULTY");
  const [category, setCategory] = useState("UNCATEGORIZED");
  const [reasonText, setReasonText] = useState("");
  const [course, setCourse] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [block, setBlock] = useState("");
  const keyRef = useRef<{
    fingerprint: string;
    createKey: IdempotencyKey;
    submitKey: IdempotencyKey;
  } | null>(null);

  useEffect(() => {
    if (!open) keyRef.current = null;
  }, [open]);

  const confirm = () => {
    if (!studentSelectionToken || pending) return;
    const fingerprint = JSON.stringify({ studentSelectionToken, sourceType, category, reasonText, course, yearLevel, block });
    if (!keyRef.current || keyRef.current.fingerprint !== fingerprint) {
      keyRef.current = {
        fingerprint,
        createKey: createIdempotencyKey(),
        submitKey: createIdempotencyKey(),
      };
    }
    const keys = keyRef.current;
    onPendingChange(true);
    void (async () => {
      try {
        const reference = await createPortalReferral({
          student_selection_token: studentSelectionToken,
          source_type: sourceType,
          reason_category_code: category,
          reason_text: reasonText,
          course_snapshot: course,
          year_level_snapshot: yearLevel,
          block_snapshot: block,
        }, keys.createKey);
        await submitPortalReferral(reference, {
          reason_text: reasonText,
          course_snapshot: course,
          year_level_snapshot: yearLevel,
          block_snapshot: block,
        }, keys.submitKey);
        keyRef.current = null;
        onCreated(reference);
      } catch (error) {
        onError(error);
      } finally {
        onPendingChange(false);
      }
    })();
  };

  return (
    <AlertDialog onOpenChange={(value) => { if (!value && !pending) onClose(); }} open={open}>
      <AlertDialogContent className="portal-counseling__dialog" size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Create referral</AlertDialogTitle>
          <AlertDialogDescription>Record a new initial referral for a student within your scope.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="portal-counseling__dialog-field">
          <Label htmlFor="portal-referrals-student-search">Student</Label>
          <Input
            id="portal-referrals-student-search"
            onChange={(event) => { setSearch(event.target.value); onSearch(event.target.value, "referral"); }}
            placeholder="Search by name or student number"
            value={search}
          />
          <select
            id="portal-referrals-student"
            onChange={(event) => setStudentSelectionToken(event.target.value || null)}
            value={studentSelectionToken ?? ""}
          >
            <option value="">{studentsLoading ? "Loading students…" : "Select a student…"}</option>
            {students.map((student) => (
              <option key={student.selection_token} value={student.selection_token}>{student.label}</option>
            ))}
          </select>
        </div>
        <div className="portal-counseling__dialog-field">
          <Label htmlFor="portal-referrals-source">Source</Label>
          <select id="portal-referrals-source" onChange={(event) => setSourceType(event.target.value)} value={sourceType}>{optionList(SOURCE_TYPE_OPTIONS)}</select>
        </div>
        <div className="portal-counseling__dialog-field">
          <Label htmlFor="portal-referrals-category">Reason category</Label>
          <select id="portal-referrals-category" onChange={(event) => setCategory(event.target.value)} value={category}>{optionList(REASON_CATEGORY_OPTIONS)}</select>
        </div>
        <div className="portal-counseling__dialog-field">
          <Label htmlFor="portal-referrals-reason-text">Reason</Label>
          <Textarea id="portal-referrals-reason-text" maxLength={500} onChange={(event) => setReasonText(event.target.value)} value={reasonText} />
        </div>
        <div className="portal-counseling__dialog-field">
          <Label htmlFor="portal-referrals-course">Course</Label>
          <Input id="portal-referrals-course" maxLength={100} onChange={(event) => setCourse(event.target.value)} value={course} />
        </div>
        <div className="portal-counseling__dialog-field">
          <Label htmlFor="portal-referrals-year">Year level</Label>
          <Input id="portal-referrals-year" maxLength={30} onChange={(event) => setYearLevel(event.target.value)} value={yearLevel} />
        </div>
        <div className="portal-counseling__dialog-field">
          <Label htmlFor="portal-referrals-block">Block</Label>
          <Input id="portal-referrals-block" maxLength={100} onChange={(event) => setBlock(event.target.value)} value={block} />
        </div>
        {error ? <p className="portal-counseling__dialog-error" role="alert">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={pending || !studentSelectionToken} onClick={confirm}>{pending ? "Saving…" : "Create referral"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
function CreateCallSlipDialog({
  open,
  onClose,
  referralReference,
  students,
  studentsLoading,
  onSearch,
  pending,
  error,
  onCreated,
  onError,
  onPendingChange,
}: {
  open: boolean;
  onClose: () => void;
  referralReference: string | null;
  students: StaffStudentOption[];
  studentsLoading: boolean;
  onSearch: (q: string, workflow: "referral" | "call_slip") => void;
  pending: boolean;
  error: string | null;
  onCreated: (referenceCode: string) => void;
  onError: (error: unknown) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const [studentSelectionToken, setStudentSelectionToken] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [purpose, setPurpose] = useState("GENERAL_OFFICE_REPORTING");
  const [destination, setDestination] = useState("GUIDANCE_OFFICE");
  const [mode, setMode] = useState("ONSITE");
  const [reportTo, setReportTo] = useState("Guidance Office");
  const keyRef = useRef<{
    fingerprint: string;
    key: IdempotencyKey;
  } | null>(null);

  useEffect(() => {
    if (!open) keyRef.current = null;
  }, [open]);

  const confirm = () => {
    if (pending) return;
    const base = {
      destination_code: destination,
      report_to_destination: reportTo,
      mode,
      student_safe_location: "",
      student_safe_instructions: "",
      office_only_remarks: "",
    };
    const fingerprint = JSON.stringify({ referralReference, studentSelectionToken, purpose, destination, mode, reportTo });
    if (!keyRef.current || keyRef.current.fingerprint !== fingerprint) {
      keyRef.current = { fingerprint, key: createIdempotencyKey() };
    }
    const key = keyRef.current.key;
    onPendingChange(true);
    void (async () => {
      try {
        const reference = referralReference
          ? await createPortalCallSlipFromReferral({ referral_reference: referralReference, ...base }, key)
          : studentSelectionToken
            ? await createPortalCallSlip({ ...base, student_selection_token: studentSelectionToken, source_type: "OFFICE_INITIATED", purpose_code: purpose }, key)
            : null;
        if (reference) {
          keyRef.current = null;
          onCreated(reference);
        }
      } catch (error) {
        onError(error);
      } finally {
        onPendingChange(false);
      }
    })();
  };

  return (
    <AlertDialog onOpenChange={(value) => { if (!value && !pending) onClose(); }} open={open}>
      <AlertDialogContent className="portal-counseling__dialog" size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{referralReference ? "Prepare call slip" : "Create call slip"}</AlertDialogTitle>
          <AlertDialogDescription>
            {referralReference ? `Prepare a draft call slip linked to referral ${referralReference}.` : "Prepare a new office-initiated call slip."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {referralReference ? (
          <p className="portal-counseling__dialog-note">Referral {referralReference} is already selected as the linked record.</p>
        ) : (
          <div className="portal-counseling__dialog-field">
            <Label htmlFor="portal-call-slips-student-search">Student</Label>
            <Input
              id="portal-call-slips-student-search"
              onChange={(event) => { setSearch(event.target.value); onSearch(event.target.value, "call_slip"); }}
              placeholder="Search by name or student number"
              value={search}
            />
            <select
              id="portal-call-slips-student"
              onChange={(event) => setStudentSelectionToken(event.target.value || null)}
              value={studentSelectionToken ?? ""}
            >
              <option value="">{studentsLoading ? "Loading students…" : "Select a student…"}</option>
              {students.map((student) => (
                <option key={student.selection_token} value={student.selection_token}>{student.label}</option>
              ))}
            </select>
          </div>
        )}
        {!referralReference ? (
          <div className="portal-counseling__dialog-field">
            <Label htmlFor="portal-call-slips-purpose">Purpose</Label>
            <select id="portal-call-slips-purpose" onChange={(event) => setPurpose(event.target.value)} value={purpose}>{optionList(PURPOSE_OPTIONS)}</select>
          </div>
        ) : null}
        <div className="portal-counseling__dialog-field">
          <Label htmlFor="portal-call-slips-destination">Destination</Label>
          <select id="portal-call-slips-destination" onChange={(event) => setDestination(event.target.value)} value={destination}>{optionList(DESTINATION_OPTIONS)}</select>
        </div>
        <div className="portal-counseling__dialog-field">
          <Label htmlFor="portal-call-slips-report">Report to</Label>
          <Input id="portal-call-slips-report" maxLength={255} onChange={(event) => setReportTo(event.target.value)} value={reportTo} />
        </div>
        <div className="portal-counseling__dialog-field">
          <Label htmlFor="portal-call-slips-mode">Mode</Label>
          <select id="portal-call-slips-mode" onChange={(event) => setMode(event.target.value)} value={mode}>{optionList(MODE_OPTIONS)}</select>
        </div>
        {error ? <p className="portal-counseling__dialog-error" role="alert">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={pending || (!referralReference && !studentSelectionToken)} onClick={confirm}>{pending ? "Saving…" : "Create draft"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
function IssueDialog({
  open,
  onClose,
  referenceCode,
  pending,
  error,
  onIssued,
  onError,
  onPendingChange,
}: {
  open: boolean;
  onClose: () => void;
  referenceCode: string;
  pending: boolean;
  error: string | null;
  onIssued: () => void;
  onError: (error: unknown) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [mode, setMode] = useState("ONSITE");
  const [duration, setDuration] = useState("60");
  const keyRef = useRef<{ fingerprint: string; key: IdempotencyKey } | null>(null);

  useEffect(() => {
    if (!open) keyRef.current = null;
  }, [open]);

  const confirm = () => {
    if (!startAt || !endAt || pending) return;
    const fingerprint = JSON.stringify({ referenceCode, startAt, endAt, mode, duration });
    if (!keyRef.current || keyRef.current.fingerprint !== fingerprint) {
      keyRef.current = { fingerprint, key: createIdempotencyKey() };
    }
    onPendingChange(true);
    void (async () => {
      try {
        await issuePortalCallSlip(referenceCode, {
          scheduled_start_at: startAt,
          scheduled_end_at: endAt,
          expected_duration_minutes: Number(duration) || 60,
          mode,
        }, keyRef.current!.key);
        keyRef.current = null;
        onIssued();
      } catch (error) {
        onError(error);
      } finally {
        onPendingChange(false);
      }
    })();
  };

  return (
    <AlertDialog onOpenChange={(value) => { if (!value && !pending) onClose(); }} open={open}>
      <AlertDialogContent className="portal-counseling__dialog" size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Issue call slip {referenceCode}</AlertDialogTitle>
          <AlertDialogDescription>Set the schedule so the student can be called in.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="portal-counseling__dialog-field">
          <Label htmlFor="portal-call-slips-start">Starts at</Label>
          <Input id="portal-call-slips-start" onChange={(event) => setStartAt(event.target.value)} type="datetime-local" value={startAt} />
        </div>
        <div className="portal-counseling__dialog-field">
          <Label htmlFor="portal-call-slips-end">Ends at</Label>
          <Input id="portal-call-slips-end" onChange={(event) => setEndAt(event.target.value)} type="datetime-local" value={endAt} />
        </div>
        <div className="portal-counseling__dialog-field">
          <Label htmlFor="portal-call-slips-duration">Expected duration (minutes)</Label>
          <Input id="portal-call-slips-duration" maxLength={4} onChange={(event) => setDuration(event.target.value)} value={duration} />
        </div>
        <div className="portal-counseling__dialog-field">
          <Label htmlFor="portal-call-slips-issue-mode">Mode</Label>
          <select id="portal-call-slips-issue-mode" onChange={(event) => setMode(event.target.value)} value={mode}>{optionList(MODE_OPTIONS)}</select>
        </div>
        {error ? <p className="portal-counseling__dialog-error" role="alert">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={pending || !startAt || !endAt} onClick={confirm}>{pending ? "Saving…" : "Issue call slip"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
function AttendanceDialog({
  open,
  onClose,
  referenceCode,
  pending,
  error,
  onRecorded,
  onError,
  onPendingChange,
}: {
  open: boolean;
  onClose: () => void;
  referenceCode: string;
  pending: boolean;
  error: string | null;
  onRecorded: () => void;
  onError: (error: unknown) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const [reportedAt, setReportedAt] = useState("");
  const keyRef = useRef<{ fingerprint: string; key: IdempotencyKey } | null>(null);

  useEffect(() => {
    if (!open) keyRef.current = null;
  }, [open]);

  const confirm = () => {
    if (!reportedAt || pending) return;
    const fingerprint = JSON.stringify({ referenceCode, reportedAt });
    if (!keyRef.current || keyRef.current.fingerprint !== fingerprint) {
      keyRef.current = { fingerprint, key: createIdempotencyKey() };
    }
    onPendingChange(true);
    void (async () => {
      try {
        await recordPortalCallSlipAttendance(referenceCode, reportedAt, keyRef.current!.key);
        keyRef.current = null;
        onRecorded();
      } catch (error) {
        onError(error);
      } finally {
        onPendingChange(false);
      }
    })();
  };

  return (
    <AlertDialog onOpenChange={(value) => { if (!value && !pending) onClose(); }} open={open}>
      <AlertDialogContent className="portal-counseling__dialog" size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Record attendance for {referenceCode}</AlertDialogTitle>
          <AlertDialogDescription>Save the reported time for this call slip.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="portal-counseling__dialog-field">
          <Label htmlFor="portal-call-slips-reported">Reported at</Label>
          <Input id="portal-call-slips-reported" onChange={(event) => setReportedAt(event.target.value)} type="datetime-local" value={reportedAt} />
        </div>
        {error ? <p className="portal-counseling__dialog-error" role="alert">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={pending || !reportedAt} onClick={confirm}>{pending ? "Saving…" : "Record attendance"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CounselorAssignDialog({
  open,
  onClose,
  title,
  options,
  optionsError,
  pending,
  error,
  onAssigned,
  onRetryOptions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  options: ReferralCounselorOption[] | ReferralCounselorOptionLike[];
  optionsError: boolean;
  pending: boolean;
  error: string | null;
  onAssigned: (selectionToken: string, reasonCode: string) => void;
  onRetryOptions: () => void;
}) {
  const [counselorSelectionToken, setCounselorSelectionToken] = useState<string | null>(null);
  const [reasonCode, setReasonCode] = useState("");
  return (
    <AlertDialog onOpenChange={(value) => { if (!value && !pending) onClose(); }} open={open}>
      <AlertDialogContent className="portal-counseling__dialog" size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>Choose an active counselor within scope for this record.</AlertDialogDescription>
        </AlertDialogHeader>
        {optionsError ? (
          <div className="portal-counseling__detail-state">
            <p>We couldn’t load counselor options.</p>
            <Button onClick={onRetryOptions} size="sm" type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button>
          </div>
        ) : (
          <div className="portal-counseling__dialog-field">
            <Label htmlFor="portal-referrals-counselor">Counselor</Label>
            <select id="portal-referrals-counselor" onChange={(event) => setCounselorSelectionToken(event.target.value || null)} value={counselorSelectionToken ?? ""}>
              <option value="">{options.length === 0 ? "No counselors available" : "Select a counselor…"}</option>
              {options.map((option) => (
                <option key={option.selection_token} value={option.selection_token}>{option.display_name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="portal-counseling__dialog-field">
          <Label htmlFor="portal-referrals-assign-reason">Reason</Label>
          <select id="portal-referrals-assign-reason" onChange={(event) => setReasonCode(event.target.value)} value={reasonCode}>
            <option value="">Select a reason…</option>
            {optionList(WORKFLOW_REASONS.map((value) => ({ label: portalValueLabel(value), value })))}
          </select>
        </div>
        {error ? <p className="portal-counseling__dialog-error" role="alert">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} onClick={onClose}>Keep record</AlertDialogCancel>
          <AlertDialogAction disabled={pending || !counselorSelectionToken || !reasonCode} onClick={() => counselorSelectionToken && onAssigned(counselorSelectionToken, reasonCode)}>{pending ? "Saving…" : "Save assignment"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
type QueueState =
  | { kind: "loading" }
  | { kind: "ready"; page: PortalReferralsPage | PortalCallSlipsPage }
  | { kind: "forbidden" }
  | { kind: "unavailable"; error: "unavailable" | "rate_limited" | "validation" };

type ActionIntent =
  | { kind: "referral-transition"; item: ReferralStaffQueueItem; action: ReferralTransition }
  | { kind: "call-slip-reason"; item: CallSlipStaffQueueItem; action: "cancel" | "no-show" | "expire" }
  | null;

type MutationKeyEntry = { fingerprint: string; key: IdempotencyKey };

function actionMutationScope(intent: ActionIntent) {
  if (!intent) return null;
  return intent.kind === "referral-transition"
    ? `referral:${intent.item.reference_code}:${intent.action}`
    : `call-slip:${intent.item.reference_code}:${intent.action}`;
}

export function PortalReferralsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasCapability, status: accessStatus } = usePortalAccess();

  const rawQuery = searchParams.toString();
  const requested = searchParams.get("section") === "call-slips" ? "call-slips" : "referrals";
  const fallbackNav = REFERRALS_NAV_ITEMS as unknown as ReturnType<typeof getReferralsNavItems>;
  const navItems = accessStatus === "ready" ? getReferralsNavItems(hasCapability) : fallbackNav;
  const section: ReferralsSection = navItems.find((item) => item.value === requested)?.value ?? navItems[0]?.value ?? "referrals";

  const pageNumber = safePage(searchParams.get("page"));
  const referralFilters = useMemo(() => parseReferralsFilters(searchParams), [searchParams]);
  const callSlipFilters = useMemo(() => parseCallSlipsFilters(searchParams), [searchParams]);

  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<QueueState>({ kind: "loading" });
  const [expandedReferrals, setExpandedReferrals] = useState<Set<string>>(new Set());
  const [expandedSlips, setExpandedSlips] = useState<Set<string>>(new Set());
  const [referralDetails, setReferralDetails] = useState<Map<string, { detail: PortalReferralDetail | null; error: boolean }>>(new Map());
  const [slipDetails, setSlipDetails] = useState<Map<string, { detail: PortalCallSlipDetail | null; error: boolean }>>(new Map());
  const [mutationNote, setMutationNote] = useState<string | null>(null);
  const [actionIntent, setActionIntent] = useState<ActionIntent>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionDetail, setActionDetail] = useState("");
  const [actionErrorText, setActionErrorText] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [createReferralOpen, setCreateReferralOpen] = useState(false);
  const [createSlipOpen, setCreateSlipOpen] = useState(false);
  const [createSlipFrom, setCreateSlipFrom] = useState<string | null>(null);
  const [issueItem, setIssueItem] = useState<CallSlipStaffQueueItem | null>(null);
  const [attendanceItem, setAttendanceItem] = useState<CallSlipStaffQueueItem | null>(null);
  const [assignItem, setAssignItem] = useState<ReferralStaffQueueItem | CallSlipStaffQueueItem | null>(null);
  const [assignOptions, setAssignOptions] = useState<ReferralCounselorOption[]>([]);
  const [assignOptionsError, setAssignOptionsError] = useState(false);
  const [assignPending, setAssignPending] = useState(false);
  const [students, setStudents] = useState<StaffStudentOption[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const mutationKeysRef = useRef<Map<string, MutationKeyEntry>>(new Map());

  const getMutationKey = (scope: string, fingerprint: string) => {
    const current = mutationKeysRef.current.get(scope);
    if (current?.fingerprint === fingerprint) return current.key;
    const entry = { fingerprint, key: createIdempotencyKey() };
    mutationKeysRef.current.set(scope, entry);
    return entry.key;
  };

  const discardMutationKey = (scope: string) => {
    mutationKeysRef.current.delete(scope);
  };

  const canonicalHref = section === "call-slips"
    ? callSlipsHref("call-slips", pageNumber, callSlipFilters)
    : referralsHref("referrals", pageNumber, referralFilters);

  useEffect(() => {
    if (accessStatus !== "ready") return;
    if (rawQuery !== (canonicalHref.split("?")[1] ?? "")) router.replace(canonicalHref);
  }, [accessStatus, canonicalHref, rawQuery, router]);

  useEffect(() => {
    if (accessStatus !== "ready") return;
    const controller = new AbortController();
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active || controller.signal.aborted) return;
      setMutationNote(null);
      setExpandedReferrals(new Set());
      setExpandedSlips(new Set());
      setReferralDetails(new Map());
      setSlipDetails(new Map());
      setState({ kind: "loading" });
      try {
        if (section === "call-slips") {
          const page = await getPortalCallSlipQueue(pageNumber, callSlipFilters, controller.signal);
          if (active && !controller.signal.aborted) setState({ kind: "ready", page });
        } else {
          const page = await getPortalReferralQueue(pageNumber, referralFilters, controller.signal);
          if (active && !controller.signal.aborted) setState({ kind: "ready", page });
        }
      } catch (error) {
        if (active && !controller.signal.aborted && !isAbortError(error)) {
          const kind = error instanceof ReferralsApiError ? error.kind : error instanceof CallSlipsApiError ? error.kind : null;
          if (kind === "permission") setState({ kind: "forbidden" });
          else if (kind === "rate_limited") setState({ kind: "unavailable", error: "rate_limited" });
          else if (kind === "validation") setState({ kind: "unavailable", error: "validation" });
          else setState({ kind: "unavailable", error: "unavailable" });
        }
      }
    });
    return () => { active = false; controller.abort(); };
  }, [accessStatus, section, pageNumber, reloadKey, referralFilters, callSlipFilters]);
const loadReferralDetail = async (item: ReferralStaffQueueItem) => {
    setReferralDetails((current) => new Map(current).set(item.reference_code, { detail: null, error: false }));
    try {
      const detail = await getPortalReferralDetail(item.reference_code);
      setReferralDetails((current) => new Map(current).set(item.reference_code, { detail, error: false }));
    } catch (error) {
      if (!isAbortError(error)) setReferralDetails((current) => new Map(current).set(item.reference_code, { detail: null, error: true }));
    }
  };

  const loadCallSlipDetail = async (item: CallSlipStaffQueueItem) => {
    setSlipDetails((current) => new Map(current).set(item.reference_code, { detail: null, error: false }));
    try {
      const detail = await getPortalCallSlipDetail(item.reference_code);
      setSlipDetails((current) => new Map(current).set(item.reference_code, { detail, error: false }));
    } catch (error) {
      if (!isAbortError(error)) setSlipDetails((current) => new Map(current).set(item.reference_code, { detail: null, error: true }));
    }
  };

  const toggleReferral = (item: ReferralStaffQueueItem) => {
    if (expandedReferrals.has(item.reference_code)) {
      setExpandedReferrals((current) => { const next = new Set(current); next.delete(item.reference_code); return next; });
      return;
    }
    setExpandedReferrals((current) => new Set(current).add(item.reference_code));
    if (!referralDetails.has(item.reference_code)) void loadReferralDetail(item);
  };

  const toggleSlip = (item: CallSlipStaffQueueItem) => {
    if (expandedSlips.has(item.reference_code)) {
      setExpandedSlips((current) => { const next = new Set(current); next.delete(item.reference_code); return next; });
      return;
    }
    setExpandedSlips((current) => new Set(current).add(item.reference_code));
    if (!slipDetails.has(item.reference_code)) void loadCallSlipDetail(item);
  };

  const openAssign = async (item: ReferralStaffQueueItem | CallSlipStaffQueueItem) => {
    setAssignItem(item);
    setActionErrorText(null);
    setAssignOptions([]);
    setAssignOptionsError(false);
    const reference = item.reference_code;
    try {
      if ("can_prepare_call_slip" in item) {
        rememberReferralOptions(item, reference);
        setAssignOptions(await getPortalReferralCounselorOptions(reference));
      } else {
        rememberCallSlipOptions(item, reference);
        setAssignOptions(await getPortalCallSlipCounselorOptions(reference) as ReferralCounselorOption[]);
      }
    } catch (error) {
      if (!isAbortError(error)) setAssignOptionsError(true);
    }
  };

  const confirmAssign = async (selectionToken: string, reasonCode: string) => {
    if (!assignItem) return;
    const action = assignItem.assignment_state === "Assigned" ? "reassign" : "assign";
    const scope = `assignment:${assignItem.reference_code}`;
    const fingerprint = JSON.stringify({ referenceCode: assignItem.reference_code, action, selectionToken, reasonCode });
    const key = getMutationKey(scope, fingerprint);
    setAssignPending(true);
    setActionErrorText(null);
    try {
      if ("can_prepare_call_slip" in assignItem) {
        await assignPortalReferral(assignItem.reference_code, selectionToken, reasonCode, key);
      } else {
        await assignPortalCallSlip(assignItem.reference_code, selectionToken, reasonCode, key);
      }
      discardMutationKey(scope);
      setAssignItem(null);
      setMutationNote(`Record ${assignItem.reference_code} assigned to a counselor.`);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setActionErrorText(errorMessage(error));
    } finally {
      setAssignPending(false);
    }
  };

  const handleReferralAction = (action: string, item: ReferralStaffQueueItem) => {
    if (action === "prepare-call-slip") {
      setCreateSlipFrom(item.reference_code);
      setCreateSlipOpen(true);
      return;
    }
    if (action === "assign" || action === "reassign") {
      void openAssign(item);
      return;
    }
    setActionReason("");
    setActionDetail("");
    setActionErrorText(null);
    setActionIntent({ kind: "referral-transition", item, action: action as ReferralTransition });
  };

  const handleSlipAction = (action: string, item: CallSlipStaffQueueItem) => {
    if (action === "issue") { setActionErrorText(null); setIssueItem(item); return; }
    if (action === "attendance") { setActionErrorText(null); setAttendanceItem(item); return; }
    if (action === "cancel" || action === "no-show" || action === "expire") {
      setActionReason("");
      setActionDetail("");
      setActionErrorText(null);
      setActionIntent({ kind: "call-slip-reason", item, action });
      return;
    }
    if (action === "assign" || action === "reassign") {
      void openAssign(item);
    }
  };

  const confirmAction = async () => {
    if (!actionIntent) return;
    setActionPending(true);
    setActionErrorText(null);
    try {
      if (actionIntent.kind === "referral-transition") {
        const scope = actionMutationScope(actionIntent);
        if (!scope) return;
        const key = getMutationKey(scope, JSON.stringify({ action: actionIntent.action, reason: actionReason, detail: actionDetail }));
        await transitionPortalReferral(actionIntent.item.reference_code, actionIntent.action, actionReason, actionDetail, key);
        discardMutationKey(scope);
        setMutationNote(`Referral ${actionIntent.item.reference_code} updated.`);
      } else {
        const scope = actionMutationScope(actionIntent);
        if (!scope) return;
        const key = getMutationKey(scope, JSON.stringify({ action: actionIntent.action, reason: actionReason, detail: actionDetail }));
        await callSlipReasonAction(actionIntent.item.reference_code, actionIntent.action, actionReason, actionDetail, key);
        discardMutationKey(scope);
        setMutationNote(`Call slip ${actionIntent.item.reference_code} updated.`);
      }
      setActionIntent(null);
      setActionReason("");
      setActionDetail("");
      setReloadKey((value) => value + 1);
    } catch (error) {
      setActionErrorText(errorMessage(error));
    } finally {
      setActionPending(false);
    }
  };

  const searchStudents = (query: string, workflow: "referral" | "call_slip") => {
    setStudentsLoading(true);
    void getPortalStaffStudents(query, workflow)
      .then((options) => setStudents(options))
      .catch((error) => { if (!isAbortError(error)) setStudents([]); })
      .finally(() => setStudentsLoading(false));
  };

  const submitFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams({ section });
    const statuses = [...new Set(form.getAll("status")
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean))];
    if (statuses.length) params.set("status", statuses.join(","));
    for (const [key, value] of form.entries()) {
      if (key === "status") continue;
      if (typeof value === "string" && value.trim() && value.trim() !== "all") params.set(key, value.trim());
    }
    router.push(`/portal/referrals?${params.toString()}`, { scroll: false });
  };

  if (accessStatus === "loading") return <PortalReferralsLoading />;

  if (accessStatus === "ready" && navItems.length === 0) {
    return (
      <section aria-labelledby="portal-referrals-unavailable-heading" className="portal-counseling portal-counseling--state">
        <PortalPageHeader className="portal-counseling__page-header" current="Referrals & Call Slips" description="Review referrals and call slips in your scope." headingId="portal-referrals-unavailable-heading" title="Referrals & Call Slips" />
        <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state">
          <h2>Referrals and call slips aren’t available for this account.</h2>
          <p>Your current permissions don’t include a referrals or call slips queue.</p>
        </PortalCollectionFrame>
      </section>
    );
  }

  return (
    <section aria-labelledby="portal-referrals-heading" className="portal-counseling">
      <PortalPageHeader
        className="portal-counseling__page-header"
        current="Referrals & Call Slips"
        description="Review referrals and call slips within your workspace scope."
        headingId="portal-referrals-heading"
        title="Referrals & Call Slips"
      />
      <div className="portal-counseling__workspace">
        {navItems.length > 0 ? (
          <PortalWorkspaceNav activeValue={section} ariaLabel="Referrals & Call Slips sections" items={navItems} />
        ) : null}
        <div className="portal-counseling__active-content">
          {state.kind === "forbidden" ? (
            <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state">
              <h2>You don’t have access to this section.</h2>
              <p>Your current permissions can’t open this queue.</p>
            </PortalCollectionFrame>
          ) : state.kind === "unavailable" ? (
            <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state">
              <h2>We couldn’t load this queue.</h2>
              <p>{state.error === "rate_limited" ? "Too many requests. Wait a moment and try again." : "Try again when the connection is ready."}</p>
              <Button onClick={() => setReloadKey((value) => value + 1)} type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button>
            </PortalCollectionFrame>
          ) : null}

          {section === "referrals" ? (
            <PortalFilterPanel
              accessibleLabel="referral filters"
              action="/portal/referrals?section=referrals"
              className="portal-counseling__filters"
              onSubmit={submitFilters}
              resetKey={`ref:${referralFilters.q ?? ""}:${referralFilters.status ?? ""}:${referralFilters.assignment}:${referralFilters.sourceType ?? ""}:${referralFilters.reasonCategory ?? ""}:${referralFilters.order}:${pageNumber}`}
              summary="Narrow the referrals visible to this account."
            >
              <div className="portal-counseling__filters-grid">
                <div className="portal-counseling__filter-field portal-counseling__filter-field--search">
                  <Label htmlFor="portal-referrals-q">Search</Label>
                  <Input defaultValue={referralFilters.q ?? ""} id="portal-referrals-q" maxLength={MAX_QUERY_LENGTH} name="q" placeholder="Reference, student name, or student number" />
                </div>
                <div className="portal-counseling__filter-field">
                  <Label htmlFor="portal-referrals-status">Status</Label>
                  <PortalStatusFilter ariaLabel="referral statuses" description="Filter referrals by status." id="portal-referrals-status" options={REFERRAL_STATUS_OPTIONS} selectedValues={referralFilters.statuses} title="Status" />
                </div>
                <div className="portal-counseling__filter-field">
                  <Label htmlFor="portal-referrals-assignment">Assignment</Label>
                  <select defaultValue={referralFilters.assignment} id="portal-referrals-assignment" name="assignment">{optionList(ASSIGNMENT_OPTIONS)}</select>
                </div>
                <div className="portal-counseling__filter-field">
                  <Label htmlFor="portal-referrals-source">Source</Label>
                  <select defaultValue={referralFilters.sourceType ?? ""} id="portal-referrals-source" name="source_type"><option value="">Any source</option>{optionList(SOURCE_TYPE_OPTIONS)}</select>
                </div>
                <div className="portal-counseling__filter-field">
                  <Label htmlFor="portal-referrals-category">Reason category</Label>
                  <select defaultValue={referralFilters.reasonCategory ?? ""} id="portal-referrals-category" name="reason_category"><option value="">Any category</option>{optionList(REASON_CATEGORY_OPTIONS)}</select>
                </div>
                <div className="portal-counseling__filter-field">
                  <Label htmlFor="portal-referrals-year">Academic year</Label>
                  <Input defaultValue={referralFilters.academicYear ?? ""} id="portal-referrals-year" maxLength={9} name="academic_year" placeholder="2025-2026" />
                </div>
                <div className="portal-counseling__filter-field">
                  <Label htmlFor="portal-referrals-order">Order</Label>
                  <select defaultValue={referralFilters.order} id="portal-referrals-order" name="order">{optionList(ORDER_OPTIONS)}</select>
                </div>
              </div>
              <div className="portal-counseling__filter-actions">
                <Button size="sm" type="submit">Apply filters</Button>
                <Link className="portal-counseling__filter-clear" href="/portal/referrals?section=referrals">Clear</Link>
              </div>
            </PortalFilterPanel>
          ) : null}

          {section === "call-slips" ? (
            <PortalFilterPanel
              accessibleLabel="call slip filters"
              action="/portal/referrals?section=call-slips"
              className="portal-counseling__filters"
              onSubmit={submitFilters}
              resetKey={`slip:${callSlipFilters.q ?? ""}:${callSlipFilters.status ?? ""}:${callSlipFilters.assignment}:${callSlipFilters.purpose ?? ""}:${callSlipFilters.mode ?? ""}:${callSlipFilters.destination ?? ""}:${callSlipFilters.order}:${pageNumber}`}
              summary="Narrow the call slips visible to this account."
            >
              <div className="portal-counseling__filters-grid">
                <div className="portal-counseling__filter-field portal-counseling__filter-field--search">
                  <Label htmlFor="portal-call-slips-q">Search</Label>
                  <Input defaultValue={callSlipFilters.q ?? ""} id="portal-call-slips-q" maxLength={MAX_QUERY_LENGTH} name="q" placeholder="Reference, student name, or student number" />
                </div>
                <div className="portal-counseling__filter-field">
                  <Label htmlFor="portal-call-slips-status">Status</Label>
                  <PortalStatusFilter ariaLabel="call slip statuses" description="Filter call slips by status." id="portal-call-slips-status" options={CALL_SLIP_STATUS_OPTIONS} selectedValues={callSlipFilters.statuses} title="Status" />
                </div>
                <div className="portal-counseling__filter-field">
                  <Label htmlFor="portal-call-slips-assignment">Assignment</Label>
                  <select defaultValue={callSlipFilters.assignment} id="portal-call-slips-assignment" name="assignment">{optionList(SLIP_ASSIGNMENT_OPTIONS)}</select>
                </div>
                <div className="portal-counseling__filter-field">
                  <Label htmlFor="portal-call-slips-purpose">Purpose</Label>
                  <select defaultValue={callSlipFilters.purpose ?? ""} id="portal-call-slips-purpose" name="purpose"><option value="">Any purpose</option>{optionList(PURPOSE_OPTIONS)}</select>
                </div>
                <div className="portal-counseling__filter-field">
                  <Label htmlFor="portal-call-slips-mode">Mode</Label>
                  <select defaultValue={callSlipFilters.mode ?? ""} id="portal-call-slips-mode" name="mode"><option value="">Any mode</option>{optionList(MODE_OPTIONS)}</select>
                </div>
                <div className="portal-counseling__filter-field">
                  <Label htmlFor="portal-call-slips-destination">Destination</Label>
                  <select defaultValue={callSlipFilters.destination ?? ""} id="portal-call-slips-destination" name="destination"><option value="">Any destination</option>{optionList(DESTINATION_OPTIONS)}</select>
                </div>
                <div className="portal-counseling__filter-field">
                  <Label htmlFor="portal-call-slips-year">Academic year</Label>
                  <Input defaultValue={callSlipFilters.academicYear ?? ""} id="portal-call-slips-year" maxLength={9} name="academic_year" placeholder="2025-2026" />
                </div>
                <div className="portal-counseling__filter-field">
                  <Label htmlFor="portal-call-slips-order">Order</Label>
                  <select defaultValue={callSlipFilters.order} id="portal-call-slips-order" name="order">{optionList(ORDER_OPTIONS)}</select>
                </div>
              </div>
              <div className="portal-counseling__filter-actions">
                <Button size="sm" type="submit">Apply filters</Button>
                <Link className="portal-counseling__filter-clear" href="/portal/referrals?section=call-slips">Clear</Link>
              </div>
            </PortalFilterPanel>
          ) : null}

          {section === "referrals" ? (
            <PortalCollectionFrame aria-labelledby="portal-referrals-results-heading" className="portal-counseling__frame">
              <div className="portal-counseling__frame-heading">
                <div><p className="portal-counseling__kicker">Referrals</p><h2 id="portal-referrals-results-heading">Referral queue</h2></div>
                <div className="portal-counseling__frame-actions">
                  <p className="portal-counseling__result-count">{state.kind === "ready" ? `${state.page.total} ${state.page.total === 1 ? "referral" : "referrals"}` : "…"}</p>
                  {hasCapability(PORTAL_CAPABILITIES.referralsQueueView) ? <Button onClick={() => { setActionErrorText(null); setCreateReferralOpen(true); }} size="sm" type="button">Create referral</Button> : null}
                </div>
              </div>
              {mutationNote ? <p className="portal-counseling__mutation portal-counseling__mutation--success" role="status">{mutationNote}</p> : null}
              {state.kind === "loading" ? <div aria-busy="true" className="portal-counseling__loading"><Skeleton className="portal-counseling__skeleton-row" /></div>
                : state.kind === "ready" && state.page.items.length === 0 ? <EmptyState section="referrals" />
                  : state.kind === "ready" ? <ReferralTable details={referralDetails} expanded={expandedReferrals} hasCapability={hasCapability} items={state.page.items as ReferralStaffQueueItem[]} onAction={handleReferralAction} onRetry={(item) => void loadReferralDetail(item)} onToggle={toggleReferral} /> : null}
              {state.kind === "ready" ? <QueuePagination filters={referralFilters} page={state.page.page} section="referrals" total={state.page.total} /> : null}
            </PortalCollectionFrame>
          ) : null}

          {section === "call-slips" ? (
            <PortalCollectionFrame aria-labelledby="portal-call-slips-results-heading" className="portal-counseling__frame">
              <div className="portal-counseling__frame-heading">
                <div><p className="portal-counseling__kicker">Call Slips</p><h2 id="portal-call-slips-results-heading">Call slip queue</h2></div>
                <div className="portal-counseling__frame-actions">
                  <p className="portal-counseling__result-count">{state.kind === "ready" ? `${state.page.total} ${state.page.total === 1 ? "call slip" : "call slips"}` : "…"}</p>
                  {hasCapability(PORTAL_CAPABILITIES.callSlipsQueueView) ? <Button onClick={() => { setActionErrorText(null); setCreateSlipFrom(null); setCreateSlipOpen(true); }} size="sm" type="button">Create call slip</Button> : null}
                </div>
              </div>
              {mutationNote ? <p className="portal-counseling__mutation portal-counseling__mutation--success" role="status">{mutationNote}</p> : null}
              {state.kind === "loading" ? <div aria-busy="true" className="portal-counseling__loading"><Skeleton className="portal-counseling__skeleton-row" /></div>
                : state.kind === "ready" && state.page.items.length === 0 ? <EmptyState section="call-slips" />
                  : state.kind === "ready" ? <CallSlipTable details={slipDetails} expanded={expandedSlips} hasCapability={hasCapability} items={state.page.items as CallSlipStaffQueueItem[]} onAction={handleSlipAction} onRetry={(item) => void loadCallSlipDetail(item)} onToggle={toggleSlip} /> : null}
              {state.kind === "ready" ? <QueuePagination filters={callSlipFilters} page={state.page.page} section="call-slips" total={state.page.total} /> : null}
            </PortalCollectionFrame>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        confirmLabel="Save"
        description={actionIntent?.kind === "referral-transition" ? `Update referral ${actionIntent.item.reference_code}.` : "Apply this call slip action."}
        detailText={actionDetail}
        error={actionErrorText}
        needsReason={actionIntent !== null}
        onCancel={() => { discardMutationKey(actionMutationScope(actionIntent) ?? ""); setActionIntent(null); setActionReason(""); setActionDetail(""); setActionErrorText(null); }}
        onConfirm={() => void confirmAction()}
        open={actionIntent !== null}
        pending={actionPending}
        reason={actionReason}
        reasonOptions={actionIntent?.kind === "referral-transition" ? WORKFLOW_REASONS : SLIP_WORKFLOW_REASONS}
        setDetailText={setActionDetail}
        setReason={setActionReason}
        title={actionIntent?.kind === "referral-transition" ? `Update referral ${actionIntent.item.reference_code}` : "Call slip action"}
      />
      <CreateReferralDialog
        error={actionErrorText}
        onClose={() => { setCreateReferralOpen(false); setActionErrorText(null); }}
        onCreated={(reference) => { setCreateReferralOpen(false); setMutationNote(`Referral ${reference} created.`); setReloadKey((value) => value + 1); }}
        onError={(error) => setActionErrorText(errorMessage(error))}
        onPendingChange={setActionPending}
        onSearch={searchStudents}
        open={createReferralOpen}
        pending={actionPending}
        students={students}
        studentsLoading={studentsLoading}
      />
      <CreateCallSlipDialog
        error={actionErrorText}
        onClose={() => { setCreateSlipOpen(false); setCreateSlipFrom(null); setActionErrorText(null); }}
        onCreated={(reference) => { setCreateSlipOpen(false); setCreateSlipFrom(null); setMutationNote(`Call slip ${reference} prepared.`); setReloadKey((value) => value + 1); }}
        onError={(error) => setActionErrorText(errorMessage(error))}
        onPendingChange={setActionPending}
        onSearch={searchStudents}
        open={createSlipOpen}
        pending={actionPending}
        referralReference={createSlipFrom}
        students={students}
        studentsLoading={studentsLoading}
      />
      <IssueDialog
        error={actionErrorText}
        onClose={() => { setIssueItem(null); setActionErrorText(null); }}
        onError={(error) => setActionErrorText(errorMessage(error))}
        onIssued={() => { setIssueItem(null); setMutationNote("Call slip issued."); setReloadKey((value) => value + 1); }}
        onPendingChange={setActionPending}
        open={issueItem !== null}
        pending={actionPending}
        referenceCode={issueItem?.reference_code ?? ""}
      />
      <AttendanceDialog
        error={actionErrorText}
        onClose={() => { setAttendanceItem(null); setActionErrorText(null); }}
        onError={(error) => setActionErrorText(errorMessage(error))}
        onPendingChange={setActionPending}
        onRecorded={() => { setAttendanceItem(null); setMutationNote("Attendance recorded."); setReloadKey((value) => value + 1); }}
        open={attendanceItem !== null}
        pending={actionPending}
        referenceCode={attendanceItem?.reference_code ?? ""}
      />
      <CounselorAssignDialog error={actionErrorText} onAssigned={(selectionToken, reasonCode) => void confirmAssign(selectionToken, reasonCode)} onClose={() => { if (assignItem) discardMutationKey(`assignment:${assignItem.reference_code}`); setAssignItem(null); setActionErrorText(null); }} onRetryOptions={() => assignItem ? void openAssign(assignItem) : undefined} open={assignItem !== null} options={assignOptions} optionsError={assignOptionsError} pending={assignPending} title={assignItem ? `Assign ${assignItem.reference_code}` : "Assign record"} />
    </section>
  );
}
