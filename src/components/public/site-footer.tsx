import Link from "next/link";

import { BrandAssetImage } from "@/components/public/brand-asset-image";
import { ExternalLink } from "@/components/public/external-link";
import { isExternalUrl, PublicLink } from "@/components/public/public-link";
import type { BrandingConfig, ResolvedBrandAsset } from "@/lib/branding";

function FooterOffice({ branding }: { branding: BrandingConfig }) {
  const location = branding.officeLocation || branding.address;
  if (!branding.email && !branding.phone && !location) return null;

  return (
    <section aria-labelledby="public-footer-office-heading" className="public-footer__link-group">
      <h2 id="public-footer-office-heading">Office</h2>
      <address className="public-footer__contact-links">
        {branding.email ? (
          <a href={`mailto:${branding.email}`}>{branding.email}</a>
        ) : null}
        {branding.phone ? (
          <a href={`tel:${branding.phone.replace(/[^0-9+]/g, "")}`}>
            {branding.phone}
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

function PrivacyCredential({
  asset,
  noticeLink,
  fallbackLabel,
  ownerLabel,
}: {
  asset: ResolvedBrandAsset;
  noticeLink: BrandingConfig["privacyLinks"][number] | undefined;
  fallbackLabel: string;
  ownerLabel: string;
}) {
  const credentialLabel = `${ownerLabel}: ${asset.alt}`;
  const credential = (
    <>
      <span className="public-footer__privacy-marks">
        <BrandAssetImage
          asset={asset}
          className="public-footer__privacy-mark h-auto"
          fallbackLabel={fallbackLabel}
        />
      </span>
      <span className="public-footer__privacy-credential-copy">
        <span className="public-footer__privacy-credential-owner">{ownerLabel}</span>
        <span className="public-footer__privacy-credential-label">{asset.alt}</span>
      </span>
    </>
  );

  return (
    <div className="public-footer__privacy-credential">
      {noticeLink ? (
        <ExternalLink
          ariaLabel={`${credentialLabel}; open privacy notice`}
          className="public-footer__privacy-credential-link"
          href={noticeLink.url}
        >
          {credential}
        </ExternalLink>
      ) : (
        <div className="public-footer__privacy-credential-link">{credential}</div>
      )}
    </div>
  );
}

function FooterPrivacy({ branding }: { branding: BrandingConfig }) {
  const compassPrivacyHref = "/privacy";
  const privacyLinks = branding.privacyLinks.filter((link) => {
    try {
      const url = new URL(link.url, "https://compass.invalid");
      return !(url.origin === "https://compass.invalid" && url.pathname === compassPrivacyHref);
    } catch {
      return true;
    }
  });

  const noticeLink = privacyLinks.find((link) => isExternalUrl(link.url));
  const ownerLabel = noticeLink?.owner_label?.trim() || branding.institutionName;

  return (
    <section aria-labelledby="public-footer-privacy-heading" className="public-footer__privacy public-footer__link-group">
      <h2 id="public-footer-privacy-heading">Privacy</h2>
      <div className="public-footer__privacy-links">
        <PublicLink
          href={compassPrivacyHref}
          label={`${branding.productName} Privacy Notice`}
        />
        {privacyLinks.length > 0 ? (
          privacyLinks.map((link) => (
            <PublicLink
              key={`${link.owner_type}-${link.url}`}
              href={link.url}
              label={link.label}
            />
          ))
        ) : null}
      </div>
      {branding.footerPrivacyAssets.length > 0 ? (
        <>
          {branding.footerPrivacyAssets.map((asset) => (
            <PrivacyCredential
              key={asset.id}
              asset={asset}
              fallbackLabel={branding.productName}
              noticeLink={noticeLink}
              ownerLabel={ownerLabel}
            />
          ))}
        </>
      ) : null}
    </section>
  );
}

function FooterLinks({ branding }: { branding: BrandingConfig }) {
  if (branding.footerLinks.length === 0) return null;

  return (
    <nav aria-label="Approved public links" className="public-footer__links public-footer__link-group">
      <h2>Public links</h2>
      <ul>
        {branding.footerLinks.map((link) => (
          <li key={`${link.owner_type}-${link.url}`}>
            <PublicLink href={link.url} label={link.label} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SiteFooter({ branding }: { branding: BrandingConfig }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="public-footer">
      <div className="public-shell public-footer__inner">
        <div className="public-footer__identity">
          <div className="public-footer__marks" aria-label="Institutional marks">
            {branding.footerIdentityAssets.length > 0 ? (
              branding.footerIdentityAssets.map((asset) => (
                <BrandAssetImage
                  key={asset.id}
                  asset={asset}
                  className="public-footer__mark h-auto"
                  fallbackLabel={branding.productName}
                />
              ))
            ) : (
              <span className="public-brand-asset-fallback">
                {branding.productName}
              </span>
            )}
          </div>
          <div className="public-footer__identity-copy">
            <p className="public-footer__institution">{branding.institutionName}</p>
            <p className="public-footer__office">{branding.officeName}</p>
          </div>
        </div>

        <div className="public-footer__details">
          <FooterOffice branding={branding} />
          <div className="public-footer__link-groups">
            <FooterPrivacy branding={branding} />
            <FooterLinks branding={branding} />
          </div>
        </div>
      </div>
      <div className="public-shell public-footer__meta">
        <p>© {currentYear} {branding.institutionName}</p>
        <p>{branding.productName} is a service of {branding.officeName}.</p>
        <p>Developed for {branding.officeName}.</p>
      </div>
    </footer>
  );
}
