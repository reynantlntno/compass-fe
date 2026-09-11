"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

export type PortalStatusFilterOption<T extends string = string> = {
  label: string;
  value: T;
};

type PortalStatusFilterProps<T extends string> = {
  ariaLabel: string;
  id: string;
  name?: string;
  options: readonly PortalStatusFilterOption<T>[];
  selectedValues: readonly T[];
  title: string;
  description?: string;
  allLabel?: string;
  clearLabel?: string;
};

function normalizeSelection<T extends string>(
  options: readonly PortalStatusFilterOption<T>[],
  values: readonly T[],
) {
  return options
    .map((option) => option.value)
    .filter((value) => values.includes(value));
}

type StatusDraft<T extends string> = {
  key: string;
  values: T[];
};

export function PortalStatusFilter<T extends string>({
  allLabel = "All statuses",
  ariaLabel,
  clearLabel = "Clear status selection",
  description = "Choose one or more statuses.",
  id,
  name = "status",
  options,
  selectedValues,
  title,
}: PortalStatusFilterProps<T>) {
  const selectionKey = `${options.map((option) => option.value).join(",")}|${selectedValues.join(",")}`;
  const [draft, setDraft] = useState<StatusDraft<T>>(() => ({
    key: selectionKey,
    values: normalizeSelection(options, selectedValues),
  }));
  const selected = draft.key === selectionKey
    ? draft.values
    : normalizeSelection(options, selectedValues);

  const summary = selected.length === 0
    ? allLabel
    : selected.length === 1
      ? options.find((option) => option.value === selected[0])?.label ?? allLabel
      : `${selected.length} statuses selected`;

  const toggleStatus = (status: T, checked: boolean) => {
    const next = checked
      ? [...new Set([...selected, status])]
      : selected.filter((value) => value !== status);

    setDraft({ key: selectionKey, values: normalizeSelection(options, next) });
  };

  return (
    <div className="portal-status-filter__control">
      <Popover modal="trap-focus">
        <PopoverTrigger
          aria-label={ariaLabel}
          className="portal-status-filter__trigger"
          id={id}
          type="button"
        >
          <span>{summary}</span>
          <ChevronDown aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="compass-surface portal-status-filter__popover"
          sideOffset={6}
        >
          <PopoverHeader className="portal-status-filter__popover-header">
            <PopoverTitle>{title}</PopoverTitle>
            <PopoverDescription>{description}</PopoverDescription>
          </PopoverHeader>
          <div className="portal-status-filter__options">
            {options.map((option) => (
              <div className="portal-status-filter__option" key={option.value}>
                <Checkbox
                  aria-label={option.label}
                  checked={selected.includes(option.value)}
                  onCheckedChange={(checked) => toggleStatus(option.value, checked === true)}
                />
                <span>{option.label}</span>
              </div>
            ))}
          </div>
          {selected.length > 0 ? (
            <button
              className="portal-status-filter__clear"
              onClick={() => setDraft({ key: selectionKey, values: [] })}
              type="button"
            >
              {clearLabel}
            </button>
          ) : null}
        </PopoverContent>
      </Popover>
      {selected.map((status) => (
        <input key={status} name={name} type="hidden" value={status} />
      ))}
    </div>
  );
}
