import { cache } from "react";

import {
  contentPublicAnnouncements,
  contentPublicResources,
} from "@/lib/api/generated/content/content";
import type { ContentPageResultSchema } from "@/lib/api/generated/model";
import { getPublicServiceGuide } from "@/lib/public-service-guide";

function pageResult(
  result:
    | PromiseSettledResult<Awaited<ReturnType<typeof contentPublicAnnouncements>>>
    | PromiseSettledResult<Awaited<ReturnType<typeof contentPublicResources>>>,
) {
  if (result.status !== "fulfilled" || result.value.status !== 200) {
    return null;
  }

  return result.value.data as ContentPageResultSchema;
}

export const getHomepageContent = cache(async () => {
  const [announcementsResult, resourcesResult, serviceGuideResult] =
    await Promise.allSettled([
      contentPublicAnnouncements({ page: 1, page_size: 2 }),
      contentPublicResources({ page: 1, page_size: 3 }),
      getPublicServiceGuide(),
    ]);

  const serviceGuide =
    serviceGuideResult.status === "fulfilled" &&
    serviceGuideResult.value.state === "ready"
      ? serviceGuideResult.value.data
      : null;

  return {
    announcements: pageResult(announcementsResult)?.items ?? [],
    resources: pageResult(resourcesResult)?.items ?? [],
    serviceGuide,
  };
});
