import type { Metadata } from "next";

import { RecoveryResetForm } from "@/components/auth/recovery-reset-form";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Set a new COMPASS account password.",
  robots: { index: false, follow: false },
};

export default function RecoveryResetPage() {
  return <RecoveryResetForm />;
}
