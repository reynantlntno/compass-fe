import { Suspense } from "react";

import {
  PortalStudentDirectoryLoading,
  PortalStudentDirectoryPage,
} from "@/components/portal/portal-student-directory";

export const dynamic = "force-dynamic";

export default function PortalStudentsRoute() {
  return (
    <Suspense fallback={<PortalStudentDirectoryLoading />}>
      <PortalStudentDirectoryPage />
    </Suspense>
  );
}
