import { Suspense } from "react";

import {
  PortalGoodMoralLoading,
  PortalGoodMoralPage,
} from "@/components/portal/portal-requests";

export const dynamic = "force-dynamic";

export default function PortalRequestsRoute() {
  return (
    <Suspense fallback={<PortalGoodMoralLoading />}>
      <PortalGoodMoralPage />
    </Suspense>
  );
}
