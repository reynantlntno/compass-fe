import type { Metadata } from "next";

import { ActivationPage } from "@/components/auth/activation-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Student account activation",
  description: "Finish activating a COMPASS student account.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function StudentActivationPage() {
  return <ActivationPage kind="student" />;
}
