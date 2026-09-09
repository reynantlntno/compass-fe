import { authorityMe } from "@/lib/api/generated/authority/authority";
import { profilesMe } from "@/lib/api/generated/profiles/profiles";
import { systemHealth } from "@/lib/api/generated/system/system";
import { cookieSessionReadOptions } from "@/lib/api/auth";
import type {
  EffectiveAuthorityProjectionSchema,
  HealthComponentSchema,
  HealthProjectionSchema,
  SelfProfileSchema,
} from "@/lib/api/generated/model";

const MAX_AUTHORITY_CAPABILITY_LENGTH = 160;

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEffectiveAuthorityProjection(
  value: unknown,
): value is EffectiveAuthorityProjectionSchema {
  if (!isRecord(value)) return false;

  const capabilities = value.effective_capabilities;
  return (
    typeof value.account_id === "number" &&
    Number.isSafeInteger(value.account_id) &&
    value.account_id > 0 &&
    Array.isArray(capabilities) &&
    capabilities.every((entry) => {
      if (!isRecord(entry)) return false;
      return (
        typeof entry.capability === "string" &&
        entry.capability.trim().length > 0 &&
        entry.capability.length <= MAX_AUTHORITY_CAPABILITY_LENGTH
      );
    })
  );
}

export async function getCurrentPortalCapabilities(
  userId: number,
  signal?: AbortSignal,
): Promise<string[] | null> {
  try {
    const response = await authorityMe(cookieSessionReadOptions(signal));

    if (
      response.status !== 200 ||
      !isEffectiveAuthorityProjection(response.data) ||
      response.data.account_id !== userId
    ) {
      return null;
    }

    return [
      ...new Set(
        response.data.effective_capabilities.map(({ capability }) =>
          capability.trim(),
        ),
      ),
    ];
  } catch (error) {
    if (isAbortError(error)) throw error;
    return null;
  }
}

function isSelfProfile(value: unknown): value is SelfProfileSchema {
  if (!isRecord(value)) return false;

  const profile = value as Record<string, unknown>;
  return (
    typeof profile.display_name === "string" &&
    profile.display_name.trim().length > 0 &&
    typeof profile.role === "string" &&
    Number.isSafeInteger(profile.user_id)
  );
}

export async function getCurrentPortalProfile(
  signal?: AbortSignal,
): Promise<SelfProfileSchema | null> {
  try {
    const response = await profilesMe(cookieSessionReadOptions(signal));

    if (response.status !== 200 || !isSelfProfile(response.data)) {
      return null;
    }

    return response.data;
  } catch {
    return null;
  }
}

export type PortalSystemHealthState =
  | { kind: "ready"; health: HealthProjectionSchema }
  | { kind: "forbidden" }
  | { kind: "unavailable" };

const HEALTH_STATUSES = new Set(["ok", "warning", "error"]);
const COMPONENT_STATUSES = new Set(["ok", "warning", "error", "skipped"]);
const MAX_HEALTH_COMPONENT_LENGTH = 80;
const MAX_HEALTH_LABEL_LENGTH = 120;
const MAX_HEALTH_MESSAGE_LENGTH = 255;
const MAX_HEALTH_REASON_LENGTH = 100;

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isHealthComponent(value: unknown): value is HealthComponentSchema {
  if (!isRecord(value)) return false;

  const component = value as Record<string, unknown>;
  return (
    typeof component.component === "string" &&
    component.component.trim().length > 0 &&
    component.component.length <= MAX_HEALTH_COMPONENT_LENGTH &&
    typeof component.label === "string" &&
    component.label.trim().length > 0 &&
    component.label.length <= MAX_HEALTH_LABEL_LENGTH &&
    typeof component.status === "string" &&
    COMPONENT_STATUSES.has(component.status) &&
    typeof component.message === "string" &&
    component.message.trim().length > 0 &&
    component.message.length <= MAX_HEALTH_MESSAGE_LENGTH &&
    typeof component.reason_code === "string" &&
    component.reason_code.length <= MAX_HEALTH_REASON_LENGTH &&
    typeof component.duration_ms === "number" &&
    Number.isFinite(component.duration_ms) &&
    component.duration_ms >= 0 &&
    (typeof component.checked_at === "string" ||
      component.checked_at === null ||
      component.checked_at === undefined)
  );
}

function isHealthProjection(value: unknown): value is HealthProjectionSchema {
  if (!isRecord(value)) return false;

  const health = value as Record<string, unknown>;
  const componentCount = health.component_count;
  const failedCount = health.failed_count;
  const warningCount = health.warning_count;
  const components = health.components;

  return (
    typeof health.status === "string" &&
    HEALTH_STATUSES.has(health.status) &&
    isNonNegativeSafeInteger(componentCount) &&
    isNonNegativeSafeInteger(failedCount) &&
    isNonNegativeSafeInteger(warningCount) &&
    Array.isArray(components) &&
    components.length === componentCount &&
    components.every(isHealthComponent)
  );
}

export async function getPortalSystemHealth(
  signal?: AbortSignal,
): Promise<PortalSystemHealthState> {
  try {
    const response = await systemHealth(cookieSessionReadOptions(signal));

    if (response.status === 403) return { kind: "forbidden" };
    if (response.status !== 200 || !isHealthProjection(response.data)) {
      return { kind: "unavailable" };
    }

    return { kind: "ready", health: response.data };
  } catch {
    return { kind: "unavailable" };
  }
}
