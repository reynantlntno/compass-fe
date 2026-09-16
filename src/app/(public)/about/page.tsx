import type { Metadata } from "next";

import { PublicAboutContent } from "@/components/public/public-about-page";
import { getPublicIdentity } from "@/lib/public-identity";
import { ABOUT_PAGE_CONTENT } from "@/lib/public-site-copy";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const identity = await getPublicIdentity();

  return {
    title: `About ${identity.officeName} | ${identity.productName}`,
    description: ABOUT_PAGE_CONTENT.summary,
  };
}

export default async function AboutPage() {
  const identity = await getPublicIdentity();

  return (
    <article
      aria-labelledby="about-heading"
      className="public-section public-content-page public-about-page"
    >
      <div className="public-shell public-reading-width">
        <PublicAboutContent identity={identity} />
      </div>
    </article>
  );
}
