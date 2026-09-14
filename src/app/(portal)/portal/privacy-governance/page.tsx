import { Suspense } from "react";

import {
  PortalPrivacyGovernanceLoading,
  PortalPrivacyGovernancePage,
} from "@/components/portal/portal-privacy-governance";

export const dynamic = "force-dynamic";

export default function PortalPrivacyGovernanceRoute() {
  return (
    <Suspense fallback={<PortalPrivacyGovernanceLoading />}>
      <PortalPrivacyGovernancePage />
    </Suspense>
  );
}
