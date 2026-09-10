import { Suspense } from "react";

import {
  PortalBackupsLoading,
  PortalBackupsPage,
} from "@/components/portal/portal-backups";

export const dynamic = "force-dynamic";

export default function PortalBackupsRoute() {
  return (
    <Suspense fallback={<PortalBackupsLoading />}>
      <PortalBackupsPage />
    </Suspense>
  );
}
