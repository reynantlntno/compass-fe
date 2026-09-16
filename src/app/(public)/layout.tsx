import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { getPublicIdentity } from "@/lib/public-identity";
import { getCompassSocialMetadata } from "@/lib/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const identity = await getPublicIdentity();
  const title = `${identity.officeName} | ${identity.institutionName}`;
  const description = `${identity.productName} support from the ${identity.officeName} of ${identity.institutionName}.`;

  return {
    title: {
      absolute: title,
    },
    description,
    ...getCompassSocialMetadata(title, description, `${identity.productName} — ${identity.officeName}`),
  };
}

export default async function PublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  const identity = await getPublicIdentity();

  return (
    <div className="public-site flex min-h-screen flex-col bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none focus:ring-3 focus:ring-ring/50"
      >
        Skip to main content
      </a>
      <SiteHeader identity={identity} />
      <main id="main-content" className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter identity={identity} />
    </div>
  );
}
