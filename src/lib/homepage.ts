import { cache } from "react";

import {
  contentPublicAnnouncements,
  contentPublicResources,
} from "@/lib/api/generated/content/content";
import type { ContentListResultSchema } from "@/lib/api/generated/model";

function pageResult(
  result:
    | PromiseSettledResult<Awaited<ReturnType<typeof contentPublicAnnouncements>>>
    | PromiseSettledResult<Awaited<ReturnType<typeof contentPublicResources>>>,
) {
  if (result.status !== "fulfilled" || result.value.status !== 200) {
    return null;
  }

  return result.value.data as ContentListResultSchema;
}

export const getHomepageContent = cache(async () => {
  const [announcementsResult, resourcesResult] = await Promise.allSettled([
    contentPublicAnnouncements({ page: 1, page_size: 2 }),
    contentPublicResources({ page: 1, page_size: 3 }),
  ]);

  return {
    announcements: pageResult(announcementsResult)?.items ?? [],
    resources: pageResult(resourcesResult)?.items ?? [],
  };
});
