import { randomUUID } from "node:crypto";

/** Server-side identifiers are always UUID v4. */
export function newId(): string {
  return randomUUID();
}
