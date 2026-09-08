"use client";

import { PublicContentError } from "@/components/public/public-content-pages";

export default function ResourcesError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PublicContentError kind="resources" reset={reset} />;
}
