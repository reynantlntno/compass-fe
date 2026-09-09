import { cache } from "react";

import { privacyNoticeView } from "@/lib/api/generated/privacy/privacy";
import type { PrivacyNoticeSchema } from "@/lib/api/generated/model";

const PUBLIC_PRIVACY_NOTICE_IDENTIFIER = "compass-gco-privacy";
const PUBLIC_PRIVACY_PURPOSE = "compass_public";
const PUBLIC_PRIVACY_LOCALE = "en";

export type PublicPrivacyNoticeState =
  | { state: "ready"; data: PrivacyNoticeSchema }
  | { state: "unavailable" };

function isPrivacyNotice(value: unknown): value is PrivacyNoticeSchema {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.body_html === "string" &&
    candidate.body_html.trim().length > 0 &&
    typeof candidate.version === "string" &&
    candidate.version.trim().length > 0 &&
    (typeof candidate.effective_at === "string" ||
      candidate.effective_at === null ||
      candidate.effective_at === undefined)
  );
}

export const getPublicPrivacyNotice = cache(async (): Promise<PublicPrivacyNoticeState> => {
  try {
    const response = await privacyNoticeView(PUBLIC_PRIVACY_NOTICE_IDENTIFIER, {
      purpose_workflow: PUBLIC_PRIVACY_PURPOSE,
      locale: PUBLIC_PRIVACY_LOCALE,
    });

    if (response.status !== 200 || !isPrivacyNotice(response.data)) {
      return { state: "unavailable" };
    }

    return { state: "ready", data: response.data };
  } catch {
    return { state: "unavailable" };
  }
});
