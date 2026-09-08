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
  const response = await fetch(resolveUrl(url), {
    ...requestOptions,
    credentials: requestOptions.credentials ?? "include",
  });

  return {
    data: await readResponseBody<T>(response),
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
  } as T;
}
