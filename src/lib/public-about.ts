import { cache } from "react";

import { contentPublicPage } from "@/lib/api/generated/content/content";
import type { PublicPageSchema } from "@/lib/api/generated/model";

const PUBLIC_ABOUT_PAGE_KEY = "about";

export type PublicAboutPageState =
  | { state: "ready"; data: PublicPageSchema }
  | { state: "empty" }
  | { state: "unavailable" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPublicAboutPage(value: unknown): value is PublicPageSchema {
  if (!isRecord(value)) return false;

  return (
    value.page_key === PUBLIC_ABOUT_PAGE_KEY &&
    nonEmptyString(value.id) &&
    nonEmptyString(value.title) &&
    typeof value.summary === "string" &&
    nonEmptyString(value.body_html) &&
    typeof value.status === "string" &&
    value.status.toLowerCase() === "published" &&
    typeof value.audience === "string" &&
    value.audience.toLowerCase() === "public" &&
    (typeof value.published_at === "string" ||
      value.published_at === null ||
      value.published_at === undefined)
  );
}

export const getPublicAboutPage = cache(
  async (): Promise<PublicAboutPageState> => {
    try {
      const response = await contentPublicPage(PUBLIC_ABOUT_PAGE_KEY);

      if (response.status === 404) {
        return { state: "empty" };
      }

      if (response.status !== 200 || !isPublicAboutPage(response.data)) {
        return { state: "unavailable" };
      }

      return { state: "ready", data: response.data };
    } catch {
      return { state: "unavailable" };
    }
  },
);
