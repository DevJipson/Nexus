"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Hydration-safe "has the client mounted" flag.
 *
 * `useSyncExternalStore` is the canonical way to read a client-only value: the
 * server snapshot is `false`, and React re-renders with `true` after hydration
 * without a cascading setState inside an effect.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
