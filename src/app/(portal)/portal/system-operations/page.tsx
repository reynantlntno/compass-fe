import { Suspense } from "react";

import {
  PortalSystemOperationsLoading,
  PortalSystemOperationsPage,
} from "@/components/portal/portal-system-operations";

export const dynamic = "force-dynamic";

export default function PortalSystemOperationsRoute() {
  return (
    <Suspense fallback={<PortalSystemOperationsLoading />}>
      <PortalSystemOperationsPage />
    </Suspense>
  );
}
