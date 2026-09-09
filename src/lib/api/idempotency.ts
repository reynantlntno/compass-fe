const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

export type IdempotencyKey = string & {
  readonly __compassIdempotencyKey: unique symbol;
};

function formatUuid(bytes: Uint8Array) {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}

export function createIdempotencyKey(): IdempotencyKey {
  const runtimeCrypto = globalThis.crypto;
  if (typeof runtimeCrypto?.randomUUID === "function") {
    return runtimeCrypto.randomUUID() as IdempotencyKey;
  }

  if (typeof runtimeCrypto?.getRandomValues === "function") {
    return formatUuid(runtimeCrypto.getRandomValues(new Uint8Array(16))) as IdempotencyKey;
  }

  throw new Error("Secure random number generation is unavailable.");
}

export function idempotencyHeaders(key: IdempotencyKey): Record<string, string> {
  return { [IDEMPOTENCY_KEY_HEADER]: key };
}

export function withIdempotencyKey(
  key: IdempotencyKey,
  options: RequestInit = {},
): RequestInit {
  const headers = new Headers(options.headers);
  headers.set(IDEMPOTENCY_KEY_HEADER, key);

  return { ...options, headers };
}
