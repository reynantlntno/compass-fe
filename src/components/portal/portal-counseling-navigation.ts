import { PORTAL_CAPABILITIES } from "./portal-navigation";

export const COUNSELING_NAV_ITEMS = [
  { href: "/portal/counseling?section=sessions", label: "Sessions", value: "sessions" },
  { href: "/portal/counseling?section=routine-interviews", label: "Routine interviews", value: "routine-interviews" },
  { href: "/portal/counseling?section=cases", label: "Cases", value: "cases" },
  { href: "/portal/counseling?section=urgent-support", label: "Urgent support", value: "urgent-support" },
] as const;

export type CounselingNavItem = (typeof COUNSELING_NAV_ITEMS)[number];

export function getCounselingNavItems(hasCapability: (capability: string) => boolean): CounselingNavItem[] {
  return COUNSELING_NAV_ITEMS.filter((item) =>
    item.value === "urgent-support"
      ? hasCapability(PORTAL_CAPABILITIES.urgentSupportQueueReview)
      : hasCapability(PORTAL_CAPABILITIES.counselingSessionsQueueView),
  );
}
