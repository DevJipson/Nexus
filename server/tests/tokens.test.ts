import { describe, expect, it } from "vitest";
import { generateToken, hashToken, tokensEqual } from "../src/lib/tokens";

describe("tokens", () => {
  it("generates URL-safe tokens with 256 bits of entropy", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    // 32 bytes → 43 base64url characters.
    expect(token).toHaveLength(43);
  });

  it("generates unique tokens", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateToken()));
    expect(tokens.size).toBe(200);
  });

  it("hashes deterministically to a 64-char hex digest", () => {
    const token = generateToken();
    const first = hashToken(token);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).toBe(first);
    expect(hashToken(token)).not.toBe(hashToken(`${token}x`));
  });

  it("compares tokens in constant time", () => {
    const a = hashToken("one");
    expect(tokensEqual(a, a)).toBe(true);
    expect(tokensEqual(a, hashToken("two"))).toBe(false);
    expect(tokensEqual(a, "shorter")).toBe(false);
  });
});
