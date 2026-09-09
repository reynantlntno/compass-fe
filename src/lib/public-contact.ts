import { contentContactCreate } from "@/lib/api/generated/content/content";
import { withIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";
import type {
  ContactSubmissionCreateSchema,
  ContactSubmissionCreateSchemaAffiliation,
  ContactSubmissionCreateSchemaSubmissionType,
} from "@/lib/api/generated/model";

export type PublicContactFormValues = Required<
  Pick<
    ContactSubmissionCreateSchema,
    | "affiliation"
    | "email"
    | "message_body"
    | "name"
    | "phone"
    | "privacy_acknowledged"
    | "subject"
    | "submission_type"
    | "urgent_support_disclaimer_acknowledged"
  >
>;

export type PublicContactField = keyof PublicContactFormValues;

export type PublicContactSubmitResult =
  | { state: "accepted"; referenceCode: string | null }
  | { state: "validation"; fields: PublicContactField[] }
  | { state: "conflict" }
  | { state: "challenge_required"; action: "contact" }
  | { state: "rate_limited" }
  | { state: "unavailable" }
  | { state: "failed" };

const CONTACT_FIELDS = new Set<PublicContactField>([
  "affiliation",
  "email",
  "message_body",
  "name",
  "phone",
  "privacy_acknowledged",
  "subject",
  "submission_type",
  "urgent_support_disclaimer_acknowledged",
]);

const SAFE_REFERENCE_CODE = /^[A-Za-z0-9][A-Za-z0-9-]{0,79}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validationFields(value: unknown): PublicContactField[] {
  if (!isRecord(value) || !isRecord(value.field_errors)) return [];

  return Object.keys(value.field_errors).filter(
    (field): field is PublicContactField => CONTACT_FIELDS.has(field as PublicContactField),
  );
}

function safeReferenceCode(value: unknown) {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return SAFE_REFERENCE_CODE.test(normalized) ? normalized : null;
}

function challengeState(value: unknown): "contact" | "unexpected" | null {
  if (!isRecord(value)) return null;

  const required = value.challenge_required === true;
  const action = value.challenge_action;
  if (required && action === "contact") return "contact";
  if (required || (action !== null && action !== undefined)) return "unexpected";
  return null;
}

export async function submitPublicContact(
  values: PublicContactFormValues,
  idempotencyKey: IdempotencyKey,
  captchaResponse?: string | null,
): Promise<PublicContactSubmitResult> {
  try {
    const payload: ContactSubmissionCreateSchema = captchaResponse
      ? { ...values, captcha_response: captchaResponse }
      : values;
    const response = await contentContactCreate(payload, withIdempotencyKey(idempotencyKey));

    if (response.status === 200) {
      const data = response.data;
      if (!isRecord(data) || typeof data.reference_code !== "string") {
        return { state: "failed" };
      }

      return {
        state: "accepted",
        referenceCode: safeReferenceCode(data.reference_code),
      };
    }

    if (response.status === 400 || response.status === 422) {
      return { state: "validation", fields: validationFields(response.data) };
    }

    if (response.status === 413) {
      return { state: "validation", fields: ["message_body"] };
    }

    if (response.status === 409) {
      return { state: "conflict" };
    }

    if (response.status === 429) {
      const challenge = challengeState(response.data);
      if (challenge === "contact") {
        return { state: "challenge_required", action: "contact" };
      }
      if (challenge === "unexpected") {
        return { state: "unavailable" };
      }
      return { state: "rate_limited" };
    }

    if (response.status === 500 || response.status === 503) {
      return { state: "unavailable" };
    }

    return { state: "failed" };
  } catch {
    return { state: "unavailable" };
  }
}

export type {
  ContactSubmissionCreateSchemaAffiliation,
  ContactSubmissionCreateSchemaSubmissionType,
};
