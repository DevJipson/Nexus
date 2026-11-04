import { defineConfig } from "vitest/config";

/**
 * Server test configuration.
 *
 * - `fileParallelism: false` keeps database-backed suites (migrations, seed)
 *   deterministic: they reset a shared disposable database and must not race.
 * - Database suites are skipped automatically when `TEST_DATABASE_URL` is not
 *   set, so `npm test` always runs (unit suites) even without a database.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["src/index.ts"],
    },
  },
});
