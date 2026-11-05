/**
 * Typed client for the NEXUS backend (server/ — Express + PostgreSQL).
 *
 * The frontend is a local-first demo by default; setting
 * `NEXT_PUBLIC_NEXUS_API_URL` (e.g. "http://localhost:4000") switches the
 * features that support it — currently Messages — onto the live backend.
 *
 * Every successful response is `{ data: T }`; failures are
 * `{ error: { code, message } }`. Session auth rides the same-origin
 * `nexus_session` cookie (SameSite=Lax, cross-origin fetch with credentials).
 */

export const API_URL = process.env.NEXT_PUBLIC_NEXUS_API_URL ?? null;
/** Live backend mode is opt-in via env; everything else stays local demo. */
export const isBackendEnabled = typeof API_URL === "string" && API_URL.length > 0;

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UNAVAILABLE"
  | "INTERNAL"
  | "NETWORK";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;

  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  json?: unknown;
  signal?: AbortSignal;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!isBackendEnabled) {
    throw new ApiError(0, "NETWORK", "The NEXUS backend is not configured (NEXT_PUBLIC_NEXUS_API_URL is unset).");
  }
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      headers: {
        "X-Requested-With": "nexus",
        ...(options.json !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
      signal: options.signal,
    });
  } catch (cause) {
    throw new ApiError(0, "NETWORK", cause instanceof Error ? cause.message : "Could not reach the NEXUS API.");
  }

  const body = (await response.json().catch(() => null)) as {
    data?: T;
    error?: { code?: ApiErrorCode; message?: string };
  } | null;

  if (!response.ok) {
    const code = body?.error?.code ?? "INTERNAL";
    const message = body?.error?.message ?? `Request failed with status ${response.status}.`;
    throw new ApiError(response.status, code, message);
  }
  return body?.data as T;
}
