"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function ContentRetryButton() {
  const router = useRouter();

  return (
    <Button type="button" variant="outline" onClick={() => router.refresh()}>
      Try again
    </Button>
  );
}
