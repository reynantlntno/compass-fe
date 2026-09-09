import type { ReactNode } from "react";

import { PortalGate } from "@/components/auth/portal-gate";
import { getPublicBranding } from "@/lib/branding";

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const branding = await getPublicBranding();

  return <PortalGate branding={branding}>{children}</PortalGate>;
}
