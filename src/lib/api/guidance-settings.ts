import {
  authorityCoverageCreate,
  authorityCoverageDeactivate,
  authorityCoverageList,
  authorityCoverageOptions,
  authorityCoverageUpdate,
  workflowAccessCreate,
  workflowAccessList,
  workflowAccessOptions,
  workflowAccessRevoke,
} from "@/lib/api/generated/authority/authority";
import {
  appointmentsAvailabilityCreate,
  appointmentsAvailabilityDeactivate,
  appointmentsAvailabilityList,
  appointmentsAvailabilityOptions,
  appointmentsAvailabilityUpdate,
  appointmentsOfficeClosureCreate,
  appointmentsOfficeClosureDeactivate,
  appointmentsOfficeClosureUpdate,
  appointmentsOfficeClosures,
  appointmentsScheduleChange,
  appointmentsScheduleChangePreview,
} from "@/lib/api/generated/appointments/appointments";
import {
  assessmentsGovernanceInstrumentActivate,
  assessmentsGovernanceInstrumentDeactivate,
  assessmentsGovernanceInstrumentCreate,
  assessmentsGovernanceInstrumentUpdate,
  assessmentsGovernanceInstrumentsList,
} from "@/lib/api/generated/assessments/assessments";
import {
  organizationsAcademicTermActivate,
  organizationsAcademicTermApprove,
  organizationsAcademicTermArchive,
  organizationsAcademicTermClose,
  organizationsAcademicTermCreate,
  organizationsAcademicTermRollback,
  organizationsAcademicTermRolloverPreview,
  organizationsAcademicTermSubmit,
  organizationsAcademicTermUpdate,
  organizationsAcademicTermsList,
  organizationsBrandAssetActivate,
  organizationsBrandAssetArchive,
  organizationsBrandAssetCreate,
  organizationsBrandAssetDownload,
  organizationsBrandAssetsList,
  organizationsBrandAssetRetire,
  organizationsBrandAssetUpdate,
  organizationsDocumentTemplateActivate,
  organizationsDocumentTemplateArchive,
  organizationsDocumentTemplateCreate,
  organizationsDocumentTemplateRetire,
  organizationsDocumentTemplatesList,
  organizationsDocumentTemplateUpdate,
  organizationsDocumentTemplateVersionActivate,
  organizationsDocumentTemplateVersionActivationPreflight,
  organizationsDocumentTemplateVersionArchive,
  organizationsDocumentTemplateVersionClone,
  organizationsDocumentTemplateVersionDetail,
  organizationsDocumentTemplateVersionRetire,
  organizationsDocumentTemplateVersionUpdate,
  organizationsDocumentTemplateVersionsList,
  organizationsFormFamiliesList,
  organizationsFormFamilyActivate,
  organizationsFormFamilyArchive,
  organizationsFormFamilyCreate,
  organizationsFormFamilyRetire,
  organizationsFormFamilyUpdate,
  organizationsFormRevisionsList,
  organizationsFormRevisionActivationPreflight,
  organizationsFormRevisionActivate,
  organizationsFormRevisionApprove,
  organizationsFormRevisionArchive,
  organizationsFormRevisionClone,
  organizationsFormRevisionCreate,
  organizationsFormRevisionRetire,
  organizationsFormRevisionSourceDownload,
  organizationsFormRevisionSourceUpload,
  organizationsFormRevisionSubmit,
  organizationsFormRevisionUpdate,
  organizationsInstitutionProfilesList,
  organizationsInstitutionProfileActivate,
  organizationsInstitutionProfileArchive,
  organizationsInstitutionProfileCreate,
  organizationsInstitutionProfileRetire,
  organizationsInstitutionProfileUpdate,
  organizationsOfficesList,
  organizationsOfficeActivate,
  organizationsOfficeArchive,
  organizationsOfficeCreate,
  organizationsOfficeRetire,
  organizationsOfficeUpdate,
} from "@/lib/api/generated/organizations/organizations";
import type {
  AssessmentInstrumentGovernanceCreateSchema,
  AssessmentInstrumentGovernanceLifecycleSchema,
  AssessmentInstrumentGovernanceUpdateSchema,
  AppointmentsAvailabilityListParams,
  AppointmentsOfficeClosuresParams,
  CoverageCreateSchema,
  CoverageDeactivateSchema,
  CoverageUpdateSchema,
  DocumentTemplateActivationPreflightSchema,
  DocumentTemplateSchema,
  DocumentTemplateVersionUpdateSchema,
  FamilySchema,
  FormRevisionActivationPreflightSchema,
  InstitutionSchema,
  LifecycleSchema,
  OfficeSchema,
  OrganizationsFormRevisionSourceUploadBody,
  OrganizationsBrandAssetCreateBody,
  OrganizationsBrandAssetUpdateBody,
  RollbackSchema,
  ScheduleChangeSchema,
  WorkflowAccessCreateSchema,
  WorkflowAccessListParams,
  WorkflowAccessRevokeSchema,
  TermSchema,
} from "@/lib/api/generated/model";
import { cookieSessionMutationOptions, cookieSessionReadOptions } from "@/lib/api/auth";
import { withIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";

export const GUIDANCE_PAGE_SIZE = 20;

export type GuidanceSettingsApiErrorKind = "conflict" | "permission" | "rate_limited" | "unavailable" | "validation";

export class GuidanceSettingsApiError extends Error {
  readonly kind: GuidanceSettingsApiErrorKind;

  constructor(kind: GuidanceSettingsApiErrorKind) {
    super("The Guidance settings request could not be completed.");
    this.name = "GuidanceSettingsApiError";
    this.kind = kind;
  }
}

type GeneratedResponse = { data: unknown; status: number };
type SafePage<T> = { items: T[]; page: number; page_size: number; total: number };

export type PortalAcademicTerm = {
  academic_year: string;
  semester: string;
  start_date: string;
  end_date: string;
  status: string;
  is_current: boolean;
  configuration_identifier: string;
  approved_at: string | null;
  activated_at: string | null;
  closed_at: string | null;
};

export type PortalInstitutionProfile = {
  legal_name: string;
  short_name: string;
  address: string;
  main_campus: string;
  primary_brand_color: string;
  secondary_brand_color: string;
  accent_brand_color: string;
  version_label: string;
  status: string;
  effective_from: string | null;
  effective_until: string | null;
  former_name: string;
  former_short_name: string;
  source_note: string;
  activated_at: string | null;
  retired_at: string | null;
};

export type PortalOfficeProfile = {
  office_name: string;
  office_short_name: string;
  document_header_name: string;
  office_address: string;
  office_hours: string;
  contact_email: string;
  contact_number: string;
  version_label: string;
  status: string;
  effective_from: string | null;
  effective_until: string | null;
  legacy_office_name: string;
  default_signatory_name: string;
  default_signatory_title: string;
  footer_note: string;
  source_note: string;
  activated_at: string | null;
  retired_at: string | null;
};

export type PortalBrandAsset = {
  asset_type: string;
  semantic_role: string;
  placement: string;
  owner_type: string;
  background_variant: string;
  status: string;
  version_label: string;
  usage_context: string;
  alt_text: string;
  display_order: number;
  effective_from: string | null;
  effective_until: string | null;
  content_type: string;
  image_width: number | null;
  image_height: number | null;
};

export type PortalDocumentTemplate = {
  stable_key: string;
  display_name: string;
  document_kind: string;
  default_output_format: string;
  retention_classification: string;
  description: string;
  related_form_family_label: string;
  owner_office_label: string;
  status: string;
};

export type PortalDocumentTemplateVersion = {
  template_stable_key: string;
  version_label: string;
  output_format: string;
  page_size: string;
  page_orientation: string;
  status: string;
  is_used: boolean;
  related_form_revision_label: string;
  approved_at: string | null;
  retired_at: string | null;
};

export type PortalCounselorCoverage = {
  counselor_display_name: string;
  scope_label: string;
  campus: string | null;
  college: string | null;
  department: string | null;
  program: string | null;
  is_primary: boolean;
  state: string;
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
  updated_at: string;
};

export type PortalCounselorOption = {
  display_name: string;
};

export type PortalWorkflowAccess = {
  grant_reference: string;
  grantee_display_name: string;
  grantee_role: string;
  capability: string;
  capability_label: string;
  scope_mode: string;
  scope_mode_label: string;
  scope_label: string;
  valid_from: string;
  valid_until: string | null;
  status: string;
  status_label: string;
  grant_reason_code: string;
  grant_reason_label: string;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
};

export type PortalWorkflowChoice = { value: string; label: string };

export type PortalWorkflowCapabilityOption = PortalWorkflowChoice & {
  eligible_roles: string[];
  scope_modes: string[];
  scope_mode_labels: string[];
  office_wide_grant_allowed: boolean;
  expiry_required: boolean;
};

export type PortalWorkflowGranteeOption = {
  display_name: string;
  role: string;
  role_label: string;
};

export type PortalWorkflowAccessOptions = {
  grantees: PortalWorkflowGranteeOption[];
  capabilities: PortalWorkflowCapabilityOption[];
  scope_modes: PortalWorkflowChoice[];
  grant_reasons: PortalWorkflowChoice[];
  revocation_reasons: PortalWorkflowChoice[];
};

export type GuidanceWorkflowAccessFilters = {
  q?: string;
  capability?: string;
  scope_mode?: string;
  status?: string;
  role?: string;
  order?: "recent" | "oldest";
};

export type PortalScheduleRecord = {
  public_reference: string;
  kind: "availability_rule" | "unavailable_block";
  counselor_display_name: string;
  day_of_week: number | null;
  day_label: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  mode: string | null;
  location: string | null;
  slot_duration_minutes: number | null;
  max_appointments_per_slot: number | null;
  is_all_day: boolean | null;
  effective_from: string | null;
  effective_until: string | null;
  is_active: boolean;
  state: string;
  state_label: string;
  updated_at: string;
};

export type PortalScheduleCounselorOption = { display_name: string };
export type PortalScheduleChoice = { value: string; label: string };

export type PortalScheduleOptions = {
  counselors: PortalScheduleCounselorOption[];
  days: PortalScheduleChoice[];
  modes: PortalScheduleChoice[];
  states: PortalScheduleChoice[];
};

export type PortalOfficeClosure = {
  public_reference: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  reason: string;
  is_active: boolean;
  state: string;
  state_label: string;
  updated_at: string | null;
};

export type GuidanceScheduleFilters = {
  kind?: "availability_rule" | "unavailable_block";
  q?: string;
  state?: string;
  date_from?: string;
  date_to?: string;
  order?: "recent" | "oldest";
};

export type GuidanceOfficeClosureFilters = {
  state?: string;
  date_from?: string;
  date_to?: string;
  order?: "recent" | "oldest";
};

export type PortalSchedulePreview = {
  affected_outcome: string;
  fingerprint: string;
  kind: string;
  operation: string;
  pending_count: number;
  record_reference: string;
  record_state: string;
  scheduled_count: number;
};

export type GuidanceScheduleMutationFields = Omit<
  ScheduleChangeSchema,
  "request_key" | "counselor" | "counselor_selection_token"
> & {
  counselor?: PortalScheduleCounselorOption | null;
};

export type GuidanceCoverageFilters = {
  q?: string;
  state?: string;
  campus?: string;
  college?: string;
  department?: string;
  program?: string;
  order?: "recent" | "oldest";
};

export type PortalFormFamily = {
  stable_key: string;
  display_name: string;
  description: string;
  status: string;
};

export type PortalFormRevision = {
  form_family_key: string;
  official_form_code: string;
  official_revision: string;
  display_title: string;
  status: string;
  effective_from: string | null;
  effective_until: string | null;
  is_used: boolean;
  internal_schema_version: string;
  internal_template_version: string;
  source_label: string;
  approved_at: string | null;
  submitted_at: string | null;
  activated_at: string | null;
  retired_at: string | null;
  has_source: boolean;
};

export type PortalAssessmentInstrument = {
  key: string;
  title: string;
  category: string;
  official_source_reference: string;
  has_official_scoring_guide: boolean;
  allows_scores: boolean;
  allows_interpretation: boolean;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type RolloverPreview = {
  academic_year: string;
  semester: string;
  prior_term: string;
  providers: Array<{ key: string; status: string; count: number; reason_code: string | null }>;
  rollback: { status: string; condition: string; reference: string };
};

export type RevisionPreflight = FormRevisionActivationPreflightSchema;

const termKeys = new WeakMap<PortalAcademicTerm, number>();
const institutionKeys = new WeakMap<PortalInstitutionProfile, number>();
const officeKeys = new WeakMap<PortalOfficeProfile, number>();
const familyKeys = new WeakMap<PortalFormFamily, number>();
const revisionKeys = new WeakMap<PortalFormRevision, number>();
const brandAssetKeys = new WeakMap<PortalBrandAsset, number>();
const templateKeys = new WeakMap<PortalDocumentTemplate, number>();
const templateVersionKeys = new WeakMap<PortalDocumentTemplateVersion, number>();
const coverageKeys = new WeakMap<PortalCounselorCoverage, number>();
const counselorOptionTokens = new WeakMap<PortalCounselorOption, string>();
const workflowGranteeTokens = new WeakMap<PortalWorkflowGranteeOption, string>();
const scheduleCounselorTokens = new WeakMap<PortalScheduleCounselorOption, string>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, max = 4000, allowEmpty = true): string | null {
  if (typeof value !== "string" || value.length > max || (!allowEmpty && !value.trim())) return null;
  return value;
}

function timestamp(value: unknown): string | null {
  return value === null || value === undefined ? null : typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
}

function errorKind(status: number): GuidanceSettingsApiErrorKind {
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 422) return "validation";
  if (status === 401 || status === 403 || status === 404) return "permission";
  return "unavailable";
}

async function readRequest<T>(request: Promise<GeneratedResponse>, parse: (value: unknown) => T | null): Promise<T> {
  try {
    const response = await request;
    if (response.status === 200) {
      const parsed = parse(response.data);
      if (parsed !== null) return parsed;
    }
    throw new GuidanceSettingsApiError(errorKind(response.status));
  } catch (error) {
    if (error instanceof GuidanceSettingsApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new GuidanceSettingsApiError("unavailable");
  }
}

async function readBlob(request: Promise<GeneratedResponse>): Promise<Blob> {
  try {
    const response = await request;
    if (response.status === 200 && response.data instanceof Blob) return response.data;
    throw new GuidanceSettingsApiError(errorKind(response.status));
  } catch (error) {
    if (error instanceof GuidanceSettingsApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new GuidanceSettingsApiError("unavailable");
  }
}

function parsePage<T>(value: unknown, parseItem: (value: unknown) => T | null): SafePage<T> | null {
  if (!isRecord(value) || !Array.isArray(value.items) || typeof value.page !== "number" || typeof value.page_size !== "number" || typeof value.total !== "number") return null;
  if (!Number.isSafeInteger(value.page) || value.page < 1 || value.page_size !== GUIDANCE_PAGE_SIZE || !Number.isSafeInteger(value.total) || value.total < 0) return null;
  return { items: value.items.map(parseItem).filter((item): item is T => item !== null), page: value.page, page_size: value.page_size, total: value.total };
}

function parseSafeKey(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseTerm(value: unknown): PortalAcademicTerm | null {
  if (!isRecord(value)) return null;
  const id = parseSafeKey(value.id);
  if (id === null) return null;
  const item = {
    academic_year: stringValue(value.academic_year, 20, false), semester: stringValue(value.semester, 100, false),
    start_date: stringValue(value.start_date, 30, false), end_date: stringValue(value.end_date, 30, false),
    status: stringValue(value.status, 30, false), is_current: value.is_current === true,
    configuration_identifier: stringValue(value.configuration_identifier, 160) ?? "",
    approved_at: timestamp(value.approved_at), activated_at: timestamp(value.activated_at), closed_at: timestamp(value.closed_at),
  };
  if (!item.academic_year || !item.semester || !item.start_date || !item.end_date || !item.status) return null;
  const result = item as PortalAcademicTerm;
  termKeys.set(result, id);
  return result;
}

function parseInstitution(value: unknown): PortalInstitutionProfile | null {
  if (!isRecord(value)) return null;
  const id = parseSafeKey(value.id);
  if (id === null) return null;
  const required = ["legal_name", "short_name", "status"];
  if (required.some((key) => !stringValue(value[key], 255, false))) return null;
  const result = {
    legal_name: String(value.legal_name), short_name: String(value.short_name), address: stringValue(value.address, 2000) ?? "",
    main_campus: stringValue(value.main_campus, 255) ?? "", primary_brand_color: stringValue(value.primary_brand_color, 30) ?? "",
    secondary_brand_color: stringValue(value.secondary_brand_color, 30) ?? "", accent_brand_color: stringValue(value.accent_brand_color, 30) ?? "",
    version_label: stringValue(value.version_label, 50) ?? "", status: String(value.status), effective_from: timestamp(value.effective_from), effective_until: timestamp(value.effective_until),
    former_name: stringValue(value.former_name, 255) ?? "", former_short_name: stringValue(value.former_short_name, 50) ?? "",
    source_note: stringValue(value.source_note, 2000) ?? "", activated_at: timestamp(value.activated_at), retired_at: timestamp(value.retired_at),
  } as PortalInstitutionProfile;
  institutionKeys.set(result, id);
  return result;
}

function parseOffice(value: unknown): PortalOfficeProfile | null {
  if (!isRecord(value) || !stringValue(value.office_name, 255, false) || !stringValue(value.status, 30, false)) return null;
  const id = parseSafeKey(value.id);
  if (id === null) return null;
  const result = {
    office_name: String(value.office_name), office_short_name: stringValue(value.office_short_name, 50) ?? "", document_header_name: stringValue(value.document_header_name, 255) ?? "",
    office_address: stringValue(value.office_address, 2000) ?? "", office_hours: stringValue(value.office_hours, 255) ?? "", contact_email: stringValue(value.contact_email, 254) ?? "", contact_number: stringValue(value.contact_number, 50) ?? "",
    version_label: stringValue(value.version_label, 50) ?? "", status: String(value.status), effective_from: timestamp(value.effective_from), effective_until: timestamp(value.effective_until),
    legacy_office_name: stringValue(value.legacy_office_name, 255) ?? "", default_signatory_name: stringValue(value.default_signatory_name, 255) ?? "", default_signatory_title: stringValue(value.default_signatory_title, 255) ?? "", footer_note: stringValue(value.footer_note, 2000) ?? "", source_note: stringValue(value.source_note, 2000) ?? "", activated_at: timestamp(value.activated_at), retired_at: timestamp(value.retired_at),
  } as PortalOfficeProfile;
  officeKeys.set(result, id);
  return result;
}

function parseBrandAsset(value: unknown): PortalBrandAsset | null {
  if (!isRecord(value)) return null;
  const id = parseSafeKey(value.id);
  if (
    id === null ||
    !stringValue(value.asset_type, 80, false) ||
    !stringValue(value.semantic_role, 120, false) ||
    !stringValue(value.owner_type, 80, false) ||
    !stringValue(value.status, 40, false)
  ) return null;
  if (typeof value.display_order !== "number" || !Number.isSafeInteger(value.display_order) || value.display_order < 0) return null;
  const item = {
    asset_type: String(value.asset_type),
    semantic_role: String(value.semantic_role),
    placement: stringValue(value.placement, 120) ?? "",
    owner_type: String(value.owner_type),
    background_variant: stringValue(value.background_variant, 80) ?? "",
    status: String(value.status),
    version_label: stringValue(value.version_label, 80) ?? "",
    usage_context: stringValue(value.usage_context, 160) ?? "",
    alt_text: stringValue(value.alt_text, 500) ?? "",
    display_order: value.display_order,
    effective_from: timestamp(value.effective_from),
    effective_until: timestamp(value.effective_until),
    content_type: stringValue(value.content_type, 100) ?? "",
    image_width: typeof value.image_width === "number" ? value.image_width : null,
    image_height: typeof value.image_height === "number" ? value.image_height : null,
  } satisfies PortalBrandAsset;
  brandAssetKeys.set(item, id);
  return item;
}

function parseDocumentTemplate(value: unknown): PortalDocumentTemplate | null {
  if (!isRecord(value)) return null;
  const id = parseSafeKey(value.id);
  if (
    id === null ||
    !stringValue(value.stable_key, 120, false) ||
    !stringValue(value.display_name, 255, false) ||
    !stringValue(value.document_kind, 100, false) ||
    !stringValue(value.status, 40, false)
  ) return null;
  const item = {
    stable_key: String(value.stable_key),
    display_name: String(value.display_name),
    document_kind: String(value.document_kind),
    default_output_format: stringValue(value.default_output_format, 40) ?? "",
    retention_classification: stringValue(value.retention_classification, 80) ?? "",
    description: stringValue(value.description, 4000) ?? "",
    related_form_family_label: stringValue(value.related_form_family_label, 255) ?? "",
    owner_office_label: stringValue(value.owner_office_label, 255) ?? "",
    status: String(value.status),
  } satisfies PortalDocumentTemplate;
  templateKeys.set(item, id);
  return item;
}

function parseDocumentTemplateVersion(value: unknown): PortalDocumentTemplateVersion | null {
  if (!isRecord(value)) return null;
  const id = parseSafeKey(value.id);
  if (
    id === null ||
    !stringValue(value.template_stable_key, 120, false) ||
    !stringValue(value.version_label, 80, false) ||
    !stringValue(value.status, 40, false)
  ) return null;
  const item = {
    template_stable_key: String(value.template_stable_key),
    version_label: String(value.version_label),
    output_format: stringValue(value.output_format, 40) ?? "",
    page_size: stringValue(value.page_size, 40) ?? "",
    page_orientation: stringValue(value.page_orientation, 40) ?? "",
    status: String(value.status),
    is_used: value.is_used === true,
    related_form_revision_label: stringValue(value.related_form_revision_label, 255) ?? "",
    approved_at: timestamp(value.approved_at),
    retired_at: timestamp(value.retired_at),
  } satisfies PortalDocumentTemplateVersion;
  templateVersionKeys.set(item, id);
  return item;
}

function parseCoverage(value: unknown): PortalCounselorCoverage | null {
  if (!isRecord(value)) return null;
  const id = parseSafeKey(value.id);
  if (
    id === null ||
    !stringValue(value.counselor_display_name, 255, false) ||
    !stringValue(value.scope_label, 255, false) ||
    !stringValue(value.state, 40, false) ||
    !stringValue(value.starts_at, 30, false) ||
    !timestamp(value.updated_at)
  ) return null;
  const item = {
    counselor_display_name: String(value.counselor_display_name),
    scope_label: String(value.scope_label),
    campus: stringValue(value.campus, 120),
    college: stringValue(value.college, 120),
    department: stringValue(value.department, 120),
    program: stringValue(value.program, 120),
    is_primary: value.is_primary === true,
    state: String(value.state),
    is_active: value.is_active === true,
    starts_at: String(value.starts_at),
    ends_at: timestamp(value.ends_at),
    updated_at: String(value.updated_at),
  } satisfies PortalCounselorCoverage;
  coverageKeys.set(item, id);
  return item;
}

function parseCounselorOption(value: unknown): PortalCounselorOption | null {
  if (!isRecord(value) || !stringValue(value.display_name, 255, false) || !stringValue(value.selection_token, 4096, false)) return null;
  const item = { display_name: String(value.display_name) } satisfies PortalCounselorOption;
  counselorOptionTokens.set(item, String(value.selection_token));
  return item;
}

function parseChoice(value: unknown): PortalWorkflowChoice | null {
  if (
    !isRecord(value) ||
    !stringValue(value.value, 160, false) ||
    !stringValue(value.label, 255, false)
  ) {
    return null;
  }
  return { value: String(value.value), label: String(value.label) };
}

function parseWorkflowAccess(value: unknown): PortalWorkflowAccess | null {
  if (!isRecord(value)) return null;
  const requiredStrings = [
    "grant_reference",
    "grantee_display_name",
    "grantee_role",
    "capability",
    "capability_label",
    "scope_mode",
    "scope_mode_label",
    "scope_label",
    "status",
    "status_label",
    "grant_reason_code",
    "grant_reason_label",
  ];
  if (requiredStrings.some((key) => !stringValue(value[key], 500, false))) {
    return null;
  }
  const validFrom = timestamp(value.valid_from);
  const createdAt = timestamp(value.created_at);
  const updatedAt = timestamp(value.updated_at);
  if (!validFrom || !createdAt || !updatedAt) return null;
  return {
    grant_reference: String(value.grant_reference),
    grantee_display_name: String(value.grantee_display_name),
    grantee_role: String(value.grantee_role),
    capability: String(value.capability),
    capability_label: String(value.capability_label),
    scope_mode: String(value.scope_mode),
    scope_mode_label: String(value.scope_mode_label),
    scope_label: String(value.scope_label),
    valid_from: validFrom,
    valid_until: timestamp(value.valid_until),
    status: String(value.status),
    status_label: String(value.status_label),
    grant_reason_code: String(value.grant_reason_code),
    grant_reason_label: String(value.grant_reason_label),
    created_at: createdAt,
    updated_at: updatedAt,
    revoked_at: timestamp(value.revoked_at),
  };
}

function parseWorkflowGranteeOption(value: unknown): PortalWorkflowGranteeOption | null {
  if (
    !isRecord(value) ||
    !stringValue(value.display_name, 255, false) ||
    !stringValue(value.role, 40, false) ||
    !stringValue(value.role_label, 120, false) ||
    !stringValue(value.selection_token, 4096, false)
  ) {
    return null;
  }
  const item = {
    display_name: String(value.display_name),
    role: String(value.role),
    role_label: String(value.role_label),
  } satisfies PortalWorkflowGranteeOption;
  workflowGranteeTokens.set(item, String(value.selection_token));
  return item;
}

function parseWorkflowCapabilityOption(value: unknown): PortalWorkflowCapabilityOption | null {
  if (
    !isRecord(value) ||
    !stringValue(value.value, 160, false) ||
    !stringValue(value.label, 255, false) ||
    !Array.isArray(value.eligible_roles) ||
    !Array.isArray(value.scope_modes) ||
    !Array.isArray(value.scope_mode_labels) ||
    !value.eligible_roles.every((item) => typeof item === "string" && item.length <= 40) ||
    !value.scope_modes.every((item) => typeof item === "string" && item.length <= 80) ||
    !value.scope_mode_labels.every((item) => typeof item === "string" && item.length <= 255) ||
    typeof value.office_wide_grant_allowed !== "boolean" ||
    typeof value.expiry_required !== "boolean"
  ) {
    return null;
  }
  return {
    value: String(value.value),
    label: String(value.label),
    eligible_roles: value.eligible_roles,
    scope_modes: value.scope_modes,
    scope_mode_labels: value.scope_mode_labels,
    office_wide_grant_allowed: value.office_wide_grant_allowed,
    expiry_required: value.expiry_required,
  };
}

function parseWorkflowAccessOptions(value: unknown): PortalWorkflowAccessOptions | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.grantees) ||
    !Array.isArray(value.capabilities) ||
    !Array.isArray(value.scope_modes) ||
    !Array.isArray(value.grant_reasons) ||
    !Array.isArray(value.revocation_reasons)
  ) {
    return null;
  }
  const grantees = value.grantees
    .map(parseWorkflowGranteeOption)
    .filter((item): item is PortalWorkflowGranteeOption => item !== null);
  const capabilities = value.capabilities
    .map(parseWorkflowCapabilityOption)
    .filter((item): item is PortalWorkflowCapabilityOption => item !== null);
  const scopeModes = value.scope_modes
    .map(parseChoice)
    .filter((item): item is PortalWorkflowChoice => item !== null);
  const grantReasons = value.grant_reasons
    .map(parseChoice)
    .filter((item): item is PortalWorkflowChoice => item !== null);
  const revocationReasons = value.revocation_reasons
    .map(parseChoice)
    .filter((item): item is PortalWorkflowChoice => item !== null);
  if (
    grantees.length !== value.grantees.length ||
    capabilities.length !== value.capabilities.length ||
    scopeModes.length !== value.scope_modes.length ||
    grantReasons.length !== value.grant_reasons.length ||
    revocationReasons.length !== value.revocation_reasons.length
  ) {
    return null;
  }
  return {
    grantees,
    capabilities,
    scope_modes: scopeModes,
    grant_reasons: grantReasons,
    revocation_reasons: revocationReasons,
  };
}

function parseScheduleRecord(value: unknown): PortalScheduleRecord | null {
  if (!isRecord(value)) return null;
  const kind = value.kind;
  if (kind !== "availability_rule" && kind !== "unavailable_block") return null;
  const publicReference = stringValue(value.public_reference, 160, false);
  const counselorName = stringValue(value.counselor_display_name, 255, false);
  const state = stringValue(value.state, 40, false);
  const stateLabel = stringValue(value.state_label, 120, false);
  const updatedAt = timestamp(value.updated_at);
  if (!publicReference || !counselorName || !state || !stateLabel || !updatedAt) return null;
  const optionalInteger = (candidate: unknown, max = 100000): number | null =>
    candidate === null || candidate === undefined
      ? null
      : typeof candidate === "number" && Number.isSafeInteger(candidate) && candidate >= 0 && candidate <= max
        ? candidate
        : null;
  const dayOfWeek = optionalInteger(value.day_of_week, 7);
  const slotDuration = optionalInteger(value.slot_duration_minutes, 1440);
  const maxAppointments = optionalInteger(value.max_appointments_per_slot, 10000);
  if (value.day_of_week !== null && value.day_of_week !== undefined && dayOfWeek === null) return null;
  if (value.slot_duration_minutes !== null && value.slot_duration_minutes !== undefined && slotDuration === null) return null;
  if (value.max_appointments_per_slot !== null && value.max_appointments_per_slot !== undefined && maxAppointments === null) return null;
  if (value.is_active !== true && value.is_active !== false) return null;
  if (value.is_all_day !== null && value.is_all_day !== undefined && typeof value.is_all_day !== "boolean") return null;
  return {
    public_reference: publicReference,
    kind,
    counselor_display_name: counselorName,
    day_of_week: dayOfWeek,
    day_label: stringValue(value.day_label, 120),
    date: stringValue(value.date, 30),
    start_time: stringValue(value.start_time, 30),
    end_time: stringValue(value.end_time, 30),
    mode: stringValue(value.mode, 80),
    location: stringValue(value.location, 255),
    slot_duration_minutes: slotDuration,
    max_appointments_per_slot: maxAppointments,
    is_all_day: value.is_all_day === null || value.is_all_day === undefined ? null : value.is_all_day,
    effective_from: timestamp(value.effective_from),
    effective_until: timestamp(value.effective_until),
    is_active: value.is_active,
    state,
    state_label: stateLabel,
    updated_at: updatedAt,
  };
}

function parseScheduleCounselorOption(value: unknown): PortalScheduleCounselorOption | null {
  if (!isRecord(value) || !stringValue(value.display_name, 255, false) || !stringValue(value.selection_token, 4096, false)) return null;
  const item = { display_name: String(value.display_name) } satisfies PortalScheduleCounselorOption;
  scheduleCounselorTokens.set(item, String(value.selection_token));
  return item;
}

function parseScheduleOptions(value: unknown): PortalScheduleOptions | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.counselors) ||
    !Array.isArray(value.days) ||
    !Array.isArray(value.modes) ||
    !Array.isArray(value.states)
  ) return null;
  const counselors = value.counselors
    .map(parseScheduleCounselorOption)
    .filter((item): item is PortalScheduleCounselorOption => item !== null);
  const days = value.days.map(parseChoice).filter((item): item is PortalScheduleChoice => item !== null);
  const modes = value.modes.map(parseChoice).filter((item): item is PortalScheduleChoice => item !== null);
  const states = value.states.map(parseChoice).filter((item): item is PortalScheduleChoice => item !== null);
  if (
    counselors.length !== value.counselors.length ||
    days.length !== value.days.length ||
    modes.length !== value.modes.length ||
    states.length !== value.states.length
  ) return null;
  return { counselors, days, modes, states };
}

function parseOfficeClosure(value: unknown): PortalOfficeClosure | null {
  if (!isRecord(value)) return null;
  const publicReference = stringValue(value.public_reference, 160, false);
  const date = stringValue(value.date, 30, false);
  if (!publicReference || !date || !stringValue(value.state, 40, false) || !stringValue(value.state_label, 120, false)) return null;
  if (value.is_all_day !== true && value.is_all_day !== false) return null;
  if (value.is_active !== true && value.is_active !== false) return null;
  return {
    public_reference: publicReference,
    date,
    start_time: stringValue(value.start_time, 30),
    end_time: stringValue(value.end_time, 30),
    is_all_day: value.is_all_day,
    reason: stringValue(value.reason, 255) ?? "",
    is_active: value.is_active,
    state: String(value.state),
    state_label: String(value.state_label),
    updated_at: timestamp(value.updated_at),
  };
}

function parseSchedulePreview(value: unknown): PortalSchedulePreview | null {
  if (!isRecord(value)) return null;
  const strings = ["affected_outcome", "fingerprint", "kind", "operation", "record_reference", "record_state"];
  if (strings.some((key) => !stringValue(value[key], 500, false))) return null;
  const pendingCount = value.pending_count;
  const scheduledCount = value.scheduled_count;
  if (
    typeof pendingCount !== "number" ||
    !Number.isSafeInteger(pendingCount) ||
    pendingCount < 0 ||
    typeof scheduledCount !== "number" ||
    !Number.isSafeInteger(scheduledCount) ||
    scheduledCount < 0
  ) return null;
  return {
    affected_outcome: String(value.affected_outcome),
    fingerprint: String(value.fingerprint),
    kind: String(value.kind),
    operation: String(value.operation),
    pending_count: pendingCount,
    record_reference: String(value.record_reference),
    record_state: String(value.record_state),
    scheduled_count: scheduledCount,
  };
}

function parseFamily(value: unknown): PortalFormFamily | null {
  if (!isRecord(value) || !stringValue(value.stable_key, 80, false) || !stringValue(value.display_name, 255, false) || !stringValue(value.status, 30, false)) return null;
  const id = parseSafeKey(value.id);
  if (id === null) return null;
  const result = { stable_key: String(value.stable_key), display_name: String(value.display_name), description: stringValue(value.description, 4000) ?? "", status: String(value.status) };
  familyKeys.set(result, id);
  return result;
}

function parseRevision(value: unknown): PortalFormRevision | null {
  if (!isRecord(value) || !stringValue(value.form_family_key, 80, false) || !stringValue(value.official_form_code, 80, false) || !stringValue(value.display_title, 255, false) || !stringValue(value.status, 30, false)) return null;
  const id = parseSafeKey(value.id);
  if (id === null) return null;
  const result = { form_family_key: String(value.form_family_key), official_form_code: String(value.official_form_code), official_revision: stringValue(value.official_revision, 50) ?? "", display_title: String(value.display_title), status: String(value.status), effective_from: timestamp(value.effective_from), effective_until: timestamp(value.effective_until), is_used: value.is_used === true, internal_schema_version: stringValue(value.internal_schema_version, 80) ?? "", internal_template_version: stringValue(value.internal_template_version, 30) ?? "", source_label: stringValue(value.source_label, 255) ?? "", approved_at: timestamp(value.approved_at), submitted_at: timestamp(value.submitted_at), activated_at: timestamp(value.activated_at), retired_at: timestamp(value.retired_at), has_source: Boolean(value.source_label) };
  revisionKeys.set(result, id);
  return result;
}

function parseInstrument(value: unknown): PortalAssessmentInstrument | null {
  if (!isRecord(value) || !stringValue(value.key, 100, false) || !stringValue(value.title, 200, false) || !stringValue(value.category, 50, false) || !stringValue(value.created_at, 40, false) || !stringValue(value.updated_at, 40, false)) return null;
  return { key: String(value.key), title: String(value.title), category: String(value.category), official_source_reference: stringValue(value.official_source_reference, 255) ?? "", has_official_scoring_guide: value.has_official_scoring_guide === true, allows_scores: value.allows_scores === true, allows_interpretation: value.allows_interpretation === true, notes: stringValue(value.notes, 4000) ?? "", is_active: value.is_active === true, created_at: String(value.created_at), updated_at: String(value.updated_at) };
}

function parseRolloverPreview(value: unknown): RolloverPreview | null {
  if (!isRecord(value) || !stringValue(value.academic_year, 20, false) || !stringValue(value.semester, 100, false) || !stringValue(value.prior_term, 120, false) || !Array.isArray(value.providers) || !isRecord(value.rollback)) return null;
  const providers = value.providers.map((provider) => {
    if (!isRecord(provider) || !stringValue(provider.key, 120, false) || !stringValue(provider.status, 40, false) || typeof provider.count !== "number" || !Number.isSafeInteger(provider.count) || provider.count < 0) return null;
    return { key: String(provider.key), status: String(provider.status), count: provider.count, reason_code: stringValue(provider.reason_code, 120) };
  }).filter((provider): provider is { key: string; status: string; count: number; reason_code: string | null } => provider !== null);
  const rollback = value.rollback;
  if (!stringValue(rollback.status, 40, false) || !stringValue(rollback.condition, 500, false) || !stringValue(rollback.reference, 160, false)) return null;
  return { academic_year: String(value.academic_year), semester: String(value.semester), prior_term: String(value.prior_term), providers, rollback: { status: String(rollback.status), condition: String(rollback.condition), reference: String(rollback.reference) } };
}

function parseRevisionPreflight(value: unknown): RevisionPreflight | null {
  if (!isRecord(value) || !Array.isArray(value.blockers) || !value.blockers.every((item) => typeof item === "string" && item.length <= 500) || typeof value.ready !== "boolean" || typeof value.safe_template !== "boolean" || !stringValue(value.status, 40, false)) return null;
  return { blockers: value.blockers, ready: value.ready, safe_template: value.safe_template, status: String(value.status) };
}

function parseTemplatePreflight(value: unknown): DocumentTemplateActivationPreflightSchema | null {
  if (!isRecord(value) || !Array.isArray(value.blockers) || !value.blockers.every((item) => typeof item === "string" && item.length <= 500) || typeof value.ready !== "boolean" || !stringValue(value.status, 40, false)) return null;
  return { blockers: value.blockers, ready: value.ready, status: String(value.status) };
}

function safeKey(value: number | undefined) {
  if (!value || !Number.isSafeInteger(value) || value < 1) throw new GuidanceSettingsApiError("validation");
  return value;
}

function runMutation(request: (options: RequestInit) => Promise<GeneratedResponse>, key: IdempotencyKey, signal?: AbortSignal) {
  return cookieSessionMutationOptions(signal).then((mutationOptions) => request(withIdempotencyKey(key, mutationOptions))).then((response) => {
    if (response.status >= 200 && response.status < 300) return;
    throw new GuidanceSettingsApiError(errorKind(response.status));
  }).catch((error) => {
    if (error instanceof GuidanceSettingsApiError || (error instanceof Error && error.name === "AbortError")) throw error;
    throw new GuidanceSettingsApiError("unavailable");
  });
}

export function getGuidanceAcademicTerms(signal?: AbortSignal) {
  return readRequest(organizationsAcademicTermsList({ page: 1, page_size: GUIDANCE_PAGE_SIZE }, cookieSessionReadOptions(signal)), (value) => parsePage(value, parseTerm));
}

export function getGuidanceInstitutions(signal?: AbortSignal) {
  return readRequest(organizationsInstitutionProfilesList({ page: 1, page_size: GUIDANCE_PAGE_SIZE }, cookieSessionReadOptions(signal)), (value) => parsePage(value, parseInstitution));
}

export function getGuidanceOffices(signal?: AbortSignal) {
  return readRequest(organizationsOfficesList({ page: 1, page_size: GUIDANCE_PAGE_SIZE }, cookieSessionReadOptions(signal)), (value) => parsePage(value, parseOffice));
}

export function getGuidanceFamilies(signal?: AbortSignal) {
  return readRequest(organizationsFormFamiliesList({ page: 1, page_size: GUIDANCE_PAGE_SIZE }, cookieSessionReadOptions(signal)), (value) => parsePage(value, parseFamily));
}

export function getGuidanceRevisions(signal?: AbortSignal) {
  return readRequest(organizationsFormRevisionsList({ page: 1, page_size: GUIDANCE_PAGE_SIZE }, cookieSessionReadOptions(signal)), (value) => parsePage(value, parseRevision));
}

export function getGuidanceInstruments(signal?: AbortSignal) {
  return readRequest(assessmentsGovernanceInstrumentsList({ page: 1, page_size: GUIDANCE_PAGE_SIZE }, cookieSessionReadOptions(signal)), (value) => parsePage(value, parseInstrument));
}

export function getGuidanceBrandAssets(signal?: AbortSignal) {
  return readRequest(organizationsBrandAssetsList({ page: 1, page_size: GUIDANCE_PAGE_SIZE }, cookieSessionReadOptions(signal)), (value) => parsePage(value, parseBrandAsset));
}

export function getGuidanceDocumentTemplates(signal?: AbortSignal) {
  return readRequest(organizationsDocumentTemplatesList({ page: 1, page_size: GUIDANCE_PAGE_SIZE }, cookieSessionReadOptions(signal)), (value) => parsePage(value, parseDocumentTemplate));
}

export function getGuidanceTemplateVersions(template: PortalDocumentTemplate, signal?: AbortSignal) {
  return readRequest(organizationsDocumentTemplateVersionsList(safeKey(templateKeys.get(template)), { page: 1, page_size: GUIDANCE_PAGE_SIZE }, cookieSessionReadOptions(signal)), (value) => parsePage(value, parseDocumentTemplateVersion));
}

export function getGuidanceTemplateVersionDetail(version: PortalDocumentTemplateVersion, signal?: AbortSignal) {
  return readRequest(organizationsDocumentTemplateVersionDetail(safeKey(templateVersionKeys.get(version)), cookieSessionReadOptions(signal)), parseDocumentTemplateVersion);
}

export function getGuidanceTemplatePreflight(version: PortalDocumentTemplateVersion, signal?: AbortSignal) {
  return readRequest(organizationsDocumentTemplateVersionActivationPreflight(safeKey(templateVersionKeys.get(version)), cookieSessionReadOptions(signal)), parseTemplatePreflight);
}

export function getGuidanceCoverage(filters: GuidanceCoverageFilters = {}, page = 1, signal?: AbortSignal) {
  return readRequest(authorityCoverageList({ ...filters, page, page_size: GUIDANCE_PAGE_SIZE }, cookieSessionReadOptions(signal)), (value) => parsePage(value, parseCoverage));
}

export function getGuidanceCounselorOptions(page = 1, signal?: AbortSignal) {
  return readRequest(authorityCoverageOptions({ page, page_size: GUIDANCE_PAGE_SIZE }, cookieSessionReadOptions(signal)), (value) => parsePage(value, parseCounselorOption));
}

export function getGuidanceWorkflowAccess(
  filters: GuidanceWorkflowAccessFilters = {},
  page = 1,
  signal?: AbortSignal,
) {
  return readRequest(
    workflowAccessList(
      {
        ...filters,
        page,
        page_size: GUIDANCE_PAGE_SIZE,
      } satisfies WorkflowAccessListParams,
      cookieSessionReadOptions(signal),
    ),
    (value) => parsePage(value, parseWorkflowAccess),
  );
}

export function getGuidanceWorkflowAccessOptions(signal?: AbortSignal) {
  return readRequest(
    workflowAccessOptions(cookieSessionReadOptions(signal)),
    parseWorkflowAccessOptions,
  );
}

export function createGuidanceWorkflowAccess(
  grantee: PortalWorkflowGranteeOption,
  payload: Omit<WorkflowAccessCreateSchema, "grantee_id" | "grantee_selection_token">,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  const selectionToken = workflowGranteeTokens.get(grantee);
  if (!selectionToken) throw new GuidanceSettingsApiError("validation");
  return runMutation(
    (options) =>
      workflowAccessCreate(
        { ...payload, grantee_selection_token: selectionToken },
        options,
      ),
    key,
    signal,
  );
}

export function revokeGuidanceWorkflowAccess(
  item: PortalWorkflowAccess,
  payload: WorkflowAccessRevokeSchema,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  if (!item.grant_reference.trim()) throw new GuidanceSettingsApiError("validation");
  return runMutation(
    (options) => workflowAccessRevoke(item.grant_reference, payload, options),
    key,
    signal,
  );
}

export function downloadGuidanceBrandAsset(item: PortalBrandAsset, signal?: AbortSignal) {
  return readBlob(organizationsBrandAssetDownload(safeKey(brandAssetKeys.get(item)), cookieSessionReadOptions(signal)));
}

export function getGuidanceRolloverPreview(term: PortalAcademicTerm, priorTerm?: PortalAcademicTerm, signal?: AbortSignal) {
  const params = priorTerm ? { prior_term_id: safeKey(termKeys.get(priorTerm)) } : {};
  return readRequest(organizationsAcademicTermRolloverPreview(safeKey(termKeys.get(term)), params, cookieSessionReadOptions(signal)), parseRolloverPreview);
}

export function getGuidanceRevisionPreflight(revision: PortalFormRevision, signal?: AbortSignal) {
  return readRequest(organizationsFormRevisionActivationPreflight(safeKey(revisionKeys.get(revision)), cookieSessionReadOptions(signal)), parseRevisionPreflight);
}

export function downloadGuidanceRevisionSource(revision: PortalFormRevision, signal?: AbortSignal) {
  return readBlob(organizationsFormRevisionSourceDownload(safeKey(revisionKeys.get(revision)), cookieSessionReadOptions(signal)));
}

export function createGuidanceAcademicTerm(payload: TermSchema, key: IdempotencyKey, signal?: AbortSignal) { return runMutation((options) => organizationsAcademicTermCreate(payload, options), key, signal); }
export function updateGuidanceAcademicTerm(item: PortalAcademicTerm, payload: TermSchema, key: IdempotencyKey, signal?: AbortSignal) { return runMutation((options) => organizationsAcademicTermUpdate(safeKey(termKeys.get(item)), payload, options), key, signal); }
export function academicTermLifecycle(item: PortalAcademicTerm, action: "submit" | "approve" | "activate" | "close" | "archive", payload: LifecycleSchema, key: IdempotencyKey, signal?: AbortSignal) {
  const id = safeKey(termKeys.get(item));
  const request = action === "submit" ? organizationsAcademicTermSubmit : action === "approve" ? organizationsAcademicTermApprove : action === "activate" ? organizationsAcademicTermActivate : action === "close" ? organizationsAcademicTermClose : organizationsAcademicTermArchive;
  return runMutation((options) => request(id, payload, options), key, signal);
}
export function rollbackGuidanceAcademicTerm(item: PortalAcademicTerm, priorTerm: PortalAcademicTerm, payload: Omit<RollbackSchema, "prior_term_id">, key: IdempotencyKey, signal?: AbortSignal) {
  const body: RollbackSchema = { ...payload, prior_term_id: safeKey(termKeys.get(priorTerm)) };
  return runMutation((options) => organizationsAcademicTermRollback(safeKey(termKeys.get(item)), body, options), key, signal);
}

export function createGuidanceInstitution(payload: InstitutionSchema, key: IdempotencyKey, signal?: AbortSignal) { return runMutation((options) => organizationsInstitutionProfileCreate(payload, options), key, signal); }
export function updateGuidanceInstitution(item: PortalInstitutionProfile, payload: InstitutionSchema, key: IdempotencyKey, signal?: AbortSignal) { return runMutation((options) => organizationsInstitutionProfileUpdate(safeKey(institutionKeys.get(item)), payload, options), key, signal); }
export function institutionLifecycle(item: PortalInstitutionProfile, action: "activate" | "retire" | "archive", payload: LifecycleSchema, key: IdempotencyKey, signal?: AbortSignal) { const request = action === "activate" ? organizationsInstitutionProfileActivate : action === "retire" ? organizationsInstitutionProfileRetire : organizationsInstitutionProfileArchive; return runMutation((options) => request(safeKey(institutionKeys.get(item)), payload, options), key, signal); }
export function createGuidanceOffice(payload: OfficeSchema, key: IdempotencyKey, signal?: AbortSignal) { return runMutation((options) => organizationsOfficeCreate(payload, options), key, signal); }
export function updateGuidanceOffice(item: PortalOfficeProfile, payload: OfficeSchema, key: IdempotencyKey, signal?: AbortSignal) { return runMutation((options) => organizationsOfficeUpdate(safeKey(officeKeys.get(item)), payload, options), key, signal); }
export function officeLifecycle(item: PortalOfficeProfile, action: "activate" | "retire" | "archive", payload: LifecycleSchema, key: IdempotencyKey, signal?: AbortSignal) { const request = action === "activate" ? organizationsOfficeActivate : action === "retire" ? organizationsOfficeRetire : organizationsOfficeArchive; return runMutation((options) => request(safeKey(officeKeys.get(item)), payload, options), key, signal); }

export function createGuidanceFamily(payload: FamilySchema, key: IdempotencyKey, signal?: AbortSignal) { return runMutation((options) => organizationsFormFamilyCreate(payload, options), key, signal); }
export function updateGuidanceFamily(item: PortalFormFamily, payload: FamilySchema, key: IdempotencyKey, signal?: AbortSignal) { return runMutation((options) => organizationsFormFamilyUpdate(safeKey(familyKeys.get(item)), payload, options), key, signal); }
export function familyLifecycle(item: PortalFormFamily, action: "activate" | "retire" | "archive", payload: LifecycleSchema, key: IdempotencyKey, signal?: AbortSignal) { const request = action === "activate" ? organizationsFormFamilyActivate : action === "retire" ? organizationsFormFamilyRetire : organizationsFormFamilyArchive; return runMutation((options) => request(safeKey(familyKeys.get(item)), payload, options), key, signal); }
export function createGuidanceRevision(payload: Record<string, unknown>, key: IdempotencyKey, signal?: AbortSignal) { return runMutation((options) => organizationsFormRevisionCreate(payload as never, options), key, signal); }
export function createGuidanceRevisionForFamily(family: PortalFormFamily, payload: Omit<Record<string, unknown>, "form_family_id">, key: IdempotencyKey, signal?: AbortSignal) { return createGuidanceRevision({ ...payload, form_family_id: safeKey(familyKeys.get(family)) }, key, signal); }
export function updateGuidanceRevision(item: PortalFormRevision, family: PortalFormFamily, payload: Omit<Record<string, unknown>, "form_family_id">, key: IdempotencyKey, signal?: AbortSignal) {
  return runMutation((options) => organizationsFormRevisionUpdate(safeKey(revisionKeys.get(item)), { ...payload, form_family_id: safeKey(familyKeys.get(family)) } as never, options), key, signal);
}
export function revisionLifecycle(item: PortalFormRevision, action: "submit" | "approve" | "activate" | "retire" | "archive" | "clone", payload: LifecycleSchema, key: IdempotencyKey, signal?: AbortSignal) { const id = safeKey(revisionKeys.get(item)); const request = action === "submit" ? organizationsFormRevisionSubmit : action === "approve" ? organizationsFormRevisionApprove : action === "activate" ? organizationsFormRevisionActivate : action === "retire" ? organizationsFormRevisionRetire : action === "archive" ? organizationsFormRevisionArchive : organizationsFormRevisionClone; return runMutation((options) => request(id, payload, options), key, signal); }
export function uploadGuidanceRevisionSource(item: PortalFormRevision, file: File, sourceLabel: string, expectedUpdatedAt: string | null, key: IdempotencyKey, signal?: AbortSignal) { const body: OrganizationsFormRevisionSourceUploadBody = { file, source_label: sourceLabel.trim().slice(0, 255), expected_updated_at: expectedUpdatedAt }; return runMutation((options) => organizationsFormRevisionSourceUpload(safeKey(revisionKeys.get(item)), body, options), key, signal); }

export function createGuidanceInstrument(payload: AssessmentInstrumentGovernanceCreateSchema, key: IdempotencyKey, signal?: AbortSignal) { return runMutation((options) => assessmentsGovernanceInstrumentCreate(payload, options), key, signal); }
export function updateGuidanceInstrument(item: PortalAssessmentInstrument, payload: AssessmentInstrumentGovernanceUpdateSchema, key: IdempotencyKey, signal?: AbortSignal) { return runMutation((options) => assessmentsGovernanceInstrumentUpdate(item.key, payload, options), key, signal); }
export function setGuidanceInstrumentActive(item: PortalAssessmentInstrument, active: boolean, payload: AssessmentInstrumentGovernanceLifecycleSchema, key: IdempotencyKey, signal?: AbortSignal) { const request = active ? assessmentsGovernanceInstrumentActivate : assessmentsGovernanceInstrumentDeactivate; return runMutation((options) => request(item.key, payload, options), key, signal); }

export function createGuidanceBrandAsset(payload: OrganizationsBrandAssetCreateBody, key: IdempotencyKey, signal?: AbortSignal) { return runMutation((options) => organizationsBrandAssetCreate(payload, options), key, signal); }
export function updateGuidanceBrandAsset(item: PortalBrandAsset, payload: OrganizationsBrandAssetUpdateBody, key: IdempotencyKey, signal?: AbortSignal) { return runMutation((options) => organizationsBrandAssetUpdate(safeKey(brandAssetKeys.get(item)), payload, options), key, signal); }
export function brandAssetLifecycle(item: PortalBrandAsset, action: "activate" | "retire" | "archive", payload: LifecycleSchema, key: IdempotencyKey, signal?: AbortSignal) {
  const request = action === "activate" ? organizationsBrandAssetActivate : action === "retire" ? organizationsBrandAssetRetire : organizationsBrandAssetArchive;
  return runMutation((options) => request(safeKey(brandAssetKeys.get(item)), payload, options), key, signal);
}

export function createGuidanceDocumentTemplate(payload: DocumentTemplateSchema, key: IdempotencyKey, signal?: AbortSignal) { return runMutation((options) => organizationsDocumentTemplateCreate(payload, options), key, signal); }
export function updateGuidanceDocumentTemplate(item: PortalDocumentTemplate, payload: DocumentTemplateSchema, key: IdempotencyKey, signal?: AbortSignal) { return runMutation((options) => organizationsDocumentTemplateUpdate(safeKey(templateKeys.get(item)), payload, options), key, signal); }
export function documentTemplateLifecycle(item: PortalDocumentTemplate, action: "activate" | "retire" | "archive", payload: LifecycleSchema, key: IdempotencyKey, signal?: AbortSignal) {
  const request = action === "activate" ? organizationsDocumentTemplateActivate : action === "retire" ? organizationsDocumentTemplateRetire : organizationsDocumentTemplateArchive;
  return runMutation((options) => request(safeKey(templateKeys.get(item)), payload, options), key, signal);
}
export function updateGuidanceTemplateVersion(item: PortalDocumentTemplateVersion, payload: DocumentTemplateVersionUpdateSchema, key: IdempotencyKey, signal?: AbortSignal) { return runMutation((options) => organizationsDocumentTemplateVersionUpdate(safeKey(templateVersionKeys.get(item)), payload, options), key, signal); }
export function templateVersionLifecycle(item: PortalDocumentTemplateVersion, action: "activate" | "retire" | "archive" | "clone", payload: LifecycleSchema, key: IdempotencyKey, signal?: AbortSignal) {
  const request = action === "activate" ? organizationsDocumentTemplateVersionActivate : action === "retire" ? organizationsDocumentTemplateVersionRetire : action === "archive" ? organizationsDocumentTemplateVersionArchive : organizationsDocumentTemplateVersionClone;
  return runMutation((options) => request(safeKey(templateVersionKeys.get(item)), payload, options), key, signal);
}

export function createGuidanceCoverage(option: PortalCounselorOption, payload: Omit<CoverageCreateSchema, "counselor_id" | "counselor_selection_token">, key: IdempotencyKey, signal?: AbortSignal) {
  const selectionToken = counselorOptionTokens.get(option);
  if (!selectionToken) throw new GuidanceSettingsApiError("validation");
  return runMutation((options) => authorityCoverageCreate({ ...payload, counselor_selection_token: selectionToken }, options), key, signal);
}
export function updateGuidanceCoverage(item: PortalCounselorCoverage, payload: CoverageUpdateSchema, key: IdempotencyKey, signal?: AbortSignal) { return runMutation((options) => authorityCoverageUpdate(safeKey(coverageKeys.get(item)), payload, options), key, signal); }
export function deactivateGuidanceCoverage(item: PortalCounselorCoverage, payload: CoverageDeactivateSchema, key: IdempotencyKey, signal?: AbortSignal) { return runMutation((options) => authorityCoverageDeactivate(safeKey(coverageKeys.get(item)), payload, options), key, signal); }

export function getGuidanceScheduleRecords(
  filters: GuidanceScheduleFilters = {},
  page = 1,
  signal?: AbortSignal,
) {
  return readRequest(
    appointmentsAvailabilityList(
      {
        ...filters,
        page,
        page_size: GUIDANCE_PAGE_SIZE,
      } satisfies AppointmentsAvailabilityListParams,
      cookieSessionReadOptions(signal),
    ),
    (value) => parsePage(value, parseScheduleRecord),
  );
}

export function getGuidanceScheduleOptions(signal?: AbortSignal) {
  return readRequest(
    appointmentsAvailabilityOptions(cookieSessionReadOptions(signal)),
    parseScheduleOptions,
  );
}

export function getGuidanceOfficeClosures(
  filters: GuidanceOfficeClosureFilters = {},
  page = 1,
  signal?: AbortSignal,
) {
  return readRequest(
    appointmentsOfficeClosures(
      {
        ...filters,
        page,
        page_size: GUIDANCE_PAGE_SIZE,
      } satisfies AppointmentsOfficeClosuresParams,
      cookieSessionReadOptions(signal),
    ),
    (value) => parsePage(value, parseOfficeClosure),
  );
}

function buildSchedulePayload(
  fields: GuidanceScheduleMutationFields,
  key: IdempotencyKey,
): ScheduleChangeSchema {
  const { counselor, ...rest } = fields;
  // `scope_reason` is the bounded record-level reason consumed by the
  // availability service. Keep it out of the visible form state, but derive
  // it from the same user-entered operational reason so blocks and closures
  // do not silently lose their reason on create/update.
  const payload: ScheduleChangeSchema = {
    ...rest,
    scope_reason: rest.scope_reason?.trim() || rest.reason?.trim() || "",
    request_key: key,
  };
  if (counselor) {
    const selectionToken = scheduleCounselorTokens.get(counselor);
    if (!selectionToken) throw new GuidanceSettingsApiError("validation");
    payload.counselor_selection_token = selectionToken;
  }
  return payload;
}

function readMutation<T>(
  request: (options: RequestInit) => Promise<GeneratedResponse>,
  key: IdempotencyKey,
  parse: (value: unknown) => T | null,
  signal?: AbortSignal,
): Promise<T> {
  return cookieSessionMutationOptions(signal)
    .then((options) => request(withIdempotencyKey(key, options)))
    .then((response) => {
      if (response.status >= 200 && response.status < 300) {
        const parsed = parse(response.data);
        if (parsed !== null) return parsed;
      }
      throw new GuidanceSettingsApiError(errorKind(response.status));
    })
    .catch((error) => {
      if (error instanceof GuidanceSettingsApiError || (error instanceof Error && error.name === "AbortError")) throw error;
      throw new GuidanceSettingsApiError("unavailable");
    });
}

export function previewGuidanceScheduleChange(
  fields: GuidanceScheduleMutationFields,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  return readMutation(
    (options) => appointmentsScheduleChangePreview(buildSchedulePayload(fields, key), options),
    key,
    parseSchedulePreview,
    signal,
  );
}

export function applyGuidanceScheduleChange(
  fields: GuidanceScheduleMutationFields,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  return runMutation(
    (options) => appointmentsScheduleChange(buildSchedulePayload(fields, key), options),
    key,
    signal,
  );
}

export function createGuidanceScheduleRule(
  fields: GuidanceScheduleMutationFields,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  return runMutation(
    (options) => appointmentsAvailabilityCreate(buildSchedulePayload(fields, key), options),
    key,
    signal,
  );
}

export function updateGuidanceScheduleRule(
  item: PortalScheduleRecord,
  fields: GuidanceScheduleMutationFields,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  return runMutation(
    (options) => appointmentsAvailabilityUpdate(item.public_reference, buildSchedulePayload(fields, key), options),
    key,
    signal,
  );
}

export function deactivateGuidanceScheduleRule(
  item: PortalScheduleRecord,
  fields: GuidanceScheduleMutationFields,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  return runMutation(
    (options) => appointmentsAvailabilityDeactivate(item.public_reference, buildSchedulePayload(fields, key), options),
    key,
    signal,
  );
}

export function createGuidanceOfficeClosure(
  fields: GuidanceScheduleMutationFields,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  return runMutation(
    (options) => appointmentsOfficeClosureCreate(buildSchedulePayload(fields, key), options),
    key,
    signal,
  );
}

export function updateGuidanceOfficeClosure(
  item: PortalOfficeClosure,
  fields: GuidanceScheduleMutationFields,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  return runMutation(
    (options) => appointmentsOfficeClosureUpdate(item.public_reference, buildSchedulePayload(fields, key), options),
    key,
    signal,
  );
}

export function deactivateGuidanceOfficeClosure(
  item: PortalOfficeClosure,
  fields: GuidanceScheduleMutationFields,
  key: IdempotencyKey,
  signal?: AbortSignal,
) {
  return runMutation(
    (options) => appointmentsOfficeClosureDeactivate(item.public_reference, buildSchedulePayload(fields, key), options),
    key,
    signal,
  );
}
