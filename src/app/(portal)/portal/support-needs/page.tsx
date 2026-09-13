import { Suspense } from "react";

import {
  PortalSupportNeedsLoading,
  PortalSupportNeedsPage,
} from "@/components/portal/portal-support-needs";

export const dynamic = "force-dynamic";

export default function PortalSupportNeedsRoute() {
  return (
    <Suspense fallback={<PortalSupportNeedsLoading />}>
      <PortalSupportNeedsPage />
    </Suspense>
  );
}
