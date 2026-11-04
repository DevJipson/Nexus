import type { Pool, PoolClient } from "pg";

/**
 * Runs `work` inside a single database transaction. The client is checked out
 * for the duration, rolled back on any throw, and always released.
 *
 * All multi-statement mutations (and every future migration of state that the
 * frontend store performs atomically, e.g. task moves with activity logging)
 * must go through this helper so workspace-scoped invariants hold.
 */
export async function withTransaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The connection may already be broken; releasing is still required.
    }
    throw error;
  } finally {
    client.release();
  }
}
