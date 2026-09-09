"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { getPortalUnreadNotificationCount } from "@/lib/api/notifications";

type PortalNotificationsStatus = "loading" | "ready" | "unavailable";

type PortalNotificationsContextValue = {
  status: PortalNotificationsStatus;
  unreadCount: number | null;
  refreshUnreadCount: () => Promise<void>;
};

const PortalNotificationsContext =
  createContext<PortalNotificationsContextValue | null>(null);

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export function PortalNotificationsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<{
    status: PortalNotificationsStatus;
    unreadCount: number | null;
  }>({ status: "loading", unreadCount: null });
  const stateRef = useRef(state);
  const requestRef = useRef<AbortController | null>(null);
  const lastRecoveryCheckRef = useRef(0);

  const applyState = useCallback(
    (nextState: {
      status: PortalNotificationsStatus;
      unreadCount: number | null;
    }) => {
      stateRef.current = nextState;
      setState(nextState);
    },
    [],
  );

  const refreshUnreadCount = useCallback(async () => {
    requestRef.current?.abort();
    await Promise.resolve();

    const controller = new AbortController();
    requestRef.current = controller;
    applyState({ status: "loading", unreadCount: null });

    try {
      const unreadCount = await getPortalUnreadNotificationCount(
        controller.signal,
      );

      if (controller.signal.aborted) return;

      applyState(
        unreadCount === null
          ? { status: "unavailable", unreadCount: null }
          : { status: "ready", unreadCount },
      );
    } catch (error) {
      if (isAbortError(error)) return;
      if (!controller.signal.aborted) {
        applyState({ status: "unavailable", unreadCount: null });
      }
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [applyState]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void refreshUnreadCount();
    });

    return () => {
      active = false;
      requestRef.current?.abort();
    };
  }, [refreshUnreadCount]);

  useEffect(() => {
    const revalidateAfterRecovery = () => {
      const now = Date.now();
      if (now - lastRecoveryCheckRef.current < 30_000) return;
      lastRecoveryCheckRef.current = now;
      void refreshUnreadCount();
    };

    window.addEventListener("focus", revalidateAfterRecovery);
    window.addEventListener("online", revalidateAfterRecovery);

    return () => {
      window.removeEventListener("focus", revalidateAfterRecovery);
      window.removeEventListener("online", revalidateAfterRecovery);
    };
  }, [refreshUnreadCount]);

  const contextValue = useMemo(
    () => ({ ...state, refreshUnreadCount }),
    [refreshUnreadCount, state],
  );

  return (
    <PortalNotificationsContext.Provider value={contextValue}>
      {children}
    </PortalNotificationsContext.Provider>
  );
}

export function usePortalNotifications() {
  const context = useContext(PortalNotificationsContext);
  if (!context) {
    throw new Error(
      "usePortalNotifications must be used inside PortalNotificationsProvider.",
    );
  }

  return context;
}
