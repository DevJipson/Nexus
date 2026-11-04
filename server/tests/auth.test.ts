import type { Express } from "express";
import { type Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SESSION_COOKIE_NAME } from "../src/lib/session-cookie";
import {
  api,
  createCapturingTransport,
  createPool,
  createTestApp,
  describeDb,
  firstCookie,
  resetDatabase,
  testEnv,
  uniqueEmail,
  type CapturingTransport,
} from "./helpers/db";

describeDb("auth", () => {
  let pool: Pool;
  let app: Express;
  let email: CapturingTransport;

  const env = testEnv();
  const password = "Correct-Horse-9";

  beforeAll(async () => {
    pool = createPool();
    await resetDatabase(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    email = createCapturingTransport();
    app = createTestApp(pool, env, email);
    await pool.query("TRUNCATE TABLE users CASCADE");
  });

  async function register(emailAddress: string, passwordValue = password) {
    return api(app).post("/api/v1/auth/register").send({ name: "Test Person", email: emailAddress, password: passwordValue });
  }

  describe("registration", () => {
    it("creates an account, hashes the password and sends a verification email", async () => {
      const address = uniqueEmail("reg");
      const response = await register(address);

      expect(response.status).toBe(201);
      expect(response.body.data.user.email).toBe(address);
      expect(response.body.data.user.emailVerified).toBe(false);
      expect(response.body.data.emailVerificationRequired).toBe(true);
      // Password is never returned.
      expect(JSON.stringify(response.body)).not.toContain(password);

      const stored = await pool.query<{ password_hash: string }>("SELECT password_hash FROM users WHERE email = $1", [address]);
      expect(stored.rows[0]?.password_hash).toContain("$argon2id$");

      expect(email.messages).toHaveLength(1);
      expect(email.messages[0]?.to).toBe(address);
      expect(email.tokenFor(address, "Verify")).toBeTruthy();
    });

    it("rejects weak passwords", async () => {
      const response = await api(app)
        .post("/api/v1/auth/register")
        .send({ name: "Weak", email: uniqueEmail("weak"), password: "short" });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects duplicate emails", async () => {
      const address = uniqueEmail("dup");
      await register(address);
      const second = await register(address);
      expect(second.status).toBe(409);
      expect(second.body.error.code).toBe("CONFLICT");
    });

    it("normalizes email case", async () => {
      const address = uniqueEmail("case");
      const response = await register(address.toUpperCase());
      expect(response.status).toBe(201);
      expect(response.body.data.user.email).toBe(address);
    });
  });

  describe("email verification", () => {
    it("consumes the token and marks the email verified", async () => {
      const address = uniqueEmail("verify");
      await register(address);
      const token = email.tokenFor(address, "Verify");
      expect(token).toBeTruthy();

      const response = await api(app).post("/api/v1/auth/verify-email").send({ token });
      expect(response.status).toBe(200);
      expect(response.body.data.user.emailVerified).toBe(true);
    });

    it("rejects a token that was already used", async () => {
      const address = uniqueEmail("reuse");
      await register(address);
      const token = email.tokenFor(address, "Verify")!;
      await api(app).post("/api/v1/auth/verify-email").send({ token });
      const second = await api(app).post("/api/v1/auth/verify-email").send({ token });
      expect(second.status).toBe(400);
    });
  });

  describe("login and sessions", () => {
    it("logs in and sets an HttpOnly session cookie", async () => {
      const address = uniqueEmail("login");
      await register(address);

      const response = await api(app).post("/api/v1/auth/login").send({ email: address, password });
      expect(response.status).toBe(200);
      expect(response.body.data.user.email).toBe(address);

      const cookie = firstCookie(response);
      expect(cookie).toContain(SESSION_COOKIE_NAME);
      expect(cookie).toContain("HttpOnly");
      expect(cookie.toLowerCase()).toContain("samesite=lax");
    });

    it("rejects a wrong password with a generic message", async () => {
      const address = uniqueEmail("wrongpw");
      await register(address);
      const response = await api(app).post("/api/v1/auth/login").send({ email: address, password: "Wrong-Password-1" });
      expect(response.status).toBe(401);
      expect(response.body.error.message).toBe("Incorrect email or password.");
    });

    it("returns the same generic error for an unknown email (no enumeration)", async () => {
      const response = await api(app)
        .post("/api/v1/auth/login")
        .send({ email: "nobody@example.test", password: "Wrong-Password-1" });
      expect(response.status).toBe(401);
      expect(response.body.error.message).toBe("Incorrect email or password.");
    });

    it("authorizes authenticated requests and blocks them without a cookie", async () => {
      const address = uniqueEmail("guard");
      await register(address);
      const login = await api(app).post("/api/v1/auth/login").send({ email: address, password });
      const cookie = firstCookie(login);

      const authed = await api(app).get("/api/v1/auth/me").set("Cookie", cookie);
      expect(authed.status).toBe(200);
      expect(authed.body.data.user.email).toBe(address);

      const anonymous = await api(app).get("/api/v1/auth/me");
      expect(anonymous.status).toBe(401);
      expect(anonymous.body.error.code).toBe("UNAUTHENTICATED");
    });

    it("revokes the session on logout", async () => {
      const address = uniqueEmail("logout");
      await register(address);
      const login = await api(app).post("/api/v1/auth/login").send({ email: address, password });
      const cookie = firstCookie(login);

      await api(app).post("/api/v1/auth/logout").set("Cookie", cookie);
      const after = await api(app).get("/api/v1/auth/me").set("Cookie", cookie);
      expect(after.status).toBe(401);
    });

    it("rejects a revoked or unknown session token", async () => {
      const response = await api(app)
        .get("/api/v1/auth/me")
        .set("Cookie", `${SESSION_COOKIE_NAME}=not-a-real-token`);
      expect(response.status).toBe(401);
    });
  });

  describe("password reset", () => {
    it("issues a reset link, resets the password and revokes sessions", async () => {
      const address = uniqueEmail("reset");
      await register(address);
      const login = await api(app).post("/api/v1/auth/login").send({ email: address, password });
      const oldCookie = firstCookie(login);

      const forgot = await api(app).post("/api/v1/auth/forgot-password").send({ email: address });
      expect(forgot.status).toBe(200);

      const token = email.tokenFor(address, "Reset");
      expect(token).toBeTruthy();

      const reset = await api(app).post("/api/v1/auth/reset-password").send({ token, password: "Brand-New-Pass-1" });
      expect(reset.status).toBe(200);

      // Old password no longer works; the new one does.
      const oldLogin = await api(app).post("/api/v1/auth/login").send({ email: address, password });
      expect(oldLogin.status).toBe(401);
      const newLogin = await api(app)
        .post("/api/v1/auth/login")
        .send({ email: address, password: "Brand-New-Pass-1" });
      expect(newLogin.status).toBe(200);

      // Sessions issued before the reset are revoked.
      const afterReset = await api(app).get("/api/v1/auth/me").set("Cookie", oldCookie);
      expect(afterReset.status).toBe(401);
    });

    it("returns 200 for unknown emails (no enumeration)", async () => {
      const response = await api(app).post("/api/v1/auth/forgot-password").send({ email: "ghost@example.test" });
      expect(response.status).toBe(200);
      expect(email.messages).toHaveLength(0);
    });
  });

  describe("change password", () => {
    it("keeps the current session but revokes others", async () => {
      const address = uniqueEmail("change");
      await register(address);
      const first = await api(app).post("/api/v1/auth/login").send({ email: address, password });
      const second = await api(app).post("/api/v1/auth/login").send({ email: address, password });
      const firstCookieValue = firstCookie(first);
      const secondCookieValue = firstCookie(second);

      const change = await api(app)
        .patch("/api/v1/auth/password")
        .set("Cookie", firstCookieValue)
        .send({ currentPassword: password, newPassword: "Rotated-Pass-9" });
      expect(change.status).toBe(200);

      // Current session survives; the other is revoked.
      expect((await api(app).get("/api/v1/auth/me").set("Cookie", firstCookieValue)).status).toBe(200);
      expect((await api(app).get("/api/v1/auth/me").set("Cookie", secondCookieValue)).status).toBe(401);
    });

    it("rejects an incorrect current password", async () => {
      const address = uniqueEmail("badchange");
      await register(address);
      const login = await api(app).post("/api/v1/auth/login").send({ email: address, password });
      const response = await api(app)
        .patch("/api/v1/auth/password")
        .set("Cookie", firstCookie(login))
        .send({ currentPassword: "nope", newPassword: "Rotated-Pass-9" });
      expect(response.status).toBe(401);
    });
  });
});
