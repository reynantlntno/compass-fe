import { requestSessionRefresh } from "@/lib/api/session-refresh";

type CompassRequestOptions = RequestInit & {
  schema?: unknown;
};

function getApiOrigin() {
  if (typeof window !== "undefined") {
    return "";
  }

  const value = process.env.COMPASS_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!value) {
    throw new Error("COMPASS_API_BASE_URL is required for server API requests.");
  }

  return value;
}

function resolveUrl(url: string) {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return `${getApiOrigin()}${url}`;
}

function shouldRefreshOnUnauthorized(
  url: string,
  options: RequestInit,
): boolean {
  const headers = new Headers(options.headers);
  if (headers.get("X-COMPASS-Auth-Transport") !== "cookie") return false;

  try {
    const path = new URL(resolveUrl(url), "http://compass.invalid").pathname;
    return !path.startsWith("/api/v1/auth/");
  } catch {
    return !url.includes("/api/v1/auth/");
  }
}

async function readResponseBody<T>(response: Response) {
  if ([204, 205, 304].includes(response.status)) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("json")) {
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  if (contentType.startsWith("text/")) {
    return (await response.text()) as T;
  }

  return (await response.blob()) as T;
}

export async function compassFetch<T>(
  url: string,
  options: CompassRequestOptions = {},
): Promise<T> {
  const requestOptions = { ...options };
  delete requestOptions.schema;
  const fetchOptions = {
    ...requestOptions,
    credentials: requestOptions.credentials ?? "include",
  } satisfies RequestInit;
  const resolvedUrl = resolveUrl(url);
  let response = await fetch(resolvedUrl, fetchOptions);

  if (
    response.status === 401 &&
    shouldRefreshOnUnauthorized(url, fetchOptions)
  ) {
    try {
      if (await requestSessionRefresh()) {
        response = await fetch(resolvedUrl, fetchOptions);
      }
    } catch {
      // Return the original unauthorized response. The auth provider will
      // surface transport failures through its own session check.
    }
  }

  return {
    data: await readResponseBody<T>(response),
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
  } as T;
}
