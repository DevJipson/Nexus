import { hash as argon2Hash, verify as argon2Verify, type Options } from "@node-rs/argon2";

/**
 * Argon2id parameters per the OWASP Password Storage Cheat Sheet floor:
 * m = 19456 KiB (19 MiB), t = 2, p = 1. @node-rs/argon2 defaults to Argon2id.
 *
 * The @node-rs binding ships prebuilt native binaries, so development on
 * Windows requires no node-gyp toolchain.
 */
const ARGON2ID_OPTIONS: Options = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(plain: string): Promise<string> {
  return argon2Hash(plain, ARGON2ID_OPTIONS);
}

export function verifyPassword(passwordHash: string, plain: string): Promise<boolean> {
  return argon2Verify(passwordHash, plain);
}
