import type { ReactNode } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { getPublicIdentity } from "@/lib/public-identity";

export const dynamic = "force-dynamic";

export default async function AuthLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const identity = await getPublicIdentity();

  return <AuthShell identity={identity}>{children}</AuthShell>;
}
