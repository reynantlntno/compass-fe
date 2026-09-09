import { Suspense } from "react";

import {
  PortalAccountSettings,
  PortalAccountSettingsLoading,
} from "@/components/portal/portal-account-settings";

export const dynamic = "force-dynamic";

export default function PortalAccountSettingsRoute() {
  return (
    <Suspense fallback={<PortalAccountSettingsLoading />}>
      <PortalAccountSettings />
    </Suspense>
  );
}
