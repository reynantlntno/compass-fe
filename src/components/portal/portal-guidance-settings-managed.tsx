"use client";

import { RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { PortalCollectionFrame } from "@/components/portal/portal-collection-frame";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  brandAssetLifecycle,
  createGuidanceBrandAsset,
  createGuidanceCoverage,
  createGuidanceDocumentTemplate,
  deactivateGuidanceCoverage,
  documentTemplateLifecycle,
  downloadGuidanceBrandAsset,
  getGuidanceBrandAssets,
  getGuidanceCoverage,
  getGuidanceCounselorOptions,
  getGuidanceDocumentTemplates,
  getGuidanceTemplatePreflight,
  getGuidanceTemplateVersions,
  GuidanceSettingsApiError,
  templateVersionLifecycle,
  updateGuidanceBrandAsset,
  updateGuidanceCoverage,
  updateGuidanceDocumentTemplate,
  updateGuidanceTemplateVersion,
  type GuidanceCoverageFilters,
  type PortalBrandAsset,
  type PortalCounselorCoverage,
  type PortalCounselorOption,
  type PortalDocumentTemplate,
  type PortalDocumentTemplateVersion,
} from "@/lib/api/guidance-settings";
import { createIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";

type LoadState<T> =
  | { kind: "loading" }
  | { kind: "ready"; value: T; total?: number; page?: number }
  | { kind: "error"; error: "permission" | "unavailable" };

const formatDate = (value: string | null | undefined) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(date);
};

const DISPLAY_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  ARCHIVED: "Archived",
  A4: "A4",
  CERTIFICATE: "Certificate",
  CERTIFICATION: "Certification",
  CAMPAIGN: "Campaign",
  COMPASS: "COMPASS",
  CONFIDENTIAL: "Confidential",
  DARK: "Dark background",
  DOCUMENT_HEADER_LOGO: "Document header logo",
  DRAFT: "Draft",
  EXPIRED: "Expired",
  FAVICON: "Favicon",
  FOOTER_CERTIFICATIONS: "Footer certifications",
  FOOTER_IDENTITY: "Footer identity",
  FOOTER_IDENTITY_ROW: "Footer identity row",
  FOOTER_PRIVACY_CREDENTIALS: "Footer privacy credentials",
  FOOTER_RECOGNITIONS: "Footer recognitions",
  HEADER_IDENTITY: "Header identity",
  HTML: "HTML",
  IDENTITY: "Institutional identity",
  INACTIVE: "Inactive",
  INSTITUTION: "Institution",
  LOGIN_HERO: "Login hero image",
  LANDSCAPE: "Landscape",
  LIGHT: "Light background",
  LOGO_FULL: "Full logo",
  LOGO_MARK: "Logo mark",
  OFFICIAL_FORM: "Official form",
  OFFICIAL_RECORD: "Official record",
  OFFICE: "Office",
  PARTNER: "Partner",
  PDF: "PDF",
  PORTRAIT: "Portrait",
  PRINT: "Print use",
  PROVISIONAL: "Provisional",
  PUBLICATION: "Publication",
  PUBLICATION_MARKS: "Publication marks",
  PUBLIC_PAGE_LOGO: "Public page logo",
  PRIVACY_CREDENTIAL: "Privacy credential",
  RECOGNITION: "Recognition",
  RELEASE_RECORD: "Release record",
  REPORT_EXPORT: "Report export",
  RETIRED: "Retired",
  SCHEDULED: "Scheduled",
  SEAL: "Institutional seal",
  STANDARD: "Standard",
  SUMMARY: "Summary",
  TEMPORARY: "Temporary",
  TRANSPARENT: "Transparent background",
};

const ASSET_TYPE_OPTIONS = ["LOGO_FULL", "LOGO_MARK", "SEAL", "FAVICON", "DOCUMENT_HEADER_LOGO", "LOGIN_HERO", "PUBLIC_PAGE_LOGO"] as const;
const ASSET_ROLE_OPTIONS = ["IDENTITY", "CERTIFICATION", "RECOGNITION", "CAMPAIGN", "PRIVACY_CREDENTIAL", "PARTNER", "PUBLICATION"] as const;
const ASSET_OWNER_OPTIONS = ["INSTITUTION", "OFFICE", "COMPASS", "PARTNER"] as const;
const ASSET_PLACEMENT_OPTIONS = ["HEADER_IDENTITY", "FOOTER_IDENTITY", "FOOTER_IDENTITY_ROW", "FOOTER_CERTIFICATIONS", "FOOTER_RECOGNITIONS", "FOOTER_PRIVACY_CREDENTIALS", "PUBLICATION_MARKS"] as const;
const BACKGROUND_OPTIONS = ["LIGHT", "DARK", "TRANSPARENT", "PRINT"] as const;
const DOCUMENT_KIND_OPTIONS = ["CERTIFICATE", "OFFICIAL_FORM", "RELEASE_RECORD", "REPORT_EXPORT", "SUMMARY"] as const;
const OUTPUT_FORMAT_OPTIONS = ["HTML", "PDF"] as const;
const RETENTION_OPTIONS = ["STANDARD", "OFFICIAL_RECORD", "CONFIDENTIAL", "TEMPORARY"] as const;
const PAGE_SIZE_OPTIONS = ["LETTER", "A4", "LEGAL"] as const;
const PAGE_ORIENTATION_OPTIONS = ["portrait", "landscape"] as const;

const label = (value: string) =>
  DISPLAY_LABELS[value] ??
  value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const errorText = (error: unknown) =>
  error instanceof GuidanceSettingsApiError && error.kind === "permission"
    ? "This action is not available for this account."
    : "Guidance settings are temporarily unavailable. Try again.";

function ActionButton({
  label: buttonLabel,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button disabled={disabled} onClick={onClick} size="sm" type="button" variant="outline">
      {buttonLabel}
    </Button>
  );
}

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

type InstitutionDocumentsProps = {
  canBranding: boolean;
  canTemplates: boolean;
};

type DocumentDialog = "brand" | "template" | "version" | null;

export function GuidanceInstitutionDocuments({ canBranding, canTemplates }: InstitutionDocumentsProps) {
  const [brands, setBrands] = useState<LoadState<PortalBrandAsset[]>>({ kind: "loading" });
  const [templates, setTemplates] = useState<LoadState<PortalDocumentTemplate[]>>({ kind: "loading" });
  const [versions, setVersions] = useState<Record<string, LoadState<PortalDocumentTemplateVersion[]>>>({});
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<{ version: PortalDocumentTemplateVersion; ready: boolean; status: string; blockers: string[] } | null>(null);
  const [dialog, setDialog] = useState<DocumentDialog>(null);
  const [brandTarget, setBrandTarget] = useState<PortalBrandAsset | null>(null);
  const [templateTarget, setTemplateTarget] = useState<PortalDocumentTemplate | null>(null);
  const [versionTarget, setVersionTarget] = useState<PortalDocumentTemplateVersion | null>(null);
  const [brandFields, setBrandFields] = useState({ assetType: "LOGO_FULL", semanticRole: "IDENTITY", placement: "HEADER_IDENTITY", ownerType: "INSTITUTION", backgroundVariant: "LIGHT", altText: "", version: "1", effectiveFrom: "", effectiveUntil: "", file: null as File | null });
  const [templateFields, setTemplateFields] = useState({ key: "", name: "", kind: "OFFICIAL_FORM", format: "PDF", retention: "STANDARD", description: "" });
  const [versionFields, setVersionFields] = useState({ label: "", format: "PDF", pageSize: "A4", orientation: "portrait" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const mutationKeys = useRef(new Map<string, { fingerprint: string; key: IdempotencyKey }>());

  const reload = () => {
    setReloadKey((value) => value + 1);
    setPreflight(null);
    setExpandedTemplate(null);
    setVersions({});
  };

  useEffect(() => {
    const controller = new AbortController();
    if (canBranding) {
      void Promise.resolve().then(() => {
        if (controller.signal.aborted) return;
        setBrands({ kind: "loading" });
        return getGuidanceBrandAssets(controller.signal)
          .then((page) => setBrands({ kind: "ready", value: page.items, total: page.total, page: page.page }))
          .catch((cause) => {
            if (!controller.signal.aborted) setBrands({ kind: "error", error: cause instanceof GuidanceSettingsApiError && cause.kind === "permission" ? "permission" : "unavailable" });
          });
      });
    }
    if (canTemplates) {
      void Promise.resolve().then(() => {
        if (controller.signal.aborted) return;
        setTemplates({ kind: "loading" });
        return getGuidanceDocumentTemplates(controller.signal)
          .then((page) => setTemplates({ kind: "ready", value: page.items, total: page.total, page: page.page }))
          .catch((cause) => {
            if (!controller.signal.aborted) setTemplates({ kind: "error", error: cause instanceof GuidanceSettingsApiError && cause.kind === "permission" ? "permission" : "unavailable" });
          });
      });
    }
    return () => controller.abort();
  }, [canBranding, canTemplates, reloadKey]);

  const mutate = async (name: string, operation: (key: IdempotencyKey) => Promise<unknown>) => {
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
      setError(errorText(cause));
    } finally {
      setBusy(null);
    }
  };

  const openBrand = (item?: PortalBrandAsset) => {
    setBrandTarget(item ?? null);
    setBrandFields({ assetType: item?.asset_type ?? "LOGO_FULL", semanticRole: item?.semantic_role ?? "IDENTITY", placement: item?.placement ?? "HEADER_IDENTITY", ownerType: item?.owner_type ?? "INSTITUTION", backgroundVariant: item?.background_variant ?? "LIGHT", altText: item?.alt_text ?? "", version: item?.version_label ?? "1", effectiveFrom: item?.effective_from?.slice(0, 10) ?? "", effectiveUntil: item?.effective_until?.slice(0, 10) ?? "", file: null });
    mutationKeys.current.delete("brand-dialog");
    setError(null);
    setDialog("brand");
  };

  const openTemplate = (item?: PortalDocumentTemplate) => {
    setTemplateTarget(item ?? null);
    setTemplateFields({ key: item?.stable_key ?? "", name: item?.display_name ?? "", kind: item?.document_kind ?? "OFFICIAL_FORM", format: item?.default_output_format ?? "PDF", retention: item?.retention_classification ?? "STANDARD", description: item?.description ?? "" });
    mutationKeys.current.delete("template-dialog");
    setError(null);
    setDialog("template");
  };

  const openVersion = (item: PortalDocumentTemplateVersion) => {
    setVersionTarget(item);
    setVersionFields({ label: item.version_label, format: item.output_format, pageSize: item.page_size, orientation: item.page_orientation.toLowerCase() });
    mutationKeys.current.delete("version-dialog");
    setError(null);
    setDialog("version");
  };

  const loadVersions = (template: PortalDocumentTemplate) => {
    if (expandedTemplate === template.stable_key) {
      setExpandedTemplate(null);
      return;
    }
    setExpandedTemplate(template.stable_key);
    if (versions[template.stable_key]?.kind === "ready") return;
    setVersions((current) => ({ ...current, [template.stable_key]: { kind: "loading" } }));
    getGuidanceTemplateVersions(template)
      .then((page) => setVersions((current) => ({ ...current, [template.stable_key]: { kind: "ready", value: page.items, total: page.total, page: page.page } })))
      .catch((cause) => setVersions((current) => ({ ...current, [template.stable_key]: { kind: "error", error: cause instanceof GuidanceSettingsApiError && cause.kind === "permission" ? "permission" : "unavailable" } })));
  };

  const downloadBrand = async (item: PortalBrandAsset) => {
    setBusy(`brand-download-${item.semantic_role}`);
    setError(null);
    try {
      const blob = await downloadGuidanceBrandAsset(item);
      const url = URL.createObjectURL(blob);
      try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `brand-${item.semantic_role.toLowerCase()}`;
        anchor.click();
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(null);
    }
  };

  const inspectPreflight = async (version: PortalDocumentTemplateVersion) => {
    setBusy(`template-preflight-${version.version_label}`);
    setError(null);
    try {
      const result = await getGuidanceTemplatePreflight(version);
      setPreflight({ version, ...result });
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(null);
    }
  };

  const submitDialog = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dialog) return;
    const fingerprint = JSON.stringify({ dialog, brandTarget, templateTarget, versionTarget, brandFields, templateFields, versionFields });
    const keyName = `${dialog}-dialog`;
    const existing = mutationKeys.current.get(keyName);
    const key = existing?.fingerprint === fingerprint ? existing.key : createIdempotencyKey();
    mutationKeys.current.set(keyName, { fingerprint, key });
    setBusy(keyName);
    setError(null);
    try {
      if (dialog === "brand") {
        if (!brandTarget && !brandFields.file) throw new GuidanceSettingsApiError("validation");
        const payload = {
          alt_text: brandFields.altText,
          asset_type: brandFields.assetType,
          background_variant: brandFields.backgroundVariant,
          display_order: 0,
          file: brandFields.file ?? undefined,
          owner_type: brandFields.ownerType,
          placement: brandFields.placement,
          semantic_role: brandFields.semanticRole,
          version_label: brandFields.version,
          effective_from: brandFields.effectiveFrom || null,
          effective_until: brandFields.effectiveUntil || null,
        };
        if (brandTarget) await updateGuidanceBrandAsset(brandTarget, payload, key);
        else await createGuidanceBrandAsset({ ...payload, file: brandFields.file as File }, key);
      }
      if (dialog === "template") {
        const payload = { stable_key: templateFields.key, display_name: templateFields.name, document_kind: templateFields.kind, default_output_format: templateFields.format, retention_classification: templateFields.retention, description: templateFields.description };
        if (templateTarget) await updateGuidanceDocumentTemplate(templateTarget, payload, key);
        else await createGuidanceDocumentTemplate(payload, key);
      }
      if (dialog === "version" && versionTarget) {
        await updateGuidanceTemplateVersion(versionTarget, { version_label: versionFields.label, output_format: versionFields.format, page_size: versionFields.pageSize, page_orientation: versionFields.orientation }, key);
      }
      mutationKeys.current.delete(keyName);
      setDialog(null);
      setBrandTarget(null);
      setTemplateTarget(null);
      setVersionTarget(null);
      reload();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(null);
    }
  };

  const dialogTitle = dialog === "brand" ? (brandTarget ? "Edit branding asset" : "New branding asset") : dialog === "template" ? (templateTarget ? "Edit document template" : "New document template") : "Edit template version";

  return (
    <div className="portal-counseling__stack">
      {error ? <p className="portal-counseling__inline-error" role="alert">{error}</p> : null}
      {canBranding ? (
        <PortalCollectionFrame aria-labelledby="guidance-branding-heading" className="portal-counseling__frame">
          <FrameHeading count={brands.kind === "ready" ? brands.value.length : 0} kicker="Institution & documents" newLabel="New branding asset" onNew={() => openBrand()} title="Branding assets" />
          {brands.kind === "loading" ? <><Skeleton as="span" /><Skeleton as="span" /></> : brands.kind === "error" ? <StateBlock retry={reload} title="Branding assets are temporarily unavailable." /> : brands.value.length === 0 ? <p>No branding assets are available.</p> : (
            <div className="portal-counseling__table-wrap"><table className="portal-counseling__table"><thead><tr><th scope="col">Asset</th><th scope="col">Placement</th><th scope="col">Owner</th><th scope="col">Status</th><th scope="col">Version</th><th scope="col">Effective dates</th><th scope="col">Actions</th></tr></thead><tbody>
              {brands.value.map((item) => <tr key={`${item.semantic_role}-${item.version_label}`}><Cell label="Asset"><strong>{label(item.semantic_role)}</strong><span>{label(item.asset_type)}</span></Cell><Cell label="Placement">{label(item.placement)}</Cell><Cell label="Owner">{label(item.owner_type)}</Cell><Cell label="Status"><Badge>{label(item.status)}</Badge></Cell><Cell label="Version">{item.version_label || "Not recorded"}</Cell><Cell label="Effective dates">{formatDate(item.effective_from)} – {formatDate(item.effective_until)}</Cell><Cell label="Actions"><div className="portal-counseling__row-actions"><ActionButton disabled={busy !== null} label="Edit" onClick={() => openBrand(item)} /><ActionButton disabled={busy !== null} label="Preview / download" onClick={() => void downloadBrand(item)} />{item.status === "DRAFT" || item.status === "PROVISIONAL" ? <ActionButton disabled={busy !== null} label="Activate" onClick={() => void mutate(`brand-activate-${item.semantic_role}`, (key) => brandAssetLifecycle(item, "activate", { expected_status: item.status }, key))} /> : null}{item.status === "ACTIVE" ? <ActionButton disabled={busy !== null} label="Retire" onClick={() => void mutate(`brand-retire-${item.semantic_role}`, (key) => brandAssetLifecycle(item, "retire", { expected_status: item.status }, key))} /> : null}{item.status !== "ARCHIVED" ? <ActionButton disabled={busy !== null} label="Archive" onClick={() => void mutate(`brand-archive-${item.semantic_role}`, (key) => brandAssetLifecycle(item, "archive", { expected_status: item.status }, key))} /> : null}</div></Cell></tr>)}
            </tbody></table></div>
          )}
        </PortalCollectionFrame>
      ) : null}

      {canTemplates ? (
        <PortalCollectionFrame aria-labelledby="guidance-templates-heading" className="portal-counseling__frame">
          <FrameHeading count={templates.kind === "ready" ? templates.value.length : 0} kicker="Institution & documents" newLabel="New template family" onNew={() => openTemplate()} title="Document templates" />
          {templates.kind === "loading" ? <><Skeleton as="span" /><Skeleton as="span" /></> : templates.kind === "error" ? <StateBlock retry={reload} title="Document templates are temporarily unavailable." /> : templates.value.length === 0 ? <p>No document templates are available.</p> : (
            <div className="portal-counseling__table-wrap"><table className="portal-counseling__table"><thead><tr><th scope="col">Template</th><th scope="col">Kind / format</th><th scope="col">Retention</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody>
              {templates.value.map((item) => { const versionState = versions[item.stable_key]; return <tr key={item.stable_key}><Cell label="Template"><strong>{item.display_name}</strong><span>{item.stable_key}</span></Cell><Cell label="Kind / format">{label(item.document_kind)} · {label(item.default_output_format)}</Cell><Cell label="Retention">{label(item.retention_classification)}</Cell><Cell label="Status"><Badge>{label(item.status)}</Badge></Cell><Cell label="Actions"><div className="portal-counseling__row-actions"><ActionButton disabled={busy !== null} label={expandedTemplate === item.stable_key ? "Hide versions" : "Show versions"} onClick={() => loadVersions(item)} /><ActionButton disabled={busy !== null} label="Edit" onClick={() => openTemplate(item)} />{item.status === "DRAFT" ? <ActionButton disabled={busy !== null} label="Activate" onClick={() => void mutate(`template-activate-${item.stable_key}`, (key) => documentTemplateLifecycle(item, "activate", { expected_status: item.status }, key))} /> : null}{item.status === "ACTIVE" ? <ActionButton disabled={busy !== null} label="Retire" onClick={() => void mutate(`template-retire-${item.stable_key}`, (key) => documentTemplateLifecycle(item, "retire", { expected_status: item.status }, key))} /> : null}{item.status !== "ARCHIVED" ? <ActionButton disabled={busy !== null} label="Archive" onClick={() => void mutate(`template-archive-${item.stable_key}`, (key) => documentTemplateLifecycle(item, "archive", { expected_status: item.status }, key))} /> : null}</div>{expandedTemplate === item.stable_key ? <div className="portal-counseling__expanded-panel">{!versionState || versionState.kind === "loading" ? <p>Loading template versions…</p> : versionState.kind === "error" ? <StateBlock title="Template versions are temporarily unavailable." /> : versionState.value.length === 0 ? <p>No versions are available.</p> : <ul>{versionState.value.map((version) => <li key={`${version.version_label}-${version.status}`}><span><strong>{version.version_label}</strong> · {label(version.status)}{version.is_used ? " · In use" : ""}</span><span className="portal-counseling__row-actions"><ActionButton disabled={busy !== null} label="Edit" onClick={() => openVersion(version)} /><ActionButton disabled={busy !== null} label="Preflight" onClick={() => void inspectPreflight(version)} />{version.status === "DRAFT" ? <ActionButton disabled={busy !== null} label="Activate" onClick={() => void mutate(`version-activate-${version.version_label}`, (key) => templateVersionLifecycle(version, "activate", { expected_status: version.status }, key))} /> : null}{version.status === "ACTIVE" || version.status === "RETIRED" ? <ActionButton disabled={busy !== null} label="Clone" onClick={() => void mutate(`version-clone-${version.version_label}`, (key) => templateVersionLifecycle(version, "clone", { expected_status: version.status }, key))} /> : null}{version.status === "ACTIVE" ? <ActionButton disabled={busy !== null} label="Retire" onClick={() => void mutate(`version-retire-${version.version_label}`, (key) => templateVersionLifecycle(version, "retire", { expected_status: version.status }, key))} /> : null}{version.status !== "ARCHIVED" ? <ActionButton disabled={busy !== null} label="Archive" onClick={() => void mutate(`version-archive-${version.version_label}`, (key) => templateVersionLifecycle(version, "archive", { expected_status: version.status }, key))} /> : null}</span></li>)}</ul>}</div> : null}</Cell></tr>; })}
            </tbody></table></div>
          )}
        </PortalCollectionFrame>
      ) : null}

      {preflight ? <PortalCollectionFrame className="portal-counseling__frame"><div className="portal-counseling__frame-heading"><div><p className="portal-counseling__kicker">Template activation preflight</p><h2>{preflight.version.version_label}</h2></div><Badge>{preflight.ready ? "Ready" : "Blocked"}</Badge></div>{preflight.blockers.length ? <ul>{preflight.blockers.map((blocker) => <li key={blocker}>{label(blocker)}</li>)}</ul> : <p>This version passed the current activation checks.</p>}</PortalCollectionFrame> : null}

      <AlertDialog onOpenChange={(open) => { if (!open && busy === null) { mutationKeys.current.delete("brand-dialog"); mutationKeys.current.delete("template-dialog"); mutationKeys.current.delete("version-dialog"); setDialog(null); setBrandTarget(null); setTemplateTarget(null); setVersionTarget(null); setError(null); } }} open={dialog !== null}>
        <AlertDialogContent className="portal-counseling__dialog"><AlertDialogHeader><AlertDialogTitle>{dialogTitle}</AlertDialogTitle><AlertDialogDescription>Keep governance metadata bounded. Source files and renderer details remain backend-owned.</AlertDialogDescription></AlertDialogHeader><form onSubmit={submitDialog}><div className="portal-counseling__dialog-fields">
          {dialog === "brand" ? <><Label>Asset type<select required value={brandFields.assetType} onChange={(event) => setBrandFields((value) => ({ ...value, assetType: event.target.value }))}>{ASSET_TYPE_OPTIONS.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></Label><Label>Semantic role<select required value={brandFields.semanticRole} onChange={(event) => setBrandFields((value) => ({ ...value, semanticRole: event.target.value }))}>{ASSET_ROLE_OPTIONS.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></Label><Label>Placement<select value={brandFields.placement} onChange={(event) => setBrandFields((value) => ({ ...value, placement: event.target.value }))}>{ASSET_PLACEMENT_OPTIONS.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></Label><Label>Owner<select required value={brandFields.ownerType} onChange={(event) => setBrandFields((value) => ({ ...value, ownerType: event.target.value }))}>{ASSET_OWNER_OPTIONS.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></Label><Label>Background<select required value={brandFields.backgroundVariant} onChange={(event) => setBrandFields((value) => ({ ...value, backgroundVariant: event.target.value }))}>{BACKGROUND_OPTIONS.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></Label><Label>Alternative text<Input required value={brandFields.altText} onChange={(event) => setBrandFields((value) => ({ ...value, altText: event.target.value }))} /></Label><Label>Version label<Input value={brandFields.version} onChange={(event) => setBrandFields((value) => ({ ...value, version: event.target.value }))} /></Label><Label>Effective from<Input type="date" value={brandFields.effectiveFrom} onChange={(event) => setBrandFields((value) => ({ ...value, effectiveFrom: event.target.value }))} /></Label><Label>Effective until<Input type="date" value={brandFields.effectiveUntil} onChange={(event) => setBrandFields((value) => ({ ...value, effectiveUntil: event.target.value }))} /></Label><Label>Image file<Input accept="image/png,image/jpeg,image/webp" required={!brandTarget} type="file" onChange={(event) => setBrandFields((value) => ({ ...value, file: event.target.files?.[0] ?? null }))} /></Label></> : null}
          {dialog === "template" ? <><Label>Stable key<Input required value={templateFields.key} onChange={(event) => setTemplateFields((value) => ({ ...value, key: event.target.value }))} /></Label><Label>Display name<Input required value={templateFields.name} onChange={(event) => setTemplateFields((value) => ({ ...value, name: event.target.value }))} /></Label><Label>Document kind<select required value={templateFields.kind} onChange={(event) => setTemplateFields((value) => ({ ...value, kind: event.target.value }))}>{DOCUMENT_KIND_OPTIONS.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></Label><Label>Output format<select required value={templateFields.format} onChange={(event) => setTemplateFields((value) => ({ ...value, format: event.target.value }))}>{OUTPUT_FORMAT_OPTIONS.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></Label><Label>Retention classification<select value={templateFields.retention} onChange={(event) => setTemplateFields((value) => ({ ...value, retention: event.target.value }))}>{RETENTION_OPTIONS.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></Label><Label>Description<Input value={templateFields.description} onChange={(event) => setTemplateFields((value) => ({ ...value, description: event.target.value }))} /></Label></> : null}
          {dialog === "version" ? <><Label>Version label<Input required value={versionFields.label} onChange={(event) => setVersionFields((value) => ({ ...value, label: event.target.value }))} /></Label><Label>Output format<select required value={versionFields.format} onChange={(event) => setVersionFields((value) => ({ ...value, format: event.target.value }))}>{OUTPUT_FORMAT_OPTIONS.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></Label><Label>Page size<select required value={versionFields.pageSize} onChange={(event) => setVersionFields((value) => ({ ...value, pageSize: event.target.value }))}>{PAGE_SIZE_OPTIONS.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></Label><Label>Page orientation<select required value={versionFields.orientation} onChange={(event) => setVersionFields((value) => ({ ...value, orientation: event.target.value }))}>{PAGE_ORIENTATION_OPTIONS.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></Label></> : null}
        </div><AlertDialogFooter><AlertDialogCancel disabled={busy !== null}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy !== null} type="submit">{busy !== null ? "Saving…" : "Save draft"}</AlertDialogAction></AlertDialogFooter></form></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type CoverageProps = { onChanged?: () => void };

export function GuidanceCounselorCoverage({ onChanged }: CoverageProps) {
  const [data, setData] = useState<LoadState<PortalCounselorCoverage[]>>({ kind: "loading" });
  const [options, setOptions] = useState<LoadState<PortalCounselorOption[]>>({ kind: "ready", value: [], total: 0, page: 1 });
  const [dialog, setDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<PortalCounselorCoverage | null>(null);
  const [selectedCounselor, setSelectedCounselor] = useState("");
  const [filterFields, setFilterFields] = useState({ q: "", state: "", order: "recent" as "recent" | "oldest", campus: "", college: "", department: "", program: "" });
  const [fields, setFields] = useState({ campus: "", college: "", department: "", program: "", starts: "", ends: "", primary: true });
  const [applied, setApplied] = useState<GuidanceCoverageFilters>({ order: "recent" });
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const mutationKeys = useRef(new Map<string, { fingerprint: string; key: IdempotencyKey }>());

  const reload = () => setReloadKey((value) => value + 1);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return;
      setData({ kind: "loading" });
      return getGuidanceCoverage(applied, page, controller.signal)
        .then((result) => setData({ kind: "ready", value: result.items, total: result.total, page: result.page }))
        .catch((cause) => { if (!controller.signal.aborted) setData({ kind: "error", error: cause instanceof GuidanceSettingsApiError && cause.kind === "permission" ? "permission" : "unavailable" }); });
    });
    return () => controller.abort();
  }, [applied, page, reloadKey]);

  const mutate = async (name: string, operation: (key: IdempotencyKey) => Promise<unknown>) => {
    const existing = mutationKeys.current.get(name);
    const key = existing?.key ?? createIdempotencyKey();
    mutationKeys.current.set(name, { fingerprint: name, key });
    setBusy(name);
    setError(null);
    try { await operation(key); mutationKeys.current.delete(name); reload(); onChanged?.(); } catch (cause) { setError(errorText(cause)); } finally { setBusy(null); }
  };

  const openNew = () => {
    setEditTarget(null); setSelectedCounselor(""); setFields((value) => ({ ...value, campus: "", college: "", department: "", program: "", starts: "", ends: "", primary: true })); setError(null); mutationKeys.current.delete("coverage-dialog"); setDialog(true);
    setOptions({ kind: "loading" });
    getGuidanceCounselorOptions()
      .then((result) => setOptions({ kind: "ready", value: result.items, total: result.total, page: result.page }))
      .catch((cause) => setOptions({ kind: "error", error: cause instanceof GuidanceSettingsApiError && cause.kind === "permission" ? "permission" : "unavailable" }));
  };

  const openEdit = (item: PortalCounselorCoverage) => {
    setEditTarget(item); setFields((value) => ({ ...value, campus: item.campus ?? "", college: item.college ?? "", department: item.department ?? "", program: item.program ?? "", starts: item.starts_at.slice(0, 10), ends: item.ends_at?.slice(0, 10) ?? "", primary: item.is_primary })); setError(null); mutationKeys.current.delete("coverage-dialog"); setDialog(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const option = options.kind === "ready" ? options.value[Number(selectedCounselor)] : undefined;
    if (!editTarget && !option) { setError("Select an active counselor."); return; }
    if (!fields.starts) { setError("A start date is required."); return; }
    const payload = { campus: fields.campus || null, college: fields.college || null, department: fields.department || null, program: fields.program || null, starts_at: fields.starts, ends_at: fields.ends || null, is_primary: fields.primary };
    const fingerprint = JSON.stringify({ editTarget, option, payload });
    const existing = mutationKeys.current.get("coverage-dialog");
    const key = existing?.fingerprint === fingerprint ? existing.key : createIdempotencyKey();
    mutationKeys.current.set("coverage-dialog", { fingerprint, key });
    setBusy("coverage-dialog"); setError(null);
    try {
      if (editTarget) await updateGuidanceCoverage(editTarget, { ...payload, expected_updated_at: editTarget.updated_at }, key);
      else await createGuidanceCoverage(option as PortalCounselorOption, payload, key);
      mutationKeys.current.delete("coverage-dialog"); setDialog(false); reload(); onChanged?.();
    } catch (cause) { setError(errorText(cause)); } finally { setBusy(null); }
  };

  const applyFilters = () => { setPage(1); setApplied({ q: filterFields.q.trim() || undefined, state: filterFields.state || undefined, campus: filterFields.campus.trim() || undefined, college: filterFields.college.trim() || undefined, department: filterFields.department.trim() || undefined, program: filterFields.program.trim() || undefined, order: filterFields.order }); };
  const totalPages = data.kind === "ready" && data.total ? Math.ceil(data.total / 20) : 1;

  return (
    <div className="portal-counseling__stack">
      {error ? <p className="portal-counseling__inline-error" role="alert">{error}</p> : null}
      <PortalCollectionFrame className="portal-counseling__frame">
        <FrameHeading count={data.kind === "ready" ? data.total ?? data.value.length : 0} kicker="Guidance settings" newLabel="New coverage rule" onNew={openNew} title="Counselor coverage" />
        <div className="portal-counseling__filter-grid"><Label>Search counselor<Input value={filterFields.q} onChange={(event) => setFilterFields((value) => ({ ...value, q: event.target.value }))} /></Label><Label>State<select value={filterFields.state} onChange={(event) => setFilterFields((value) => ({ ...value, state: event.target.value }))}><option value="">All states</option><option value="ACTIVE">Active</option><option value="SCHEDULED">Scheduled</option><option value="EXPIRED">Expired</option><option value="INACTIVE">Inactive</option></select></Label><Label>Campus<Input value={filterFields.campus} onChange={(event) => setFilterFields((value) => ({ ...value, campus: event.target.value }))} /></Label><Label>College<Input value={filterFields.college} onChange={(event) => setFilterFields((value) => ({ ...value, college: event.target.value }))} /></Label><Label>Department<Input value={filterFields.department} onChange={(event) => setFilterFields((value) => ({ ...value, department: event.target.value }))} /></Label><Label>Program<Input value={filterFields.program} onChange={(event) => setFilterFields((value) => ({ ...value, program: event.target.value }))} /></Label><Label>Order<select value={filterFields.order} onChange={(event) => setFilterFields((value) => ({ ...value, order: event.target.value as "recent" | "oldest" }))}><option value="recent">Recently updated</option><option value="oldest">Oldest updated</option></select></Label><Button onClick={applyFilters} size="sm" type="button">Apply filters</Button></div>
        {data.kind === "loading" ? <><Skeleton as="span" /><Skeleton as="span" /></> : data.kind === "error" ? <StateBlock retry={reload} title="Counselor coverage is temporarily unavailable." /> : data.value.length === 0 ? <p>No counselor coverage rules match this view.</p> : <div className="portal-counseling__table-wrap"><table className="portal-counseling__table"><thead><tr><th scope="col">Counselor</th><th scope="col">Scope</th><th scope="col">State</th><th scope="col">Start date</th><th scope="col">End date</th><th scope="col">Primary</th><th scope="col">Updated</th><th scope="col">Actions</th></tr></thead><tbody>{data.value.map((item) => <tr key={`${item.counselor_display_name}-${item.starts_at}-${item.updated_at}`}><Cell label="Counselor">{item.counselor_display_name}</Cell><Cell label="Scope">{item.scope_label}</Cell><Cell label="State"><Badge>{label(item.state)}</Badge></Cell><Cell label="Start date">{formatDate(item.starts_at)}</Cell><Cell label="End date">{formatDate(item.ends_at)}</Cell><Cell label="Primary">{item.is_primary ? "Yes" : "No"}</Cell><Cell label="Updated">{formatDate(item.updated_at)}</Cell><Cell label="Actions"><div className="portal-counseling__row-actions">{item.is_active ? <ActionButton disabled={busy !== null} label="Edit" onClick={() => openEdit(item)} /> : null}{item.is_active ? <ActionButton disabled={busy !== null} label="Deactivate" onClick={() => void mutate(`coverage-deactivate-${item.counselor_display_name}-${item.starts_at}`, (key) => deactivateGuidanceCoverage(item, { expected_updated_at: item.updated_at }, key))} /> : null}</div></Cell></tr>)}</tbody></table></div>}
        {totalPages > 1 ? <div className="portal-counseling__pagination"><Button disabled={page <= 1 || busy !== null} onClick={() => setPage((value) => value - 1)} size="sm" type="button" variant="outline">Previous</Button><span>Page {page} of {totalPages}</span><Button disabled={page >= totalPages || busy !== null} onClick={() => setPage((value) => value + 1)} size="sm" type="button" variant="outline">Next</Button></div> : null}
      </PortalCollectionFrame>

      <AlertDialog onOpenChange={(open) => { if (!open && busy === null) { mutationKeys.current.delete("coverage-dialog"); setDialog(false); setEditTarget(null); setError(null); } }} open={dialog}>
        <AlertDialogContent className="portal-counseling__dialog"><AlertDialogHeader><AlertDialogTitle>{editTarget ? "Edit counselor coverage" : "New counselor coverage"}</AlertDialogTitle><AlertDialogDescription>Coverage defines organizational scope. It does not assign individual records.</AlertDialogDescription></AlertDialogHeader><form onSubmit={submit}><div className="portal-counseling__dialog-fields">
          {!editTarget ? <Label>Counselor<select required value={selectedCounselor} onChange={(event) => setSelectedCounselor(event.target.value)}><option value="">Select a counselor</option>{options.kind === "ready" ? options.value.map((option, index) => <option key={option.display_name} value={index}>{option.display_name}</option>) : null}</select></Label> : <p><strong>Counselor:</strong> {editTarget.counselor_display_name}</p>}
          <Label>Campus (optional)<Input value={fields.campus} onChange={(event) => setFields((value) => ({ ...value, campus: event.target.value }))} /></Label><Label>College (optional)<Input value={fields.college} onChange={(event) => setFields((value) => ({ ...value, college: event.target.value }))} /></Label><Label>Department (optional)<Input value={fields.department} onChange={(event) => setFields((value) => ({ ...value, department: event.target.value }))} /></Label><Label>Program (optional)<Input value={fields.program} onChange={(event) => setFields((value) => ({ ...value, program: event.target.value }))} /></Label><Label>Start date<Input required type="date" value={fields.starts} onChange={(event) => setFields((value) => ({ ...value, starts: event.target.value }))} /></Label><Label>End date (optional)<Input type="date" value={fields.ends} onChange={(event) => setFields((value) => ({ ...value, ends: event.target.value }))} /></Label><Label><input checked={fields.primary} onChange={(event) => setFields((value) => ({ ...value, primary: event.target.checked }))} type="checkbox" /> Primary coverage</Label>
        </div><AlertDialogFooter><AlertDialogCancel disabled={busy !== null}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy !== null || options.kind === "loading"} type="submit">{busy !== null ? "Saving…" : editTarget ? "Save changes" : "Create coverage"}</AlertDialogAction></AlertDialogFooter></form></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
