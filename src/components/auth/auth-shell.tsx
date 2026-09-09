import Link from "next/link";
import type { ReactNode } from "react";

import { BrandAssetImage } from "@/components/public/brand-asset-image";
import type { BrandingConfig } from "@/lib/branding";

function AuthBrand({ branding }: { branding: BrandingConfig }) {
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

export function AuthShell({
  branding,
  children,
}: {
  branding: BrandingConfig;
  children: ReactNode;
}) {
  return (
    <div className="auth-page">
      <a className="auth-skip-link" href="#auth-panel-content">
        Skip to account access
      </a>
      <main className="auth-shell">
        <Link className="auth-back-link" href="/">
          Back to {branding.productName}
        </Link>

        <section className="auth-panel" aria-label={`${branding.productName} account access`}>
          <div className="auth-panel__identity">
            <AuthBrand branding={branding} />
          </div>
          <div className="auth-panel__content" id="auth-panel-content">
            {children}
          </div>
          <footer className="auth-panel__footer">
            <p>
              {branding.productName} handles account information as described in the{" "}
              <Link href="/privacy">COMPASS Privacy Notice</Link>.
            </p>
          </footer>
        </section>
      </main>
    </div>
  );
}
