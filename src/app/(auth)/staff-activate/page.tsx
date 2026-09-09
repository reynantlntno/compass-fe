import type { Metadata } from "next";

import { ActivationPage } from "@/components/auth/activation-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Staff account activation",
  description: "Finish activating a COMPASS staff account.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function StaffActivationPage() {
  return <ActivationPage kind="staff" />;
}
