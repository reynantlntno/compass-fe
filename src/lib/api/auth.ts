import {
  authCsrf,
  authLogin,
  authLoginOtpResend,
  authLoginVerify,
  authLogout,
  authMe,
  authRecoveryRequest,
  authRecoveryReset,
  authStaffActivation,
  authStudentActivation,
  authTokenRefresh,
} from "@/lib/api/generated/authentication/authentication";
import type {
  LoginChallengeSchema,
  LoginRequestSchema,
  LoginVerifyRequestSchema,
  MeSchema,
  OtpResendRequestSchema,
  RecoveryRequestSchema,
  RecoveryResetRequestSchema,
  StaffActivationRequestSchema,
  StudentActivationRequestSchema,
} from "@/lib/api/generated/model";

const SESSION_MEDIA_TYPE = "application/vnd.compass.session+json";
const SESSION_TRANSPORT_HEADER = "X-COMPASS-Auth-Transport";
const SESSION_TRANSPORT_VALUE = "cookie";

export type AuthChallengeAction = "login" | "recovery" | "activation";

export type AuthApiErrorKind =
  | "challenge_required"
  | "conflict"
  | "invalid_activation"
  | "invalid_credentials"
  | "invalid_recovery"
  | "rate_limited"
  | "unavailable"
  | "validation";

export class AuthApiError extends Error {
  readonly kind: AuthApiErrorKind;
  readonly challengeRequired: boolean;
  readonly challengeAction: AuthChallengeAction | null;

  constructor(
    kind: AuthApiErrorKind,
    options: {
      challengeAction?: AuthChallengeAction | null;
      challengeRequired?: boolean;
    } = {},
  ) {
    super("The authentication request could not be completed.");
    this.name = "AuthApiError";
    this.kind = kind;
    this.challengeRequired = options.challengeRequired === true;
    this.challengeAction = options.challengeAction ?? null;
  }
}

export type CurrentAuthSession =
  | { authenticated: true; user: MeSchema }
  | { authenticated: false };

export type LoginResult =
  | { kind: "signed-in" }
  | { kind: "challenge"; challenge: LoginChallengeSchema };

let csrfToken: string | null = null;

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sessionReadOptions(signal?: AbortSignal): RequestInit {
  return {
    cache: "no-store",
    credentials: "include",
    headers: {
      Accept: SESSION_MEDIA_TYPE,
      [SESSION_TRANSPORT_HEADER]: SESSION_TRANSPORT_VALUE,
    },
    signal,
  };
}

export function cookieSessionReadOptions(signal?: AbortSignal): RequestInit {
  return sessionReadOptions(signal);
}

function sessionMutationOptions(
  csrf?: string | null,
  signal?: AbortSignal,
): RequestInit {
  const headers = new Headers({
    Accept: SESSION_MEDIA_TYPE,
    [SESSION_TRANSPORT_HEADER]: SESSION_TRANSPORT_VALUE,
  });

  if (csrf) headers.set("X-CSRFToken", csrf);

  return {
    cache: "no-store",
    credentials: "include",
    headers,
    signal,
  };
}

export async function cookieSessionMutationOptions(
  signal?: AbortSignal,
): Promise<RequestInit> {
  const csrf = await getCsrfToken(signal);
  return sessionMutationOptions(csrf, signal);
}

function publicRequestOptions(signal?: AbortSignal): RequestInit {
  return {
    cache: "no-store",
    credentials: "include",
    signal,
  };
}

function throwTransportError(error: unknown): never {
  if (isAbortError(error)) throw error;
  throw new AuthApiError("unavailable");
}

function hasChallengeMetadata(data: unknown): data is Record<string, unknown> {
  return (
    isRecord(data) &&
    ("challenge_required" in data || "challenge_action" in data)
  );
}

function challengeError(
  data: unknown,
  expectedAction: AuthChallengeAction | undefined,
): AuthApiError | null {
  if (!hasChallengeMetadata(data)) return null;

  const required = data.challenge_required === true;
  const action = data.challenge_action;

  if (required && action === expectedAction) {
    return new AuthApiError("challenge_required", {
      challengeAction: expectedAction,
      challengeRequired: true,
    });
  }

  if (required || (action !== null && action !== undefined)) {
    return new AuthApiError("unavailable");
  }

  return null;
}

function throwResponseError(
  status: number,
  data: unknown,
  context:
    | "login"
    | "verification"
    | "recovery-request"
    | "recovery-reset"
    | "activation",
  expectedChallengeAction?: AuthChallengeAction,
): never {
  if (status === 429) {
    const challenge = challengeError(data, expectedChallengeAction);
    if (challenge) throw challenge;
    throw new AuthApiError("rate_limited");
  }

  if (status === 409) throw new AuthApiError("conflict");
  if (status === 500 || status === 503) throw new AuthApiError("unavailable");

  if (context === "recovery-reset" && [400, 401, 403, 404].includes(status)) {
    throw new AuthApiError("invalid_recovery");
  }

  if (context === "activation" && [400, 401, 403, 404].includes(status)) {
    throw new AuthApiError("invalid_activation");
  }

  if (context === "recovery-request" && ![400, 422].includes(status)) {
    throw new AuthApiError("unavailable");
  }

  if ((context === "login" || context === "verification") && [401, 403].includes(status)) {
    throw new AuthApiError("invalid_credentials");
  }

  if ([400, 422].includes(status)) throw new AuthApiError("validation");

  throw new AuthApiError("unavailable");
}

function isLoginChallenge(data: unknown): data is LoginChallengeSchema {
  return (
    isRecord(data) &&
    typeof data.challenge_id === "string" &&
    data.challenge_id.length > 0 &&
    typeof data.pending_nonce === "string" &&
    data.pending_nonce.length > 0 &&
    typeof data.expires_in === "number" &&
    Number.isFinite(data.expires_in) &&
    data.expires_in > 0 &&
    typeof data.requires_verification === "boolean"
  );
}

function isMeProjection(data: unknown): data is MeSchema {
  return (
    isRecord(data) &&
    Number.isSafeInteger(data.id) &&
    typeof data.email === "string" &&
    data.email.trim().length > 0 &&
    typeof data.first_name === "string" &&
    typeof data.last_name === "string" &&
    typeof data.role === "string" &&
    data.role.trim().length > 0
  );
}

async function getCsrfToken(signal?: AbortSignal): Promise<string> {
  if (csrfToken) return csrfToken;

  let response;
  try {
    response = await authCsrf({
      cache: "no-store",
      credentials: "include",
      signal,
    });
  } catch (error) {
    return throwTransportError(error);
  }

  if (response.status !== 200 || !isRecord(response.data)) {
    throw new AuthApiError("unavailable");
  }

  const value = response.data.csrf_token;
  if (typeof value !== "string" || value.length === 0) {
    throw new AuthApiError("unavailable");
  }

  csrfToken = value;
  return value;
}

export async function getCurrentAuthSession(
  signal?: AbortSignal,
  allowRefresh = true,
): Promise<CurrentAuthSession> {
  let response;
  try {
    response = await authMe(sessionReadOptions(signal));
  } catch (error) {
    return throwTransportError(error);
  }

  if (response.status === 200) {
    if (!isMeProjection(response.data)) throw new AuthApiError("unavailable");
    return { authenticated: true, user: response.data };
  }

  if (response.status === 401) {
    if (allowRefresh && (await refreshAuthSession(signal))) {
      return getCurrentAuthSession(signal, false);
    }
    return { authenticated: false };
  }

  throwResponseError(response.status, response.data, "verification");
}

export async function refreshAuthSession(signal?: AbortSignal): Promise<boolean> {
  const csrf = await getCsrfToken(signal);
  let response;
  try {
    response = await authTokenRefresh(
      {},
      sessionMutationOptions(csrf, signal),
    );
  } catch (error) {
    return throwTransportError(error);
  }

  if (response.status === 200) return true;
  if ([400, 401, 403, 404].includes(response.status)) return false;

  throwResponseError(response.status, response.data, "verification");
}

export async function loginWithPassword(
  input: Pick<LoginRequestSchema, "email" | "password"> & {
    captchaResponse?: string | null;
  },
  signal?: AbortSignal,
): Promise<LoginResult> {
  const payload: LoginRequestSchema = {
    email: input.email.trim(),
    password: input.password,
  };

  if (input.captchaResponse) payload.captcha_response = input.captchaResponse;

  const csrf = await getCsrfToken(signal);
  let response;
  try {
    response = await authLogin(payload, sessionMutationOptions(csrf, signal));
  } catch (error) {
    return throwTransportError(error);
  }

  if (response.status === 200) return { kind: "signed-in" };
  if (response.status === 202) {
    if (!isLoginChallenge(response.data)) throw new AuthApiError("unavailable");
    return { kind: "challenge", challenge: response.data };
  }

  throwResponseError(response.status, response.data, "login", "login");
}

export async function verifyLogin(
  input: LoginVerifyRequestSchema,
  signal?: AbortSignal,
): Promise<void> {
  const payload: LoginVerifyRequestSchema = {
    challenge_id: input.challenge_id,
    pending_nonce: input.pending_nonce,
    otp: input.otp.trim(),
    trust_device: input.trust_device === true,
  };
  const csrf = await getCsrfToken(signal);
  let response;
  try {
    response = await authLoginVerify(
      payload,
      sessionMutationOptions(csrf, signal),
    );
  } catch (error) {
    return throwTransportError(error);
  }

  if (response.status === 200) return;
  throwResponseError(response.status, response.data, "verification");
}

export async function resendLoginOtp(
  input: OtpResendRequestSchema,
  signal?: AbortSignal,
): Promise<void> {
  const csrf = await getCsrfToken(signal);
  let response;
  try {
    response = await authLoginOtpResend(
      input,
      sessionMutationOptions(csrf, signal),
    );
  } catch (error) {
    return throwTransportError(error);
  }

  if (response.status === 200) return;
  throwResponseError(response.status, response.data, "verification");
}

export async function requestPasswordRecovery(
  email: string,
  captchaResponse?: string | null,
  signal?: AbortSignal,
): Promise<void> {
  const payload: RecoveryRequestSchema = { email: email.trim() };
  if (captchaResponse) payload.captcha_response = captchaResponse;

  let response;
  try {
    response = await authRecoveryRequest(payload, publicRequestOptions(signal));
  } catch (error) {
    return throwTransportError(error);
  }

  if (response.status === 200) return;
  throwResponseError(
    response.status,
    response.data,
    "recovery-request",
    "recovery",
  );
}

export async function resetPassword(
  input: Pick<RecoveryResetRequestSchema, "token" | "new_password" | "password_confirmation"> & {
    captchaResponse?: string | null;
  },
  signal?: AbortSignal,
): Promise<void> {
  const payload: RecoveryResetRequestSchema = {
    token: input.token,
    new_password: input.new_password,
    password_confirmation: input.password_confirmation,
  };
  if (input.captchaResponse) payload.captcha_response = input.captchaResponse;

  let response;
  try {
    response = await authRecoveryReset(payload, publicRequestOptions(signal));
  } catch (error) {
    return throwTransportError(error);
  }

  if (response.status === 200) return;
  throwResponseError(
    response.status,
    response.data,
    "recovery-reset",
    "recovery",
  );
}

type ActivationInput = Pick<
  StaffActivationRequestSchema,
  "token" | "password" | "password_confirmation"
> & {
  captchaResponse?: string | null;
};

function activationPayload(input: ActivationInput): StaffActivationRequestSchema {
  const payload: StaffActivationRequestSchema = {
    token: input.token,
    password: input.password,
    password_confirmation: input.password_confirmation,
  };

  if (input.captchaResponse) payload.captcha_response = input.captchaResponse;
  return payload;
}

export async function activateStudentAccount(
  input: ActivationInput,
  signal?: AbortSignal,
): Promise<void> {
  const payload: StudentActivationRequestSchema = activationPayload(input);
  let response;
  try {
    response = await authStudentActivation(
      payload,
      publicRequestOptions(signal),
    );
  } catch (error) {
    return throwTransportError(error);
  }

  if (response.status === 200) return;
  throwResponseError(response.status, response.data, "activation", "activation");
}

export async function activateStaffAccount(
  input: ActivationInput,
  signal?: AbortSignal,
): Promise<void> {
  const payload = activationPayload(input);
  let response;
  try {
    response = await authStaffActivation(
      payload,
      publicRequestOptions(signal),
    );
  } catch (error) {
    return throwTransportError(error);
  }

  if (response.status === 200) return;
  throwResponseError(response.status, response.data, "activation", "activation");
}

export async function logoutCurrentSession(signal?: AbortSignal): Promise<void> {
  let csrf: string | null = null;
  try {
    csrf = await getCsrfToken(signal);
  } catch (error) {
    if (isAbortError(error)) throw error;
  }

  let response;
  try {
    response = await authLogout(sessionMutationOptions(csrf, signal));
  } catch (error) {
    return throwTransportError(error);
  }

  if ([204, 400, 401, 403, 404].includes(response.status)) return;
  throwResponseError(response.status, response.data, "verification");
}

export function clearCachedCsrfToken() {
  csrfToken = null;
}
