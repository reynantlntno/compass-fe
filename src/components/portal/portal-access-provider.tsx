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

import { useAuthSession } from "@/components/auth/auth-session-provider";
import { getCurrentPortalAccess } from "@/lib/api/portal";
import type { PortalAuditPlane } from "@/components/portal/portal-navigation";

export type PortalAccessStatus = "loading" | "ready" | "unavailable";

type PortalAccessState = {
  auditPlanes: readonly PortalAuditPlane[];
  status: PortalAccessStatus;
  userId: number | null;
  capabilities: readonly string[];
};

type PortalAccessContextValue = {
  auditPlanes: readonly PortalAuditPlane[];
  status: PortalAccessStatus;
  capabilities: readonly string[];
  hasCapability: (capability: string) => boolean;
  refreshAccess: () => Promise<void>;
};

const PortalAccessContext = createContext<PortalAccessContextValue | null>(null);

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export function PortalAccessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthSession();
  const userId = user?.id ?? null;
  const [state, setState] = useState<PortalAccessState>(() => ({
    auditPlanes: [],
    status: "loading",
    userId,
    capabilities: [],
  }));
  const stateRef = useRef(state);
  const requestRef = useRef<AbortController | null>(null);
  const lastRecoveryCheckRef = useRef(0);

  const applyState = useCallback((nextState: PortalAccessState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const refreshAccess = useCallback(async () => {
    requestRef.current?.abort();

    // Keep the first state transition on the async side of this helper. This
    // also avoids a synchronous render cascade when the session changes.
    await Promise.resolve();

    if (userId === null) {
      applyState({
        auditPlanes: [],
        status: "unavailable",
        userId: null,
        capabilities: [],
      });
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    const currentState = stateRef.current;

    if (currentState.userId !== userId) {
      applyState({
        auditPlanes: [],
        status: "loading",
        userId,
        capabilities: [],
      });
    }

    try {
      const access = await getCurrentPortalAccess(
        userId,
        controller.signal,
      );

      if (controller.signal.aborted) return;

      applyState(
        access
          ? {
              auditPlanes: access.auditPlanes,
              status: "ready",
              userId,
              capabilities: access.capabilities,
            }
          : {
              auditPlanes: [],
              status: "unavailable",
              userId,
              capabilities: [],
            },
      );
    } catch (error) {
      if (isAbortError(error)) return;
      if (!controller.signal.aborted) {
        applyState({
          auditPlanes: [],
          status: "unavailable",
          userId,
          capabilities: [],
        });
      }
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [applyState, userId]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void refreshAccess();
    });

    return () => {
      active = false;
      requestRef.current?.abort();
    };
  }, [refreshAccess]);

  useEffect(() => {
    lastRecoveryCheckRef.current = 0;

    const revalidateAfterRecovery = () => {
      const now = Date.now();
      if (now - lastRecoveryCheckRef.current < 30_000) return;
      lastRecoveryCheckRef.current = now;
      void refreshAccess();
    };

    window.addEventListener("focus", revalidateAfterRecovery);
    window.addEventListener("online", revalidateAfterRecovery);

    return () => {
      window.removeEventListener("focus", revalidateAfterRecovery);
      window.removeEventListener("online", revalidateAfterRecovery);
    };
  }, [refreshAccess]);

  const hasCapability = useCallback(
    (capability: string) =>
      state.status === "ready" && state.capabilities.includes(capability),
    [state.capabilities, state.status],
  );

  const contextValue = useMemo<PortalAccessContextValue>(
    () => ({
      auditPlanes: state.auditPlanes,
      status: state.status,
      capabilities: state.capabilities,
      hasCapability,
      refreshAccess,
    }),
    [hasCapability, refreshAccess, state],
  );

  return (
    <PortalAccessContext.Provider value={contextValue}>
      {children}
    </PortalAccessContext.Provider>
  );
}

export function usePortalAccess(): PortalAccessContextValue {
  const context = useContext(PortalAccessContext);
  if (!context) {
    throw new Error("usePortalAccess must be used inside PortalAccessProvider.");
  }

  return context;
}
