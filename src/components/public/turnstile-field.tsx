"use client";

import { useEffect, useRef, useState } from "react";

const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TURNSTILE_SCRIPT_SELECTOR = "script[data-compass-turnstile]";

export type TurnstileAction = "login" | "recovery" | "activation" | "contact";

type WidgetId = string | number;

type TurnstileRenderOptions = {
  sitekey: string;
  action: TurnstileAction;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => WidgetId;
  reset?: (widgetId?: WidgetId) => void;
  remove?: (widgetId?: WidgetId) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileScriptPromise: Promise<void> | null = null;

function loadTurnstileScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Turnstile is only available in a browser."));
  }

  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(TURNSTILE_SCRIPT_SELECTOR);
    const script = existing ?? document.createElement("script");

    const finish = () => {
      if (window.turnstile) {
        resolve();
      } else {
        script.remove();
        reject(new Error("Turnstile did not become available."));
      }
    };

    script.addEventListener("load", finish, { once: true });
    script.addEventListener(
      "error",
      () => {
        script.remove();
        reject(new Error("Turnstile could not load."));
      },
      { once: true },
    );

    if (!existing) {
      script.async = true;
      script.defer = true;
      script.src = TURNSTILE_SCRIPT_SRC;
      script.dataset.compassTurnstile = "true";
      document.head.appendChild(script);
    }
  }).catch((error) => {
    turnstileScriptPromise = null;
    throw error;
  });

  return turnstileScriptPromise;
}

export function TurnstileField({
  action,
  disabled = false,
  onError,
  onToken,
  onUnavailable,
  resetKey = 0,
}: {
  action: TurnstileAction;
  disabled?: boolean;
  onError?: () => void;
  onToken: (token: string | null) => void;
  onUnavailable?: () => void;
  resetKey?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<WidgetId | null>(null);
  const callbacksRef = useRef({ onError, onToken, onUnavailable });
  const siteKey = process.env.NEXT_PUBLIC_COMPASS_TURNSTILE_SITE_KEY?.trim() ?? "";
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">(() =>
    siteKey ? "loading" : "unavailable",
  );

  useEffect(() => {
    callbacksRef.current = { onError, onToken, onUnavailable };
  }, [onError, onToken, onUnavailable]);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;

    if (!siteKey) {
      callbacksRef.current.onUnavailable?.();
      return;
    }

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !container || !window.turnstile) return;

        try {
          widgetIdRef.current = window.turnstile.render(container, {
            sitekey: siteKey,
            action,
            callback: (token) => {
              if (cancelled) return;
              setStatus("ready");
              callbacksRef.current.onToken(token);
            },
            "expired-callback": () => {
              if (cancelled) return;
              callbacksRef.current.onToken(null);
            },
            "error-callback": () => {
              if (cancelled) return;
              setStatus("unavailable");
              callbacksRef.current.onToken(null);
              callbacksRef.current.onError?.();
            },
          });
          setStatus("ready");
        } catch {
          setStatus("unavailable");
          callbacksRef.current.onUnavailable?.();
        }
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("unavailable");
        callbacksRef.current.onUnavailable?.();
      });

    return () => {
      cancelled = true;
      const widgetId = widgetIdRef.current;
      if (widgetId !== null && window.turnstile?.remove) {
        window.turnstile.remove(widgetId);
      }
      widgetIdRef.current = null;
      if (container) container.replaceChildren();
    };
  }, [action, siteKey]);

  useEffect(() => {
    if (resetKey === 0) return;

    const widgetId = widgetIdRef.current;
    if (widgetId !== null && window.turnstile?.reset) {
      window.turnstile.reset(widgetId);
    }
    callbacksRef.current.onToken(null);
  }, [resetKey]);

  return (
    <div
      aria-live="polite"
      className="public-turnstile"
      data-disabled={disabled ? "true" : undefined}
    >
      <div ref={containerRef} />
      {status === "loading" ? <p className="public-turnstile__status">Loading verification…</p> : null}
      {status === "unavailable" ? (
        <p className="public-turnstile__status" role="alert">
          Verification is temporarily unavailable. Please try again later.
        </p>
      ) : null}
    </div>
  );
}
