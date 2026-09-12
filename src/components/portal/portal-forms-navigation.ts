import { PORTAL_CAPABILITIES } from "./portal-navigation";

export const FORMS_NAV_ITEMS = [
  { href: "/portal/forms?section=inventory", label: "Individual Inventory", value: "inventory" },
  { href: "/portal/forms?section=exit-interviews", label: "Exit Interviews", value: "exit-interviews" },
] as const;

export type FormsSection = (typeof FORMS_NAV_ITEMS)[number]["value"];
export type FormsNavItem = (typeof FORMS_NAV_ITEMS)[number];

export function getFormsNavItems(hasCapability: (capability: string) => boolean): FormsNavItem[] {
  return FORMS_NAV_ITEMS.filter((item) =>
    item.value === "inventory"
      ? hasCapability(PORTAL_CAPABILITIES.inventoryQueueView)
      : hasCapability(PORTAL_CAPABILITIES.exitInterviewsQueueView),
  );
}
