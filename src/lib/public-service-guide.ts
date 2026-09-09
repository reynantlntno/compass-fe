import { cache } from "react";

import { contentPublicServiceGuide } from "@/lib/api/generated/content/content";
import type {
  PublicServiceGuideSchema,
  ServiceGuideConfirmationFieldSchema,
  ServiceGuideEntrySchema,
  ServiceGuideFieldsSchema,
  ServiceGuideReadinessSchema,
  ServiceGuideStepSchema,
} from "@/lib/api/generated/model";

export type PublicServiceGuideState =
  | { state: "ready"; data: PublicServiceGuideSchema }
  | { state: "empty" }
  | { state: "not_published" }
  | { state: "unavailable" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isConfirmationField(value: unknown): value is ServiceGuideConfirmationFieldSchema {
  return (
    isRecord(value) &&
    typeof value.confirmed === "boolean" &&
    isString(value.label) &&
    isString(value.owner) &&
    isString(value.value)
  );
}

function isFields(value: unknown): value is ServiceGuideFieldsSchema {
  if (!isRecord(value)) return false;

  return [
    "claim_rules",
    "contact",
    "fees",
    "office_hours",
    "proxy_claims",
    "receipt_rules",
    "requirements",
    "timelines",
  ].every((key) => isConfirmationField(value[key]));
}

function isStep(value: unknown): value is ServiceGuideStepSchema {
  return (
    isRecord(value) &&
    isString(value.boundary) &&
    isString(value.description) &&
    isString(value.key) &&
    isString(value.label)
  );
}

function isEntry(value: unknown): value is ServiceGuideEntrySchema {
  return (
    isRecord(value) &&
    isString(value.anchor) &&
    isString(value.availability_label) &&
    typeof value.available === "boolean" &&
    isString(value.description) &&
    isFields(value.fields) &&
    isString(value.key) &&
    isString(value.label) &&
    isString(value.privacy_level) &&
    Array.isArray(value.steps) &&
    value.steps.every(isStep) &&
    isString(value.summary)
  );
}

function isReadiness(value: unknown): value is ServiceGuideReadinessSchema {
  return (
    isRecord(value) &&
    isString(value.display_state) &&
    typeof value.document_official === "boolean" &&
    isString(value.document_readiness) &&
    Array.isArray(value.missing_fields) &&
    isString(value.pending_notice) &&
    typeof value.official === "boolean" &&
    isString(value.state)
  );
}

function isServiceGuide(value: unknown): value is PublicServiceGuideSchema {
  if (!isRecord(value)) return false;

  return (
    isString(value.effective_date) || value.effective_date === null || value.effective_date === undefined
  ) &&
    Array.isArray(value.entries) &&
    value.entries.every(isEntry) &&
    isString(value.guide_key) &&
    typeof value.has_approved_revision === "boolean" &&
    isReadiness(value.readiness) &&
    isString(value.owner_office) &&
    isString(value.publication_state) &&
    isString(value.summary) &&
    isString(value.title) &&
    isString(value.version_label);
}

export const getPublicServiceGuide = cache(async (): Promise<PublicServiceGuideState> => {
  try {
    const response = await contentPublicServiceGuide();
    if (response.status !== 200 || !isServiceGuide(response.data)) {
      return { state: "unavailable" };
    }

    if (!response.data.has_approved_revision || !response.data.readiness.official) {
      return { state: "not_published" };
    }

    if (response.data.entries.length === 0) {
      return { state: "empty" };
    }

    return { state: "ready", data: response.data };
  } catch {
    return { state: "unavailable" };
  }
});
