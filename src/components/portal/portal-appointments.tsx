"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";

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
import { usePortalAccess } from "@/components/portal/portal-access-provider";
import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
import { PortalFilterPanel } from "@/components/portal/portal-filter-panel";
import { PortalPageHeader } from "@/components/portal/portal-page-header";
import { PortalStatusFilter } from "@/components/portal/portal-status-filter";
import { PORTAL_CAPABILITIES } from "@/components/portal/portal-navigation";
import {
  APPOINTMENT_ASSIGNMENTS,
  APPOINTMENT_MODES,
  APPOINTMENT_ORDERS,
  APPOINTMENT_STATUSES,
  APPOINTMENT_TYPES,
  AppointmentsApiError,
  cancelPortalAppointment,
  completePortalAppointment,
  getPortalAppointmentDetail,
  getPortalAppointments,
  openPortalAppointmentSession,
  markAppointmentNoShow,
  reviewAppointment,
  scheduleAppointment,
  type AppointmentAssignment,
  type AppointmentListFilters,
  type AppointmentMode,
  type AppointmentOrder,
  type AppointmentStatus,
  type AppointmentType,
  type PortalAppointment,
  type PortalAppointmentPage,
} from "@/lib/api/appointments";
import { createIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";

type ParsedAppointmentFilters = AppointmentListFilters & {
  statuses: AppointmentStatus[];
};

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; page: PortalAppointmentPage }
  | { kind: "unavailable"; error: "unavailable" | "rate_limited" | "validation" }
  | { kind: "forbidden" };

type DetailState =
  | { kind: "loading" }
  | { kind: "ready"; appointment: PortalAppointment | null }
  | { kind: "error" };

type AppointmentAction =
  | "cancel"
  | "complete"
  | "no-show"
  | "review"
  | "schedule";

type ActionIntent = {
  action: AppointmentAction;
  appointment: PortalAppointment;
};

type MutationState = {
  referenceCode: string;
  message: string;
  state: "pending" | "error" | "success";
};

type MutationKeyEntry = {
  fingerprint: string;
  key: IdempotencyKey;
};

const STATUS_OPTIONS: readonly { label: string; value: AppointmentStatus }[] = [
  { label: "Draft", value: "DRAFT" },
  { label: "Submitted", value: "SUBMITTED" },
  { label: "Pending review", value: "PENDING_REVIEW" },
  { label: "Approved", value: "APPROVED" },
  { label: "Scheduled", value: "SCHEDULED" },
  { label: "Declined", value: "DECLINED" },
  { label: "Cancelled by student", value: "CANCELLED_BY_STUDENT" },
  { label: "Cancelled by office", value: "CANCELLED_BY_OFFICE" },
  { label: "Late cancellation requested", value: "LATE_CANCELLATION_REQUESTED" },
  { label: "Late cancellation approved", value: "LATE_CANCELLATION_APPROVED" },
  { label: "Late cancellation declined", value: "LATE_CANCELLATION_DECLINED" },
  { label: "Completed", value: "COMPLETED" },
  { label: "No-show", value: "NO_SHOW" },
];

const TYPE_OPTIONS: readonly { label: string; value: AppointmentType }[] = [
  { label: "All appointment types", value: "COUNSELING" },
  { label: "Counseling", value: "COUNSELING" },
  { label: "Routine interview", value: "ROUTINE_INTERVIEW" },
  { label: "Follow-up", value: "FOLLOW_UP" },
  { label: "Other", value: "OTHER" },
];

const MODE_OPTIONS: readonly { label: string; value: AppointmentMode }[] = [
  { label: "All appointment modes", value: "ONSITE" },
  { label: "On-site", value: "ONSITE" },
  { label: "Online", value: "ONLINE" },
];

const ASSIGNMENT_OPTIONS: readonly { label: string; value: AppointmentAssignment }[] = [
  { label: "All assignments", value: "all" },
  { label: "Assigned to me", value: "mine" },
  { label: "Unassigned", value: "unassigned" },
];

const ACTIVE_REVIEW_STATUSES = new Set<AppointmentStatus>([
  "SUBMITTED",
  "PENDING_REVIEW",
]);

const STATUS_SET = new Set<string>(APPOINTMENT_STATUSES);
const TYPE_SET = new Set<string>(APPOINTMENT_TYPES);
const MODE_SET = new Set<string>(APPOINTMENT_MODES);
const ASSIGNMENT_SET = new Set<string>(APPOINTMENT_ASSIGNMENTS);
const ORDER_SET = new Set<string>(APPOINTMENT_ORDERS);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PAGE = 10_000;
const MAX_QUERY_LENGTH = 120;

function labelForStatus(status: string) {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function labelForType(value: string) {
  return value === "ROUTINE_INTERVIEW"
    ? "Routine interview"
    : value === "FOLLOW_UP"
      ? "Follow-up"
      : value.charAt(0) + value.slice(1).toLowerCase();
}

function labelForMode(value: string) {
  return value === "ONSITE" ? "On-site" : "Online";
}

function parseDate(value: string | null) {
  return value && DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    ? value
    : null;
}

function parsePage(value: string | null) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1;
}

function parseStatuses(value: string | null) {
  if (!value) return [];
  return [...new Set(value.split(",").map((item) => item.trim().toUpperCase()))].filter(
    (item): item is AppointmentStatus => STATUS_SET.has(item),
  );
}

type AppointmentSearchParams = { get: (name: string) => string | null };

function parseAppointmentFilters(params: AppointmentSearchParams): ParsedAppointmentFilters {
  const statuses = parseStatuses(params.get("status"));
  const q = params.get("q")?.trim() ?? "";
  const appointmentType = params.get("type");
  const appointmentMode = params.get("mode");
  const assignment = params.get("assignment");
  const order = params.get("order");
  const dateFrom = parseDate(params.get("date_from"));
  const dateTo = parseDate(params.get("date_to"));

  return {
    q: q && q.length <= MAX_QUERY_LENGTH ? q : null,
    status: statuses.length ? statuses.join(",") : null,
    statuses,
    appointmentType: appointmentType && TYPE_SET.has(appointmentType)
      ? appointmentType as AppointmentType
      : null,
    appointmentMode: appointmentMode && MODE_SET.has(appointmentMode)
      ? appointmentMode as AppointmentMode
      : null,
    assignment: assignment && ASSIGNMENT_SET.has(assignment)
      ? assignment as AppointmentAssignment
      : "all",
    dateFrom,
    dateTo,
    order: order && ORDER_SET.has(order) ? order as AppointmentOrder : "recent",
  };
}

function appointmentHref(page: number, filters: ParsedAppointmentFilters | AppointmentListFilters) {
  const params = new URLSearchParams();
  const statuses = "statuses" in filters
    ? filters.statuses
    : filters.status?.split(",").filter(Boolean) ?? [];
  if (statuses.length) params.set("status", statuses.join(","));
  if (filters.q?.trim()) params.set("q", filters.q.trim().slice(0, MAX_QUERY_LENGTH));
  if (filters.appointmentType) params.set("type", filters.appointmentType);
  if (filters.appointmentMode) params.set("mode", filters.appointmentMode);
  if (filters.assignment && filters.assignment !== "all") params.set("assignment", filters.assignment);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  if (filters.order && filters.order !== "recent") params.set("order", filters.order);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/portal/appointments?${query}` : "/portal/appointments";
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(date);
}

function formatSchedule(appointment: PortalAppointment) {
  const date = formatDate(appointment.confirmed_date ?? appointment.requested_date);
  const time = appointment.confirmed_start_time ?? appointment.requested_start_time;
  if (!date) return "Schedule not set";
  return time ? `${date} at ${time.slice(0, 5)}` : date;
}

function loadMessage(kind: LoadState["kind"] | "rate_limited" | "validation") {
  if (kind === "rate_limited") return "Too many appointment requests. Please wait and try again.";
  if (kind === "validation") return "The appointment filters could not be applied.";
  return "Appointments are unavailable right now.";
}

function mutationMessage(error: AppointmentsApiError) {
  switch (error.kind) {
    case "conflict":
      return "This appointment changed. Refresh the queue and try again.";
    case "permission":
      return "This action is not available for this account.";
    case "validation":
      return "Check the appointment details and try again.";
    case "rate_limited":
      return "Too many attempts. Please wait before trying again.";
    default:
      return "This appointment action is temporarily unavailable. Try again.";
  }
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function actionLabel(action: AppointmentAction) {
  return action === "no-show"
    ? "Mark no-show"
    : action === "schedule"
      ? "Schedule"
      : action.charAt(0).toUpperCase() + action.slice(1);
}

function canAction(
  action: AppointmentAction,
  appointment: PortalAppointment,
  hasCapability: (capability: string) => boolean,
) {
  if (action === "cancel") {
    return appointment.status === "SCHEDULED" && hasCapability(PORTAL_CAPABILITIES.appointmentsCancel);
  }
  if (action === "complete" || action === "no-show") {
    return appointment.status === "SCHEDULED" && hasCapability(PORTAL_CAPABILITIES.appointmentsOutcomeManage);
  }
  if (action === "review") {
    return ACTIVE_REVIEW_STATUSES.has(appointment.status) && hasCapability(PORTAL_CAPABILITIES.appointmentsReview);
  }
  return appointment.status === "APPROVED" && hasCapability(PORTAL_CAPABILITIES.appointmentsSchedule);
}

function AppointmentPageHeader({
  description = "Review and manage appointments within your authorized counseling scope.",
  title = "Appointments",
}: {
  description?: ReactNode;
  title?: ReactNode;
}) {
  return (
    <PortalPageHeader
      className="portal-appointments__page-header"
      current="Appointments"
      description={description}
      headingId="portal-appointments-heading"
      title={title}
    />
  );
}

function AppointmentFilters({ filters }: { filters: ParsedAppointmentFilters }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rangeError, setRangeError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const dateFrom = parseDate(String(form.get("date_from") ?? ""));
    const dateTo = parseDate(String(form.get("date_to") ?? ""));
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setRangeError("The start date must be on or before the end date.");
      return;
    }
    setRangeError(null);
    const submittedStatuses = form.getAll("status").filter((value): value is string => typeof value === "string");
    const nextFilters: ParsedAppointmentFilters = {
      q: String(form.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH) || null,
      status: submittedStatuses.length ? submittedStatuses.join(",") : null,
      statuses: submittedStatuses.filter((value): value is AppointmentStatus => STATUS_SET.has(value)),
      appointmentType: TYPE_SET.has(String(form.get("type") ?? ""))
        ? String(form.get("type")) as AppointmentType
        : null,
      appointmentMode: MODE_SET.has(String(form.get("mode") ?? ""))
        ? String(form.get("mode")) as AppointmentMode
        : null,
      assignment: ASSIGNMENT_SET.has(String(form.get("assignment") ?? "all"))
        ? String(form.get("assignment")) as AppointmentAssignment
        : "all",
      dateFrom,
      dateTo,
      order: ORDER_SET.has(String(form.get("order") ?? "recent"))
        ? String(form.get("order")) as AppointmentOrder
        : "recent",
    };
    startTransition(() => router.push(appointmentHref(1, nextFilters)));
  };

  return (
    <PortalFilterPanel
      accessibleLabel="appointment filters"
      action="/portal/appointments"
      ariaBusy={isPending}
      className="portal-appointments__filters"
      onSubmit={handleSubmit}
      resetKey={`${filters.q ?? ""}:${filters.status ?? ""}:${filters.appointmentType ?? ""}:${filters.appointmentMode ?? ""}:${filters.assignment}:${filters.dateFrom ?? ""}:${filters.dateTo ?? ""}:${filters.order}`}
      summary="Search and narrow the appointments visible to this account."
    >
      <div className="portal-appointments__filters-grid">
        <div className="portal-appointments__filter-field portal-appointments__filter-field--search">
          <Label htmlFor="portal-appointments-query">Search</Label>
          <Input
            defaultValue={filters.q ?? ""}
            id="portal-appointments-query"
            maxLength={MAX_QUERY_LENGTH}
            name="q"
            placeholder="Reference, student name, or student number"
          />
        </div>
        <div className="portal-appointments__filter-field">
          <Label htmlFor="portal-appointments-status">Status</Label>
          <PortalStatusFilter
            ariaLabel="Choose appointment statuses"
            id="portal-appointments-status"
            options={STATUS_OPTIONS}
            selectedValues={filters.statuses}
            title="Appointment status"
          />
        </div>
        <div className="portal-appointments__filter-field">
          <Label htmlFor="portal-appointments-type">Appointment type</Label>
          <select defaultValue={filters.appointmentType ?? ""} id="portal-appointments-type" name="type">
            <option value="">All appointment types</option>
            {TYPE_OPTIONS.slice(1).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="portal-appointments__filter-field">
          <Label htmlFor="portal-appointments-mode">Mode</Label>
          <select defaultValue={filters.appointmentMode ?? ""} id="portal-appointments-mode" name="mode">
            <option value="">All appointment modes</option>
            {MODE_OPTIONS.slice(1).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="portal-appointments__filter-field">
          <Label htmlFor="portal-appointments-assignment">Assignment</Label>
          <select defaultValue={filters.assignment ?? "all"} id="portal-appointments-assignment" name="assignment">
            {ASSIGNMENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="portal-appointments__filter-field">
          <Label htmlFor="portal-appointments-date-from">From date</Label>
          <Input defaultValue={filters.dateFrom ?? ""} id="portal-appointments-date-from" name="date_from" type="date" />
        </div>
        <div className="portal-appointments__filter-field">
          <Label htmlFor="portal-appointments-date-to">To date</Label>
          <Input defaultValue={filters.dateTo ?? ""} id="portal-appointments-date-to" name="date_to" type="date" />
        </div>
        <div className="portal-appointments__filter-field">
          <Label htmlFor="portal-appointments-order">Order</Label>
          <select defaultValue={filters.order ?? "recent"} id="portal-appointments-order" name="order">
            <option value="recent">Recently updated</option>
            <option value="upcoming">Upcoming first</option>
          </select>
        </div>
      </div>
      {rangeError ? <p className="portal-appointments__filter-error" role="alert">{rangeError}</p> : null}
      <div className="portal-appointments__filter-actions">
        <Button disabled={isPending} size="sm" type="submit">Apply filters</Button>
        <Link className="portal-appointments__filter-clear" href="/portal/appointments">Clear</Link>
      </div>
    </PortalFilterPanel>
  );
}

function AppointmentsLoadingState() {
  return (
    <section aria-busy="true" aria-label="Loading appointments" className="portal-appointments portal-appointments--loading" role="status">
      <span className="sr-only">Loading appointments…</span>
      <AppointmentPageHeader
        description="Review and manage appointments within your authorized counseling scope."
        title={<Skeleton as="span" aria-hidden="true" className="portal-appointments__skeleton-heading" />}
      />
      <PortalFilterPanel
        accessibleLabel="appointment filters"
        action="/portal/appointments"
        ariaBusy
        className="portal-appointments__filters"
        resetKey="appointments-loading"
        summary={<Skeleton as="span" aria-hidden="true" className="portal-appointments__skeleton-summary" />}
      >
        <div aria-hidden="true" className="portal-appointments__filters-grid portal-appointments__filters-grid--loading">
          {Array.from({ length: 8 }, (_, index) => <Skeleton as="span" key={index} />)}
        </div>
      </PortalFilterPanel>
      <PortalCollectionFrame className="portal-appointments__frame">
        <div aria-hidden="true" className="portal-appointments__skeleton-table">
          {Array.from({ length: 6 }, (_, row) => (
            <div className="portal-appointments__skeleton-table-row" key={row}>
              {Array.from({ length: 8 }, (_, cell) => <Skeleton as="span" key={cell} />)}
            </div>
          ))}
        </div>
      </PortalCollectionFrame>
    </section>
  );
}

export function PortalAppointmentsLoading() {
  return <AppointmentsLoadingState />;
}

function AccessState({ kind, onRetry }: { kind: "forbidden" | "unavailable"; onRetry?: () => void }) {
  return (
    <section aria-labelledby="portal-appointments-heading" className="portal-appointments portal-appointments--state">
      <AppointmentPageHeader />
      <PortalCollectionFrame className="portal-appointments__frame portal-appointments__frame--state">
        <h2>
          {kind === "forbidden" ? "Appointments aren’t available for this account." : "Appointments are unavailable right now."}
        </h2>
        <p>{kind === "forbidden" ? "Return to your workspace to continue." : "Try again when the connection is ready."}</p>
        {onRetry ? <Button onClick={onRetry} type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button> : null}
      </PortalCollectionFrame>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="portal-appointments__empty" role="status">
      <h2>No appointments to show.</h2>
      <p>Try changing the filters or check back after more appointments are recorded.</p>
    </div>
  );
}

function AppointmentDetails({
  appointment,
  detail,
  onRetry,
}: {
  appointment: PortalAppointment;
  detail: DetailState | undefined;
  onRetry: () => void;
}) {
  if (!detail || detail.kind === "loading") {
    return <div className="portal-appointments__detail-state" role="status"><Skeleton as="span" /> <Skeleton as="span" /></div>;
  }
  if (detail.kind === "error") {
    return <div className="portal-appointments__detail-state" role="status"><p>Details are unavailable right now.</p><Button onClick={onRetry} size="sm" type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button></div>;
  }
  const value = detail.appointment ?? appointment;
  const facts = [
    ["Schedule", formatSchedule(value)],
    ["Type", labelForType(value.appointment_type)],
    ["Mode", labelForMode(value.appointment_mode)],
    ["Status", labelForStatus(value.status)],
    value.reason ? ["Reason", value.reason] : null,
    value.cancellation_reason ? ["Cancellation note", value.cancellation_reason] : null,
    value.internal_notes ? ["Approved notes", value.internal_notes] : null,
  ].filter((fact): fact is [string, string] => Boolean(fact && fact[1]));

  return (
    <div className="portal-appointments__detail-content">
      <dl>
        {facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
    </div>
  );
}

function AppointmentActions({
  appointment,
  hasCapability,
  onAction,
}: {
  appointment: PortalAppointment;
  hasCapability: (capability: string) => boolean;
  onAction: (action: AppointmentAction, appointment: PortalAppointment) => void;
}) {
  const actions: AppointmentAction[] = ["review", "schedule", "cancel", "complete", "no-show"].filter(
    (action): action is AppointmentAction => canAction(action as AppointmentAction, appointment, hasCapability),
  );
  if (!actions.length) return null;
  return (
    <div className="portal-appointments__row-actions" aria-label={`Actions for ${appointment.reference_code}`}>
      {actions.map((action) => (
        <Button key={action} onClick={() => onAction(action, appointment)} size="xs" type="button" variant={action === "cancel" || action === "no-show" ? "outline" : "ghost"}>
          {actionLabel(action)}
        </Button>
      ))}
    </div>
  );
}

function AppointmentTable({
  appointments,
  expandedReference,
  details,
  hasCapability,
  mutation,
  onAction,
  onRetryDetail,
  onOpenSession,
  onToggle,
}: {
  appointments: PortalAppointment[];
  expandedReference: string | null;
  details: Record<string, DetailState>;
  hasCapability: (capability: string) => boolean;
  mutation: MutationState | null;
  onAction: (action: AppointmentAction, appointment: PortalAppointment) => void;
  onRetryDetail: (appointment: PortalAppointment) => void;
  onOpenSession: (appointment: PortalAppointment) => void;
  onToggle: (appointment: PortalAppointment) => void;
}) {
  return (
    <div className="portal-appointments__table-wrap">
      <table className="portal-appointments__table">
        <thead>
          <tr>
            <th scope="col">Student</th>
            <th scope="col">Reference</th>
            <th scope="col">Type</th>
            <th scope="col">Mode</th>
            <th scope="col">Status</th>
            <th scope="col">Schedule</th>
            <th scope="col">Assignment</th>
            <th scope="col">Details &amp; actions</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((appointment) => {
            const expanded = expandedReference === appointment.reference_code;
            const detailId = `portal-appointment-detail-${appointment.reference_code}`;
            const mutationForRow = mutation?.referenceCode === appointment.reference_code ? mutation : null;
            return (
              <Fragment key={appointment.reference_code}>
                <tr className={expanded ? "is-expanded" : undefined}>
                  <td data-label="Student">
                    <span className="portal-appointments__student-name">{appointment.student_display_name ?? "Student details unavailable"}</span>
                    {appointment.student_number ? <span className="portal-appointments__student-number">{appointment.student_number}</span> : null}
                  </td>
                  <td data-label="Reference"><span className="portal-appointments__reference">{appointment.reference_code}</span></td>
                  <td data-label="Type">{labelForType(appointment.appointment_type)}</td>
                  <td data-label="Mode">{labelForMode(appointment.appointment_mode)}</td>
                  <td data-label="Status"><Badge variant="outline" data-tone={appointment.status.toLowerCase()}>{labelForStatus(appointment.status)}</Badge></td>
                  <td data-label="Schedule">{formatSchedule(appointment)}</td>
                  <td data-label="Assignment">{appointment.assignment_state ?? "Assignment unavailable"}</td>
                  <td data-label="Details & actions">
                    <div className="portal-appointments__details-actions">
                      <Button
                        aria-controls={detailId}
                        aria-expanded={expanded}
                        aria-label={`${expanded ? "Hide" : "Show"} details for ${appointment.reference_code}`}
                        onClick={() => onToggle(appointment)}
                        size="xs"
                        type="button"
                        variant="outline"
                      >
                        {expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                        <span className="sr-only">{expanded ? "Hide" : "Show"} details</span>
                      </Button>
                      <AppointmentActions appointment={appointment} hasCapability={hasCapability} onAction={onAction} />
                      {appointment.status === "SCHEDULED" && hasCapability(PORTAL_CAPABILITIES.counselingSessionsQueueView) ? <Button onClick={() => onOpenSession(appointment)} size="xs" type="button" variant="ghost">Open session</Button> : null}
                    </div>
                  </td>
                </tr>
                {expanded ? (
                  <tr className="portal-appointments__detail-row">
                    <td colSpan={8} id={detailId}>
                      <AppointmentDetails appointment={appointment} detail={details[appointment.reference_code]} onRetry={() => onRetryDetail(appointment)} />
                      {mutationForRow ? <p className={`portal-appointments__mutation portal-appointments__mutation--${mutationForRow.state}`} role={mutationForRow.state === "error" ? "alert" : "status"}>{mutationForRow.message}</p> : null}
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

function AppointmentsPagination({ page, filters }: { page: PortalAppointmentPage; filters: ParsedAppointmentFilters }) {
  const totalPages = Math.max(1, Math.ceil(page.total / page.page_size));
  if (totalPages <= 1) return null;
  return (
    <Pagination aria-label="Appointment pages" className="portal-appointments__pagination">
      <PaginationContent>
        <PaginationItem>
          {page.page > 1 ? <PaginationPrevious href={appointmentHref(page.page - 1, filters)} text="Previous" /> : <span aria-hidden="true" className="portal-appointments__pagination-spacer" />}
        </PaginationItem>
        <PaginationItem className="portal-appointments__pagination-current"><span aria-current="page">Page {page.page} of {totalPages}</span></PaginationItem>
        <PaginationItem>
          {page.page < totalPages ? <PaginationNext href={appointmentHref(page.page + 1, filters)} text="Next" /> : <span aria-hidden="true" className="portal-appointments__pagination-spacer" />}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

export function PortalAppointmentsPage() {
  const { hasCapability, refreshAccess, status: accessStatus } = usePortalAccess();
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawQuery = searchParams.toString();
  const filters = useMemo(() => parseAppointmentFilters(searchParams), [searchParams]);
  const pageNumber = parsePage(searchParams.get("page"));
  const canonicalHref = appointmentHref(pageNumber, filters);
  const canonicalQuery = canonicalHref.split("?")[1] ?? "";
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedReference, setExpandedReference] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, DetailState>>({});
  const [actionIntent, setActionIntent] = useState<ActionIntent | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [reviewDecision, setReviewDecision] = useState<"approve" | "decline">("approve");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [mutation, setMutation] = useState<MutationState | null>(null);
  const mutationKeysRef = useRef<Map<string, MutationKeyEntry>>(new Map());
  const canQueue = accessStatus === "ready" && hasCapability(PORTAL_CAPABILITIES.appointmentsQueueView);
  const queryKey = `${rawQuery}:${reloadKey}:${canQueue}`;

  useEffect(() => {
    if (rawQuery !== canonicalQuery) {
      router.replace(canonicalHref, { scroll: false });
    }
  }, [canonicalHref, canonicalQuery, rawQuery, router]);

  useEffect(() => {
    if (!canQueue) return;
    const controller = new AbortController();
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!active || controller.signal.aborted) return null;
        setLoadState({ kind: "loading" });
        setExpandedReference(null);
        setDetails({});
        return getPortalAppointments(pageNumber, filters, controller.signal);
      })
      .then((page) => {
        if (page && active && !controller.signal.aborted) setLoadState({ kind: "ready", page });
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted || isAbortError(error)) return;
        if (error instanceof AppointmentsApiError && error.kind === "permission") {
          setLoadState({ kind: "forbidden" });
        } else {
          setLoadState({
            kind: "unavailable",
            error: error instanceof AppointmentsApiError && (error.kind === "rate_limited" || error.kind === "validation")
              ? error.kind
              : "unavailable",
          });
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [canQueue, filters, pageNumber, queryKey]);

  const openAction = (action: AppointmentAction, appointment: PortalAppointment) => {
    setActionIntent({ action, appointment });
    setActionReason("");
    setActionError(null);
    setReviewDecision("approve");
    setScheduleDate(appointment.confirmed_date ?? appointment.requested_date ?? "");
    setScheduleStart(appointment.confirmed_start_time ?? "");
    setScheduleEnd(appointment.confirmed_end_time ?? "");
  };

  const closeAction = (open: boolean) => {
    if (!open) {
      setActionIntent(null);
      setActionError(null);
    }
  };

  const getMutationKey = (scope: string, fingerprint: string) => {
    const existing = mutationKeysRef.current.get(scope);
    if (existing?.fingerprint === fingerprint) return existing.key;
    const key = createIdempotencyKey();
    mutationKeysRef.current.set(scope, { fingerprint, key });
    return key;
  };

  const handleConfirmAction = async () => {
    if (!actionIntent) return;
    const { action, appointment } = actionIntent;
    const reason = actionReason.trim();
    if (action === "cancel" && !reason) {
      setActionError("Add a short reason before cancelling this appointment.");
      return;
    }
    if (action === "schedule" && (!scheduleDate || !scheduleStart || !scheduleEnd)) {
      setActionError("Add a date and start and end times before scheduling.");
      return;
    }
    const fingerprint = JSON.stringify({ action, referenceCode: appointment.reference_code, reason, reviewDecision, scheduleDate, scheduleStart, scheduleEnd });
    const scope = `appointment:${action}:${appointment.reference_code}`;
    const key = getMutationKey(scope, fingerprint);
    setMutation({ referenceCode: appointment.reference_code, message: "Saving appointment change…", state: "pending" });
    try {
      if (action === "cancel") {
        await cancelPortalAppointment(appointment.reference_code, { reason }, key);
      } else if (action === "complete") {
        await completePortalAppointment(appointment.reference_code, {}, key);
      } else if (action === "no-show") {
        await markAppointmentNoShow(appointment.reference_code, key);
      } else if (action === "review") {
        await reviewAppointment(appointment.reference_code, {
          action: reviewDecision,
          decline_reason: reviewDecision === "decline" ? reason : "",
          internal_notes: reviewDecision === "approve" ? reason : "",
          reason,
        }, key);
      } else {
        await scheduleAppointment(appointment.reference_code, {
          confirmed_date: scheduleDate,
          confirmed_start_time: scheduleStart,
          confirmed_end_time: scheduleEnd,
          internal_notes: reason,
        }, key);
      }
      mutationKeysRef.current.delete(scope);
      setMutation({ referenceCode: appointment.reference_code, message: "Appointment updated.", state: "success" });
      setActionIntent(null);
      setReloadKey((value) => value + 1);
    } catch (error: unknown) {
      const apiError = error instanceof AppointmentsApiError ? error : new AppointmentsApiError("unavailable");
      if (apiError.kind !== "unavailable" && apiError.kind !== "rate_limited") mutationKeysRef.current.delete(scope);
      setMutation({ referenceCode: appointment.reference_code, message: mutationMessage(apiError), state: "error" });
    }
  };

  const openSession = async (appointment: PortalAppointment) => {
    const fingerprint = JSON.stringify({ appointment: appointment.reference_code, action: "open-session" });
    const scope = `appointment:open-session:${appointment.reference_code}`;
    const key = getMutationKey(scope, fingerprint);
    setMutation({ referenceCode: appointment.reference_code, message: "Opening counseling session…", state: "pending" });
    try {
      const result = await openPortalAppointmentSession(appointment.reference_code, key);
      mutationKeysRef.current.delete(scope);
      setMutation({ referenceCode: appointment.reference_code, message: "Session opened.", state: "success" });
      router.push(`/portal/counseling/sessions/${encodeURIComponent(result.reference_code)}`);
    } catch (error: unknown) {
      const apiError = error instanceof AppointmentsApiError ? error : new AppointmentsApiError("unavailable");
      if (apiError.kind !== "unavailable" && apiError.kind !== "rate_limited") mutationKeysRef.current.delete(scope);
      setMutation({ referenceCode: appointment.reference_code, message: mutationMessage(apiError), state: "error" });
    }
  };

  const toggleDetails = (appointment: PortalAppointment) => {
    if (expandedReference === appointment.reference_code) {
      setExpandedReference(null);
      return;
    }
    setExpandedReference(appointment.reference_code);
    if (details[appointment.reference_code]) return;
    setDetails((current) => ({ ...current, [appointment.reference_code]: { kind: "loading" } }));
    void getPortalAppointmentDetail(appointment.reference_code)
      .then((detail) => setDetails((current) => ({ ...current, [appointment.reference_code]: { kind: "ready", appointment: detail } })))
      .catch((error: unknown) => {
        if (!isAbortError(error)) setDetails((current) => ({ ...current, [appointment.reference_code]: { kind: "error" } }));
      });
  };

  const retryDetails = (appointment: PortalAppointment) => {
    setDetails((current) => ({ ...current, [appointment.reference_code]: { kind: "loading" } }));
    void getPortalAppointmentDetail(appointment.reference_code)
      .then((detail) => setDetails((current) => ({ ...current, [appointment.reference_code]: { kind: "ready", appointment: detail } })))
      .catch(() => setDetails((current) => ({ ...current, [appointment.reference_code]: { kind: "error" } })));
  };

  if (accessStatus === "loading") return <AppointmentsLoadingState />;
  if (accessStatus === "unavailable") return <AccessState kind="unavailable" onRetry={() => void refreshAccess()} />;
  if (!canQueue) return <AccessState kind="forbidden" />;
  if (loadState.kind === "loading") return <AppointmentsLoadingState />;
  if (loadState.kind === "forbidden") return <AccessState kind="forbidden" />;
  if (loadState.kind === "unavailable") {
    return (
      <section aria-labelledby="portal-appointments-heading" className="portal-appointments portal-appointments--state">
        <AppointmentPageHeader />
        <AppointmentFilters filters={filters} />
        <PortalCollectionFrame className="portal-appointments__frame portal-appointments__frame--state">
          <h2>{loadMessage(loadState.error)}</h2>
          <p>Try again when the connection is ready.</p>
          <Button onClick={() => setReloadKey((value) => value + 1)} type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button>
        </PortalCollectionFrame>
      </section>
    );
  }

  const page = loadState.page;
  const activeAppointment = actionIntent?.appointment;
  return (
    <section aria-labelledby="portal-appointments-heading" className="portal-appointments">
      <AppointmentPageHeader />
      <AppointmentFilters filters={filters} />
      <PortalCollectionFrame aria-labelledby="portal-appointments-results-heading" className="portal-appointments__frame">
        <div className="portal-appointments__frame-heading">
          <div>
            <p className="portal-appointments__kicker">Queue</p>
            <h2 id="portal-appointments-results-heading">Appointments</h2>
          </div>
          <p className="portal-appointments__result-count">{page.total} {page.total === 1 ? "appointment" : "appointments"}</p>
        </div>
        {mutation && !activeAppointment ? <p className={`portal-appointments__mutation portal-appointments__mutation--${mutation.state}`} role={mutation.state === "error" ? "alert" : "status"}>{mutation.message}</p> : null}
        {page.items.length ? (
          <AppointmentTable
            appointments={page.items}
            details={details}
            expandedReference={expandedReference}
            hasCapability={hasCapability}
            mutation={mutation}
            onAction={openAction}
            onOpenSession={openSession}
            onRetryDetail={retryDetails}
            onToggle={toggleDetails}
          />
        ) : <EmptyState />}
        <AppointmentsPagination filters={filters} page={page} />
      </PortalCollectionFrame>

      <AlertDialog onOpenChange={closeAction} open={actionIntent !== null}>
        <AlertDialogContent size="sm" className="portal-appointments__dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{actionIntent ? actionLabel(actionIntent.action) : "Appointment action"}</AlertDialogTitle>
            <AlertDialogDescription>
              {activeAppointment ? `${activeAppointment.reference_code} will be updated using the current appointment state.` : "Review this appointment action before continuing."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {actionIntent?.action === "review" ? (
            <div className="portal-appointments__dialog-field">
              <Label htmlFor="portal-appointments-review-decision">Decision</Label>
              <select id="portal-appointments-review-decision" onChange={(event) => setReviewDecision(event.target.value as "approve" | "decline")} value={reviewDecision}>
                <option value="approve">Approve</option>
                <option value="decline">Decline</option>
              </select>
            </div>
          ) : null}
          {actionIntent && ["cancel", "review", "schedule"].includes(actionIntent.action) ? (
            <div className="portal-appointments__dialog-field">
              <Label htmlFor="portal-appointments-action-reason">{actionIntent.action === "schedule" ? "Notes (optional)" : "Reason or notes"}</Label>
              <textarea id="portal-appointments-action-reason" maxLength={2_000} onChange={(event) => setActionReason(event.target.value)} value={actionReason} />
            </div>
          ) : null}
          {actionIntent?.action === "schedule" ? (
            <div className="portal-appointments__dialog-schedule">
              <div><Label htmlFor="portal-appointments-schedule-date">Date</Label><Input id="portal-appointments-schedule-date" onChange={(event) => setScheduleDate(event.target.value)} type="date" value={scheduleDate} /></div>
              <div><Label htmlFor="portal-appointments-schedule-start">Start</Label><Input id="portal-appointments-schedule-start" onChange={(event) => setScheduleStart(event.target.value)} type="time" value={scheduleStart} /></div>
              <div><Label htmlFor="portal-appointments-schedule-end">End</Label><Input id="portal-appointments-schedule-end" onChange={(event) => setScheduleEnd(event.target.value)} type="time" value={scheduleEnd} /></div>
            </div>
          ) : null}
          {actionError ? <p className="portal-appointments__dialog-error" role="alert">{actionError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation?.state === "pending"}>Keep appointment</AlertDialogCancel>
            <AlertDialogAction disabled={mutation?.state === "pending"} onClick={() => void handleConfirmAction()}>
              {mutation?.state === "pending" ? "Saving…" : "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
