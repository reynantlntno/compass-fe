import { ExternalLink } from "@/components/public/external-link";
import { BrandAssetImage } from "@/components/public/brand-asset-image";
import { isExternalUrl, PublicLink } from "@/components/public/public-link";
import type { BrandingConfig, ResolvedBrandAsset } from "@/lib/branding";

function FooterOffice({ branding }: { branding: BrandingConfig }) {
  const location = branding.officeLocation || branding.address;
  if (!branding.email && !branding.phone && !location) return null;

  return (
    <section aria-labelledby="public-footer-office-heading" className="public-footer__link-group">
      <h2 id="public-footer-office-heading">Office</h2>
      <div className="public-footer__contact-links">
        {branding.email ? (
          <a href={`mailto:${branding.email}`}>{branding.email}</a>
        ) : null}
        {branding.phone ? (
          <a href={`tel:${branding.phone.replace(/[^0-9+]/g, "")}`}>
            {branding.phone}
          </a>
        ) : null}
        {location ? <p>{location}</p> : null}
      </div>
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
      <span>{credentialLabel}</span>
    </>
  );

  return (
    <div className="public-footer__privacy-credential">
      {noticeLink ? (
        <ExternalLink
          aria-label={`${credentialLabel}; open privacy notice`}
          className="public-footer__privacy-credential-link"
          href={noticeLink.url}
          showArrow={false}
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
  if (branding.privacyLinks.length === 0 && branding.footerPrivacyAssets.length === 0) {
    return null;
  }

  const noticeLink = branding.privacyLinks.find((link) => isExternalUrl(link.url));
  const ownerLabel = noticeLink?.owner_label?.trim() || branding.institutionName;

  return (
    <section aria-labelledby="public-footer-privacy-heading" className="public-footer__privacy public-footer__link-group">
      <h2 id="public-footer-privacy-heading">Privacy</h2>
      {branding.privacyLinks.length > 0 ? (
        <div className="public-footer__privacy-links">
          {branding.privacyLinks.map((link) => (
            <PublicLink
              key={`${link.owner_type}-${link.url}`}
              href={link.url}
              label={link.label}
            />
          ))}
        </div>
      ) : null}
      {branding.footerPrivacyAssets.map((asset) => (
        <PrivacyCredential
          key={asset.id}
          asset={asset}
          fallbackLabel={branding.productName}
          noticeLink={noticeLink}
          ownerLabel={ownerLabel}
        />
      ))}
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
            <p className="public-footer__product">{branding.productName}</p>
          </div>
        </div>

        <div className="public-footer__links-column">
          <FooterOffice branding={branding} />
          <FooterPrivacy branding={branding} />
          <FooterLinks branding={branding} />
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
