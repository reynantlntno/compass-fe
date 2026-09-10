"use client";

import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PortalViewMenuItem = {
  href: string;
  label: string;
  value: string;
};

type PortalViewMenuProps = {
  activeValue: string;
  ariaLabel: string;
  className?: string;
  items: readonly PortalViewMenuItem[];
  label?: string;
};

export function PortalViewMenu({
  activeValue,
  ariaLabel,
  className,
  items,
  label = "View",
}: PortalViewMenuProps) {
  const currentItem = items.find((item) => item.value === activeValue);
  const currentLabel = currentItem?.label ?? "Current view";

  return (
    <div className={cn("portal-view-menu", className)}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={`${label}: ${currentLabel}`}
              className="portal-view-menu__trigger"
              variant="outline"
            />
          }
        >
          <span className="portal-view-menu__trigger-label">{label}:</span>
          <span>{currentLabel}</span>
          <ChevronDown aria-hidden="true" className="portal-view-menu__trigger-icon" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          aria-label={ariaLabel}
          className="compass-surface portal-view-menu__content"
        >
          {items.map((item) => {
            const isCurrent = item.value === activeValue;

            return (
              <DropdownMenuItem
                className={cn(
                  "portal-view-menu__item",
                  isCurrent && "is-current",
                )}
                key={item.value}
                render={
                  <Link
                    aria-current={isCurrent ? "page" : undefined}
                    href={item.href}
                  />
                }
              >
                <span>{item.label}</span>
                {isCurrent ? <Check aria-hidden="true" /> : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
