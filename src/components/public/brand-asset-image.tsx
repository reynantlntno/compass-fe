"use client";

import Image from "next/image";
import { useState } from "react";

import type { ResolvedBrandAsset } from "@/lib/branding";
import { cn } from "@/lib/utils";

export function BrandAssetImage({
  asset,
  className,
  fallbackLabel = "COMPASS",
}: {
  asset: ResolvedBrandAsset;
  className?: string;
  fallbackLabel?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={cn("public-brand-asset-fallback", className)}
        role="img"
        aria-label={fallbackLabel}
      >
        {fallbackLabel}
      </span>
    );
  }

  return (
    <Image
      src={asset.src}
      alt={asset.alt}
      width={asset.width}
      height={asset.height}
      unoptimized
      className={cn("h-10 w-auto max-w-48 object-contain object-left", className)}
      onError={() => setFailed(true)}
    />
  );
}
