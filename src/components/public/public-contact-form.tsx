"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent, type ReactNode } from "react";

import {
  ContactSubmissionCreateSchemaAffiliation,
  ContactSubmissionCreateSchemaSubmissionType,
} from "@/lib/api/generated/model";
import { submitPublicContact, type PublicContactField, type PublicContactFormValues, type PublicContactSubmitResult } from "@/lib/public-contact";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createIdempotencyKey, type IdempotencyKey } from "@/lib/api/idempotency";
import { TurnstileField } from "@/components/public/turnstile-field";

const INITIAL_VALUES: PublicContactFormValues = {
  submission_type: ContactSubmissionCreateSchemaSubmissionType.inquiry,
  name: "",
  email: "",
  phone: "",
  affiliation: ContactSubmissionCreateSchemaAffiliation.visitor,
  subject: "",
  message_body: "",
  privacy_acknowledged: false,
  urgent_support_disclaimer_acknowledged: false,
};

const SUBMISSION_TYPES = [
  { value: ContactSubmissionCreateSchemaSubmissionType.inquiry, label: "Inquiry / question" },
  { value: ContactSubmissionCreateSchemaSubmissionType.suggestion, label: "Suggestion" },
  { value: ContactSubmissionCreateSchemaSubmissionType.feedback, label: "Feedback" },
  { value: ContactSubmissionCreateSchemaSubmissionType.concern, label: "Concern" },
  { value: ContactSubmissionCreateSchemaSubmissionType.other, label: "Other" },
] as const;

const AFFILIATIONS = [
  { value: ContactSubmissionCreateSchemaAffiliation.student, label: "Student" },
  { value: ContactSubmissionCreateSchemaAffiliation.parent, label: "Parent / guardian" },
  { value: ContactSubmissionCreateSchemaAffiliation.faculty, label: "Faculty member" },
  { value: ContactSubmissionCreateSchemaAffiliation.staff, label: "Staff member" },
  { value: ContactSubmissionCreateSchemaAffiliation.visitor, label: "Visitor / guest" },
  { value: ContactSubmissionCreateSchemaAffiliation.other, label: "Other" },
] as const;

const EMAIL_REQUIRED_TYPES = new Set<PublicContactFormValues["submission_type"]>([
  ContactSubmissionCreateSchemaSubmissionType.inquiry,
  ContactSubmissionCreateSchemaSubmissionType.concern,
  ContactSubmissionCreateSchemaSubmissionType.other,
]);

const CONTACT_FIELD_LIMITS = {
  name: 150,
  email: 254,
  phone: 50,
  subject: 200,
  message_body: 32768,
} as const;

type ContactErrors = Partial<Record<PublicContactField, string>>;

function fieldErrorId(field: PublicContactField) {
  return `contact-${field}-error`;
}

function validate(values: PublicContactFormValues): ContactErrors {
  const errors: ContactErrors = {};
  const email = values.email.trim();

  if (!values.subject.trim()) errors.subject = "Add a subject so the office knows where to begin.";
  if (!values.message_body.trim()) errors.message_body = "Add a message before sending.";

  if (values.name.length > CONTACT_FIELD_LIMITS.name) {
    errors.name = "Keep your name within 150 characters.";
  }
  if (values.email.length > CONTACT_FIELD_LIMITS.email) {
    errors.email = "Keep your email address within 254 characters.";
  }
  if (values.phone.length > CONTACT_FIELD_LIMITS.phone) {
    errors.phone = "Keep your phone number within 50 characters.";
  }
  if (values.subject.length > CONTACT_FIELD_LIMITS.subject) {
    errors.subject = "Keep your subject within 200 characters.";
  }
  if (values.message_body.length > CONTACT_FIELD_LIMITS.message_body) {
    errors.message_body = "Your message is too long. Please shorten it and try again.";
  }

  if (EMAIL_REQUIRED_TYPES.has(values.submission_type) && !email) {
    errors.email = "An email address is needed for this type of message.";
  } else if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (new TextEncoder().encode(values.message_body).length > CONTACT_FIELD_LIMITS.message_body) {
    errors.message_body = "Your message is too long. Please shorten it and try again.";
  }

  if (!values.privacy_acknowledged) {
    errors.privacy_acknowledged = "Please acknowledge the COMPASS Privacy Notice.";
  }

  if (!values.urgent_support_disclaimer_acknowledged) {
    errors.urgent_support_disclaimer_acknowledged =
      "Please acknowledge that this form is not for urgent or emergency support.";
  }

  return errors;
}

function resultMessage(result: Exclude<PublicContactSubmitResult, { state: "accepted" }>) {
  switch (result.state) {
    case "validation":
      return "Please check the highlighted fields.";
    case "conflict":
      return "This message could not be sent safely. Please review it and try again.";
    case "challenge_required":
      return "A quick verification is needed before sending.";
    case "rate_limited":
      return "Please wait a little while before trying again.";
    case "unavailable":
      return "The office contact form is temporarily unavailable. Please try again later.";
    case "failed":
      return "We couldn’t send your message. Please try again later.";
  }
}

function serverValidationErrors(fields: PublicContactField[]): ContactErrors {
  return Object.fromEntries(
    fields.map((field) => {
      if (field === "email") return [field, "Enter a valid email address."];
      if (field === "message_body") return [field, "Add a shorter message before sending."];
      if (field === "subject") return [field, "Add a subject before sending."];
      if (field === "privacy_acknowledged") {
        return [field, "Please acknowledge the COMPASS Privacy Notice."];
      }
      if (field === "urgent_support_disclaimer_acknowledged") {
        return [field, "Please acknowledge the urgent-support notice."];
      }
      return [field, "Please review this field."];
    }),
  );
}

export function PublicContactForm() {
  const [values, setValues] = useState<PublicContactFormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [result, setResult] = useState<PublicContactSubmitResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [captchaUnavailable, setCaptchaUnavailable] = useState(false);
  const idempotencyKeyRef = useRef<IdempotencyKey | null>(null);

  function resetCaptcha() {
    setCaptchaToken(null);
    setCaptchaResetKey((current) => current + 1);
  }

  function updateField<K extends PublicContactField>(field: K, value: PublicContactFormValues[K]) {
    idempotencyKeyRef.current = null;
    resetCaptcha();
    setCaptchaUnavailable(false);
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setResult(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult({ state: "validation", fields: Object.keys(nextErrors) as PublicContactField[] });
      return;
    }

    if (result?.state === "challenge_required" && !captchaToken) {
      return;
    }

    const idempotencyKey = idempotencyKeyRef.current ?? (idempotencyKeyRef.current = createIdempotencyKey());

    setIsSubmitting(true);
    setResult(null);
    const submission = await submitPublicContact(values, idempotencyKey, captchaToken);
    setIsSubmitting(false);
    setResult(submission);

    if (submission.state !== "accepted") {
      resetCaptcha();
    }

    if (submission.state === "validation") {
      setErrors((current) => ({ ...current, ...serverValidationErrors(submission.fields) }));
    }

    if (submission.state === "accepted") {
      setValues(INITIAL_VALUES);
      setErrors({});
      idempotencyKeyRef.current = null;
      setCaptchaUnavailable(false);
    }
  }

  if (result?.state === "accepted") {
    return (
      <div className="public-contact-result" role="status" aria-live="polite">
        <p className="public-eyebrow">Message received</p>
        <h2>Thank you for reaching out.</h2>
        <p>Your message has been received by the office.</p>
        {result.referenceCode ? (
          <p className="public-contact-result__reference">
            Reference code: <strong>{result.referenceCode}</strong>
          </p>
        ) : null}
        <Button type="button" variant="outline" onClick={() => setResult(null)}>
          Send another message
        </Button>
      </div>
    );
  }

  const emailRequired = EMAIL_REQUIRED_TYPES.has(values.submission_type);

  return (
    <form
      aria-busy={isSubmitting}
      className="public-contact-form"
      noValidate
      onSubmit={handleSubmit}
    >
      {result ? (
        <p className="public-contact-form__notice" role="alert">
          {resultMessage(result)}
        </p>
      ) : null}

      {result?.state === "challenge_required" ? (
        <div className="public-contact-form__challenge" aria-live="polite">
          <p>
            Please complete the quick verification. Your message will stay here while we check
            it.
          </p>
          <TurnstileField
            action="contact"
            disabled={isSubmitting}
            key={captchaResetKey}
            onError={() => {
              resetCaptcha();
              setCaptchaUnavailable(false);
            }}
            onToken={(token) => {
              setCaptchaToken(token);
              setCaptchaUnavailable(false);
            }}
            onUnavailable={() => {
              setCaptchaToken(null);
              setCaptchaUnavailable(true);
            }}
            resetKey={captchaResetKey}
          />
        </div>
      ) : null}

      <div className="public-contact-form__grid">
        <ContactSelect
          disabled={isSubmitting}
          id="contact-submission-type"
          label="What would you like to share?"
          onValueChange={(value) => updateField("submission_type", value as PublicContactFormValues["submission_type"])}
          options={SUBMISSION_TYPES}
          value={values.submission_type}
        />
        <ContactSelect
          disabled={isSubmitting}
          id="contact-affiliation"
          label="I am a…"
          onValueChange={(value) => updateField("affiliation", value as PublicContactFormValues["affiliation"])}
          options={AFFILIATIONS}
          value={values.affiliation}
        />
        <ContactInput
          autoComplete="name"
          error={errors.name}
          field="name"
          label="Name"
          maxLength={CONTACT_FIELD_LIMITS.name}
          onChange={(value) => updateField("name", value)}
          disabled={isSubmitting}
          value={values.name}
        />
        <ContactInput
          autoComplete="email"
          error={errors.email}
          field="email"
          label={emailRequired ? "Email" : "Email (optional)"}
          maxLength={CONTACT_FIELD_LIMITS.email}
          onChange={(value) => updateField("email", value)}
          disabled={isSubmitting}
          required={emailRequired}
          type="email"
          value={values.email}
        />
        <ContactInput
          autoComplete="tel"
          error={errors.phone}
          field="phone"
          label="Phone (optional)"
          maxLength={CONTACT_FIELD_LIMITS.phone}
          onChange={(value) => updateField("phone", value)}
          disabled={isSubmitting}
          type="tel"
          value={values.phone}
        />
        <ContactInput
          error={errors.subject}
          field="subject"
          label="Subject"
          maxLength={CONTACT_FIELD_LIMITS.subject}
          required
          onChange={(value) => updateField("subject", value)}
          disabled={isSubmitting}
          value={values.subject}
        />
      </div>

      <div className="public-contact-form__field public-contact-form__field--message">
        <Label htmlFor="contact-message-body">Message</Label>
        <Textarea
          aria-describedby={errors.message_body ? fieldErrorId("message_body") : undefined}
          aria-invalid={Boolean(errors.message_body)}
          id="contact-message-body"
          maxLength={CONTACT_FIELD_LIMITS.message_body}
          name="message_body"
          onChange={(event) => updateField("message_body", event.target.value)}
          rows={8}
          disabled={isSubmitting}
          required
          value={values.message_body}
        />
        {errors.message_body ? (
          <FieldError id={fieldErrorId("message_body")} className="public-contact-form__error">
            {errors.message_body}
          </FieldError>
        ) : null}
      </div>

      <fieldset className="public-contact-form__consents">
        <legend>Before you send</legend>
        <ConsentCheckbox
          checked={values.privacy_acknowledged}
          error={errors.privacy_acknowledged}
          id="contact-privacy-acknowledged"
          disabled={isSubmitting}
          onCheckedChange={(checked) => updateField("privacy_acknowledged", checked)}
          required
        >
          I have read and acknowledge the <Link href="/privacy">COMPASS Privacy Notice</Link>.
        </ConsentCheckbox>
        <ConsentCheckbox
          checked={values.urgent_support_disclaimer_acknowledged}
          error={errors.urgent_support_disclaimer_acknowledged}
          id="contact-urgent-disclaimer"
          disabled={isSubmitting}
          onCheckedChange={(checked) => updateField("urgent_support_disclaimer_acknowledged", checked)}
          required
        >
          I understand that this form is not for urgent or emergency support.
        </ConsentCheckbox>
      </fieldset>

      <div className="public-contact-form__actions">
        <Button
          disabled={
            isSubmitting ||
            captchaUnavailable ||
            (result?.state === "challenge_required" && !captchaToken)
          }
          type="submit"
        >
          {isSubmitting ? "Sending…" : "Send message"}
        </Button>
        <p>
          For immediate safety concerns, use local emergency support or contact the office through
          an official channel.
        </p>
      </div>
    </form>
  );
}

function ContactInput({
  autoComplete,
  error,
  field,
  label,
  maxLength,
  onChange,
  disabled,
  required,
  type = "text",
  value,
}: {
  autoComplete?: string;
  error?: string;
  field: "name" | "email" | "phone" | "subject";
  label: string;
  maxLength: number;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  type?: "email" | "tel" | "text";
  value: string;
}) {
  const id = `contact-${field}`;

  return (
    <div className="public-contact-form__field">
      <Label htmlFor={id}>{label}</Label>
      <Input
        autoComplete={autoComplete}
        aria-describedby={error ? fieldErrorId(field) : undefined}
        aria-invalid={Boolean(error)}
        disabled={disabled}
        id={id}
        maxLength={maxLength}
        name={field}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
      {error ? (
        <FieldError id={fieldErrorId(field)} className="public-contact-form__error">
          {error}
        </FieldError>
      ) : null}
    </div>
  );
}

function ContactSelect<T extends readonly { value: string; label: string }[]>({
  id,
  label,
  disabled,
  onValueChange,
  options,
  value,
}: {
  id: string;
  label: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
  options: T;
  value: T[number]["value"];
}) {
  return (
    <div className="public-contact-form__field">
      <Label htmlFor={id}>{label}</Label>
      <Select
        disabled={disabled}
        onValueChange={(nextValue) => nextValue && onValueChange(nextValue)}
        value={value}
      >
        <SelectTrigger id={id} className="w-full public-contact-form__select-trigger">
          <SelectValue>{options.find((option) => option.value === value)?.label}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ConsentCheckbox({
  checked,
  children,
  disabled,
  error,
  id,
  onCheckedChange,
  required,
}: {
  checked: boolean;
  children: ReactNode;
  error?: string;
  id: string;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  required?: boolean;
}) {
  const field = id === "contact-privacy-acknowledged"
    ? "privacy_acknowledged"
    : "urgent_support_disclaimer_acknowledged";

  return (
    <div className="public-contact-form__consent">
      <Checkbox
        aria-describedby={error ? fieldErrorId(field) : undefined}
        aria-invalid={Boolean(error)}
        checked={checked}
        disabled={disabled}
        id={id}
        onCheckedChange={onCheckedChange}
        required={required}
      />
      <div>
        <Label htmlFor={id}>{children}</Label>
        {error ? (
          <FieldError id={fieldErrorId(field)} className="public-contact-form__error">
            {error}
          </FieldError>
        ) : null}
      </div>
    </div>
  );
}
