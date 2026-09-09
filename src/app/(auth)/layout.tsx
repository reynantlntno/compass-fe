import type { ReactNode } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { getPublicBranding } from "@/lib/branding";

export const dynamic = "force-dynamic";

export default async function AuthLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const branding = await getPublicBranding();

  return <AuthShell branding={branding}>{children}</AuthShell>;
}
