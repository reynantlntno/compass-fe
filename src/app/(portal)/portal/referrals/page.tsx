import { Suspense } from "react";

import {
  PortalReferralsLoading,
  PortalReferralsPage,
} from "@/components/portal/portal-referrals";

export const dynamic = "force-dynamic";

export default function PortalReferralsRoute() {
  return (
    <Suspense fallback={<PortalReferralsLoading />}>
      <PortalReferralsPage />
    </Suspense>
  );
}