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
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useAuthSession } from "@/components/auth/auth-session-provider";
import { CompassFrame } from "@/components/compass/compass-frame";
import { usePortalAccess } from "@/components/portal/portal-access-provider";
import { usePortalNotifications } from "@/components/portal/portal-notifications-provider";
import {
  getVisiblePortalNavigation,
  getVisiblePortalSearchItems,
  isPortalNavigationItemActive,
  type PortalNavigationItem,
  type PortalNavigationLink,
  type PortalNavigationMenu,
} from "@/components/portal/portal-navigation";
import {
  PortalSearchDialog,
  PortalSearchTrigger,
} from "@/components/portal/portal-search";
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

const PORTAL_DOCK_VISIBLE_LIMIT = 5;
// Search is the third always-visible mobile action, so only two portal
// destinations remain in the direct mobile navigation.
const PORTAL_MOBILE_DOCK_NAV_LIMIT = 2;

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
        className="compass-surface portal-dock__menu"
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

function PortalNavigationMeasureItem({
  item,
}: {
  item: PortalNavigationItem;
}) {
  const Icon = item.icon;

  return (
    <span className="portal-dock__nav-measure-item">
      <span className="portal-dock__nav-link">
        <Icon aria-hidden="true" className="portal-dock__nav-icon" />
        <span>{item.label}</span>
      </span>
    </span>
  );
}

function PortalAdaptiveNavigation({
  ariaHidden,
  items,
}: {
  ariaHidden: boolean;
  items: readonly PortalNavigationItem[];
}) {
  const maxVisibleCount = Math.min(items.length, PORTAL_DOCK_VISIBLE_LIMIT);
  const [visibleCount, setVisibleCount] = useState(maxVisibleCount);
  const [isMeasured, setIsMeasured] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const navElement = navRef.current;
    const measureElement = measureRef.current;
    if (!navElement || !measureElement) return;

    let active = true;

    const measureNavigation = () => {
      if (!active) return;

      const availableWidth = navElement.clientWidth;
      const measuredItems = Array.from(measureElement.children)
        .slice(0, maxVisibleCount)
        .map((item) => item.getBoundingClientRect().width);
      const moreElement = measureElement.lastElementChild;
      const moreWidth = moreElement?.getBoundingClientRect().width ?? 0;
      const computedStyle = window.getComputedStyle(navElement);
      const gap = Number.parseFloat(computedStyle.columnGap) || 0;
      let nextVisibleCount = 0;

      for (let count = maxVisibleCount; count >= 0; count -= 1) {
        const hasOverflow = items.length > count;
        const directWidth = measuredItems
          .slice(0, count)
          .reduce((total, width) => total + width, 0);
        const gapCount = Math.max(count - 1, 0) + (hasOverflow && count > 0 ? 1 : 0);
        const requiredWidth =
          directWidth + gap * gapCount + (hasOverflow ? moreWidth : 0);

        if (requiredWidth <= availableWidth) {
          nextVisibleCount = count;
          break;
        }
      }

      setVisibleCount((currentCount) =>
        currentCount === nextVisibleCount ? currentCount : nextVisibleCount,
      );
      setIsMeasured(true);
    };

    measureNavigation();

    const resizeObserver = new ResizeObserver(measureNavigation);
    resizeObserver.observe(navElement);
    window.addEventListener("resize", measureNavigation);

    const fontsReady = document.fonts?.ready.then(measureNavigation);

    return () => {
      active = false;
      resizeObserver.disconnect();
      window.removeEventListener("resize", measureNavigation);
      void fontsReady;
    };
  }, [items, maxVisibleCount]);

  return (
    <nav
      aria-hidden={ariaHidden || undefined}
      aria-label="Portal navigation"
      className="portal-dock__nav portal-dock__adaptive-nav"
      data-dock-ready={isMeasured ? "true" : "false"}
      ref={navRef}
    >
      {items.slice(0, visibleCount).map((item) => (
        <PortalNavigationItemView item={item} key={item.id} />
      ))}
      <PortalMoreMenu items={items.slice(visibleCount)} />
      <div
        aria-hidden="true"
        className="portal-dock__nav-measure"
        ref={measureRef}
      >
        {items.slice(0, maxVisibleCount).map((item) => (
          <PortalNavigationMeasureItem item={item} key={item.id} />
        ))}
        <span className="portal-dock__more-trigger">
          <Ellipsis aria-hidden="true" className="portal-dock__nav-icon" />
          <span>More</span>
        </span>
      </div>
    </nav>
  );
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
      <DropdownMenuSubContent className="compass-surface portal-dock__menu portal-dock__submenu">
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
        className="compass-surface portal-dock__menu"
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
          className="compass-surface portal-account__menu"
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
        <AlertDialogContent className="compass-surface portal-signout-dialog">
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
  const {
    auditPlanes,
    status: accessStatus,
    capabilities,
  } = usePortalAccess();
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const visibleNavigation = useMemo(
    () =>
      getVisiblePortalNavigation(
        accessStatus === "ready" ? capabilities : [],
        accessStatus === "ready" ? auditPlanes : [],
      ),
    [accessStatus, auditPlanes, capabilities],
  );
  const mobileDirectNavigation = visibleNavigation.slice(
    0,
    PORTAL_MOBILE_DOCK_NAV_LIMIT,
  );
  const mobileOverflowNavigation = visibleNavigation.slice(
    PORTAL_MOBILE_DOCK_NAV_LIMIT,
  );
  const searchItems = useMemo(
    () =>
      getVisiblePortalSearchItems(
        accessStatus === "ready" ? capabilities : [],
        accessStatus === "ready" ? auditPlanes : [],
      ),
    [accessStatus, auditPlanes, capabilities],
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

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "k" ||
        (!event.metaKey && !event.ctrlKey) ||
        event.altKey ||
        event.shiftKey
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement)
      ) {
        return;
      }

      event.preventDefault();
      setSearchOpen(true);
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
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
        <CompassFrame className="portal-dock__inner" id="portal-dock-content">
          <PortalBrand
            collapsed={dockCollapsed}
            onExpand={() => setDockCollapsed(false)}
          />

          <PortalAdaptiveNavigation
            ariaHidden={dockCollapsed}
            items={visibleNavigation}
          />

          <div
            aria-hidden={dockCollapsed || undefined}
            className="portal-dock__utilities"
          >
            <PortalCollapseButton onCollapse={() => setDockCollapsed(true)} />
            <PortalSearchTrigger onOpen={() => setSearchOpen(true)} />
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
            <PortalSearchTrigger compact onOpen={() => setSearchOpen(true)} />
            <PortalMoreMenu items={mobileOverflowNavigation} />
            <PortalCollapseButton onCollapse={() => setDockCollapsed(true)} />
            <AccountMenu
              compact
              isSigningOut={isSigningOut}
              onSignOut={onSignOut}
              user={user}
            />
          </nav>
        </CompassFrame>
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

      <PortalSearchDialog
        items={searchItems}
        onOpenChange={setSearchOpen}
        open={searchOpen}
      />
    </div>
  );
}
