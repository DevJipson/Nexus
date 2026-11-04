import { describe, expect, it } from "vitest";
import {
  HttpError,
  httpError,
  isForeignKeyViolation,
  isUniqueViolation,
  toErrorBody,
} from "../src/lib/errors";

describe("HttpError", () => {
  it("maps codes to HTTP statuses", () => {
    expect(httpError.validation().status).toBe(400);
    expect(httpError.unauthenticated().status).toBe(401);
    expect(httpError.forbidden().status).toBe(403);
    expect(httpError.notFound().status).toBe(404);
    expect(httpError.conflict().status).toBe(409);
    expect(httpError.rateLimited().status).toBe(429);
    expect(httpError.unavailable().status).toBe(503);
    expect(httpError.internal().status).toBe(500);
  });

  it("carries code, message and optional details", () => {
    const error = httpError.forbidden("Workspace membership required.");
    expect(error).toBeInstanceOf(HttpError);
    expect(error.code).toBe("FORBIDDEN");
    expect(error.message).toBe("Workspace membership required.");
    expect(error.details).toBeUndefined();
  });
});

describe("toErrorBody", () => {
  it("omits details when absent", () => {
    expect(toErrorBody("NOT_FOUND", "Missing.")).toEqual({
      error: { code: "NOT_FOUND", message: "Missing." },
    });
  });

  it("includes details when present", () => {
    const body = toErrorBody("VALIDATION_ERROR", "Invalid.", [{ path: "name", message: "Required" }]);
    expect(body.error.details).toEqual([{ path: "name", message: "Required" }]);
  });
});

describe("pg error detectors", () => {
  it("detects unique violations (23505)", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ code: "42P01" })).toBe(false);
    expect(isUniqueViolation(new Error("plain"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });

  it("detects foreign key violations (23503)", () => {
    expect(isForeignKeyViolation({ code: "23503" })).toBe(true);
    expect(isForeignKeyViolation({ code: "23505" })).toBe(false);
  });
});
