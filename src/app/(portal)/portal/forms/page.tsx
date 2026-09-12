import { Suspense } from "react";

import {
  PortalFormsLoading,
  PortalFormsPage,
} from "@/components/portal/portal-forms";

export const dynamic = "force-dynamic";

export default function PortalFormsRoute() {
  return (
    <Suspense fallback={<PortalFormsLoading />}>
      <PortalFormsPage />
    </Suspense>
  );
}
