import { PORTAL_CAPABILITIES } from "./portal-navigation";

export const REFERRALS_NAV_ITEMS = [
  { href: "/portal/referrals?section=referrals", label: "Referrals", value: "referrals" },
  { href: "/portal/referrals?section=call-slips", label: "Call Slips", value: "call-slips" },
] as const;

export type ReferralsSection = (typeof REFERRALS_NAV_ITEMS)[number]["value"];
export type ReferralsNavItem = (typeof REFERRALS_NAV_ITEMS)[number];

export function getReferralsNavItems(hasCapability: (capability: string) => boolean): ReferralsNavItem[] {
  return REFERRALS_NAV_ITEMS.filter((item) =>
    item.value === "referrals"
      ? hasCapability(PORTAL_CAPABILITIES.referralsQueueView)
      : hasCapability(PORTAL_CAPABILITIES.callSlipsQueueView),
  );
}