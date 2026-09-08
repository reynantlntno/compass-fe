import { cache } from "react";

import {
  contentPublicAnnouncement,
  contentPublicAnnouncements,
  contentPublicResource,
  contentPublicResources,
} from "@/lib/api/generated/content/content";
import type {
  ContentPageResultSchema,
  PublicContentSchema,
} from "@/lib/api/generated/model";

export type PublicContentKind = "announcements" | "resources";

export type PublicContentListState =
  | {
      state: "ready";
      items: PublicContentSchema[];
      page: number;
      pageSize: number;
      total: number;
    }
  | {
      state: "empty";
      items: [];
      page: number;
      pageSize: number;
      total: 0;
    }
  | {
      state: "out_of_range";
      items: [];
      page: number;
      pageSize: number;
      total: number;
    }
  | {
      state: "unavailable";
      page: number;
    };

export type PublicContentDetailState =
  | { state: "ready"; data: PublicContentSchema }
  | { state: "not_found" }
  | { state: "unavailable" };

const safeSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isSafePublicSlug(value: string) {
  return safeSlugPattern.test(value);
}

export function parsePublicPage(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (!rawValue || !/^\d+$/.test(rawValue)) return 1;

  const page = Number(rawValue);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function isPageResult(value: unknown): value is ContentPageResultSchema {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  return (
    Array.isArray(candidate.items) &&
    typeof candidate.page === "number" &&
    typeof candidate.page_size === "number" &&
    typeof candidate.total === "number"
  );
}

async function loadContentIndex(
  kind: PublicContentKind,
  page: number,
): Promise<PublicContentListState> {
  try {
    const response =
      kind === "announcements"
        ? await contentPublicAnnouncements({ page })
        : await contentPublicResources({ page });

    if (response.status !== 200 || !isPageResult(response.data)) {
      return { state: "unavailable", page };
    }

    const pageSize = Math.max(1, response.data.page_size);
    const total = Math.max(0, response.data.total);

    if (total === 0) {
      return {
        state: "empty",
        items: [],
        page,
        pageSize,
        total: 0,
      };
    }

    if (response.data.items.length === 0) {
      return {
        state: "out_of_range",
        items: [],
        page,
        pageSize,
        total,
      };
    }

    return {
      state: "ready",
      items: response.data.items,
      page,
      pageSize,
      total,
    };
  } catch {
    return { state: "unavailable", page };
  }
}

export const getPublicContentIndex = cache(loadContentIndex);

async function loadContentDetail(
  kind: PublicContentKind,
  slug: string,
): Promise<PublicContentDetailState> {
  try {
    const response =
      kind === "announcements"
        ? await contentPublicAnnouncement(slug)
        : await contentPublicResource(slug);

    if (response.status === 404) return { state: "not_found" };
    if (response.status !== 200 || !response.data) {
      return { state: "unavailable" };
    }

    return { state: "ready", data: response.data };
  } catch {
    return { state: "unavailable" };
  }
}

export const getPublicContentDetail = cache(loadContentDetail);
