const RESOURCE_VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

/** The backend's canonical optimistic-concurrency representation. */
export function isResourceVersion(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length === 27 &&
    RESOURCE_VERSION_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

export function isOptionalResourceVersion(value: unknown): value is string | null | undefined {
  return value === null || value === undefined || isResourceVersion(value);
}
