import { Suspense } from "react";

import {
  PortalNotificationDeliveryLoading,
  PortalNotificationDeliveryPage,
} from "@/components/portal/portal-notification-delivery";

export const dynamic = "force-dynamic";

export default function PortalNotificationDeliveryRoute() {
  return (
    <Suspense fallback={<PortalNotificationDeliveryLoading />}>
      <PortalNotificationDeliveryPage />
    </Suspense>
  );
}
