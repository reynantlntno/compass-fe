import { Suspense } from "react";

import {
  PortalCounselingLoading,
  PortalCounselingPage,
} from "@/components/portal/portal-counseling";

export const dynamic = "force-dynamic";

export default function PortalCounselingRoute() {
  return (
    <Suspense fallback={<PortalCounselingLoading />}>
      <PortalCounselingPage />
    </Suspense>
  );
}
