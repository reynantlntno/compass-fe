"use client";

import { RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
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
  applyGuidanceScheduleChange,
  createGuidanceWorkflowAccess,
  getGuidanceOfficeClosures,
  getGuidanceScheduleOptions,
  getGuidanceScheduleRecords,
  getGuidanceWorkflowAccess,
  getGuidanceWorkflowAccessOptions,
  GuidanceSettingsApiError,
  previewGuidanceScheduleChange,
  revokeGuidanceWorkflowAccess,
  type GuidanceOfficeClosureFilters,
  type GuidanceScheduleFilters,
  type GuidanceScheduleMutationFields,
  type GuidanceWorkflowAccessFilters,
  type PortalOfficeClosure,
  type PortalScheduleChoice,
  type PortalScheduleOptions,
  type PortalScheduleRecord,
  type PortalSchedulePreview,
  type PortalWorkflowAccess,
  type PortalWorkflowAccessOptions,
  type PortalWorkflowChoice,
} from "@/lib/api/guidance-settings";
import { createIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";

type LoadState<T> =
  | { kind: "loading" }
  | { kind: "ready"; value: T; total?: number; page?: number }
  | { kind: "error"; error: "permission" | "unavailable" };

type PageState<T> = LoadState<T> & { total?: number; page?: number };

const formatDate = (value: string | null | undefined) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(date);
};

const todayInputValue = () => new Date().toISOString().slice(0, 10);

const label = (value: string) =>
  value
    .replace(/[._-]/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const errorText = (error: unknown, noun: string) => {
  if (error instanceof GuidanceSettingsApiError) {
    if (error.kind === "permission") return `This ${noun} action is not available for this account.`;
    if (error.kind === "conflict") return `This ${noun} changed while you were working. Refresh and try again.`;
    if (error.kind === "validation") return `Check the ${noun} details and try again.`;
  }
  return `${noun[0]?.toUpperCase() ?? noun} settings are temporarily unavailable. Try again.`;
};

function StateBlock({ title, retry }: { title: string; retry?: () => void }) {
  return (
    <div className="portal-counseling__stack" role="status">
      <ShieldCheck aria-hidden="true" className="portal-counseling__state-icon" />
      <p>{title}</p>
      {retry ? (
        <Button onClick={retry} type="button" variant="outline">
          <RefreshCw aria-hidden="true" /> Try again
        </Button>
      ) : null}
    </div>
  );
}

function FrameHeading({
  kicker,
  title,
  count,
  onNew,
  newLabel,
}: {
  kicker: string;
  title: string;
  count: number;
  onNew?: () => void;
  newLabel?: string;
}) {
  return (
    <div className="portal-counseling__frame-heading">
      <div>
        <p className="portal-counseling__kicker">{kicker}</p>
        <h2>{title}</h2>
      </div>
      <div className="portal-counseling__frame-actions">
        <p className="portal-counseling__result-count">
          {count} {count === 1 ? "record" : "records"}
        </p>
        {onNew ? (
          <Button onClick={onNew} size="sm" type="button">
            {newLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Cell({ label: cellLabel, children }: { label: string; children: ReactNode }) {
  return <td data-label={cellLabel}>{children}</td>;
}

function Pager({
  page,
  total,
  onPage,
  disabled,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
  disabled: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(total / 20));
  if (totalPages <= 1) return null;
  return (
    <div className="portal-counseling__pagination">
      <Button
        disabled={disabled || page <= 1}
        onClick={() => onPage(page - 1)}
        size="sm"
        type="button"
        variant="outline"
      >
        Previous
      </Button>
      <span aria-live="polite">
        Page {page} of {totalPages}
      </span>
      <Button
        disabled={disabled || page >= totalPages}
        onClick={() => onPage(page + 1)}
        size="sm"
        type="button"
        variant="outline"
      >
        Next
      </Button>
    </div>
  );
}

function ChoiceSelect({
  label: fieldLabel,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: readonly PortalWorkflowChoice[] | readonly PortalScheduleChoice[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Label>
      {fieldLabel}
      <select disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Label>
  );
}

function WorkflowAccessTable({
  data,
  busy,
  onRevoke,
  onRetry,
}: {
  data: PageState<PortalWorkflowAccess[]>;
  busy: string | null;
  onRevoke: (item: PortalWorkflowAccess) => void;
  onRetry?: () => void;
}) {
  if (data.kind === "loading") {
    return <><Skeleton as="span" /><Skeleton as="span" /></>;
  }
  if (data.kind === "error") {
    return <StateBlock retry={onRetry} title="Workflow access is temporarily unavailable." />;
  }
  if (!data.value.length) return <p>No workflow access grants match this view.</p>;
  return (
    <div className="portal-counseling__table-wrap">
      <table className="portal-counseling__table">
        <thead>
          <tr>
            <th scope="col">Grantee</th>
            <th scope="col">Capability</th>
            <th scope="col">Scope</th>
            <th scope="col">Validity</th>
            <th scope="col">Status</th>
            <th scope="col">Reason</th>
            <th scope="col">Updated</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.value.map((item) => (
            <tr key={item.grant_reference}>
              <Cell label="Grantee">
                <strong>{item.grantee_display_name}</strong>
                <span className="portal-counseling__secondary">{label(item.grantee_role)}</span>
              </Cell>
              <Cell label="Capability">{item.capability_label}</Cell>
              <Cell label="Scope">{item.scope_label || item.scope_mode_label}</Cell>
              <Cell label="Validity">
                {formatDate(item.valid_from)} – {formatDate(item.valid_until)}
              </Cell>
              <Cell label="Status"><Badge>{item.status_label}</Badge></Cell>
              <Cell label="Reason">{item.grant_reason_label}</Cell>
              <Cell label="Updated">{formatDate(item.updated_at)}</Cell>
              <Cell label="Actions">
                {item.status !== "REVOKED" ? (
                  <Button
                    disabled={busy !== null}
                    onClick={() => onRevoke(item)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Revoke access
                  </Button>
                ) : <span className="portal-counseling__secondary">No actions</span>}
              </Cell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GuidanceWorkflowAccess({ canManage }: { canManage: boolean }) {
  const [data, setData] = useState<PageState<PortalWorkflowAccess[]>>({ kind: "loading" });
  const [options, setOptions] = useState<LoadState<PortalWorkflowAccessOptions>>({ kind: "loading" });
  const [filters, setFilters] = useState<GuidanceWorkflowAccessFilters>({ order: "recent" });
  const [filterFields, setFilterFields] = useState({ q: "", capability: "", scopeMode: "", status: "", role: "", order: "recent" });
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<"create" | "revoke" | null>(null);
  const [target, setTarget] = useState<PortalWorkflowAccess | null>(null);
  const [fields, setFields] = useState({ grantee: "", capability: "", scopeMode: "", campus: "", college: "", department: "", program: "", validFrom: todayInputValue(), validUntil: "", reason: "LOCAL_WORKFLOW" });
  const [revocationReason, setRevocationReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const mutationKeys = useRef(new Map<string, { fingerprint: string; key: IdempotencyKey }>());

  const reload = () => setReloadKey((value) => value + 1);

  useEffect(() => {
    if (!canManage) return;
    const controller = new AbortController();
    getGuidanceWorkflowAccessOptions(controller.signal)
      .then((value) => setOptions({ kind: "ready", value }))
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setOptions({ kind: "error", error: cause instanceof GuidanceSettingsApiError && cause.kind === "permission" ? "permission" : "unavailable" });
        }
      });
    return () => controller.abort();
  }, [canManage, reloadKey]);

  useEffect(() => {
    if (!canManage) return;
    const controller = new AbortController();
    getGuidanceWorkflowAccess(filters, page, controller.signal)
      .then((value) => setData({ kind: "ready", value: value.items, total: value.total, page: value.page }))
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setData({ kind: "error", error: cause instanceof GuidanceSettingsApiError && cause.kind === "permission" ? "permission" : "unavailable" });
        }
      });
    return () => controller.abort();
  }, [canManage, filters, page, reloadKey]);

  const applyFilters = () => {
    setPage(1);
    setFilters({
      q: filterFields.q.trim() || undefined,
      capability: filterFields.capability || undefined,
      scope_mode: filterFields.scopeMode || undefined,
      status: filterFields.status || undefined,
      role: filterFields.role || undefined,
      order: filterFields.order as "recent" | "oldest",
    });
  };

  const openCreate = () => {
    const available = options.kind === "ready" ? options.value : null;
    const capability = available?.capabilities[0];
    setTarget(null);
    setFields({
      grantee: "",
      capability: capability?.value ?? "",
      scopeMode: capability?.scope_modes[0] ?? available?.scope_modes[0]?.value ?? "",
      campus: "",
      college: "",
      department: "",
      program: "",
      validFrom: todayInputValue(),
      validUntil: "",
      reason: available?.grant_reasons[0]?.value ?? "LOCAL_WORKFLOW",
    });
    setError(null);
    mutationKeys.current.delete("workflow-create");
    setDialog("create");
  };

  const openRevoke = (item: PortalWorkflowAccess) => {
    setTarget(item);
    setRevocationReason(options.kind === "ready" ? options.value.revocation_reasons[0]?.value ?? "" : "");
    setError(null);
    mutationKeys.current.delete("workflow-revoke");
    setDialog("revoke");
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (options.kind !== "ready") {
      setError("Workflow access options are still loading. Try again.");
      return;
    }
    const grantee = options.value.grantees[Number(fields.grantee)];
    const capability = options.value.capabilities.find((item) => item.value === fields.capability);
    if (!grantee || !capability || !fields.scopeMode || !fields.validFrom || !fields.reason) {
      setError("Select a grantee, capability, scope, start date, and reason.");
      return;
    }
    if (!capability.scope_modes.includes(fields.scopeMode)) {
      setError("Select a valid scope for this capability.");
      return;
    }
    const fingerprint = JSON.stringify({ grantee: fields.grantee, fields });
    const existing = mutationKeys.current.get("workflow-create");
    const key = existing?.fingerprint === fingerprint ? existing.key : createIdempotencyKey();
    mutationKeys.current.set("workflow-create", { fingerprint, key });
    setBusy("workflow-create");
    setError(null);
    try {
      await createGuidanceWorkflowAccess(
        grantee,
        {
          capability: fields.capability,
          scope_mode: fields.scopeMode,
          organization: {
            campus: fields.campus || null,
            college: fields.college || null,
            department: fields.department || null,
            program: fields.program || null,
          },
          valid_from: fields.validFrom,
          valid_until: fields.validUntil || null,
          grant_reason_code: fields.reason,
        },
        key,
      );
      mutationKeys.current.delete("workflow-create");
      setDialog(null);
      reload();
    } catch (cause) {
      setError(errorText(cause, "workflow access"));
    } finally {
      setBusy(null);
    }
  };

  const submitRevoke = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!target || !revocationReason) {
      setError("Select a revocation reason.");
      return;
    }
    const fingerprint = JSON.stringify({ target: target.grant_reference, resourceVersion: target.resource_version, revocationReason });
    const existing = mutationKeys.current.get("workflow-revoke");
    const key = existing?.fingerprint === fingerprint ? existing.key : createIdempotencyKey();
    mutationKeys.current.set("workflow-revoke", { fingerprint, key });
    setBusy("workflow-revoke");
    setError(null);
    try {
      await revokeGuidanceWorkflowAccess(target, { reason_code: revocationReason, expected_resource_version: target.resource_version }, key);
      mutationKeys.current.delete("workflow-revoke");
      setDialog(null);
      setTarget(null);
      reload();
    } catch (cause) {
      setError(errorText(cause, "workflow access"));
    } finally {
      setBusy(null);
    }
  };

  const selectedCapability = options.kind === "ready" ? options.value.capabilities.find((item) => item.value === fields.capability) : undefined;
  const scopeOptions = selectedCapability?.scope_modes.map((value, index) => ({ value, label: selectedCapability.scope_mode_labels[index] ?? label(value) })) ?? (options.kind === "ready" ? options.value.scope_modes : []);
  const total = data.kind === "ready" ? data.total ?? data.value.length : 0;

  return (
    <div className="portal-counseling__stack">
      {error ? <p className="portal-counseling__inline-error" role="alert">{error}</p> : null}
      <PortalCollectionFrame aria-labelledby="guidance-workflow-access-heading" className="portal-counseling__frame">
        <FrameHeading count={total} kicker="Guidance settings" newLabel="New workflow access" onNew={openCreate} title="Workflow access" />
        <div className="portal-counseling__filter-grid">
          <Label>Search grantee<Input value={filterFields.q} onChange={(event) => setFilterFields((value) => ({ ...value, q: event.target.value }))} /></Label>
          <Label>Capability<select value={filterFields.capability} onChange={(event) => setFilterFields((value) => ({ ...value, capability: event.target.value }))}><option value="">All capabilities</option>{options.kind === "ready" ? options.value.capabilities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>) : null}</select></Label>
          <Label>Scope<select value={filterFields.scopeMode} onChange={(event) => setFilterFields((value) => ({ ...value, scopeMode: event.target.value }))}><option value="">All scopes</option>{options.kind === "ready" ? options.value.scope_modes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>) : null}</select></Label>
          <Label>Status<select value={filterFields.status} onChange={(event) => setFilterFields((value) => ({ ...value, status: event.target.value }))}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="REVOKED">Revoked</option><option value="EXPIRED">Expired</option></select></Label>
          <Label>Grantee role<select value={filterFields.role} onChange={(event) => setFilterFields((value) => ({ ...value, role: event.target.value }))}><option value="">All roles</option><option value="COUNSELOR">Counselor</option><option value="GCO_STAFF">GCO staff</option></select></Label>
          <Label>Order<select value={filterFields.order} onChange={(event) => setFilterFields((value) => ({ ...value, order: event.target.value }))}><option value="recent">Recently updated</option><option value="oldest">Oldest updated</option></select></Label>
          <Button onClick={applyFilters} size="sm" type="button">Apply filters</Button>
        </div>
        <WorkflowAccessTable data={data} busy={busy} onRevoke={openRevoke} onRetry={reload} />
        <Pager disabled={busy !== null} page={data.kind === "ready" ? data.page ?? page : page} total={total} onPage={setPage} />
      </PortalCollectionFrame>

      <AlertDialog onOpenChange={(open) => { if (!open && busy === null) { mutationKeys.current.delete("workflow-create"); mutationKeys.current.delete("workflow-revoke"); setDialog(null); setTarget(null); setError(null); } }} open={dialog !== null}>
        <AlertDialogContent className="portal-counseling__dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{dialog === "create" ? "New workflow access" : "Revoke workflow access"}</AlertDialogTitle>
            <AlertDialogDescription>{dialog === "create" ? "Grant only the bounded capability and scope required for this staff workflow." : `Revoke access for ${target?.grantee_display_name ?? "this staff account"}.`}</AlertDialogDescription>
          </AlertDialogHeader>
          {dialog === "create" ? (
            <form onSubmit={submitCreate}>
              <div className="portal-counseling__dialog-fields">
                <Label>Grantee<select required disabled={options.kind !== "ready"} value={fields.grantee} onChange={(event) => setFields((value) => ({ ...value, grantee: event.target.value }))}><option value="">Select a staff account</option>{options.kind === "ready" ? options.value.grantees.map((item, index) => <option key={`${item.display_name}-${item.role}`} value={index}>{item.display_name} · {item.role_label}</option>) : null}</select></Label>
                <Label>Capability<select required disabled={options.kind !== "ready"} value={fields.capability} onChange={(event) => { const capability = options.kind === "ready" ? options.value.capabilities.find((item) => item.value === event.target.value) : undefined; setFields((value) => ({ ...value, capability: event.target.value, scopeMode: capability?.scope_modes[0] ?? value.scopeMode })); }}><option value="">Select a capability</option>{options.kind === "ready" ? options.value.capabilities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>) : null}</select></Label>
                <ChoiceSelect disabled={options.kind !== "ready"} label="Scope" options={scopeOptions} value={fields.scopeMode} onChange={(scopeMode) => setFields((value) => ({ ...value, scopeMode }))} />
                <Label>Campus (optional)<Input value={fields.campus} onChange={(event) => setFields((value) => ({ ...value, campus: event.target.value }))} /></Label>
                <Label>College (optional)<Input value={fields.college} onChange={(event) => setFields((value) => ({ ...value, college: event.target.value }))} /></Label>
                <Label>Department (optional)<Input value={fields.department} onChange={(event) => setFields((value) => ({ ...value, department: event.target.value }))} /></Label>
                <Label>Program (optional)<Input value={fields.program} onChange={(event) => setFields((value) => ({ ...value, program: event.target.value }))} /></Label>
                <Label>Valid from<Input required type="date" value={fields.validFrom} onChange={(event) => setFields((value) => ({ ...value, validFrom: event.target.value }))} /></Label>
                <Label>Valid until (optional)<Input type="date" value={fields.validUntil} onChange={(event) => setFields((value) => ({ ...value, validUntil: event.target.value }))} /></Label>
                <ChoiceSelect disabled={options.kind !== "ready"} label="Grant reason" options={options.kind === "ready" ? options.value.grant_reasons : []} value={fields.reason} onChange={(reason) => setFields((value) => ({ ...value, reason }))} />
              </div>
              <AlertDialogFooter><AlertDialogCancel disabled={busy !== null}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy !== null || options.kind !== "ready"} type="submit">{busy === "workflow-create" ? "Creating…" : "Create access"}</AlertDialogAction></AlertDialogFooter>
            </form>
          ) : (
            <form onSubmit={submitRevoke}>
              <div className="portal-counseling__dialog-fields">
                <ChoiceSelect label="Revocation reason" options={options.kind === "ready" ? options.value.revocation_reasons : []} value={revocationReason} onChange={setRevocationReason} />
              </div>
              <AlertDialogFooter><AlertDialogCancel disabled={busy !== null}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy !== null || !revocationReason} type="submit">{busy === "workflow-revoke" ? "Revoking…" : "Revoke access"}</AlertDialogAction></AlertDialogFooter>
            </form>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const emptyScheduleOptions: PortalScheduleOptions = { counselors: [], days: [], modes: [], states: [] };

function scheduleDefaults(options: PortalScheduleOptions, kind: "availability_rule" | "unavailable_block"): GuidanceScheduleMutationFields {
  return {
    kind,
    operation: "create",
    day_of_week: 1,
    start_time: "09:00",
    end_time: "17:00",
    mode: options.modes[0]?.value ?? "ONSITE",
    location: "",
    slot_duration_minutes: 50,
    max_appointments_per_slot: 1,
    block_date: todayInputValue(),
    is_all_day: kind === "unavailable_block",
    scope_reason: "",
    effective_from: todayInputValue(),
    effective_until: null,
    reason: "Schedule rule created",
    expected_fingerprint: "",
    confirm: false,
    handoff_action: "",
    target_reference: null,
  };
}

function scheduleFieldsForRecord(item: PortalScheduleRecord): GuidanceScheduleMutationFields {
  return {
    kind: item.kind,
    operation: "update",
    target_reference: item.public_reference,
    day_of_week: item.day_of_week,
    start_time: item.start_time,
    end_time: item.end_time,
    mode: item.mode ?? "",
    location: item.location ?? "",
    slot_duration_minutes: item.slot_duration_minutes,
    max_appointments_per_slot: item.max_appointments_per_slot,
    block_date: item.date,
    is_all_day: item.is_all_day ?? false,
    scope_reason: "",
    effective_from: item.effective_from,
    effective_until: item.effective_until,
    reason: "Schedule rule updated",
    expected_fingerprint: "",
    confirm: false,
    handoff_action: "",
  };
}

function closureFieldsForRecord(item: PortalOfficeClosure): GuidanceScheduleMutationFields {
  return {
    kind: "office_closure",
    operation: "update",
    target_reference: item.public_reference,
    day_of_week: null,
    start_time: item.start_time,
    end_time: item.end_time,
    mode: "",
    location: "",
    slot_duration_minutes: null,
    max_appointments_per_slot: null,
    block_date: item.date,
    is_all_day: item.is_all_day,
    scope_reason: "",
    effective_from: null,
    effective_until: null,
    reason: item.reason || "Office closure updated",
    expected_fingerprint: "",
    confirm: false,
    handoff_action: "",
  };
}

function scheduleActionFields(fields: GuidanceScheduleMutationFields, operation: "update" | "void") {
  return { ...fields, operation, reason: operation === "void" ? "Schedule rule deactivated" : fields.reason };
}

function scheduleLabel(options: PortalScheduleOptions, value: string | null | undefined) {
  if (!value) return "Not set";
  return options.modes.find((item) => item.value === value)?.label ?? label(value);
}

function ScheduleTable({
  data,
  options,
  busy,
  onEdit,
  onDeactivate,
  onRetry,
}: {
  data: PageState<PortalScheduleRecord[]>;
  options: PortalScheduleOptions;
  busy: string | null;
  onEdit: (item: PortalScheduleRecord) => void;
  onDeactivate: (item: PortalScheduleRecord) => void;
  onRetry?: () => void;
}) {
  if (data.kind === "loading") return <><Skeleton as="span" /><Skeleton as="span" /></>;
  if (data.kind === "error") return <StateBlock retry={onRetry} title="Schedule rules are temporarily unavailable." />;
  if (!data.value.length) return <p>No schedule rules match this view.</p>;
  return (
    <div className="portal-counseling__table-wrap">
      <table className="portal-counseling__table">
        <thead><tr><th scope="col">Counselor</th><th scope="col">Day or date</th><th scope="col">Time</th><th scope="col">Mode</th><th scope="col">Location</th><th scope="col">State</th><th scope="col">Updated</th><th scope="col">Actions</th></tr></thead>
        <tbody>
          {data.value.map((item) => (
            <tr key={item.public_reference}>
              <Cell label="Counselor">{item.counselor_display_name}</Cell>
              <Cell label="Day or date">{item.kind === "availability_rule" ? item.day_label ?? "Day not set" : formatDate(item.date)}</Cell>
              <Cell label="Time">{item.is_all_day ? "All day" : `${item.start_time ?? "Not set"} – ${item.end_time ?? "Not set"}`}</Cell>
              <Cell label="Mode">{item.kind === "availability_rule" ? scheduleLabel(options, item.mode) : "Unavailable"}</Cell>
              <Cell label="Location">{item.location || "Not set"}</Cell>
              <Cell label="State"><Badge>{item.state_label}</Badge></Cell>
              <Cell label="Updated">{formatDate(item.updated_at)}</Cell>
              <Cell label="Actions"><div className="portal-counseling__row-actions">{item.is_active ? <><Button disabled={busy !== null} onClick={() => onEdit(item)} size="sm" type="button" variant="outline">Edit</Button><Button disabled={busy !== null} onClick={() => onDeactivate(item)} size="sm" type="button" variant="outline">Deactivate</Button></> : <span className="portal-counseling__secondary">No actions</span>}</div></Cell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClosureTable({
  data,
  busy,
  canManage,
  onEdit,
  onDeactivate,
  onRetry,
}: {
  data: PageState<PortalOfficeClosure[]>;
  busy: string | null;
  canManage: boolean;
  onEdit: (item: PortalOfficeClosure) => void;
  onDeactivate: (item: PortalOfficeClosure) => void;
  onRetry?: () => void;
}) {
  if (data.kind === "loading") return <><Skeleton as="span" /><Skeleton as="span" /></>;
  if (data.kind === "error") return <StateBlock retry={onRetry} title="Office closures are temporarily unavailable." />;
  if (!data.value.length) return <p>No office closures match this view.</p>;
  return (
    <div className="portal-counseling__table-wrap">
      <table className="portal-counseling__table">
        <thead><tr><th scope="col">Date</th><th scope="col">Time</th><th scope="col">Reason</th><th scope="col">State</th><th scope="col">Updated</th><th scope="col">Actions</th></tr></thead>
        <tbody>
          {data.value.map((item) => (
            <tr key={item.public_reference}>
              <Cell label="Date">{formatDate(item.date)}</Cell>
              <Cell label="Time">{item.is_all_day ? "All day" : `${item.start_time ?? "Not set"} – ${item.end_time ?? "Not set"}`}</Cell>
              <Cell label="Reason">{item.reason || "Not recorded"}</Cell>
              <Cell label="State"><Badge>{item.state_label}</Badge></Cell>
              <Cell label="Updated">{formatDate(item.updated_at)}</Cell>
              <Cell label="Actions">{canManage && item.is_active ? <div className="portal-counseling__row-actions"><Button disabled={busy !== null} onClick={() => onEdit(item)} size="sm" type="button" variant="outline">Edit</Button><Button disabled={busy !== null} onClick={() => onDeactivate(item)} size="sm" type="button" variant="outline">Deactivate</Button></div> : <span className="portal-counseling__secondary">View only</span>}</Cell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GuidanceScheduling({ canAvailability, canClosures, canViewClosures }: { canAvailability: boolean; canClosures: boolean; canViewClosures: boolean }) {
  const [options, setOptions] = useState<PortalScheduleOptions>(emptyScheduleOptions);
  const [availability, setAvailability] = useState<PageState<PortalScheduleRecord[]>>({ kind: "loading" });
  const [blocks, setBlocks] = useState<PageState<PortalScheduleRecord[]>>({ kind: "loading" });
  const [closures, setClosures] = useState<PageState<PortalOfficeClosure[]>>({ kind: "loading" });
  const [filterFields, setFilterFields] = useState({ q: "", state: "", dateFrom: "", dateTo: "", order: "recent" });
  const [scheduleFilters, setScheduleFilters] = useState<GuidanceScheduleFilters>({ order: "recent" });
  const [closureFilters, setClosureFilters] = useState<GuidanceOfficeClosureFilters>({ order: "recent" });
  const [pages, setPages] = useState({ availability: 1, blocks: 1, closures: 1 });
  const [dialog, setDialog] = useState<"schedule" | "closure" | null>(null);
  const [scheduleFields, setScheduleFields] = useState<GuidanceScheduleMutationFields>(() => scheduleDefaults(emptyScheduleOptions, "availability_rule"));
  const [preview, setPreview] = useState<PortalSchedulePreview | null>(null);
  const [handoffConfirmed, setHandoffConfirmed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const mutationKeys = useRef(new Map<string, { fingerprint: string; key: IdempotencyKey }>());

  const reload = () => setReloadKey((value) => value + 1);

  useEffect(() => {
    if (!canAvailability) {
      return;
    }
    const controller = new AbortController();
    getGuidanceScheduleOptions(controller.signal)
      .then(setOptions)
      .catch(() => { if (!controller.signal.aborted) setOptions(emptyScheduleOptions); });
    return () => controller.abort();
  }, [canAvailability, reloadKey]);

  useEffect(() => {
    if (!canAvailability) {
      return;
    }
    const controller = new AbortController();
    Promise.all([
      getGuidanceScheduleRecords({ ...scheduleFilters, kind: "availability_rule" }, pages.availability, controller.signal),
      getGuidanceScheduleRecords({ ...scheduleFilters, kind: "unavailable_block" }, pages.blocks, controller.signal),
    ])
      .then(([availabilityPage, blockPage]) => {
        setAvailability({ kind: "ready", value: availabilityPage.items, total: availabilityPage.total, page: availabilityPage.page });
        setBlocks({ kind: "ready", value: blockPage.items, total: blockPage.total, page: blockPage.page });
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          const errorState = { kind: "error" as const, error: cause instanceof GuidanceSettingsApiError && cause.kind === "permission" ? "permission" as const : "unavailable" as const };
          setAvailability(errorState);
          setBlocks(errorState);
        }
      });
    return () => controller.abort();
  }, [canAvailability, pages.availability, pages.blocks, reloadKey, scheduleFilters]);

  useEffect(() => {
    if (!canViewClosures) {
      return;
    }
    const controller = new AbortController();
    getGuidanceOfficeClosures(closureFilters, pages.closures, controller.signal)
      .then((value) => setClosures({ kind: "ready", value: value.items, total: value.total, page: value.page }))
      .catch((cause) => {
        if (!controller.signal.aborted) setClosures({ kind: "error", error: cause instanceof GuidanceSettingsApiError && cause.kind === "permission" ? "permission" : "unavailable" });
      });
    return () => controller.abort();
  }, [canViewClosures, closureFilters, pages.closures, reloadKey]);

  const applyFilters = () => {
    setPages({ availability: 1, blocks: 1, closures: 1 });
    setScheduleFilters({ q: filterFields.q.trim() || undefined, state: filterFields.state || undefined, date_from: filterFields.dateFrom || undefined, date_to: filterFields.dateTo || undefined, order: filterFields.order as "recent" | "oldest" });
    setClosureFilters({ state: filterFields.state || undefined, date_from: filterFields.dateFrom || undefined, date_to: filterFields.dateTo || undefined, order: filterFields.order as "recent" | "oldest" });
  };

  const openSchedule = (item?: PortalScheduleRecord, operation: "update" | "void" = "update") => {
    setDialog("schedule");
    setPreview(null);
    setHandoffConfirmed(false);
    setScheduleFields(item ? scheduleActionFields(scheduleFieldsForRecord(item), operation) : scheduleDefaults(options, "availability_rule"));
    mutationKeys.current.delete("schedule-dialog");
    setError(null);
  };

  const openClosure = (item?: PortalOfficeClosure, operation: "update" | "void" = "update") => {
    setDialog("closure");
    setPreview(null);
    setHandoffConfirmed(false);
    setScheduleFields(item ? scheduleActionFields(closureFieldsForRecord(item), operation) : { ...scheduleDefaults(options, "unavailable_block"), kind: "office_closure", day_of_week: null, start_time: null, end_time: null, mode: "", location: "", slot_duration_minutes: null, max_appointments_per_slot: null, block_date: todayInputValue(), is_all_day: true, effective_from: null, effective_until: null, reason: "Office closure created" });
    mutationKeys.current.delete("schedule-dialog");
    setError(null);
  };

  const updateField = <K extends keyof GuidanceScheduleMutationFields>(field: K, value: GuidanceScheduleMutationFields[K]) => {
    mutationKeys.current.delete("schedule-dialog");
    setPreview(null);
    setHandoffConfirmed(false);
    setScheduleFields((current) => ({ ...current, [field]: value }));
  };

  const validateScheduleFields = () => {
    if (!scheduleFields.reason?.trim()) return "An operational reason is required.";
    if (!scheduleFields.kind) return "A schedule type is required.";
    if (scheduleFields.operation !== "void") {
      if (scheduleFields.kind === "availability_rule" && (scheduleFields.day_of_week === null || !scheduleFields.start_time || !scheduleFields.end_time || !scheduleFields.effective_from || !scheduleFields.mode)) return "Complete the availability day, time, mode, and effective date.";
      if (scheduleFields.kind !== "availability_rule" && (!scheduleFields.block_date || (!scheduleFields.is_all_day && (!scheduleFields.start_time || !scheduleFields.end_time)))) return "Complete the block date and time, or select all day.";
    }
    if ((scheduleFields.operation === "update" || scheduleFields.operation === "void") && !scheduleFields.target_reference) return "The schedule reference is no longer available. Refresh and try again.";
    return null;
  };

  const submitSchedulePreview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateScheduleFields();
    if (validation) { setError(validation); return; }
    const fingerprint = JSON.stringify(scheduleFields);
    const existing = mutationKeys.current.get("schedule-dialog");
    const key = existing?.fingerprint === fingerprint ? existing.key : createIdempotencyKey();
    mutationKeys.current.set("schedule-dialog", { fingerprint, key });
    setBusy("schedule-preview");
    setError(null);
    try {
      setPreview(await previewGuidanceScheduleChange(scheduleFields, key));
    } catch (cause) {
      setError(errorText(cause, "schedule"));
    } finally {
      setBusy(null);
    }
  };

  const confirmScheduleChange = async () => {
    if (!preview) return;
    if ((preview.pending_count > 0 || preview.scheduled_count > 0) && !handoffConfirmed) {
      setError("Confirm the appointment handoff before applying this schedule change.");
      return;
    }
    const entry = mutationKeys.current.get("schedule-dialog");
    const key = entry?.key ?? createIdempotencyKey();
    const fields = { ...scheduleFields, expected_fingerprint: preview.fingerprint, confirm: true, handoff_action: preview.pending_count > 0 || preview.scheduled_count > 0 ? "save_and_handoff" : "" };
    setBusy("schedule-apply");
    setError(null);
    try {
      await applyGuidanceScheduleChange(fields, key);
      mutationKeys.current.delete("schedule-dialog");
      setDialog(null);
      setPreview(null);
      reload();
    } catch (cause) {
      setError(errorText(cause, "schedule"));
      if (cause instanceof GuidanceSettingsApiError && cause.kind === "conflict") {
        setPreview(null);
        reload();
      }
    } finally {
      setBusy(null);
    }
  };

  const scheduleDialogSubmit = (event: FormEvent<HTMLFormElement>) => void submitSchedulePreview(event);
  const scheduleCount = (state: PageState<PortalScheduleRecord[]>) => state.kind === "ready" ? state.total ?? state.value.length : 0;
  const closureCount = closures.kind === "ready" ? closures.total ?? closures.value.length : 0;
  const stateOptions: PortalScheduleChoice[] = options.states.length ? options.states : [{ value: "ACTIVE", label: "Active" }, { value: "SCHEDULED", label: "Scheduled" }, { value: "EXPIRED", label: "Expired" }, { value: "INACTIVE", label: "Inactive" }];
  const modeOptions = options.modes;

  return (
    <div className="portal-counseling__stack">
      {error ? <p className="portal-counseling__inline-error" role="alert">{error}</p> : null}
      <PortalCollectionFrame className="portal-counseling__frame">
        <div className="portal-counseling__filter-grid">
          <Label>Search counselor<Input value={filterFields.q} onChange={(event) => setFilterFields((value) => ({ ...value, q: event.target.value }))} /></Label>
          <ChoiceSelect label="State" options={[{ value: "", label: "All states" }, ...stateOptions]} value={filterFields.state} onChange={(state) => setFilterFields((value) => ({ ...value, state }))} />
          <Label>From date<Input type="date" value={filterFields.dateFrom} onChange={(event) => setFilterFields((value) => ({ ...value, dateFrom: event.target.value }))} /></Label>
          <Label>To date<Input type="date" value={filterFields.dateTo} onChange={(event) => setFilterFields((value) => ({ ...value, dateTo: event.target.value }))} /></Label>
          <Label>Order<select value={filterFields.order} onChange={(event) => setFilterFields((value) => ({ ...value, order: event.target.value }))}><option value="recent">Recently updated</option><option value="oldest">Oldest updated</option></select></Label>
          <Button onClick={applyFilters} size="sm" type="button">Apply filters</Button>
        </div>
        {canAvailability ? <>
          <div className="portal-counseling__section-divider" />
          <FrameHeading count={scheduleCount(availability)} kicker="Scheduling" newLabel="New schedule rule" onNew={() => openSchedule()} title="Counselor availability" />
          <ScheduleTable data={availability} options={options} busy={busy} onEdit={(item) => openSchedule(item)} onDeactivate={(item) => openSchedule(item, "void")} onRetry={reload} />
          <Pager disabled={busy !== null} page={availability.kind === "ready" ? availability.page ?? pages.availability : pages.availability} total={scheduleCount(availability)} onPage={(value) => setPages((current) => ({ ...current, availability: value }))} />
          <div className="portal-counseling__section-divider" />
          <FrameHeading count={scheduleCount(blocks)} kicker="Scheduling" title="Unavailable blocks" />
          <ScheduleTable data={blocks} options={options} busy={busy} onEdit={(item) => openSchedule(item)} onDeactivate={(item) => openSchedule(item, "void")} onRetry={reload} />
          <Pager disabled={busy !== null} page={blocks.kind === "ready" ? blocks.page ?? pages.blocks : pages.blocks} total={scheduleCount(blocks)} onPage={(value) => setPages((current) => ({ ...current, blocks: value }))} />
        </> : null}
        {canViewClosures ? <>
          <div className="portal-counseling__section-divider" />
          <FrameHeading count={closureCount} kicker="Scheduling" newLabel="New office closure" onNew={canClosures ? () => openClosure() : undefined} title="Office closures" />
          <ClosureTable canManage={canClosures} data={closures} busy={busy} onEdit={(item) => openClosure(item)} onDeactivate={(item) => openClosure(item, "void")} onRetry={reload} />
          <Pager disabled={busy !== null} page={closures.kind === "ready" ? closures.page ?? pages.closures : pages.closures} total={closureCount} onPage={(value) => setPages((current) => ({ ...current, closures: value }))} />
        </> : null}
      </PortalCollectionFrame>

      <AlertDialog onOpenChange={(open) => { if (!open && busy === null) { mutationKeys.current.delete("schedule-dialog"); setDialog(null); setPreview(null); setHandoffConfirmed(false); setError(null); } }} open={dialog !== null}>
        <AlertDialogContent className="portal-counseling__dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{dialog === "closure" ? (scheduleFields.operation === "create" ? "New office closure" : scheduleFields.operation === "void" ? "Deactivate office closure" : "Edit office closure") : (scheduleFields.operation === "create" ? "New schedule rule" : scheduleFields.operation === "void" ? "Deactivate schedule rule" : "Edit schedule rule")}</AlertDialogTitle>
            <AlertDialogDescription>Review the possible appointment impact before applying this change. The backend remains authoritative for conflicts and handoff eligibility.</AlertDialogDescription>
          </AlertDialogHeader>
          <form onSubmit={scheduleDialogSubmit}>
            <div className="portal-counseling__dialog-fields">
              {dialog === "schedule" && scheduleFields.operation !== "void" ? <ChoiceSelect label="Rule type" options={[{ value: "availability_rule", label: "Availability rule" }, { value: "unavailable_block", label: "Unavailable block" }]} value={scheduleFields.kind} onChange={(kind) => { const nextKind = kind as "availability_rule" | "unavailable_block"; updateField("kind", nextKind); if (nextKind === "unavailable_block") updateField("is_all_day", true); }} /> : null}
              {dialog === "schedule" && scheduleFields.operation === "create" && options.counselors.length ? <ChoiceSelect label="Counselor" options={options.counselors.map((item, index) => ({ value: String(index), label: item.display_name }))} value={scheduleFields.counselor ? String(options.counselors.indexOf(scheduleFields.counselor)) : ""} onChange={(value) => updateField("counselor", options.counselors[Number(value)] ?? null)} /> : null}
              {dialog === "schedule" && scheduleFields.operation === "create" && !options.counselors.length ? <p className="portal-counseling__secondary">No counselor options are available. Refresh the scheduling section and try again.</p> : null}
              {dialog === "schedule" && scheduleFields.kind === "availability_rule" && scheduleFields.operation !== "void" ? <><ChoiceSelect label="Day" options={options.days} value={String(scheduleFields.day_of_week ?? "")} onChange={(value) => updateField("day_of_week", Number(value))} /><Label>Start time<Input required type="time" value={scheduleFields.start_time ?? ""} onChange={(event) => updateField("start_time", event.target.value)} /></Label><Label>End time<Input required type="time" value={scheduleFields.end_time ?? ""} onChange={(event) => updateField("end_time", event.target.value)} /></Label><ChoiceSelect label="Mode" options={modeOptions} value={scheduleFields.mode ?? ""} onChange={(mode) => updateField("mode", mode)} /><Label>Location (optional)<Input value={scheduleFields.location ?? ""} onChange={(event) => updateField("location", event.target.value)} /></Label><Label>Slot duration (minutes)<Input min={1} required type="number" value={scheduleFields.slot_duration_minutes ?? ""} onChange={(event) => updateField("slot_duration_minutes", event.target.value ? Number(event.target.value) : null)} /></Label><Label>Maximum appointments per slot<Input min={1} required type="number" value={scheduleFields.max_appointments_per_slot ?? ""} onChange={(event) => updateField("max_appointments_per_slot", event.target.value ? Number(event.target.value) : null)} /></Label><Label>Effective from<Input required type="date" value={scheduleFields.effective_from ?? ""} onChange={(event) => updateField("effective_from", event.target.value)} /></Label><Label>Effective until (optional)<Input type="date" value={scheduleFields.effective_until ?? ""} onChange={(event) => updateField("effective_until", event.target.value || null)} /></Label></> : null}
              {((dialog === "schedule" && scheduleFields.kind === "unavailable_block") || dialog === "closure") && scheduleFields.operation !== "void" ? <><Label>Date<Input required type="date" value={scheduleFields.block_date ?? ""} onChange={(event) => updateField("block_date", event.target.value)} /></Label><Label><input checked={scheduleFields.is_all_day === true} onChange={(event) => { updateField("is_all_day", event.target.checked); if (event.target.checked) { updateField("start_time", null); updateField("end_time", null); } }} type="checkbox" /> All day</Label>{!scheduleFields.is_all_day ? <><Label>Start time<Input required type="time" value={scheduleFields.start_time ?? ""} onChange={(event) => updateField("start_time", event.target.value)} /></Label><Label>End time<Input required type="time" value={scheduleFields.end_time ?? ""} onChange={(event) => updateField("end_time", event.target.value)} /></Label></> : null}</> : null}
              {dialog === "schedule" && scheduleFields.operation === "void" ? <p>This will deactivate the selected schedule record after the appointment-impact review.</p> : null}
              {dialog === "closure" && scheduleFields.operation === "void" ? <p>This will deactivate the selected office closure after the appointment-impact review.</p> : null}
              <Label>Operational reason<Input required maxLength={200} value={scheduleFields.reason ?? ""} onChange={(event) => updateField("reason", event.target.value)} /></Label>
              {preview ? <div className="portal-counseling__state-panel" role="status"><strong>Review impact</strong><p>{preview.pending_count} pending and {preview.scheduled_count} scheduled appointments are affected.</p><p>{preview.affected_outcome === "NONE" ? "No appointment handoff is required." : "An explicit handoff will be recorded with this schedule change."}</p>{preview.pending_count + preview.scheduled_count > 0 ? <Label><input checked={handoffConfirmed} onChange={(event) => setHandoffConfirmed(event.target.checked)} type="checkbox" /> I confirm the appointment handoff.</Label> : null}</div> : null}
            </div>
            <AlertDialogFooter><AlertDialogCancel disabled={busy !== null}>Cancel</AlertDialogCancel>{preview ? <Button disabled={busy !== null} onClick={() => void confirmScheduleChange()} type="button">{busy === "schedule-apply" ? "Applying…" : "Confirm schedule change"}</Button> : <AlertDialogAction disabled={busy !== null} type="submit">{busy === "schedule-preview" ? "Reviewing…" : "Review impact"}</AlertDialogAction>}</AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
