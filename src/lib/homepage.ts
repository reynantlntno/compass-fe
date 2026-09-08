import { cache } from "react";

import {
  contentPublicAnnouncements,
  contentPublicResources,
  contentPublicServiceGuide,
} from "@/lib/api/generated/content/content";
import type {
  ContentPageResultSchema,
  PublicServiceGuideSchema,
} from "@/lib/api/generated/model";

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

function officialServiceGuide(
  result: PromiseSettledResult<Awaited<ReturnType<typeof contentPublicServiceGuide>>>,
) {
  if (
    result.status !== "fulfilled" ||
    result.value.status !== 200 ||
    !result.value.data.has_approved_revision ||
    !result.value.data.readiness.official
  ) {
    return null;
  }

  return result.value.data as PublicServiceGuideSchema;
}

export const getHomepageContent = cache(async () => {
  const [announcementsResult, resourcesResult, serviceGuideResult] =
    await Promise.allSettled([
      contentPublicAnnouncements({ page: 1, page_size: 2 }),
      contentPublicResources({ page: 1, page_size: 3 }),
      contentPublicServiceGuide(),
    ]);

  return {
    announcements: pageResult(announcementsResult)?.items ?? [],
    resources: pageResult(resourcesResult)?.items ?? [],
    serviceGuide: officialServiceGuide(serviceGuideResult),
  };
});
