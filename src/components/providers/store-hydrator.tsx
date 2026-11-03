"use client";

import { useEffect } from "react";
import { useUiStore } from "@/store/ui-store";

/**
 * Zustand's persist middleware is deliberately skipped during SSR so the server
 * and the first client render agree. This component rehydrates once, then marks
 * the shell as ready. The app shell renders a skeleton until that happens.
 */
export function StoreHydrator() {
  useEffect(() => {
    let cancelled = false;

    const finish = () => {
      if (cancelled) return;
      useUiStore.getState().setHydrated(true);
    };

    try {
      const result = useUiStore.persist.rehydrate();
      if (result && typeof (result as Promise<void>).then === "function") {
        void (result as Promise<void>).then(finish, finish);
      } else {
        finish();
      }
    } catch {
      try {
        localStorage.removeItem("nexus:ui:v1");
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
