"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "compass-accessibility-preferences-v1";
const MAX_STORED_PREFERENCES_LENGTH = 512;

export type AccessibilityTextSize = "default" | "large" | "extra-large";
export type AccessibilityContrast = "default" | "high";
export type AccessibilitySpacing = "default" | "relaxed";
export type AccessibilityMotion = "system" | "reduced";

export interface AccessibilityPreferences {
  readonly textSize: AccessibilityTextSize;
  readonly contrast: AccessibilityContrast;
  readonly spacing: AccessibilitySpacing;
  readonly underlineLinks: boolean;
  readonly motion: AccessibilityMotion;
}

interface AccessibilityPreferencesContextValue {
  readonly preferences: AccessibilityPreferences;
  readonly setTextSize: (value: AccessibilityTextSize) => void;
  readonly setContrast: (value: AccessibilityContrast) => void;
  readonly setSpacing: (value: AccessibilitySpacing) => void;
  readonly setUnderlineLinks: (value: boolean) => void;
  readonly setMotion: (value: AccessibilityMotion) => void;
  readonly resetPreferences: () => void;
}

const DEFAULT_PREFERENCES: AccessibilityPreferences = {
  textSize: "default",
  contrast: "default",
  spacing: "default",
  underlineLinks: false,
  motion: "system",
};

const AccessibilityPreferencesContext =
  createContext<AccessibilityPreferencesContextValue | null>(null);

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function parseStoredPreferences(raw: string | null): AccessibilityPreferences {
  if (!raw || raw.length > MAX_STORED_PREFERENCES_LENGTH) return DEFAULT_PREFERENCES;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return DEFAULT_PREFERENCES;

    const keys = Object.keys(parsed).sort().join(",");
    if (keys !== "contrast,motion,spacing,textSize,underlineLinks") {
      return DEFAULT_PREFERENCES;
    }

    if (
      !isOneOf(parsed.textSize, ["default", "large", "extra-large"] as const) ||
      !isOneOf(parsed.contrast, ["default", "high"] as const) ||
      !isOneOf(parsed.spacing, ["default", "relaxed"] as const) ||
      typeof parsed.underlineLinks !== "boolean" ||
      !isOneOf(parsed.motion, ["system", "reduced"] as const)
    ) {
      return DEFAULT_PREFERENCES;
    }

    return {
      textSize: parsed.textSize,
      contrast: parsed.contrast,
      spacing: parsed.spacing,
      underlineLinks: parsed.underlineLinks,
      motion: parsed.motion,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function readStoredPreferences(): AccessibilityPreferences {
  try {
    return parseStoredPreferences(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function applyPreferences(preferences: AccessibilityPreferences): void {
  const root = document.documentElement;
  root.dataset.compassTextSize = preferences.textSize;
  root.dataset.compassContrast = preferences.contrast;
  root.dataset.compassSpacing = preferences.spacing;
  root.dataset.compassMotion = preferences.motion;

  if (preferences.underlineLinks) {
    root.dataset.compassUnderlineLinks = "true";
  } else {
    delete root.dataset.compassUnderlineLinks;
  }
}

export function AccessibilityPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(DEFAULT_PREFERENCES);
  const [hasLoadedStoredPreferences, setHasLoadedStoredPreferences] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const stored = readStoredPreferences();
    setPreferences(stored);
    applyPreferences(stored);
    setHasLoadedStoredPreferences(true);
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (hasLoadedStoredPreferences) applyPreferences(preferences);
  }, [hasLoadedStoredPreferences, preferences]);

  useEffect(() => {
    if (!hasLoadedStoredPreferences) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Preferences remain available for this session when storage is unavailable.
    }
  }, [hasLoadedStoredPreferences, preferences]);

  const setTextSize = useCallback((value: AccessibilityTextSize) => {
    setPreferences((current) => ({ ...current, textSize: value }));
  }, []);

  const setContrast = useCallback((value: AccessibilityContrast) => {
    setPreferences((current) => ({ ...current, contrast: value }));
  }, []);

  const setSpacing = useCallback((value: AccessibilitySpacing) => {
    setPreferences((current) => ({ ...current, spacing: value }));
  }, []);

  const setUnderlineLinks = useCallback((value: boolean) => {
    setPreferences((current) => ({ ...current, underlineLinks: value }));
  }, []);

  const setMotion = useCallback((value: AccessibilityMotion) => {
    setPreferences((current) => ({ ...current, motion: value }));
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    applyPreferences(DEFAULT_PREFERENCES);
  }, []);

  const value = useMemo<AccessibilityPreferencesContextValue>(
    () => ({
      preferences,
      setTextSize,
      setContrast,
      setSpacing,
      setUnderlineLinks,
      setMotion,
      resetPreferences,
    }),
    [
      preferences,
      resetPreferences,
      setContrast,
      setMotion,
      setSpacing,
      setTextSize,
      setUnderlineLinks,
    ],
  );

  return (
    <AccessibilityPreferencesContext.Provider value={value}>
      {children}
    </AccessibilityPreferencesContext.Provider>
  );
}

export function useAccessibilityPreferences(): AccessibilityPreferencesContextValue {
  const context = useContext(AccessibilityPreferencesContext);
  if (!context) {
    throw new Error("useAccessibilityPreferences must be used within AccessibilityPreferencesProvider");
  }
  return context;
}
