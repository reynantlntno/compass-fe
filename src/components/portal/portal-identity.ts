import type { MeSchema } from "@/lib/api/generated/model";

function cleanPart(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function getPortalAccountName(user: MeSchema) {
  return (
    [cleanPart(user.first_name), cleanPart(user.last_name)]
      .filter(Boolean)
      .join(" ") || user.email
  );
}

export function getPortalInitials(user: MeSchema) {
  const parts = [cleanPart(user.first_name), cleanPart(user.last_name)].filter(
    (part): part is string => Boolean(part),
  );
  const initials = parts.map((part) => part.charAt(0)).join("").slice(0, 2);
  return (initials || user.email.slice(0, 2)).toUpperCase();
}

export function getPortalRoleLabel(role: string) {
  return role
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function cleanPortalValue(value: string | null | undefined) {
  return cleanPart(value);
}
