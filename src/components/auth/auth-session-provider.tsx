"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  getCurrentAuthSession,
  logoutCurrentSession,
  refreshAuthSession,
} from "@/lib/api/auth";
import { registerSessionRefresh } from "@/lib/api/session-refresh";
import type { MeSchema } from "@/lib/api/generated/model";

export type AuthSessionStatus =
  | "unknown"
  | "authenticated"
  | "unauthenticated"
  | "unavailable";

type AuthSessionContextValue = {
  status: AuthSessionStatus;
  user: MeSchema | null;
  refreshSession: () => Promise<AuthSessionStatus>;
  signOut: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);
const SESSION_REVALIDATION_INTERVAL_MS = 5 * 60 * 1000;

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthSessionStatus>("unknown");
  const [user, setUser] = useState<MeSchema | null>(null);
  const statusRef = useRef<AuthSessionStatus>("unknown");
  const activeRequestRef = useRef<AbortController | null>(null);
  const lastRecoveryCheckRef = useRef(0);

  const applySession = useCallback(
    (nextStatus: AuthSessionStatus, nextUser: MeSchema | null) => {
      statusRef.current = nextStatus;
      setStatus(nextStatus);
      setUser(nextUser);
    },
    [],
  );

  const refreshSession = useCallback(async (): Promise<AuthSessionStatus> => {
    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;

    try {
      const session = await getCurrentAuthSession(controller.signal);
      if (session.authenticated) {
        applySession("authenticated", session.user);
        return "authenticated";
      }

      applySession("unauthenticated", null);
      return "unauthenticated";
    } catch (error) {
      if (isAbortError(error)) return statusRef.current;

      applySession("unavailable", null);
      return "unavailable";
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
      }
    }
  }, [applySession]);

  const signOut = useCallback(async () => {
    activeRequestRef.current?.abort();

    try {
      await logoutCurrentSession();
    } catch {
      // The backend logout is idempotent. Keep the local UI signed out even
      // when the network is unavailable while the request is being sent.
    } finally {
      applySession("unauthenticated", null);
    }
  }, [applySession]);

  useEffect(() => {
    const initialCheckId = window.setTimeout(() => {
      void refreshSession();
    }, 0);

    return () => {
      window.clearTimeout(initialCheckId);
      activeRequestRef.current?.abort();
    };
  }, [refreshSession]);

  useEffect(() => registerSessionRefresh(refreshAuthSession), []);

  useEffect(() => {
    if (status !== "authenticated") return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshSession();
    }, SESSION_REVALIDATION_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [refreshSession, status]);

  useEffect(() => {
    const revalidateAfterRecovery = () => {
      const now = Date.now();
      if (now - lastRecoveryCheckRef.current < 30_000) return;
      lastRecoveryCheckRef.current = now;
      void refreshSession();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") revalidateAfterRecovery();
    };

    window.addEventListener("focus", revalidateAfterRecovery);
    window.addEventListener("online", revalidateAfterRecovery);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", revalidateAfterRecovery);
      window.removeEventListener("online", revalidateAfterRecovery);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshSession]);

  return (
    <AuthSessionContext.Provider
      value={{ status, user, refreshSession, signOut }}
    >
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession(): AuthSessionContextValue {
  const context = useContext(AuthSessionContext);
  if (!context) {
    throw new Error("useAuthSession must be used inside AuthSessionProvider.");
  }

  return context;
}
