import { Suspense } from "react";

import {
  PortalAppointmentsLoading,
  PortalAppointmentsPage,
} from "@/components/portal/portal-appointments";

export const dynamic = "force-dynamic";

export default function PortalAppointmentsRoute() {
  return (
    <Suspense fallback={<PortalAppointmentsLoading />}>
      <PortalAppointmentsPage />
    </Suspense>
  );
}
