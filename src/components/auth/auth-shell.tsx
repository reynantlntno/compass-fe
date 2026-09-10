import Link from "next/link";
import type { ReactNode } from "react";

import { AuthBrand } from "@/components/auth/auth-brand";
import { AuthCard } from "@/components/auth/auth-card";
import type { BrandingConfig } from "@/lib/branding";

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

        <section
          aria-label={`${branding.productName} account access`}
          className="auth-card-stack"
        >
          <AuthCard as="header" variant="identity">
            <AuthBrand branding={branding} />
          </AuthCard>
          <AuthCard as="section" id="auth-panel-content" variant="content">
            {children}
          </AuthCard>
          <AuthCard as="footer" variant="notice">
            <p>
              {branding.productName} handles account information as described in the{" "}
              <Link href="/privacy">COMPASS Privacy Notice</Link>.
            </p>
          </AuthCard>
        </section>
      </main>
    </div>
  );
}
