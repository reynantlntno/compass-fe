"use client";

import { PublicServiceGuideError } from "@/components/public/public-service-guide";

export default function ServicesError({ reset }: { reset: () => void }) {
  return <PublicServiceGuideError reset={reset} />;
}
