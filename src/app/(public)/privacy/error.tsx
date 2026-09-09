"use client";

import { PublicPrivacyError } from "@/components/public/public-privacy-page";

export default function PrivacyError({ reset }: { reset: () => void }) {
  return <PublicPrivacyError reset={reset} />;
}
