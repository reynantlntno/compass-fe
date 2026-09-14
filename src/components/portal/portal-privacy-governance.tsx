"use client";

import { ChevronDown, RefreshCw, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { usePortalAccess } from "@/components/portal/portal-access-provider";
import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
import { PortalPageHeader } from "@/components/portal/portal-page-header";
import { PortalWorkspaceNav } from "@/components/portal/portal-workspace-nav";
import { PORTAL_CAPABILITIES } from "@/components/portal/portal-navigation";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  createDpoAppointment,
  DPO_APPOINTMENT_ORDERS,
  DPO_APPOINTMENT_PAGE_SIZE,
  DPO_APPOINTMENT_STATUSES,
  DpoAppointmentApiError,
  getDpoAppointmentDetail,
  getDpoAppointmentOptions,
  getDpoAppointments,
  retireDpoAppointment,
  type DpoAppointment,
  type DpoAppointmentHolderOption,
  type DpoAppointmentOrder,
  type DpoAppointmentStatus,
} from "@/lib/api/dpo-appointment";
import { createIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";

const NAV_ITEMS = [
  {
    href: "/portal/privacy-governance?section=dpo-appointment",
    label: "DPO appointment",
    value: "dpo-appointment",
  },
] as const;

const STATUS_LABELS: Record<DpoAppointmentStatus, string> = {
  ACTIVE: "Active",
  RETIRED: "Retired",
};

const ORDER_LABELS: Record<DpoAppointmentOrder, string> = {
  recent: "Recently appointed",
  oldest: "Oldest appointment",
};

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; page: { items: DpoAppointment[]; page: number; page_size: number; total: number } }
  | { kind: "forbidden" }
  | { kind: "unavailable" };

type DetailState =
  | { kind: "loading" }
  | { kind: "ready"; appointment: DpoAppointment }
  | { kind: "error" };

type MutationEntry = { fingerprint: string; key: IdempotencyKey };

function statusLabel(value: string) {
  return STATUS_LABELS[value as DpoAppointmentStatus] ?? "Status unavailable";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(date);
}

function errorCopy(error: unknown) {
  if (error instanceof DpoAppointmentApiError) {
    if (error.kind === "permission") return "This appointment information is not available for this account.";
    if (error.kind === "conflict") return "The appointment changed before the action completed. Refresh and try again.";
    if (error.kind === "validation") return "Check the bounded appointment fields and try again.";
    if (error.kind === "rate_limited") return "Too many requests. Try again shortly.";
  }
  return "The appointment information is temporarily unavailable. Try again when the connection is ready.";
}

function DpoHeader({ headingId = "portal-privacy-governance-heading" }: { headingId?: string }) {
  return (
    <PortalPageHeader
      className="portal-counseling__page-header"
      current="Privacy & Governance"
      description="Manage the institution’s current and historical DPO appointments within the governed privacy boundary."
      headingId={headingId}
      title="Privacy & Governance"
    />
  );
}

function StateFrame({ title, description, retry }: { title: string; description: string; retry?: () => void }) {
  return (
    <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state">
      <ShieldCheck aria-hidden="true" className="portal-counseling__state-icon" />
      <h2>{title}</h2>
      <p>{description}</p>
      {retry ? <Button onClick={retry} type="button" variant="outline"><RefreshCw aria-hidden="true" />Try again</Button> : null}
    </PortalCollectionFrame>
  );
}

function AppointmentRow({
  appointment,
  detail,
  onRetire,
  onToggle,
  expanded,
}: {
  appointment: DpoAppointment;
  detail?: DetailState;
  onRetire: (appointment: DpoAppointment) => void;
  onToggle: (appointment: DpoAppointment) => void;
  expanded: boolean;
}) {
  return (
    <>
      <tr>
        <td data-label="Holder">
          <strong>{appointment.holder_display_name}</strong>
          <span className="portal-counseling__muted">{appointment.holder_role_label}</span>
        </td>
        <td data-label="Status"><Badge variant={appointment.status === "ACTIVE" ? "default" : "secondary"}>{statusLabel(appointment.status)}</Badge></td>
        <td data-label="Validity"><span>{formatDate(appointment.valid_from)}</span><span className="portal-counseling__muted">to {formatDate(appointment.valid_until)}</span></td>
        <td data-label="Appointment reference">{appointment.appointment_reference}</td>
        <td data-label="Updated">{formatDate(appointment.retired_at ?? appointment.appointed_at)}</td>
        <td data-label="Details">
          <div className="portal-counseling__table-actions">
            <Button aria-expanded={expanded} onClick={() => onToggle(appointment)} size="sm" type="button" variant="outline">
              <ChevronDown aria-hidden="true" className={expanded ? "rotate-180" : undefined} />
              {expanded ? "Hide details" : "Details"}
            </Button>
            {appointment.status === "ACTIVE" ? <Button onClick={() => onRetire(appointment)} size="sm" type="button" variant="outline">Retire appointment</Button> : null}
          </div>
        </td>
      </tr>
      {expanded ? (
        <tr className="portal-counseling__detail-row">
          <td colSpan={6}>
            {detail?.kind === "loading" ? <p role="status">Loading appointment details…</p> : null}
            {detail?.kind === "error" ? <p role="alert">Appointment details are unavailable. Try expanding again.</p> : null}
            {detail?.kind === "ready" ? (
              <dl className="portal-privacy-governance__detail-grid">
                <div><dt>Contact email</dt><dd>{detail.appointment.contact_email}</dd></div>
                <div><dt>Appointed</dt><dd>{formatDate(detail.appointment.appointed_at)}</dd></div>
                <div><dt>Retired</dt><dd>{formatDate(detail.appointment.retired_at)}</dd></div>
                <div><dt>Safe appointment reference</dt><dd>{detail.appointment.appointment_reference}</dd></div>
              </dl>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function PortalPrivacyGovernanceLoading() {
  return (
    <section aria-busy="true" aria-labelledby="portal-privacy-governance-loading-heading" className="portal-counseling portal-privacy-governance" role="status">
      <DpoHeader headingId="portal-privacy-governance-loading-heading" />
      <PortalCollectionFrame className="portal-counseling__frame">
        <Skeleton as="span" /><Skeleton as="span" /><Skeleton as="span" />
      </PortalCollectionFrame>
    </section>
  );
}

export function PortalPrivacyGovernancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasCapability, status: accessStatus } = usePortalAccess();
  const canManage = hasCapability(PORTAL_CAPABILITIES.organizationGovernanceManage);
  const requestedSection = searchParams.get("section");
  const statusParam = searchParams.get("status");
  const orderParam = searchParams.get("order");
  const pageParam = Number(searchParams.get("page") ?? "1");
  const selectedStatuses = statusParam
    ? statusParam.split(",").filter((value): value is DpoAppointmentStatus => DPO_APPOINTMENT_STATUSES.includes(value as DpoAppointmentStatus))
    : [];
  const statusFilter = selectedStatuses.length ? selectedStatuses : undefined;
  const statusKey = statusFilter?.join(",");
  const order: DpoAppointmentOrder = DPO_APPOINTMENT_ORDERS.includes(orderParam as DpoAppointmentOrder)
    ? (orderParam as DpoAppointmentOrder)
    : "recent";
  const pageNumber = Number.isSafeInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, DetailState>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [retireTarget, setRetireTarget] = useState<DpoAppointment | null>(null);
  const [holders, setHolders] = useState<DpoAppointmentHolderOption[]>([]);
  const [holdersState, setHoldersState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [holderIndex, setHolderIndex] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [appointmentReference, setAppointmentReference] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [reasonCode, setReasonCode] = useState("DPO_APPOINTMENT_RETIRED");
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mutationKeys = useRef(new Map<string, MutationEntry>());

  const activeAppointment = useMemo(
    () => loadState.kind === "ready" ? loadState.page.items.find((item) => item.status === "ACTIVE") : undefined,
    [loadState],
  );

  const updateQuery = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", "dpo-appointment");
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`/portal/privacy-governance?${params.toString()}`);
  };

  useEffect(() => {
    if (accessStatus === "ready" && canManage && requestedSection !== "dpo-appointment") {
      router.replace("/portal/privacy-governance?section=dpo-appointment");
    }
  }, [accessStatus, canManage, requestedSection, router]);

  useEffect(() => {
    if (accessStatus !== "ready" || !canManage || requestedSection === "dpo-appointment") return;
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) setLoadState({ kind: "loading" });
    });
    getDpoAppointments({ status: statusKey ? statusKey.split(",") as DpoAppointmentStatus[] : undefined, order }, pageNumber, controller.signal)
      .then((page) => setLoadState({ kind: "ready", page }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadState({ kind: error instanceof DpoAppointmentApiError && error.kind === "permission" ? "forbidden" : "unavailable" });
      });
    return () => controller.abort();
  }, [accessStatus, canManage, order, pageNumber, reloadKey, requestedSection, statusKey]);

  useEffect(() => {
    if (!createOpen || holdersState !== "idle") return;
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) setHoldersState("loading");
    });
    getDpoAppointmentOptions(controller.signal)
      .then((value) => { setHolders(value); setHoldersState("ready"); })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setHoldersState(error instanceof DpoAppointmentApiError && error.kind === "permission" ? "error" : "error");
      });
    return () => controller.abort();
  }, [createOpen, holdersState]);

  const toggleDetails = (appointment: DpoAppointment) => {
    if (expanded === appointment.reference_code) {
      setExpanded(null);
      return;
    }
    setExpanded(appointment.reference_code);
    if (details[appointment.reference_code]) return;
    setDetails((current) => ({ ...current, [appointment.reference_code]: { kind: "loading" } }));
    getDpoAppointmentDetail(appointment.reference_code)
      .then((value) => setDetails((current) => ({ ...current, [appointment.reference_code]: { kind: "ready", appointment: value } })))
      .catch(() => setDetails((current) => ({ ...current, [appointment.reference_code]: { kind: "error" } })));
  };

  const closeCreate = () => {
    if (busy) return;
    setCreateOpen(false);
    setDialogError(null);
    setHolderIndex("");
    setValidFrom("");
    setValidUntil("");
    setAppointmentReference("");
    setContactEmail("");
    setHolders([]);
    setHoldersState("idle");
    mutationKeys.current.delete("create");
  };

  const closeRetire = () => {
    if (busy) return;
    setRetireTarget(null);
    setReasonCode("DPO_APPOINTMENT_RETIRED");
    setDialogError(null);
    mutationKeys.current.delete("retire");
  };

  const keyFor = (name: string, fingerprint: string) => {
    const existing = mutationKeys.current.get(name);
    if (existing?.fingerprint === fingerprint) return existing.key;
    const key = createIdempotencyKey();
    mutationKeys.current.set(name, { fingerprint, key });
    return key;
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const holder = holders[Number(holderIndex)];
    if (!holder || !validFrom || !appointmentReference.trim() || !contactEmail.trim()) {
      setDialogError("Choose a holder and complete the required bounded fields.");
      return;
    }
    const fingerprint = JSON.stringify([holder.display_name, validFrom, validUntil, appointmentReference.trim(), contactEmail.trim()]);
    setBusy(true);
    setDialogError(null);
    try {
      await createDpoAppointment({ holder, valid_from: validFrom, valid_until: validUntil || undefined, appointment_reference: appointmentReference.trim(), contact_email: contactEmail.trim() }, keyFor("create", fingerprint));
      mutationKeys.current.delete("create");
      closeCreate();
      setReloadKey((value) => value + 1);
    } catch (error) {
      setDialogError(errorCopy(error));
    } finally {
      setBusy(false);
    }
  };

  const submitRetire = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!retireTarget) return;
    const fingerprint = JSON.stringify([retireTarget.reference_code, reasonCode]);
    setBusy(true);
    setDialogError(null);
    try {
      await retireDpoAppointment(retireTarget, reasonCode, keyFor("retire", fingerprint));
      mutationKeys.current.delete("retire");
      closeRetire();
      setReloadKey((value) => value + 1);
    } catch (error) {
      setDialogError(errorCopy(error));
    } finally {
      setBusy(false);
    }
  };

  if (accessStatus === "loading") return <PortalPrivacyGovernanceLoading />;
  if (accessStatus !== "ready" || !canManage) {
    return <section aria-labelledby="portal-privacy-governance-heading" className="portal-counseling portal-privacy-governance portal-counseling--state"><DpoHeader /><StateFrame description="Return to your workspace to continue." title="Privacy & Governance isn’t available for this account." /></section>;
  }

  return (
    <section aria-labelledby="portal-privacy-governance-heading" className="portal-counseling portal-privacy-governance">
      <DpoHeader />
      <PortalWorkspaceNav activeValue="dpo-appointment" ariaLabel="Privacy and Governance sections" items={NAV_ITEMS} />
      {loadState.kind === "loading" ? <PortalCollectionFrame className="portal-counseling__frame"><div className="portal-counseling__table-skeleton">{Array.from({ length: 4 }, (_, row) => <div className="portal-counseling__table-skeleton-row" key={row}>{Array.from({ length: 6 }, (_, cell) => <Skeleton as="span" key={cell} />)}</div>)}</div></PortalCollectionFrame> : null}
      {loadState.kind === "forbidden" ? <StateFrame description="Return to your workspace to continue." title="DPO appointment information isn’t available for this account." /> : null}
      {loadState.kind === "unavailable" ? <StateFrame description="Try again when the connection is ready." retry={() => setReloadKey((value) => value + 1)} title="DPO appointments are temporarily unavailable." /> : null}
      {loadState.kind === "ready" ? (
        <PortalCollectionFrame aria-labelledby="portal-dpo-appointments-heading" className="portal-counseling__frame">
          <div className="portal-counseling__frame-heading">
            <div><p className="portal-counseling__kicker">Privacy & Governance</p><h2 id="portal-dpo-appointments-heading">DPO appointments</h2></div>
            <div className="portal-counseling__frame-actions">
              <label className="portal-privacy-governance__compact-field"><span>Status</span><select aria-label="Filter DPO appointments by status" onChange={(event) => updateQuery({ status: event.target.value || null, page: "1" })} value={statusFilter?.join(",") ?? ""}><option value="">All history</option>{DPO_APPOINTMENT_STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}</select></label>
              <label className="portal-privacy-governance__compact-field"><span>Order</span><select aria-label="Order DPO appointments" onChange={(event) => updateQuery({ order: event.target.value === "recent" ? null : event.target.value, page: "1" })} value={order}>{DPO_APPOINTMENT_ORDERS.map((value) => <option key={value} value={value}>{ORDER_LABELS[value]}</option>)}</select></label>
              <Button disabled={Boolean(activeAppointment)} onClick={() => setCreateOpen(true)} size="sm" type="button">Appoint DPO</Button>
            </div>
          </div>
          {activeAppointment ? <p className="portal-counseling__inline-note">An active DPO appointment already exists. Retire it before appointing a replacement.</p> : null}
          {loadState.page.items.length === 0 ? <div className="portal-counseling__empty"><h3>No DPO appointments found.</h3><p>Historical and current appointments will appear here after they are governed.</p></div> : (
            <div className="portal-counseling__table-wrap">
              <table className="portal-counseling__table"><caption className="sr-only">Current and historical DPO appointments</caption><thead><tr><th scope="col">Holder</th><th scope="col">Status</th><th scope="col">Validity</th><th scope="col">Appointment reference</th><th scope="col">Updated</th><th scope="col">Details</th></tr></thead><tbody>{loadState.page.items.map((appointment) => <AppointmentRow appointment={appointment} detail={details[appointment.reference_code]} expanded={expanded === appointment.reference_code} key={appointment.reference_code} onRetire={setRetireTarget} onToggle={toggleDetails} />)}</tbody></table>
            </div>
          )}
          {loadState.page.total > DPO_APPOINTMENT_PAGE_SIZE ? <div className="portal-counseling__pagination"><Button disabled={loadState.page.page <= 1} onClick={() => updateQuery({ page: String(loadState.page.page - 1) })} type="button" variant="outline">Previous</Button><span>Page {loadState.page.page}</span><Button disabled={loadState.page.page * loadState.page.page_size >= loadState.page.total} onClick={() => updateQuery({ page: String(loadState.page.page + 1) })} type="button" variant="outline">Next</Button></div> : null}
        </PortalCollectionFrame>
      ) : null}

      <AlertDialog open={createOpen} onOpenChange={(open) => { if (!open) closeCreate(); }}>
        <AlertDialogContent className="portal-counseling__dialog">
          <AlertDialogHeader><AlertDialogTitle>Appoint DPO</AlertDialogTitle><AlertDialogDescription>Choose an eligible institutional staff holder and enter the bounded appointment details. The backend will recheck the holder and active-appointment rules.</AlertDialogDescription></AlertDialogHeader>
          {holdersState === "loading" ? <p role="status">Loading eligible holders…</p> : null}
          {holdersState === "error" ? <div className="portal-counseling__dialog-error" role="alert">Eligible holder options are unavailable. Close and try again.</div> : null}
          {holdersState === "ready" ? <form onSubmit={submitCreate}><div className="portal-counseling__dialog-fields"><div className="portal-counseling__dialog-field"><Label htmlFor="portal-dpo-holder">Holder</Label><select id="portal-dpo-holder" onChange={(event) => setHolderIndex(event.target.value)} value={holderIndex}><option value="">Choose an institutional staff holder</option>{holders.map((holder, index) => <option key={`${holder.display_name}-${index}`} value={String(index)}>{holder.display_name} · {holder.role_label}</option>)}</select></div><div className="portal-counseling__dialog-field"><Label htmlFor="portal-dpo-valid-from">Valid from</Label><Input id="portal-dpo-valid-from" onChange={(event) => setValidFrom(event.target.value)} required type="date" value={validFrom} /></div><div className="portal-counseling__dialog-field"><Label htmlFor="portal-dpo-valid-until">Valid until (optional)</Label><Input id="portal-dpo-valid-until" onChange={(event) => setValidUntil(event.target.value)} type="date" value={validUntil} /></div><div className="portal-counseling__dialog-field"><Label htmlFor="portal-dpo-reference">Appointment reference</Label><Input id="portal-dpo-reference" maxLength={255} onChange={(event) => setAppointmentReference(event.target.value)} required value={appointmentReference} /></div><div className="portal-counseling__dialog-field"><Label htmlFor="portal-dpo-email">Contact email</Label><Input id="portal-dpo-email" maxLength={254} onChange={(event) => setContactEmail(event.target.value)} required type="email" value={contactEmail} /></div></div>{dialogError ? <p className="portal-counseling__dialog-error" role="alert">{dialogError}</p> : null}<AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} type="submit">Appoint DPO</AlertDialogAction></AlertDialogFooter></form> : null}
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(retireTarget)} onOpenChange={(open) => { if (!open) closeRetire(); }}>
        <AlertDialogContent className="portal-counseling__dialog">
          <AlertDialogHeader><AlertDialogTitle>Retire DPO appointment</AlertDialogTitle><AlertDialogDescription>Retirement is one-way. A replacement can be appointed after this active appointment is retired.</AlertDialogDescription></AlertDialogHeader>
          <form onSubmit={submitRetire}><div className="portal-counseling__dialog-field"><Label htmlFor="portal-dpo-retire-reason">Reason</Label><select id="portal-dpo-retire-reason" onChange={(event) => setReasonCode(event.target.value)} value={reasonCode}><option value="DPO_APPOINTMENT_RETIRED">DPO appointment retired</option></select></div>{dialogError ? <p className="portal-counseling__dialog-error" role="alert">{dialogError}</p> : null}<AlertDialogFooter><AlertDialogCancel disabled={busy}>Keep appointment</AlertDialogCancel><AlertDialogAction disabled={busy} type="submit">Retire appointment</AlertDialogAction></AlertDialogFooter></form>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
