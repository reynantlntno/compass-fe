import { Suspense } from "react";

import {
  PortalNotificationsLoading,
  PortalNotificationsPage,
} from "@/components/portal/portal-notifications";

export const dynamic = "force-dynamic";

export default function PortalNotificationsRoute() {
  return (
    <Suspense fallback={<PortalNotificationsLoading />}>
      <PortalNotificationsPage />
    </Suspense>
  );
}
