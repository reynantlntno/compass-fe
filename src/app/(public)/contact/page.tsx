import type { Metadata } from "next";

import { PublicContactContent } from "@/components/public/public-contact-page";
import { getPublicIdentity } from "@/lib/public-identity";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const identity = await getPublicIdentity();

  return {
    title: `Contact ${identity.officeName} | ${identity.institutionName}`,
    description: `Send a message to ${identity.officeName}.`,
  };
}

export default async function ContactPage() {
  const identity = await getPublicIdentity();

  return (
    <article
      aria-labelledby="contact-heading"
      className="public-section public-content-page public-contact-page"
    >
      <div className="public-shell public-reading-width">
        <PublicContactContent identity={identity} />
      </div>
    </article>
  );
}
