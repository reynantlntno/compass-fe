import { Suspense } from "react";

import {
  PortalAssessmentsLoading,
  PortalAssessmentsPage,
} from "@/components/portal/portal-assessments";

export const dynamic = "force-dynamic";

export default function PortalAssessmentsRoute() {
  return (
    <Suspense fallback={<PortalAssessmentsLoading />}>
      <PortalAssessmentsPage />
    </Suspense>
  );
}
