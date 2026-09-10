"use client";

import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PortalSearchItem } from "@/components/portal/portal-navigation";

function getShortcutLabel() {
  if (typeof navigator === "undefined") return "Ctrl K";

  return /Mac|iPhone|iPad/.test(
    `${navigator.platform} ${navigator.userAgent}`,
  )
    ? "⌘K"
    : "Ctrl K";
}

function subscribeToPlatform() {
  return () => undefined;
}

function useShortcutLabel() {
  return useSyncExternalStore(
    subscribeToPlatform,
    getShortcutLabel,
    () => "Ctrl K",
  );
}

export function PortalSearchShortcut({ className }: { className?: string }) {
  const shortcutLabel = useShortcutLabel();

  return (
    <kbd className={cn("portal-search__shortcut", className)}>
      {shortcutLabel}
    </kbd>
  );
}

export function PortalSearchTrigger({
  className,
  compact = false,
  onOpen,
}: {
  className?: string;
  compact?: boolean;
  onOpen: () => void;
}) {
  return (
    <Button
      aria-keyshortcuts="Meta+K Control+K"
      aria-label="Search COMPASS"
      className={cn(
        "portal-search__trigger",
        compact && "portal-search__trigger--compact",
        className,
      )}
      onClick={onOpen}
      title={compact ? "Search COMPASS" : undefined}
      type="button"
      variant="outline"
    >
      <Search aria-hidden="true" className="portal-search__trigger-icon" />
      <span className={compact ? "sr-only" : undefined}>Search</span>
      {compact ? null : <PortalSearchShortcut />}
    </Button>
  );
}

type PortalSearchDialogProps = {
  items: readonly PortalSearchItem[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

function matchScore(item: PortalSearchItem, query: string) {
  const label = item.label.toLowerCase();
  const parentLabel = item.parentLabel?.toLowerCase() ?? "";
  const keywords = item.keywords?.map((keyword) => keyword.toLowerCase()) ?? [];

  if (label === query) return 0;
  if (label.startsWith(query)) return 10;
  if (parentLabel === query) return 20;
  if (parentLabel.startsWith(query)) return 30;
  if (label.includes(query)) return 40;
  if (parentLabel.includes(query)) return 50;
  if (keywords.some((keyword) => keyword === query)) return 60;
  if (keywords.some((keyword) => keyword.startsWith(query))) return 70;
  if (keywords.some((keyword) => keyword.includes(query))) return 80;

  return null;
}

export function PortalSearchDialog({
  items,
  onOpenChange,
  open,
}: PortalSearchDialogProps) {
  const [query, setQuery] = useState("");

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setQuery("");
    onOpenChange(nextOpen);
  };

  const matchingItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return items.filter((item) => item.group === "destination");
    }

    return items
      .map((item, index) => ({
        item,
        index,
        score: matchScore(item, normalizedQuery),
      }))
      .filter((entry): entry is typeof entry & { score: number } =>
        entry.score !== null,
      )
      .sort(
        (left, right) =>
          left.score - right.score ||
          left.item.label.localeCompare(right.item.label) ||
          left.index - right.index,
      )
      .map(({ item }) => item);
  }, [items, query]);

  const groups = useMemo(
    () =>
      (['destination', 'section'] as const)
        .map((group) => ({
          items: matchingItems.filter((item) => item.group === group),
          label: group === "destination" ? "Destinations" : "Sections",
        }))
        .filter((group) => group.items.length > 0),
    [matchingItems],
  );

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent
        aria-describedby="portal-search-description"
        className="compass-surface portal-search__dialog"
      >
        <DialogHeader className="portal-search__header">
          <DialogTitle>Search COMPASS</DialogTitle>
          <DialogDescription id="portal-search-description">
            Find an available portal page or workspace section.
          </DialogDescription>
        </DialogHeader>

        <div className="portal-search__input-wrap">
          <Search aria-hidden="true" className="portal-search__input-icon" />
          <label className="sr-only" htmlFor="portal-search-input">
            Search portal pages and sections
          </label>
          <Input
            autoComplete="off"
            autoFocus
            id="portal-search-input"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages and sections"
            value={query}
          />
        </div>

        {groups.length > 0 ? (
          <div
            aria-label="Portal search results"
            className="portal-search__results"
            role="region"
          >
            {groups.map((group) => (
              <section className="portal-search__group" key={group.label}>
                <h2 className="portal-search__group-label">{group.label}</h2>
                <ul className="portal-search__result-list">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <Link
                        className="portal-search__result"
                        href={item.href}
                        onClick={() => handleOpenChange(false)}
                      >
                        <span className="portal-search__result-copy">
                          <span className="portal-search__result-label">
                            {item.label}
                          </span>
                          {item.parentLabel ? (
                            <span className="portal-search__result-parent">
                              {item.parentLabel}
                            </span>
                          ) : null}
                        </span>
                        <ArrowRight
                          aria-hidden="true"
                          className="portal-search__result-icon"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <div className="portal-search__empty" role="status">
            <strong>No matching portal pages.</strong>
            <span>Try a page or section name.</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
