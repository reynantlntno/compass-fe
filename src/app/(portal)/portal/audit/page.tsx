import { Suspense } from "react";

import {
  PortalAuditLoading,
  PortalAuditPage,
} from "@/components/portal/portal-audit";

export const dynamic = "force-dynamic";

export default function PortalAuditRoute() {
  return (
    <Suspense fallback={<PortalAuditLoading />}>
      <PortalAuditPage />
    </Suspense>
  );
}
