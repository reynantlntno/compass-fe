"use client";

import { PublicAboutError } from "@/components/public/public-about-page";

export default function AboutError({ reset }: { reset: () => void }) {
  return <PublicAboutError reset={reset} />;
}
