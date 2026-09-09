"use client";

import { PublicContactError } from "@/components/public/public-contact-page";

export default function ContactError({ reset }: { reset: () => void }) {
  return <PublicContactError reset={reset} />;
}
