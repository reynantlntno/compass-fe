import type { Metadata } from "next";

import { RecoveryRequestForm } from "@/components/auth/recovery-request-form";

export const metadata: Metadata = {
  title: "Account recovery",
  description: "Request COMPASS account recovery instructions.",
  robots: { index: false, follow: false },
};

export default function RecoveryPage() {
  return <RecoveryRequestForm />;
}
