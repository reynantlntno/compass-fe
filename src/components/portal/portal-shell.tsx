"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleUserRound,
  Ellipsis,
  LogOut,
  Settings,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useAuthSession } from "@/components/auth/auth-session-provider";
import { usePortalAccess } from "@/components/portal/portal-access-provider";
import { usePortalNotifications } from "@/components/portal/portal-notifications-provider";
import {
  getVisiblePortalNavigation,
  isPortalNavigationItemActive,
  type PortalNavigationItem,
  type PortalNavigationLink,
  type PortalNavigationMenu,
} from "@/components/portal/portal-navigation";
import { getPortalAccountName, getPortalInitials, getPortalRoleLabel } from "@/components/portal/portal-identity";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BrandingConfig } from "@/lib/branding";
import type { MeSchema } from "@/lib/api/generated/model";

function notificationAccessibleLabel(
  item: PortalNavigationLink,
  unreadCount: number | null,
) {
  if (item.id !== "notifications" || !unreadCount || unreadCount < 1) {
    return item.label;
  }

  return `${item.label}, ${unreadCount > 99 ? "99 plus" : unreadCount} unread`;
}

function notificationCountLabel(unreadCount: number | null) {
  if (!unreadCount || unreadCount < 1) return null;
  return unreadCount > 99 ? "99+" : String(unreadCount);
}

function PortalBrand({
  collapsed,
  onExpand,
}: {
  collapsed: boolean;
  onExpand: () => void;
}) {
  if (collapsed) {
    return (
      <div className="portal-dock__brand-cluster portal-dock__brand-cluster--collapsed">
        <Button
          aria-controls="portal-dock-content"
          aria-expanded={false}
          aria-label="Expand portal dock"
          className="portal-dock__brand-toggle"
          onClick={onExpand}
          title="Expand portal dock"
          variant="ghost"
        >
          <Image
            alt=""
            aria-hidden="true"
            className="portal-dock__brand-icon"
            height={40}
            src="/icon.svg"
            width={40}
          />
          <ChevronUp
            aria-hidden="true"
            className="portal-dock__expand-indicator portal-dock__expand-indicator--vertical"
          />
          <ChevronRight
            aria-hidden="true"
            className="portal-dock__expand-indicator portal-dock__expand-indicator--horizontal"
          />
        </Button>
      </div>
    );
  }

  return (
    <div className="portal-dock__brand-cluster">
      <Link
        aria-label="Open public site"
        className="portal-dock__brand"
        href="/"
        title="Open public site"
      >
        <Image
          alt=""
          aria-hidden="true"
          className="portal-dock__brand-icon"
          height={40}
          src="/icon.svg"
          width={40}
        />
      </Link>
      <span aria-hidden="true" className="portal-dock__brand-divider" />
    </div>
  );
}

function PortalCollapseButton({ onCollapse }: { onCollapse: () => void }) {
  return (
    <Button
      aria-controls="portal-dock-content"
      aria-expanded={true}
      aria-label="Collapse portal dock"
      className="portal-dock__collapse-toggle"
      onClick={onCollapse}
      title="Collapse portal dock"
      variant="ghost"
    >
      <ChevronDown
        aria-hidden="true"
        className="portal-dock__collapse-icon portal-dock__collapse-icon--vertical"
      />
      <ChevronLeft
        aria-hidden="true"
        className="portal-dock__collapse-icon portal-dock__collapse-icon--horizontal"
      />
    </Button>
  );
}

function PortalNavigationLinkView({
  item,
  onNavigate,
}: {
  item: PortalNavigationLink;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { unreadCount } = usePortalNotifications();
  const isCurrent = isPortalNavigationItemActive(pathname, item);
  const Icon = item.icon;
  const countLabel = notificationCountLabel(
    item.id === "notifications" ? unreadCount : null,
  );

  return (
    <Link
      aria-current={isCurrent ? "page" : undefined}
      aria-label={notificationAccessibleLabel(item, unreadCount)}
      className={`portal-dock__nav-link${isCurrent ? " is-current" : ""}`}
      href={item.href}
      onClick={onNavigate}
    >
      <Icon aria-hidden="true" className="portal-dock__nav-icon" />
      <span>{item.label}</span>
      {countLabel ? (
        <span aria-hidden="true" className="portal-dock__notification-count">
          {countLabel}
        </span>
      ) : null}
    </Link>
  );
}

function PortalDropdownLinkItem({
  item,
  onNavigate,
}: {
  item: PortalNavigationLink;
  onNavigate?: () => void;
}) {
  const { unreadCount } = usePortalNotifications();
  const Icon = item.icon;
  const countLabel = notificationCountLabel(
    item.id === "notifications" ? unreadCount : null,
  );

  return (
    <DropdownMenuItem
      render={
        <Link
          aria-label={notificationAccessibleLabel(item, unreadCount)}
          href={item.href}
          onClick={onNavigate}
        />
      }
    >
      <Icon aria-hidden="true" className="portal-dock__nav-icon" />
      <span>{item.label}</span>
      {countLabel ? (
        <span aria-hidden="true" className="portal-dock__notification-count">
          {countLabel}
        </span>
      ) : null}
    </DropdownMenuItem>
  );
}

function PortalNavigationMenuView({
  item,
  onNavigate,
}: {
  item: PortalNavigationMenu;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isCurrent = isPortalNavigationItemActive(pathname, item);
  const Icon = item.icon;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <Button
            aria-current={isCurrent ? "page" : undefined}
            aria-label={`Open ${item.label} menu`}
            className={`portal-dock__nav-link portal-dock__menu-trigger${isCurrent ? " is-current" : ""}`}
            variant="ghost"
          >
            <Icon aria-hidden="true" className="portal-dock__nav-icon" />
            <span>{item.label}</span>
            <ChevronDown aria-hidden="true" className="portal-dock__menu-chevron" />
          </Button>
        }
      />
      <DropdownMenuContent
        align="start"
        className="portal-dock__menu"
        side="top"
        sideOffset={16}
      >
        <DropdownMenuGroup>
          {item.items.map((child) => (
            <PortalDropdownLinkItem
              item={child}
              key={child.id}
              onNavigate={onNavigate}
            />
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PortalNavigationItemView({
  item,
  onNavigate,
}: {
  item: PortalNavigationItem;
  onNavigate?: () => void;
}) {
  if (item.kind === "menu") {
    return <PortalNavigationMenuView item={item} onNavigate={onNavigate} />;
  }

  return <PortalNavigationLinkView item={item} onNavigate={onNavigate} />;
}

function PortalDropdownNavigationItem({
  item,
  onNavigate,
}: {
  item: PortalNavigationItem;
  onNavigate?: () => void;
}) {
  if (item.kind === "link") {
    return <PortalDropdownLinkItem item={item} onNavigate={onNavigate} />;
  }

  const Icon = item.icon;

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Icon aria-hidden="true" className="portal-dock__nav-icon" />
        <span>{item.label}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="portal-dock__menu portal-dock__submenu">
        {item.items.map((child) => (
          <PortalDropdownLinkItem
            item={child}
            key={child.id}
            onNavigate={onNavigate}
          />
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function PortalMoreMenu({
  items,
  onNavigate,
}: {
  items: readonly PortalNavigationItem[];
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <DropdownMenu modal={false} onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger
        render={
          <Button
            aria-expanded={open}
            aria-label="Open more portal actions"
            className="portal-dock__more-trigger"
            variant="outline"
          >
            <Ellipsis aria-hidden="true" className="portal-dock__nav-icon" />
            <span>More</span>
          </Button>
        }
      />
      <DropdownMenuContent
        align="end"
        className="portal-dock__menu"
        side="top"
        sideOffset={24}
      >
        <DropdownMenuGroup>
          {items.map((item) => (
            <PortalDropdownNavigationItem
              item={item}
              key={item.id}
              onNavigate={onNavigate}
            />
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountMenu({
  compact,
  isSigningOut,
  onSignOut,
  user,
}: {
  compact?: boolean;
  isSigningOut: boolean;
  onSignOut: () => Promise<void>;
  user: MeSchema;
}) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const accountName = getPortalAccountName(user);
  const initials = getPortalInitials(user);
  const roleLabel = getPortalRoleLabel(user.role);

  const confirmSignOut = async () => {
    try {
      await onSignOut();
    } finally {
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <DropdownMenu
        modal={false}
        onOpenChange={setAccountMenuOpen}
        open={accountMenuOpen}
      >
        <DropdownMenuTrigger
          render={
            <Button
              aria-expanded={accountMenuOpen}
              aria-label={compact ? `Open account menu for ${accountName}` : undefined}
              className={`portal-account__trigger${compact ? " portal-account__trigger--compact" : ""}`}
              title={compact ? undefined : accountName}
              variant="outline"
            >
              <Avatar
                aria-hidden="true"
                className="portal-account__avatar"
                size={compact ? "sm" : "default"}
              >
                <AvatarFallback className="portal-account__avatar-fallback">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="portal-account__trigger-copy">
                <span className="portal-account__trigger-name">{accountName}</span>
                <span className="portal-account__trigger-role">{roleLabel}</span>
              </span>
            </Button>
          }
        />
        <DropdownMenuContent
          align="end"
          className="portal-account__menu"
          side="top"
          sideOffset={20}
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel className="portal-account__summary">
              <span className="portal-account__summary-name" title={accountName}>
                {accountName}
              </span>
              <span className="portal-account__summary-role">{roleLabel}</span>
              <span className="portal-account__summary-email">{user.email}</span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            render={<Link href="/portal/account" />}
          >
            <CircleUserRound aria-hidden="true" className="portal-dock__nav-icon" />
            <span>Account information</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            render={<Link href="/portal/account/settings" />}
          >
            <Settings aria-hidden="true" className="portal-dock__nav-icon" />
            <span>Account settings</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isSigningOut}
            onClick={() => setConfirmOpen(true)}
          >
            <LogOut aria-hidden="true" className="portal-dock__nav-icon" />
            <span>{isSigningOut ? "Signing out…" : "Sign out"}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <AlertDialogContent className="portal-signout-dialog">
          <AlertDialogHeader className="portal-signout-dialog__header">
            <AlertDialogTitle>Sign out of COMPASS?</AlertDialogTitle>
            <AlertDialogDescription>
              You can sign in again whenever you need to return to your workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="portal-signout-dialog__footer">
            <AlertDialogCancel disabled={isSigningOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSigningOut}
              onClick={() => void confirmSignOut()}
            >
              {isSigningOut ? "Signing out…" : "Sign out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function PortalShell({
  branding,
  children,
  isSigningOut,
  onSignOut,
}: {
  branding: BrandingConfig;
  children: ReactNode;
  isSigningOut: boolean;
  onSignOut: () => Promise<void>;
}) {
  const { user } = useAuthSession();
  const { status: accessStatus, capabilities } = usePortalAccess();
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const visibleNavigation = useMemo(
    () =>
      getVisiblePortalNavigation(
        accessStatus === "ready" ? capabilities : [],
      ),
    [accessStatus, capabilities],
  );
  const mobileDirectNavigation = visibleNavigation.filter(
    (item) => item.id === "home" || item.id === "notifications",
  );
  const mobileOverflowNavigation = visibleNavigation.filter(
    (item) => item.id !== "home" && item.id !== "notifications",
  );

  useEffect(() => {
    const root = document.documentElement;
    const previousValue = root.dataset.compassFixedActions;
    root.dataset.compassFixedActions = "present";

    return () => {
      if (previousValue === undefined) {
        delete root.dataset.compassFixedActions;
      } else {
        root.dataset.compassFixedActions = previousValue;
      }
    };
  }, []);

  if (!user) return null;

  const footerMark = branding.footerIdentityAssets[0];

  return (
    <div className="portal-site">
      <a className="portal-shell__skip-link" href="#portal-main">
        Skip to portal content
      </a>

      <header
        aria-label={`${branding.productName} portal navigation`}
        className={`portal-dock${dockCollapsed ? " is-collapsed" : ""}`}
      >
        <div className="portal-dock__inner" id="portal-dock-content">
          <PortalBrand
            collapsed={dockCollapsed}
            onExpand={() => setDockCollapsed(false)}
          />

          <nav
            aria-hidden={dockCollapsed || undefined}
            aria-label="Portal navigation"
            className="portal-dock__nav"
          >
            {visibleNavigation.map((item) => (
              <PortalNavigationItemView item={item} key={item.id} />
            ))}
          </nav>

          <div
            aria-hidden={dockCollapsed || undefined}
            className="portal-dock__utilities"
          >
            <PortalCollapseButton onCollapse={() => setDockCollapsed(true)} />
            <AccountMenu
              isSigningOut={isSigningOut}
              onSignOut={onSignOut}
              user={user}
            />
          </div>

          <nav
            aria-hidden={dockCollapsed || undefined}
            aria-label="Mobile portal navigation"
            className="portal-dock__mobile-nav"
          >
            {mobileDirectNavigation.map((item) => (
              <PortalNavigationItemView item={item} key={item.id} />
            ))}
            <PortalMoreMenu items={mobileOverflowNavigation} />
            <PortalCollapseButton onCollapse={() => setDockCollapsed(true)} />
            <AccountMenu
              compact
              isSigningOut={isSigningOut}
              onSignOut={onSignOut}
              user={user}
            />
          </nav>
        </div>
      </header>

      <main className="portal-shell__main" id="portal-main">
        <div className="portal-shell__content">{children}</div>
      </main>

      <footer className="portal-shell__footer">
        <div className="portal-shell__footer-inner">
          <div className="portal-shell__footer-attribution">
            <div className="portal-shell__footer-copyright">
              {footerMark ? (
                <Image
                  alt=""
                  aria-hidden="true"
                  className="portal-shell__footer-mark"
                  height={footerMark.height}
                  src={footerMark.src}
                  width={footerMark.width}
                  unoptimized
                />
              ) : null}
              <p>© {new Date().getFullYear()} {branding.institutionName}</p>
            </div>
            <p>{branding.productName} is a service of {branding.officeName}.</p>
            <p>Developed for {branding.officeName}.</p>
          </div>
          <div className="portal-shell__footer-utility">
            <Link href="/privacy">{branding.productName} Privacy Notice</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
