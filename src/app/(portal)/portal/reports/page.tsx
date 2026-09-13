import { Suspense } from "react";

import {
  PortalReportsLoading,
  PortalReportsPage,
} from "@/components/portal/portal-reports";

export const dynamic = "force-dynamic";

export default function PortalReportsRoute() {
  return (
    <Suspense fallback={<PortalReportsLoading />}>
      <PortalReportsPage />
    </Suspense>
  );
}
