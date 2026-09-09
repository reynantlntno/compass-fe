import type { Metadata } from "next";

import { PublicContactContent } from "@/components/public/public-contact-page";
import { getPublicBranding } from "@/lib/branding";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPublicBranding();

  return {
    title: `Contact ${branding.officeName} | ${branding.institutionName}`,
    description: `Send a message to ${branding.officeName}.`,
  };
}

export default async function ContactPage() {
  const branding = await getPublicBranding();

  return (
    <article
      aria-labelledby="contact-heading"
      className="public-section public-content-page public-contact-page"
    >
      <div className="public-shell public-reading-width">
        <PublicContactContent branding={branding} />
      </div>
    </article>
  );
}
