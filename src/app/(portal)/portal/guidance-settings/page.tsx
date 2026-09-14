import { Suspense } from "react";

import {
  PortalGuidanceSettingsLoading,
  PortalGuidanceSettingsPage,
} from "@/components/portal/portal-guidance-settings";

export const dynamic = "force-dynamic";

export default function PortalGuidanceSettingsRoute() {
  return (
    <Suspense fallback={<PortalGuidanceSettingsLoading />}>
      <PortalGuidanceSettingsPage />
    </Suspense>
  );
}
