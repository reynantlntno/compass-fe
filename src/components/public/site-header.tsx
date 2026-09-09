"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { BrandAssetImage } from "@/components/public/brand-asset-image";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BrandingConfig } from "@/lib/branding";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/contact", label: "Contact" },
  { href: "/announcements", label: "Announcements" },
  { href: "/resources", label: "Resources" },
] as const;

function navigationLinkClassName(isCurrent: boolean) {
  return `public-nav__link${isCurrent ? " is-current" : ""}`;
}

function isCurrentNavigationItem(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

function BrandIdentity({ branding }: { branding: BrandingConfig }) {
  return (
    <span className="public-brand">
      {branding.headerAssets.length > 0 ? (
        <span className="public-brand__marks" aria-label="Institutional identity">
          {branding.headerAssets.map((asset) => (
            <BrandAssetImage
              key={asset.id}
              asset={asset}
              className="public-brand__mark-image"
              fallbackLabel={branding.productName}
            />
          ))}
        </span>
      ) : null}
      <span className="public-brand__copy">
        <span className="public-brand__product">{branding.productName}</span>
        <span className="public-brand__office">
          {branding.officeName}
        </span>
      </span>
    </span>
  );
}

export function SiteHeader({ branding }: { branding: BrandingConfig }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <header className="public-header">
      <div className="public-shell public-header__inner">
        <Link
          href="/"
          className="min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={`${branding.productName} home`}
        >
          <BrandIdentity branding={branding} />
        </Link>

        <div className="public-header__actions">
          <nav className="public-nav" aria-label="Primary navigation">
            <ul>
              {navigation.map((item) => {
                const isCurrent = isCurrentNavigationItem(pathname, item.href);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={navigationLinkClassName(isCurrent)}
                      aria-current={isCurrent ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="public-mobile-nav">
            <DropdownMenu
              modal={false}
              onOpenChange={setMobileNavOpen}
              open={mobileNavOpen}
            >
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="public-mobile-nav__trigger"
                    aria-label={
                      mobileNavOpen ? "Close navigation menu" : "Open navigation menu"
                    }
                  >
                    {mobileNavOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
                  </Button>
                }
              />
              <DropdownMenuContent
                align="end"
                className="public-mobile-nav__panel"
                side="bottom"
                sideOffset={10}
              >
                <nav aria-label="Mobile navigation">
                  {navigation.map((item) => {
                    const isCurrent = isCurrentNavigationItem(pathname, item.href);

                    return (
                      <DropdownMenuItem
                        key={item.href}
                        className={`public-mobile-nav__item${isCurrent ? " is-current" : ""}`}
                        render={
                          <Link
                            href={item.href}
                            aria-current={isCurrent ? "page" : undefined}
                          />
                        }
                      >
                        {item.label}
                      </DropdownMenuItem>
                    );
                  })}
                </nav>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
