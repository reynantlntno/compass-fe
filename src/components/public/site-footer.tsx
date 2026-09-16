import Link from "next/link";

import { PublicLink } from "@/components/public/public-link";
import type { PublicIdentityConfig } from "@/lib/public-identity";

function FooterOffice({ identity }: { identity: PublicIdentityConfig }) {
  const location = identity.officeLocation || identity.address;
  if (!identity.email && !identity.phone && !location) return null;

  return (
    <section aria-labelledby="public-footer-office-heading" className="public-footer__link-group">
      <h2 id="public-footer-office-heading">Office</h2>
      <address className="public-footer__contact-links">
        {identity.email ? (
          <a href={`mailto:${identity.email}`}>{identity.email}</a>
        ) : null}
        {identity.phone ? (
          <a href={`tel:${identity.phone.replace(/[^0-9+]/g, "")}`}>
            {identity.phone}
          </a>
        ) : null}
        {location ? <p>{location}</p> : null}
      </address>
      <Link className="public-footer__contact-link" href="/contact">
        Contact the office
      </Link>
    </section>
  );
}

function FooterPrivacy({ identity }: { identity: PublicIdentityConfig }) {
  const compassPrivacyHref = "/privacy";

  return (
    <section aria-labelledby="public-footer-privacy-heading" className="public-footer__privacy public-footer__link-group">
      <h2 id="public-footer-privacy-heading">Privacy</h2>
      <div className="public-footer__privacy-links">
        <PublicLink
          href={compassPrivacyHref}
          label={`${identity.productName} Privacy Notice`}
        />
        {identity.privacyLinks.length > 0 ? (
          identity.privacyLinks.map((link) => (
            <PublicLink
              key={link.url}
              href={link.url}
              label={link.label}
            />
          ))
        ) : null}
      </div>
    </section>
  );
}

function FooterLinks({ identity }: { identity: PublicIdentityConfig }) {
  if (identity.footerLinks.length === 0) return null;

  return (
    <nav aria-label="Approved public links" className="public-footer__links public-footer__link-group">
      <h2>Public links</h2>
      <ul>
        {identity.footerLinks.map((link) => (
          <li key={link.url}>
            <PublicLink href={link.url} label={link.label} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SiteFooter({ identity }: { identity: PublicIdentityConfig }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="public-footer">
      <div className="public-shell public-footer__inner">
        <div className="public-footer__identity">
          <p className="public-identity-fallback">{identity.productName}</p>
          <div className="public-footer__identity-copy">
            <p className="public-footer__institution">{identity.institutionName}</p>
            <p className="public-footer__office">{identity.officeName}</p>
          </div>
        </div>

        <div className="public-footer__details">
          <FooterOffice identity={identity} />
          <div className="public-footer__link-groups">
            <FooterPrivacy identity={identity} />
            <FooterLinks identity={identity} />
          </div>
        </div>
      </div>
      <div className="public-shell public-footer__meta">
        <p>© {currentYear} {identity.institutionName}</p>
        <p>{identity.productName} is a service of {identity.officeName}.</p>
        <p>Developed for {identity.officeName}.</p>
      </div>
    </footer>
  );
}
