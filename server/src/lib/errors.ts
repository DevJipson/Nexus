/**
 * Error model shared by every route: HTTP errors carry a stable machine code
 * that the error middleware serializes into the response envelope
 * `{ error: { code, message, details? } }`.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UNAVAILABLE"
  | "INTERNAL";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  UNAVAILABLE: 503,
  INTERNAL: 500,
};

export interface ErrorBody {
  error: { code: ErrorCode; message: string; details?: unknown };
}

export function toErrorBody(
  code: ErrorCode,
  message: string,
  details?: unknown,
): ErrorBody {
  return details === undefined
    ? { error: { code, message } }
    : { error: { code, message, details } };
}

export class HttpError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export const httpError = {
  validation: (message = "The request payload is invalid.", details?: unknown) =>
    new HttpError("VALIDATION_ERROR", message, details),
  unauthenticated: (message = "Authentication is required.") =>
    new HttpError("UNAUTHENTICATED", message),
  forbidden: (message = "You do not have permission to perform this action.") =>
    new HttpError("FORBIDDEN", message),
  notFound: (message = "The requested resource was not found.") =>
    new HttpError("NOT_FOUND", message),
  conflict: (message = "The resource already exists.") =>
    new HttpError("CONFLICT", message),
  rateLimited: (message = "Too many requests. Try again later.") =>
    new HttpError("RATE_LIMITED", message),
  unavailable: (message = "The service is temporarily unavailable.") =>
    new HttpError("UNAVAILABLE", message),
  internal: (message = "Something went wrong on our side.") =>
    new HttpError("INTERNAL", message),
};

/** Postgres unique-violation detector (SQLSTATE 23505). */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

/** Postgres foreign-key-violation detector (SQLSTATE 23503). */
export function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23503"
  );
}
