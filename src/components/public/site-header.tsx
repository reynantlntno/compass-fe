"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useAuthSession } from "@/components/auth/auth-session-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PublicIdentityConfig } from "@/lib/public-identity";

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

function BrandIdentity({ identity }: { identity: PublicIdentityConfig }) {
  return (
    <span className="public-brand">
      <span className="public-brand__copy">
        <span className="public-brand__product">{identity.productName}</span>
        <span className="public-brand__office">
          {identity.officeName}
        </span>
      </span>
    </span>
  );
}

function PublicAuthAction({ mobile = false }: { mobile?: boolean }) {
  const { status } = useAuthSession();
  const isAuthenticated = status === "authenticated";
  const href = isAuthenticated ? "/portal" : "/login";
  const label = isAuthenticated ? "Open COMPASS" : "Sign in";

  if (mobile) {
    return (
      <DropdownMenuItem
        className="public-mobile-nav__item public-mobile-nav__item--auth"
        render={<Link href={href} />}
      >
        {label}
      </DropdownMenuItem>
    );
  }

  return (
    <Link className="public-auth-action" href={href}>
      {label}
    </Link>
  );
}

export function SiteHeader({ identity }: { identity: PublicIdentityConfig }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <header className="public-header">
      <div className="public-shell public-header__inner">
        <Link
          href="/"
          className="min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={`${identity.productName} home`}
        >
          <BrandIdentity identity={identity} />
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

          <div className="public-auth-action__desktop">
            <PublicAuthAction />
          </div>

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
                className="compass-surface public-mobile-nav__panel"
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
                  <DropdownMenuSeparator />
                  <PublicAuthAction mobile />
                </nav>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
