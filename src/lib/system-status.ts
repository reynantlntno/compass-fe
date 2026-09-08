import type { PublicServiceStatusSchema } from "@/lib/api/generated/model/publicServiceStatusSchema";

const MAX_STATUS_MESSAGE_LENGTH = 240;
const MAX_STATUS_DATE_LENGTH = 64;
const PUBLIC_STATUS_VALUES = new Set<PublicServiceStatusSchema["status"]>([
  "operational",
  "maintenance_scheduled",
  "maintenance_active",
]);

type MaintenanceStatusView =
  | Readonly<{
      kind: "maintenance_scheduled";
      message: string;
      startsAt: string;
      endsAt: string;
    }>
  | Readonly<{
      kind: "maintenance_active";
      message: string;
      startsAt: string;
      endsAt: string;
    }>;

export type ServiceStatusView =
  | Readonly<{
      kind: "unknown" | "operational" | "offline" | "unavailable";
    }>
  | MaintenanceStatusView;

export const UNKNOWN_SERVICE_STATUS: ServiceStatusView = { kind: "unknown" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parsePublicMessage(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;

  const message = value.trim();
  if (
    message.length === 0 ||
    message.length > MAX_STATUS_MESSAGE_LENGTH ||
    /[\u0000-\u001f\u007f<>]/.test(message) ||
    /[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(message) ||
    /\bwww\./i.test(message) ||
    /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/.test(message)
  ) {
    return undefined;
  }

  return message;
}

function parsePublicDate(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_STATUS_DATE_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    return undefined;
  }

  return value;
}

export function normalizePublicServiceStatus(value: unknown): ServiceStatusView {
  if (!isRecord(value) || typeof value.status !== "string") {
    return { kind: "unavailable" };
  }

  if (!PUBLIC_STATUS_VALUES.has(value.status as PublicServiceStatusSchema["status"])) {
    return { kind: "unavailable" };
  }

  const message = parsePublicMessage(value.message);
  const startsAt = parsePublicDate(value.starts_at);
  const endsAt = parsePublicDate(value.ends_at);

  if (message === undefined || startsAt === undefined || endsAt === undefined) {
    return { kind: "unavailable" };
  }

  if (value.status === "operational") {
    return message === null && startsAt === null && endsAt === null
      ? { kind: "operational" }
      : { kind: "unavailable" };
  }

  if (
    message === null ||
    startsAt === null ||
    endsAt === null ||
    Date.parse(endsAt) <= Date.parse(startsAt)
  ) {
    return { kind: "unavailable" };
  }

  return {
    kind: value.status as "maintenance_scheduled" | "maintenance_active",
    message,
    startsAt,
    endsAt,
  };
}

export function normalizePublicServiceStatusResponse(response: {
  status: number;
  data?: unknown;
}): ServiceStatusView {
  if (response.status !== 200) return { kind: "unavailable" };
  return normalizePublicServiceStatus(response.data);
}
