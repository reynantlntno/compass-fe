type SessionRefreshHandler = () => Promise<boolean>;

let sessionRefreshHandler: SessionRefreshHandler | null = null;

export function registerSessionRefresh(handler: SessionRefreshHandler) {
  sessionRefreshHandler = handler;

  return () => {
    if (sessionRefreshHandler === handler) sessionRefreshHandler = null;
  };
}

export function requestSessionRefresh(): Promise<boolean> {
  return sessionRefreshHandler?.() ?? Promise.resolve(false);
}
