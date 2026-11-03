"use client";

import { useEffect } from "react";
import { useUiStore } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";

/**
 * Zustand's persist middleware is deliberately skipped during SSR so the server
 * and the first client render agree. This component rehydrates both stores
 * once, then marks the shell as ready. The app shell renders a skeleton until
 * that happens — which also keeps build-time seed dates off the server HTML.
 */
export function StoreHydrator() {
  useEffect(() => {
    let cancelled = false;

    const finish = () => {
      if (cancelled) return;
      useUiStore.getState().setHydrated(true);
      useWorkspaceStore.getState().setHydrated(true);
    };

    try {
      const rehydrations = [
        useUiStore.persist.rehydrate(),
        useWorkspaceStore.persist.rehydrate(),
      ];

      void Promise.all(rehydrations).then(finish, finish);
    } catch {
      try {
        localStorage.removeItem("nexus:data:v1");
      } catch {
        // Storage can be unavailable in private or locked-down contexts.
      }
      finish();
    }
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
