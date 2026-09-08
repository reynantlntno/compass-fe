"use client";

import type { ReactNode } from "react";

import { AccessibilityOptions } from "@/components/accessibility/accessibility-options";
import { AccessibilityPreferencesProvider } from "@/components/accessibility/accessibility-preferences";

export function AccessibilityLayer({ children }: { children: ReactNode }) {
  return (
    <AccessibilityPreferencesProvider>
      <AccessibilityOptions />
      {children}
    </AccessibilityPreferencesProvider>
  );
}
