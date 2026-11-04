import type { Pool, PoolClient } from "pg";

/**
 * Project key generation.
 *
 * Mirrors the frontend `projectKey()` (first three alphabetic characters,
 * uppercased, fallback "PRJ") but guarantees uniqueness within a workspace by
 * appending a numeric suffix on collision (ATL, ATL2, ATL3, …).
 */
export function baseProjectKey(name: string): string {
  const letters = name.replace(/[^a-zA-Z]/g, "");
  const base = (letters.slice(0, 3) || "PRJ").toUpperCase();
  return base;
}

export async function allocateProjectKey(
  db: Pool | PoolClient,
  workspaceId: string,
  name: string,
): Promise<string> {
  const base = baseProjectKey(name);
  for (let attempt = 1; attempt <= 100; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base}${attempt}`;
    const existing = await db.query("SELECT 1 FROM projects WHERE workspace_id = $1 AND key = $2", [
      workspaceId,
      candidate,
    ]);
    if (existing.rowCount === 0) return candidate;
  }
  // Extremely unlikely; fall back to a stable suffix.
  return `${base}${Date.now().toString(36).slice(-4).toUpperCase()}`;
}
