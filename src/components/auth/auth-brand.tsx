import Link from "next/link";

import type { PublicIdentityConfig } from "@/lib/public-identity";

export function AuthBrand({ identity }: { identity: PublicIdentityConfig }) {
  return (
    <Link
      aria-label={`${identity.productName} home`}
      className="auth-brand"
      href="/"
    >
      <span className="auth-brand__copy">
        <span className="auth-brand__product">{identity.productName}</span>
        <span className="auth-brand__office">{identity.officeName}</span>
      </span>
    </Link>
  );
}
