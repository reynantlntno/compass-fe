import type { ReactNode } from "react";

import { PortalGate } from "@/components/auth/portal-gate";
import { getPublicIdentity } from "@/lib/public-identity";

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const identity = await getPublicIdentity();

  return <PortalGate identity={identity}>{children}</PortalGate>;
}
