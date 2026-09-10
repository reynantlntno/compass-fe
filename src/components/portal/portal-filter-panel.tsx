"use client";

import { ChevronDown } from "lucide-react";
import { useState, type FormEventHandler, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type PortalFilterPanelProps = {
  accessibleLabel?: string;
  action: string;
  ariaBusy?: boolean;
  children: ReactNode;
  className?: string;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  resetKey?: string;
  summary: ReactNode;
};

export function PortalFilterPanel({
  accessibleLabel = "filters",
  action,
  ariaBusy,
  children,
  className,
  onSubmit,
  resetKey,
  summary,
}: PortalFilterPanelProps) {
  const [open, setOpen] = useState(true);

  return (
    <form
      action={action}
      aria-busy={ariaBusy || undefined}
      className={cn("compass-surface portal-filter-panel", className)}
      data-tone="subtle"
      key={resetKey}
      method="get"
      onSubmit={onSubmit}
    >
      <Collapsible
        className="portal-filter-panel__disclosure"
        defaultOpen
        onOpenChange={setOpen}
      >
        <div className="portal-filter-panel__header">
          <div className="portal-filter-panel__heading">
            <p className="portal-filter-panel__kicker">Filters</p>
            <p className="portal-filter-panel__summary">{summary}</p>
          </div>
          <CollapsibleTrigger
            render={
              <Button
                aria-label={`${open ? "Hide" : "Show"} ${accessibleLabel}`}
                className="portal-filter-panel__toggle"
                size="sm"
                type="button"
                variant="outline"
              />
            }
          >
            {open ? "Hide filters" : "Show filters"}
            <ChevronDown
              aria-hidden="true"
              className={open ? "portal-filter-panel__toggle-icon--open" : undefined}
            />
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="portal-filter-panel__content">
          {children}
        </CollapsibleContent>
      </Collapsible>
    </form>
  );
}
