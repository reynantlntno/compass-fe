import { systemPublicStatus } from "@/lib/api/generated/system/system";
import {
  normalizePublicServiceStatusResponse,
  type ServiceStatusView,
} from "@/lib/system-status";

export async function getInitialServiceStatus(): Promise<ServiceStatusView> {
  try {
    const response = await systemPublicStatus({
      cache: "no-store",
      credentials: "omit",
    });

    return normalizePublicServiceStatusResponse(response);
  } catch {
    return { kind: "unavailable" };
  }
}
