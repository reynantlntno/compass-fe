import Link from "next/link";

import { BrandAssetImage } from "@/components/public/brand-asset-image";
import type { BrandingConfig } from "@/lib/branding";

export function AuthBrand({ branding }: { branding: BrandingConfig }) {
  return (
    <Link
      aria-label={`${branding.productName} home`}
      className="auth-brand"
      href="/"
    >
      {branding.headerAssets.length > 0 ? (
        <span
          aria-label="Institutional identity marks"
          className="auth-brand__marks"
        >
          {branding.headerAssets.map((asset) => (
            <BrandAssetImage
              key={asset.id}
              asset={asset}
              className="auth-brand__mark"
              fallbackLabel={branding.productName}
            />
          ))}
        </span>
      ) : null}
      <span className="auth-brand__copy">
        <span className="auth-brand__product">{branding.productName}</span>
        <span className="auth-brand__office">{branding.officeName}</span>
      </span>
    </Link>
  );
}
