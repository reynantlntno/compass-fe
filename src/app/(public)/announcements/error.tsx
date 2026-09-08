"use client";

import { PublicContentError } from "@/components/public/public-content-pages";

export default function AnnouncementsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PublicContentError kind="announcements" reset={reset} />;
}
