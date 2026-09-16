"use client";

import { RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import {
  academicTermLifecycle,
  createGuidanceAcademicTerm,
  createGuidanceFamily,
  createGuidanceInstrument,
  createGuidanceRevisionForFamily,
  downloadGuidanceRevisionSource,
  familyLifecycle,
  getGuidanceAcademicTerms,
  getGuidanceFamilies,
  getGuidanceInstitutionalIdentity,
  getGuidanceInstruments,
  getGuidanceRevisionPreflight,
  getGuidanceRevisions,
  getGuidanceRolloverPreview,
  GuidanceSettingsApiError,
  revisionLifecycle,
  setGuidanceInstrumentActive,
  updateGuidanceAcademicTerm,
  updateGuidanceFamily,
  updateGuidanceInstrument,
  updateGuidanceRevision,
  updateGuidanceInstitutionalIdentity,
  uploadGuidanceRevisionSource,
  type PortalAcademicTerm,
  type PortalAssessmentInstrument,
  type PortalFormFamily,
  type PortalFormRevision,
  type PortalInstitutionalIdentity,
  type InstitutionalIdentityFields,
  type RevisionPreflight,
  type RolloverPreview,
} from "@/lib/api/guidance-settings";
import { createIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";
import {
  GuidanceCounselorCoverage,
  GuidanceInstitutionDocuments,
} from "@/components/portal/portal-guidance-settings-managed";
import {
  GuidanceScheduling,
  GuidanceWorkflowAccess,
} from "@/components/portal/portal-guidance-settings-access-scheduling";

const NAV_ITEMS = [
  {
    href: "/portal/guidance-settings?section=academic-context",
    label: "Academic context",
    value: "academic-context",
  },
  {
    href: "/portal/guidance-settings?section=forms-instruments",
    label: "Forms & instruments",
    value: "forms-instruments",
  },
  {
    href: "/portal/guidance-settings?section=institution-documents",
    label: "Institution & documents",
    value: "institution-documents",
  },
  {
    href: "/portal/guidance-settings?section=counselor-coverage",
    label: "Counselor coverage",
    value: "counselor-coverage",
  },
  {
    href: "/portal/guidance-settings?section=workflow-access",
    label: "Workflow access",
    value: "workflow-access",
  },
  {
    href: "/portal/guidance-settings?section=scheduling",
    label: "Scheduling",
    value: "scheduling",
  },
] as const;

type Section = (typeof NAV_ITEMS)[number]["value"];
type LoadState<T> =
  | { kind: "loading" }
  | { kind: "ready"; value: T }
  | { kind: "error"; error: "permission" | "unavailable" };
type AcademicData = {
  terms: PortalAcademicTerm[];
};
type FormsData = {
  families: PortalFormFamily[];
  revisions: PortalFormRevision[];
  instruments: PortalAssessmentInstrument[];
};
type DialogKind =
  | "term"
  | "family"
  | "revision"
  | "instrument"
  | null;
type EditableTarget =
  | { kind: "term"; item: PortalAcademicTerm }
  | { kind: "family"; item: PortalFormFamily }
  | { kind: "revision"; item: PortalFormRevision }
  | { kind: "instrument"; item: PortalAssessmentInstrument };
type ActionHandler = (
  name: string,
  operation: (key: IdempotencyKey) => Promise<unknown>,
) => void;

const statusLabel = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatDate = (value: string | null | undefined) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(date);
};

const dateInputValue = (value: string | null | undefined) =>
  value ? value.slice(0, 10) : "";

const errorCopy = (error: unknown) =>
  error instanceof GuidanceSettingsApiError && error.kind === "permission"
    ? "This action is not available for this account."
    : "Guidance settings are temporarily unavailable. Try again.";

function GuidanceHeader({ headingId = "portal-guidance-settings-heading" }: { headingId?: string } = {}) {
  return (
    <PortalPageHeader
      className="portal-counseling__page-header"
      current="Guidance settings"
      description="Manage governed academic context, forms, institutional documents, and counselor coverage used by COMPASS."
      headingId={headingId}
      title="Guidance settings"
    />
  );
}

function StateFrame({ title, retry }: { title: string; retry?: () => void }) {
  return (
    <PortalCollectionFrame className="portal-counseling__frame portal-counseling__frame--state">
      <ShieldCheck aria-hidden="true" className="portal-counseling__state-icon" />
      <h2>{title}</h2>
      <p>Only authorized governance users can view or change these settings.</p>
      {retry ? (
        <Button onClick={retry} type="button" variant="outline">
          <RefreshCw aria-hidden="true" />
          Try again
        </Button>
      ) : null}
    </PortalCollectionFrame>
  );
}

const IDENTITY_INSTITUTION_FIELDS: Array<{
  key: keyof InstitutionalIdentityFields;
  label: string;
  type?: "text" | "email" | "url";
  maxLength: number;
  required?: boolean;
  multiline?: boolean;
}> = [
  { key: "institution_name", label: "Institution name", maxLength: 255, required: true },
  { key: "institution_short_name", label: "Abbreviation or short name", maxLength: 50 },
  { key: "institution_former_name", label: "Former institution name", maxLength: 255 },
  { key: "institution_former_short_name", label: "Former abbreviation", maxLength: 50 },
  { key: "main_campus", label: "Main campus", maxLength: 255 },
  { key: "institution_address", label: "Institution address", maxLength: 4000, multiline: true },
  { key: "official_website", label: "Official website", type: "url", maxLength: 2048 },
  { key: "institutional_email", label: "Institutional email", type: "email", maxLength: 254 },
  { key: "facebook_url", label: "Official Facebook page", type: "url", maxLength: 2048 },
];

const IDENTITY_OFFICE_FIELDS: Array<{
  key: keyof InstitutionalIdentityFields;
  label: string;
  type?: "text" | "email" | "url";
  maxLength: number;
  required?: boolean;
  multiline?: boolean;
}> = [
  { key: "office_name", label: "Office name", maxLength: 255, required: true },
  { key: "office_short_name", label: "Office short name", maxLength: 50 },
  { key: "document_header_name", label: "Document header name", maxLength: 255 },
  { key: "office_address", label: "Office address", maxLength: 4000, multiline: true },
  { key: "office_email", label: "Office email", type: "email", maxLength: 254 },
  { key: "office_phone", label: "Office phone", type: "text", maxLength: 50 },
  { key: "office_hours", label: "Office hours", maxLength: 255 },
  { key: "document_footer_text", label: "Document footer text", maxLength: 4000, multiline: true },
];

function identityFieldsFromRecord(
  identity: PortalInstitutionalIdentity,
): InstitutionalIdentityFields {
  return {
    institution_name: identity.institution_name,
    institution_short_name: identity.institution_short_name,
    institution_former_name: identity.institution_former_name,
    institution_former_short_name: identity.institution_former_short_name,
    main_campus: identity.main_campus,
    institution_address: identity.institution_address,
    official_website: identity.official_website,
    institutional_email: identity.institutional_email,
    facebook_url: identity.facebook_url,
    office_name: identity.office_name,
    office_short_name: identity.office_short_name,
    document_header_name: identity.document_header_name,
    office_address: identity.office_address,
    office_email: identity.office_email,
    office_phone: identity.office_phone,
    office_hours: identity.office_hours,
    document_footer_text: identity.document_footer_text,
  };
}

function GuidanceInstitutionalIdentityPanel() {
  const [identity, setIdentity] = useState<LoadState<PortalInstitutionalIdentity>>({ kind: "loading" });
  const [fields, setFields] = useState<InstitutionalIdentityFields | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const mutationKey = useRef<{ fingerprint: string; key: IdempotencyKey } | null>(null);

  const reload = () => {
    setIdentity({ kind: "loading" });
    setFields(null);
    setError(null);
    setMessage(null);
    setReloadKey((value) => value + 1);
  };

  useEffect(() => {
    const controller = new AbortController();
    void getGuidanceInstitutionalIdentity(controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setIdentity({ kind: "ready", value });
        setFields(identityFieldsFromRecord(value));
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setIdentity({
          kind: "error",
          error:
            cause instanceof GuidanceSettingsApiError && cause.kind === "permission"
              ? "permission"
              : "unavailable",
        });
      });
    return () => controller.abort();
  }, [reloadKey]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (identity.kind !== "ready" || !fields || busy) return;
    const fingerprint = JSON.stringify({ resourceVersion: identity.value.resource_version, fields });
    const key = mutationKey.current?.fingerprint === fingerprint
      ? mutationKey.current.key
      : createIdempotencyKey();
    mutationKey.current = { fingerprint, key };
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await updateGuidanceInstitutionalIdentity(identity.value, fields, key);
      setIdentity({ kind: "ready", value: saved });
      setFields(identityFieldsFromRecord(saved));
      mutationKey.current = null;
      setMessage("Institutional identity saved.");
    } catch (cause) {
      setError(
        cause instanceof GuidanceSettingsApiError && cause.kind === "conflict"
          ? "This identity was changed in another session. Reload it before saving again."
          : cause instanceof GuidanceSettingsApiError && cause.kind === "validation"
            ? "Check the values above and try again."
            : cause instanceof GuidanceSettingsApiError && cause.kind === "permission"
              ? "This action is not available for this account."
              : "Institutional identity could not be saved. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const updateField = (key: keyof InstitutionalIdentityFields, value: string) => {
    setFields((current) => current ? { ...current, [key]: value } : current);
    setMessage(null);
    setError(null);
  };

  if (identity.kind === "loading") {
    return (
      <PortalCollectionFrame aria-labelledby="guidance-institutional-identity-heading" className="portal-counseling__frame">
        <p className="portal-counseling__kicker">Official details</p>
        <h2 id="guidance-institutional-identity-heading">Institutional identity</h2>
        <Skeleton as="span" />
        <Skeleton as="span" />
      </PortalCollectionFrame>
    );
  }

  if (identity.kind === "error" || !fields) {
    return (
      <StateFrame
        retry={reload}
        title={identity.kind === "error" && identity.error === "permission"
          ? "Institutional identity is not available for this account."
          : "Institutional identity is temporarily unavailable."}
      />
    );
  }

  const renderFields = (definitions: typeof IDENTITY_INSTITUTION_FIELDS) =>
    definitions.map((definition) => {
      const id = `institutional-identity-${definition.key}`;
      return (
        <div className="portal-counseling__dialog-field" key={definition.key}>
          <Label htmlFor={id}>{definition.label}</Label>
          {definition.multiline ? (
            <Textarea
              id={id}
              maxLength={definition.maxLength}
              onChange={(event) => updateField(definition.key, event.target.value)}
              required={definition.required}
              value={fields[definition.key]}
            />
          ) : (
            <Input
              autoComplete="off"
              id={id}
              maxLength={definition.maxLength}
              onChange={(event) => updateField(definition.key, event.target.value)}
              required={definition.required}
              type={definition.type ?? "text"}
              value={fields[definition.key]}
            />
          )}
        </div>
      );
    });

  const changed = JSON.stringify(fields) !== JSON.stringify(identityFieldsFromRecord(identity.value));
  return (
    <PortalCollectionFrame aria-labelledby="guidance-institutional-identity-heading" className="portal-counseling__frame">
      <div className="portal-counseling__frame-heading">
        <div>
          <p className="portal-counseling__kicker">Official details</p>
          <h2 id="guidance-institutional-identity-heading">Institutional identity</h2>
        </div>
      </div>
      <p>These details support public office information and backend-rendered documents. Previously issued documents keep their saved identity.</p>
      <form onSubmit={save}>
        <div className="portal-counseling__dialog-fields">
          <fieldset className="portal-counseling__identity-group">
            <legend>Institution</legend>
            {renderFields(IDENTITY_INSTITUTION_FIELDS)}
          </fieldset>
          <fieldset className="portal-counseling__identity-group">
            <legend>Guidance and Counseling Office</legend>
            {renderFields(IDENTITY_OFFICE_FIELDS)}
          </fieldset>
        </div>
        {error ? <p className="portal-counseling__dialog-error" role="alert">{error}</p> : null}
        {message ? <p className="portal-counseling__mutation portal-counseling__mutation--success" role="status">{message}</p> : null}
        <div className="portal-counseling__frame-actions">
          <Button disabled={!changed || busy} type="submit">{busy ? "Saving…" : "Save identity"}</Button>
          <Button disabled={busy} onClick={reload} type="button" variant="outline">Reload</Button>
        </div>
      </form>
    </PortalCollectionFrame>
  );
}

function FrameHeading({
  headingId,
  kicker,
  title,
  count,
  onNew,
  newLabel,
}: {
  headingId: string;
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
        <h2 id={headingId}>{title}</h2>
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

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return <td data-label={label}>{children}</td>;
}

function ActionButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      disabled={disabled}
      onClick={onClick}
      size="sm"
      type="button"
      variant="outline"
    >
      {label}
    </Button>
  );
}

function AcademicContext({
  data,
  busy,
  action,
  openDialog,
  onPreviewRollover,
  onEdit,
}: {
  data: AcademicData;
  busy: string | null;
  action: ActionHandler;
  openDialog: (kind: Exclude<DialogKind, null>) => void;
  onPreviewRollover: (item: PortalAcademicTerm) => void;
  onEdit: (target: EditableTarget) => void;
}) {
  return (
    <div className="portal-counseling__stack">
      <PortalCollectionFrame
        aria-labelledby="guidance-terms-heading"
        className="portal-counseling__frame"
      >
        <FrameHeading
          count={data.terms.length}
          headingId="guidance-terms-heading"
          kicker="Academic context"
          newLabel="New term"
          onNew={() => openDialog("term")}
          title="Academic terms"
        />
        {data.terms.length === 0 ? (
          <p>No academic terms are available.</p>
        ) : (
          <div className="portal-counseling__table-wrap">
            <table className="portal-counseling__table">
              <thead>
                <tr>
                  <th scope="col">Academic year</th>
                  <th scope="col">Semester</th>
                  <th scope="col">Dates</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.terms.map((item) => (
                  <tr key={`${item.academic_year}-${item.semester}`}>
                    <Cell label="Academic year">{item.academic_year}</Cell>
                    <Cell label="Semester">{item.semester}</Cell>
                    <Cell label="Dates">
                      {formatDate(item.start_date)} – {formatDate(item.end_date)}
                    </Cell>
                    <Cell label="Status">
                      <Badge>{statusLabel(item.status)}</Badge>
                    </Cell>
                    <Cell label="Actions">
                      <div className="portal-counseling__row-actions">
                        {item.status === "DRAFT" ? (
                          <>
                            <ActionButton
                              disabled={busy !== null}
                              label="Edit"
                              onClick={() => onEdit({ kind: "term", item })}
                            />
                            <ActionButton
                              disabled={busy !== null}
                              label="Preview activation"
                              onClick={() => onPreviewRollover(item)}
                            />
                          </>
                        ) : null}
                        {item.status === "ACTIVE" ? (
                          <ActionButton
                            disabled={busy !== null}
                            label="Close"
                            onClick={() =>
                              action(
                                `term-close-${item.academic_year}`,
                                (key) =>
                                  academicTermLifecycle(item, "close", {}, key),
                              )
                            }
                          />
                        ) : null}
                        {item.status === "CLOSED" ? (
                          <ActionButton
                            disabled={busy !== null}
                            label="Archive"
                            onClick={() =>
                              action(
                                `term-archive-${item.academic_year}`,
                                (key) =>
                                  academicTermLifecycle(item, "archive", {}, key),
                              )
                            }
                          />
                        ) : null}
                      </div>
                    </Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PortalCollectionFrame>


    </div>
  );
}

function FormsInstruments({
  data,
  busy,
  action,
  openDialog,
  onUpload,
  onDownload,
  onPreflight,
  onEdit,
  preflightRevision,
}: {
  data: FormsData;
  busy: string | null;
  action: ActionHandler;
  openDialog: (kind: Exclude<DialogKind, null>) => void;
  onUpload: (item: PortalFormRevision, file: File) => void;
  onDownload: (item: PortalFormRevision) => void;
  onPreflight: (item: PortalFormRevision) => void;
  onEdit: (target: EditableTarget) => void;
  preflightRevision: PortalFormRevision | null;
}) {
  return (
    <div className="portal-counseling__stack">
      <PortalCollectionFrame
        aria-labelledby="guidance-families-heading"
        className="portal-counseling__frame"
      >
        <FrameHeading
          count={data.families.length}
          headingId="guidance-families-heading"
          kicker="Forms"
          newLabel="New family"
          onNew={() => openDialog("family")}
          title="Form families"
        />
        {data.families.length === 0 ? (
          <p>No form families are available.</p>
        ) : (
          <div className="portal-counseling__table-wrap">
            <table className="portal-counseling__table">
              <thead>
                <tr>
                  <th scope="col">Family</th>
                  <th scope="col">Description</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.families.map((item) => (
                  <tr key={item.stable_key}>
                    <Cell label="Family">
                      <strong>{item.display_name}</strong>
                      <span className="portal-counseling__secondary">
                        {item.stable_key}
                      </span>
                    </Cell>
                    <Cell label="Description">{item.description || "No description"}</Cell>
                    <Cell label="Status">
                      <Badge>{statusLabel(item.status)}</Badge>
                    </Cell>
                    <Cell label="Actions">
                      <div className="portal-counseling__row-actions">
                        {item.status === "DRAFT" ? (
                          <>
                            <ActionButton
                              disabled={busy !== null}
                              label="Edit"
                              onClick={() => onEdit({ kind: "family", item })}
                            />
                            <ActionButton
                              disabled={busy !== null}
                              label="Activate"
                              onClick={() =>
                                action(
                                  `family-activate-${item.stable_key}`,
                                  (key) => familyLifecycle(item, "activate", {}, key),
                                )
                              }
                            />
                          </>
                        ) : null}
                        {item.status === "ACTIVE" ? (
                          <ActionButton
                            disabled={busy !== null}
                            label="Retire"
                            onClick={() =>
                              action(
                                `family-retire-${item.stable_key}`,
                                (key) => familyLifecycle(item, "retire", {}, key),
                              )
                            }
                          />
                        ) : null}
                        {item.status === "RETIRED" ? (
                          <ActionButton
                            disabled={busy !== null}
                            label="Archive"
                            onClick={() =>
                              action(
                                `family-archive-${item.stable_key}`,
                                (key) => familyLifecycle(item, "archive", {}, key),
                              )
                            }
                          />
                        ) : null}
                      </div>
                    </Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PortalCollectionFrame>

      <PortalCollectionFrame
        aria-labelledby="guidance-revisions-heading"
        className="portal-counseling__frame"
      >
        <FrameHeading
          count={data.revisions.length}
          headingId="guidance-revisions-heading"
          kicker="Forms"
          newLabel="New revision"
          onNew={() => openDialog("revision")}
          title="Form revisions"
        />
        {data.revisions.length === 0 ? (
          <p>No form revisions are available.</p>
        ) : (
          <div className="portal-counseling__table-wrap">
            <table className="portal-counseling__table">
              <thead>
                <tr>
                  <th scope="col">Form</th>
                  <th scope="col">Revision</th>
                  <th scope="col">Status</th>
                  <th scope="col">Source</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.revisions.map((item) => (
                  <tr key={`${item.form_family_key}-${item.official_revision}`}>
                    <Cell label="Form">
                      <strong>{item.display_title}</strong>
                      <span className="portal-counseling__secondary">
                        {item.form_family_key} · {item.official_form_code}
                      </span>
                    </Cell>
                    <Cell label="Revision">{item.official_revision}</Cell>
                    <Cell label="Status">
                      <Badge>{statusLabel(item.status)}</Badge>
                    </Cell>
                    <Cell label="Source">
                      {item.source_label || "No source attached"}
                    </Cell>
                    <Cell label="Actions">
                      <div className="portal-counseling__row-actions">
                        {item.status === "DRAFT" ? (
                          <>
                            <ActionButton
                              disabled={busy !== null}
                              label="Edit"
                              onClick={() => onEdit({ kind: "revision", item })}
                            />
                            <ActionButton
                              disabled={busy !== null}
                              label="Preflight"
                              onClick={() => onPreflight(item)}
                            />
                            <ActionButton
                              disabled={busy !== null || preflightRevision !== item}
                              label="Publish"
                              onClick={() =>
                                action(
                                  `revision-publish-${item.official_form_code}`,
                                  (key) => revisionLifecycle(item, "publish", {}, key),
                                )
                              }
                            />
                            <label className="portal-counseling__file-button">
                              <Upload aria-hidden="true" />
                              <span>Attach source</span>
                              <input
                                aria-label={`Attach source for ${item.display_title}`}
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  if (file) onUpload(item, file);
                                  event.currentTarget.value = "";
                                }}
                                type="file"
                              />
                            </label>
                          </>
                        ) : null}
                        {item.status === "PUBLISHED" ? (
                          <>
                            <ActionButton
                              disabled={busy !== null}
                              label="Preflight"
                              onClick={() => onPreflight(item)}
                            />
                            <ActionButton
                              disabled={busy !== null}
                              label="Archive"
                              onClick={() =>
                                action(
                                  `revision-archive-${item.official_form_code}`,
                                  (key) => revisionLifecycle(item, "archive", {}, key),
                                )
                              }
                            />
                            <ActionButton
                              disabled={busy !== null}
                              label="Clone"
                              onClick={() =>
                                action(
                                  `revision-clone-${item.official_form_code}`,
                                  (key) => revisionLifecycle(item, "clone", {}, key),
                                )
                              }
                            />
                          </>
                        ) : null}
                        {item.status === "ARCHIVED" ? (
                          <ActionButton
                            disabled={busy !== null}
                            label="Clone"
                            onClick={() =>
                              action(
                                `revision-clone-${item.official_form_code}`,
                                (key) => revisionLifecycle(item, "clone", {}, key),
                              )
                            }
                          />
                        ) : null}
                        {item.status === "PUBLISHED" ? (
                          <ActionButton
                            disabled={busy !== null}
                            label="Clone"
                            onClick={() =>
                              action(
                                `revision-clone-${item.official_form_code}`,
                                (key) => revisionLifecycle(item, "clone", {}, key),
                              )
                            }
                          />
                        ) : null}
                        {item.has_source ? (
                          <ActionButton
                            disabled={busy !== null}
                            label="Download source"
                            onClick={() => onDownload(item)}
                          />
                        ) : null}
                      </div>
                    </Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PortalCollectionFrame>

      <PortalCollectionFrame
        aria-labelledby="guidance-instruments-heading"
        className="portal-counseling__frame"
      >
        <FrameHeading
          count={data.instruments.length}
          headingId="guidance-instruments-heading"
          kicker="Assessments"
          newLabel="New instrument"
          onNew={() => openDialog("instrument")}
          title="Assessment instruments"
        />
        {data.instruments.length === 0 ? (
          <p>No assessment instruments are available.</p>
        ) : (
          <div className="portal-counseling__table-wrap">
            <table className="portal-counseling__table">
              <thead>
                <tr>
                  <th scope="col">Instrument</th>
                  <th scope="col">Category</th>
                  <th scope="col">Scoring</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.instruments.map((item) => (
                  <tr key={item.key}>
                    <Cell label="Instrument">
                      <strong>{item.title}</strong>
                      <span className="portal-counseling__secondary">{item.key}</span>
                    </Cell>
                    <Cell label="Category">{statusLabel(item.category)}</Cell>
                    <Cell label="Scoring">
                      {item.allows_scores
                        ? "Scoring guide governed"
                        : "No score fields"}
                      {item.allows_interpretation ? " · Interpretation enabled" : ""}
                    </Cell>
                    <Cell label="Status">
                      <Badge>{item.is_active ? "Active" : "Inactive"}</Badge>
                    </Cell>
                    <Cell label="Actions">
                      <div className="portal-counseling__row-actions">
                        {!item.is_active ? (
                          <>
                            <ActionButton
                              disabled={busy !== null}
                              label="Edit"
                              onClick={() => onEdit({ kind: "instrument", item })}
                            />
                            <ActionButton
                              disabled={busy !== null}
                              label="Activate"
                              onClick={() =>
                                action(
                                  `instrument-activate-${item.key}`,
                                  (key) =>
                                    setGuidanceInstrumentActive(item, true, {}, key),
                                )
                              }
                            />
                          </>
                        ) : (
                          <ActionButton
                            disabled={busy !== null}
                            label="Deactivate"
                            onClick={() =>
                              action(
                                `instrument-deactivate-${item.key}`,
                                (key) =>
                                  setGuidanceInstrumentActive(item, false, {}, key),
                              )
                            }
                          />
                        )}
                      </div>
                    </Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PortalCollectionFrame>
    </div>
  );
}

export function PortalGuidanceSettingsLoading() {
  return (
    <section
      aria-busy="true"
      aria-labelledby="portal-guidance-settings-loading-heading"
      className="portal-counseling portal-guidance-settings"
      role="status"
    >
      <GuidanceHeader headingId="portal-guidance-settings-loading-heading" />
      <div className="portal-counseling__workspace">
        <div aria-hidden="true" className="compass-surface portal-workspace-nav portal-counseling__nav-skeleton" data-tone="subtle">
          {NAV_ITEMS.map((item) => <Skeleton className="portal-counseling__nav-skeleton-line" key={item.value} />)}
        </div>
        <div className="portal-counseling__active-content">
          <PortalCollectionFrame className="portal-counseling__frame">
            <Skeleton as="span" />
            <Skeleton as="span" />
            <Skeleton as="span" />
          </PortalCollectionFrame>
        </div>
      </div>
    </section>
  );
}

export function PortalGuidanceSettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { status: accessStatus, hasCapability } = usePortalAccess();
  const requestedSection = searchParams.get("section");
  const canInstitutionalIdentity = hasCapability(
    PORTAL_CAPABILITIES.institutionalIdentityManage,
  );
  const canOrganizationGovernance = hasCapability(
    PORTAL_CAPABILITIES.organizationGovernanceManage,
  );
  const canDocumentTemplates = hasCapability(
    PORTAL_CAPABILITIES.documentTemplatesManage,
  );
  const canCounselorCoverage = hasCapability(
    PORTAL_CAPABILITIES.counselorCoverageManage,
  );
  const canWorkflowAccess = hasCapability(
    PORTAL_CAPABILITIES.workflowAuthorityManage,
  );
  const canAvailability = hasCapability(
    PORTAL_CAPABILITIES.appointmentsAvailabilityManage,
  );
  const canOfficeClosures = hasCapability(
    PORTAL_CAPABILITIES.officeClosuresManage,
  );
  const authorizedSections: Section[] = [
    ...(canOrganizationGovernance
      ? (["academic-context", "forms-instruments"] as const)
      : []),
    ...(canInstitutionalIdentity || canOrganizationGovernance || canDocumentTemplates
      ? (["institution-documents"] as const)
      : []),
    ...(canCounselorCoverage ? (["counselor-coverage"] as const) : []),
    ...(canWorkflowAccess ? (["workflow-access"] as const) : []),
    ...(canAvailability || canOfficeClosures ? (["scheduling"] as const) : []),
  ];
  const fallbackSection = authorizedSections[0] ?? "academic-context";
  const section: Section = authorizedSections.includes(
    requestedSection as Section,
  )
    ? (requestedSection as Section)
    : fallbackSection;
  const [academic, setAcademic] = useState<LoadState<AcademicData>>({
    kind: "loading",
  });
  const [forms, setForms] = useState<LoadState<FormsData>>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [editTarget, setEditTarget] = useState<EditableTarget | null>(null);
  const [preflight, setPreflight] = useState<{
    revision: PortalFormRevision;
    result: RevisionPreflight;
  } | null>(null);
  const [rolloverPreview, setRolloverPreview] = useState<{
    term: PortalAcademicTerm;
    result: RolloverPreview;
  } | null>(null);
  const [termFields, setTermFields] = useState({
    academicYear: "",
    semester: "",
    start: "",
    end: "",
    config: "",
  });
  const [familyFields, setFamilyFields] = useState({
    key: "",
    name: "",
    description: "",
  });
  const [revisionFields, setRevisionFields] = useState({
    family: "",
    code: "",
    revision: "",
    title: "",
    schema: "1",
    template: "1",
  });
  const [instrumentFields, setInstrumentFields] = useState({
    key: "",
    title: "",
    category: "guidance",
    source: "",
    scores: false,
    guide: false,
    interpretation: true,
    notes: "",
  });
  const mutationKeys = useRef(
    new Map<string, { fingerprint: string; key: IdempotencyKey }>(),
  );

  const reload = () => {
    setReloadKey((value) => value + 1);
    setPreflight(null);
    setRolloverPreview(null);
  };

  useEffect(() => {
    if (accessStatus !== "ready" || !authorizedSections.length) return;
    if (requestedSection !== section) {
      router.replace(`/portal/guidance-settings?section=${section}`);
    }
  }, [accessStatus, authorizedSections.length, requestedSection, router, section]);

  useEffect(() => {
    if (accessStatus !== "ready" || !canOrganizationGovernance) {
      return;
    }
    const controller = new AbortController();
    if (section === "academic-context") {
      void Promise.resolve().then(() => {
        if (!controller.signal.aborted) setAcademic({ kind: "loading" });
      });
      Promise.all([
        getGuidanceAcademicTerms(controller.signal),
      ])
        .then(([terms]) => {
          setAcademic({
            kind: "ready",
            value: {
              terms: terms.items,
            },
          });
        })
        .catch((cause) => {
          if (!controller.signal.aborted) {
            setAcademic({
              kind: "error",
              error:
                cause instanceof GuidanceSettingsApiError &&
                cause.kind === "permission"
                  ? "permission"
                  : "unavailable",
            });
          }
        });
    } else if (section === "forms-instruments") {
      void Promise.resolve().then(() => {
        if (!controller.signal.aborted) setForms({ kind: "loading" });
      });
      Promise.all([
        getGuidanceFamilies(controller.signal),
        getGuidanceRevisions(controller.signal),
        getGuidanceInstruments(controller.signal),
      ])
        .then(([families, revisions, instruments]) => {
          setForms({
            kind: "ready",
            value: {
              families: families.items,
              revisions: revisions.items,
              instruments: instruments.items,
            },
          });
        })
        .catch((cause) => {
          if (!controller.signal.aborted) {
            setForms({
              kind: "error",
              error:
                cause instanceof GuidanceSettingsApiError &&
                cause.kind === "permission"
                  ? "permission"
                  : "unavailable",
            });
          }
        });
    }
    return () => controller.abort();
  }, [accessStatus, canOrganizationGovernance, reloadKey, section]);

  const doAction = async (
    name: string,
    operation: (key: IdempotencyKey) => Promise<unknown>,
  ) => {
    const existing = mutationKeys.current.get(name);
    const key = existing?.key ?? createIdempotencyKey();
    mutationKeys.current.set(name, { fingerprint: name, key });
    setBusy(name);
    setError(null);
    try {
      await operation(key);
      mutationKeys.current.delete(name);
      reload();
    } catch (cause) {
      setError(errorCopy(cause));
    } finally {
      setBusy(null);
    }
  };

  const resetDialogFields = (kind: Exclude<DialogKind, null>) => {
    if (kind === "term") {
      setTermFields({
        academicYear: "",
        semester: "",
        start: "",
        end: "",
        config: "",
      });
    }
    if (kind === "family") {
      setFamilyFields({ key: "", name: "", description: "" });
    }
    if (kind === "revision") {
      setRevisionFields({
        family: "",
        code: "",
        revision: "",
        title: "",
        schema: "1",
        template: "1",
      });
    }
    if (kind === "instrument") {
      setInstrumentFields({
        key: "",
        title: "",
        category: "guidance",
        source: "",
        scores: false,
        guide: false,
        interpretation: true,
        notes: "",
      });
    }
  };

  const openDialog = (kind: Exclude<DialogKind, null>) => {
    setEditTarget(null);
    resetDialogFields(kind);
    mutationKeys.current.delete("dialog");
    setError(null);
    setDialog(kind);
  };

  const openEdit = (target: EditableTarget) => {
    setEditTarget(target);
    mutationKeys.current.delete("dialog");
    setError(null);
    if (target.kind === "term") {
      setTermFields({
        academicYear: target.item.academic_year,
        semester: target.item.semester,
        start: dateInputValue(target.item.start_date),
        end: dateInputValue(target.item.end_date),
        config: target.item.configuration_identifier,
      });
    }
    if (target.kind === "family") {
      setFamilyFields({
        key: target.item.stable_key,
        name: target.item.display_name,
        description: target.item.description,
      });
    }
    if (target.kind === "revision") {
      setRevisionFields({
        family: target.item.form_family_key,
        code: target.item.official_form_code,
        revision: target.item.official_revision,
        title: target.item.display_title,
        schema: target.item.internal_schema_version,
        template: target.item.internal_template_version,
      });
    }
    if (target.kind === "instrument") {
      setInstrumentFields({
        key: target.item.key,
        title: target.item.title,
        category: target.item.category,
        source: target.item.official_source_reference,
        scores: target.item.allows_scores,
        guide: target.item.has_official_scoring_guide,
        interpretation: target.item.allows_interpretation,
        notes: target.item.notes,
      });
    }
    setDialog(target.kind);
  };

  const submitDialog = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dialog) return;
    const fingerprint = JSON.stringify({
      dialog,
      editKey:
        editTarget && "item" in editTarget
          ? editTarget.kind + JSON.stringify(editTarget.item)
          : null,
      termFields,
      familyFields,
      revisionFields,
      instrumentFields,
    });
    const existing = mutationKeys.current.get("dialog");
    const key =
      existing?.fingerprint === fingerprint
        ? existing.key
        : createIdempotencyKey();
    mutationKeys.current.set("dialog", { fingerprint, key });
    setBusy("dialog");
    setError(null);
    try {
      if (dialog === "term") {
        const payload = {
          academic_year: termFields.academicYear,
          semester: termFields.semester,
          start_date: termFields.start,
          end_date: termFields.end,
          configuration_identifier: termFields.config,
        };
        if (editTarget?.kind === "term") {
          await updateGuidanceAcademicTerm(editTarget.item, payload, key);
        } else {
          await createGuidanceAcademicTerm(payload, key);
        }
      }
      if (dialog === "family") {
        const payload = {
          stable_key: familyFields.key,
          display_name: familyFields.name,
          description: familyFields.description,
        };
        if (editTarget?.kind === "family") {
          await updateGuidanceFamily(editTarget.item, payload, key);
        } else {
          await createGuidanceFamily(payload, key);
        }
      }
      if (dialog === "revision" && forms.kind === "ready") {
        const family = forms.value.families.find(
          (item) => item.stable_key === revisionFields.family,
        );
        if (!family) throw new GuidanceSettingsApiError("validation");
        const payload = {
          official_form_code: revisionFields.code,
          official_revision: revisionFields.revision,
          display_title: revisionFields.title,
          internal_schema_version: revisionFields.schema,
          internal_template_version: revisionFields.template,
        };
        if (editTarget?.kind === "revision") {
          await updateGuidanceRevision(editTarget.item, family, payload, key);
        } else {
          await createGuidanceRevisionForFamily(family, payload, key);
        }
      }
      if (dialog === "instrument") {
        const payload = {
          title: instrumentFields.title,
          category: instrumentFields.category,
          official_source_reference: instrumentFields.source,
          allows_scores: instrumentFields.scores,
          has_official_scoring_guide: instrumentFields.guide,
          allows_interpretation: instrumentFields.interpretation,
          notes: instrumentFields.notes,
        };
        if (editTarget?.kind === "instrument") {
          await updateGuidanceInstrument(editTarget.item, payload, key);
        } else {
          await createGuidanceInstrument(
            { key: instrumentFields.key, ...payload },
            key,
          );
        }
      }
      mutationKeys.current.delete("dialog");
      setDialog(null);
      setEditTarget(null);
      reload();
    } catch (cause) {
      setError(errorCopy(cause));
    } finally {
      setBusy(null);
    }
  };

  const uploadSource = async (item: PortalFormRevision, file: File) => {
    await doAction(
      `revision-source-${item.official_form_code}-${file.name}-${file.size}-${file.lastModified}`,
      (key) => uploadGuidanceRevisionSource(item, file, file.name, null, key),
    );
  };

  const downloadSource = async (item: PortalFormRevision) => {
    setBusy(`revision-download-${item.official_form_code}`);
    setError(null);
    try {
      const blob = await downloadGuidanceRevisionSource(item);
      const url = URL.createObjectURL(blob);
      try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${item.official_form_code}-source`;
        anchor.click();
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (cause) {
      setError(errorCopy(cause));
    } finally {
      setBusy(null);
    }
  };

  const loadPreflight = async (item: PortalFormRevision) => {
    setBusy(`revision-preflight-${item.official_form_code}`);
    setError(null);
    try {
      setPreflight({
        revision: item,
        result: await getGuidanceRevisionPreflight(item),
      });
    } catch (cause) {
      setError(errorCopy(cause));
    } finally {
      setBusy(null);
    }
  };

  const loadRolloverPreview = async (item: PortalAcademicTerm) => {
    setBusy(`term-preview-${item.academic_year}`);
    setError(null);
    try {
      setRolloverPreview({
        term: item,
        result: await getGuidanceRolloverPreview(item),
      });
    } catch (cause) {
      setError(errorCopy(cause));
    } finally {
      setBusy(null);
    }
  };

  const activatePreview = () => {
    if (!rolloverPreview || rolloverPreview.term.status !== "DRAFT") return;
    const { term } = rolloverPreview;
    setRolloverPreview(null);
    void doAction(`term-activate-${term.academic_year}`, (key) =>
      academicTermLifecycle(term, "activate", {}, key),
    );
  };

  if (accessStatus === "loading") return <PortalGuidanceSettingsLoading />;
  if (accessStatus !== "ready" || !authorizedSections.length) {
    return (
      <section
        aria-labelledby="portal-guidance-settings-heading"
        className="portal-counseling portal-guidance-settings portal-counseling--state"
      >
        <GuidanceHeader />
        <StateFrame title="Guidance settings aren’t available for this account." />
      </section>
    );
  }

  if (section === "institution-documents") {
    return (
      <section
        aria-labelledby="portal-guidance-settings-heading"
        className="portal-counseling portal-guidance-settings"
      >
        <GuidanceHeader />
        <div className="portal-counseling__workspace">
          <PortalWorkspaceNav
            activeValue={section}
            ariaLabel="Guidance settings sections"
            items={NAV_ITEMS.filter((item) =>
              authorizedSections.includes(item.value),
            )}
          />
          <div className="portal-counseling__active-content">
            {canInstitutionalIdentity ? <GuidanceInstitutionalIdentityPanel /> : null}
            {canDocumentTemplates ? (
              <GuidanceInstitutionDocuments canTemplates={canDocumentTemplates} />
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  if (section === "counselor-coverage") {
    return (
      <section
        aria-labelledby="portal-guidance-settings-heading"
        className="portal-counseling portal-guidance-settings"
      >
        <GuidanceHeader />
        <div className="portal-counseling__workspace">
          <PortalWorkspaceNav
            activeValue={section}
            ariaLabel="Guidance settings sections"
            items={NAV_ITEMS.filter((item) =>
              authorizedSections.includes(item.value),
            )}
          />
          <div className="portal-counseling__active-content">
            <GuidanceCounselorCoverage />
          </div>
        </div>
      </section>
    );
  }

  if (section === "workflow-access") {
    return (
      <section
        aria-labelledby="portal-guidance-settings-heading"
        className="portal-counseling portal-guidance-settings"
      >
        <GuidanceHeader />
        <div className="portal-counseling__workspace">
          <PortalWorkspaceNav
            activeValue={section}
            ariaLabel="Guidance settings sections"
            items={NAV_ITEMS.filter((item) =>
              authorizedSections.includes(item.value),
            )}
          />
          <div className="portal-counseling__active-content">
            <GuidanceWorkflowAccess canManage={canWorkflowAccess} />
          </div>
        </div>
      </section>
    );
  }

  if (section === "scheduling") {
    return (
      <section
        aria-labelledby="portal-guidance-settings-heading"
        className="portal-counseling portal-guidance-settings"
      >
        <GuidanceHeader />
        <div className="portal-counseling__workspace">
          <PortalWorkspaceNav
            activeValue={section}
            ariaLabel="Guidance settings sections"
            items={NAV_ITEMS.filter((item) =>
              authorizedSections.includes(item.value),
            )}
          />
          <div className="portal-counseling__active-content">
            <GuidanceScheduling
              canAvailability={canAvailability}
              canClosures={canOfficeClosures}
              canViewClosures={canAvailability || canOfficeClosures}
            />
          </div>
        </div>
      </section>
    );
  }

  const currentLoad = section === "academic-context" ? academic : forms;
  return (
    <section
      aria-labelledby="portal-guidance-settings-heading"
      className="portal-counseling portal-guidance-settings"
    >
      <GuidanceHeader />
      <div className="portal-counseling__workspace">
        <PortalWorkspaceNav
          activeValue={section}
          ariaLabel="Guidance settings sections"
          items={NAV_ITEMS.filter((item) => authorizedSections.includes(item.value))}
        />
        <div className="portal-counseling__active-content">
          {error ? (
            <p className="portal-counseling__inline-error" role="alert">
              {error}
            </p>
          ) : null}
          {currentLoad.kind === "loading" ? (
            <PortalCollectionFrame className="portal-counseling__frame">
              <Skeleton as="span" />
              <Skeleton as="span" />
              <Skeleton as="span" />
            </PortalCollectionFrame>
          ) : null}
          {currentLoad.kind === "error" ? (
            <StateFrame
              retry={reload}
              title="Guidance settings are temporarily unavailable."
            />
          ) : null}
          {section === "academic-context" && academic.kind === "ready" ? (
            <AcademicContext
              action={doAction}
              busy={busy}
              data={academic.value}
              onEdit={openEdit}
              onPreviewRollover={(item) => void loadRolloverPreview(item)}
              openDialog={openDialog}
            />
          ) : null}
          {section === "forms-instruments" && forms.kind === "ready" ? (
            <FormsInstruments
              action={doAction}
              busy={busy}
              data={forms.value}
              onDownload={(item) => void downloadSource(item)}
              onEdit={openEdit}
              onPreflight={(item) => void loadPreflight(item)}
              preflightRevision={preflight?.result.ready ? preflight.revision : null}
              onUpload={(item, file) => void uploadSource(item, file)}
              openDialog={openDialog}
            />
          ) : null}
          {preflight ? (
            <PortalCollectionFrame className="portal-counseling__frame">
              <div className="portal-counseling__frame-heading">
                <div>
                  <p className="portal-counseling__kicker">Publication preflight</p>
                  <h2>{preflight.revision.display_title}</h2>
                </div>
                <Badge>{preflight.result.ready ? "Ready" : "Blocked"}</Badge>
              </div>
              {preflight.result.blockers.length ? (
                <ul>
                  {preflight.result.blockers.map((blocker) => (
                    <li key={blocker}>{statusLabel(blocker)}</li>
                  ))}
                </ul>
              ) : (
                <p>This revision passed the current activation checks.</p>
              )}
            </PortalCollectionFrame>
          ) : null}
          {rolloverPreview ? (
            <PortalCollectionFrame className="portal-counseling__frame">
              <div className="portal-counseling__frame-heading">
                <div>
                  <p className="portal-counseling__kicker">Activation preview</p>
                  <h2>
                    {rolloverPreview.result.academic_year} ·{" "}
                    {rolloverPreview.result.semester}
                  </h2>
                </div>
                <Badge>Read-only</Badge>
              </div>
              <p>
                {rolloverPreview.result.prior_term
                  ? `Activating this term closes ${rolloverPreview.result.prior_term}.`
                  : "No active term will be closed."}
              </p>
              <ul>
                {rolloverPreview.result.providers.map((provider) => (
                  <li key={provider.key}>
                    {statusLabel(provider.key)}: {provider.count} ·{" "}
                    {statusLabel(provider.status)}
                    {provider.reason_code
                      ? ` · ${statusLabel(provider.reason_code)}`
                      : ""}
                  </li>
                ))}
              </ul>
              <Button
                disabled={busy !== null || rolloverPreview.term.status !== "DRAFT"}
                onClick={activatePreview}
                size="sm"
                type="button"
              >
                Activate term
              </Button>
            </PortalCollectionFrame>
          ) : null}
        </div>
      </div>
      <AlertDialog
        onOpenChange={(open) => {
          if (!open && busy !== "dialog") {
            mutationKeys.current.delete("dialog");
            setDialog(null);
            setEditTarget(null);
            setError(null);
          }
        }}
        open={dialog !== null}
      >
        <AlertDialogContent className="portal-counseling__dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {editTarget
                ? `Edit ${dialog === "term" ? "academic term" : dialog === "family" ? "form family" : dialog === "revision" ? "form revision" : "assessment instrument"}`
                : dialog === "term"
                  ? "New academic term"
                  : dialog === "family"
                    ? "New form family"
                    : dialog === "revision"
                      ? "New form revision"
                      : "New assessment instrument"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Save a governed draft. Activation and publication remain separate actions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form onSubmit={submitDialog}>
            <div className="portal-counseling__dialog-fields">
              {dialog === "term" ? (
                <>
                  <Label>
                    Academic year
                    <Input
                      required
                      value={termFields.academicYear}
                      onChange={(event) =>
                        setTermFields((value) => ({
                          ...value,
                          academicYear: event.target.value,
                        }))
                      }
                    />
                  </Label>
                  <Label>
                    Semester
                    <Input
                      required
                      value={termFields.semester}
                      onChange={(event) =>
                        setTermFields((value) => ({
                          ...value,
                          semester: event.target.value,
                        }))
                      }
                    />
                  </Label>
                  <Label>
                    Start date
                    <Input
                      required
                      type="date"
                      value={termFields.start}
                      onChange={(event) =>
                        setTermFields((value) => ({
                          ...value,
                          start: event.target.value,
                        }))
                      }
                    />
                  </Label>
                  <Label>
                    End date
                    <Input
                      required
                      type="date"
                      value={termFields.end}
                      onChange={(event) =>
                        setTermFields((value) => ({
                          ...value,
                          end: event.target.value,
                        }))
                      }
                    />
                  </Label>
                  <Label>
                    Configuration identifier
                    <Input
                      required
                      value={termFields.config}
                      onChange={(event) =>
                        setTermFields((value) => ({
                          ...value,
                          config: event.target.value,
                        }))
                      }
                    />
                  </Label>
                </>
              ) : null}
              {dialog === "family" ? (
                <>
                  <Label>
                    Stable key
                    <Input
                      required
                      value={familyFields.key}
                      onChange={(event) =>
                        setFamilyFields((value) => ({
                          ...value,
                          key: event.target.value,
                        }))
                      }
                    />
                  </Label>
                  <Label>
                    Display name
                    <Input
                      required
                      value={familyFields.name}
                      onChange={(event) =>
                        setFamilyFields((value) => ({
                          ...value,
                          name: event.target.value,
                        }))
                      }
                    />
                  </Label>
                  <Label>
                    Description
                    <Input
                      value={familyFields.description}
                      onChange={(event) =>
                        setFamilyFields((value) => ({
                          ...value,
                          description: event.target.value,
                        }))
                      }
                    />
                  </Label>
                </>
              ) : null}
              {dialog === "revision" && forms.kind === "ready" ? (
                <>
                  <Label>
                    Form family
                    <select
                      required
                      value={revisionFields.family}
                      onChange={(event) =>
                        setRevisionFields((value) => ({
                          ...value,
                          family: event.target.value,
                        }))
                      }
                    >
                      <option value="">Choose a family</option>
                      {forms.value.families.map((item) => (
                        <option key={item.stable_key} value={item.stable_key}>
                          {item.display_name}
                        </option>
                      ))}
                    </select>
                  </Label>
                  <Label>
                    Official form code
                    <Input
                      required
                      value={revisionFields.code}
                      onChange={(event) =>
                        setRevisionFields((value) => ({
                          ...value,
                          code: event.target.value,
                        }))
                      }
                    />
                  </Label>
                  <Label>
                    Revision
                    <Input
                      required
                      value={revisionFields.revision}
                      onChange={(event) =>
                        setRevisionFields((value) => ({
                          ...value,
                          revision: event.target.value,
                        }))
                      }
                    />
                  </Label>
                  <Label>
                    Display title
                    <Input
                      required
                      value={revisionFields.title}
                      onChange={(event) =>
                        setRevisionFields((value) => ({
                          ...value,
                          title: event.target.value,
                        }))
                      }
                    />
                  </Label>
                  <Label>
                    Internal schema version
                    <Input
                      required
                      value={revisionFields.schema}
                      onChange={(event) =>
                        setRevisionFields((value) => ({
                          ...value,
                          schema: event.target.value,
                        }))
                      }
                    />
                  </Label>
                  <Label>
                    Internal template version
                    <Input
                      required
                      value={revisionFields.template}
                      onChange={(event) =>
                        setRevisionFields((value) => ({
                          ...value,
                          template: event.target.value,
                        }))
                      }
                    />
                  </Label>
                </>
              ) : null}
              {dialog === "instrument" ? (
                <>
                  <Label>
                    Stable key
                    <Input
                      disabled={editTarget?.kind === "instrument"}
                      required
                      value={instrumentFields.key}
                      onChange={(event) =>
                        setInstrumentFields((value) => ({
                          ...value,
                          key: event.target.value,
                        }))
                      }
                    />
                  </Label>
                  <Label>
                    Title
                    <Input
                      required
                      value={instrumentFields.title}
                      onChange={(event) =>
                        setInstrumentFields((value) => ({
                          ...value,
                          title: event.target.value,
                        }))
                      }
                    />
                  </Label>
                  <Label>
                    Category
                    <Input
                      required
                      value={instrumentFields.category}
                      onChange={(event) =>
                        setInstrumentFields((value) => ({
                          ...value,
                          category: event.target.value,
                        }))
                      }
                    />
                  </Label>
                  <Label>
                    Official source reference
                    <Input
                      value={instrumentFields.source}
                      onChange={(event) =>
                        setInstrumentFields((value) => ({
                          ...value,
                          source: event.target.value,
                        }))
                      }
                    />
                  </Label>
                  <Label>
                    <input
                      checked={instrumentFields.scores}
                      onChange={(event) =>
                        setInstrumentFields((value) => ({
                          ...value,
                          scores: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    Allows scores
                  </Label>
                  <Label>
                    <input
                      checked={instrumentFields.guide}
                      onChange={(event) =>
                        setInstrumentFields((value) => ({
                          ...value,
                          guide: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    Has official scoring guide
                  </Label>
                  <Label>
                    <input
                      checked={instrumentFields.interpretation}
                      onChange={(event) =>
                        setInstrumentFields((value) => ({
                          ...value,
                          interpretation: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    Allows interpretation
                  </Label>
                  <Label>
                    Governance notes
                    <Input
                      value={instrumentFields.notes}
                      onChange={(event) =>
                        setInstrumentFields((value) => ({
                          ...value,
                          notes: event.target.value,
                        }))
                      }
                    />
                  </Label>
                </>
              ) : null}
            </div>
            {error ? (
              <p className="portal-counseling__dialog-error" role="alert">
                {error}
              </p>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy === "dialog"}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction disabled={busy === "dialog"} type="submit">
                {busy === "dialog"
                  ? "Saving…"
                  : editTarget
                    ? "Save changes"
                    : "Save draft"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
