"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface UiState {
  hydrated: boolean;
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  commandOpen: boolean;
  helpOpen: boolean;
  setHydrated: (hydrated: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      hydrated: false,
      sidebarCollapsed: false,
      mobileNavOpen: false,
      commandOpen: false,
      helpOpen: false,
      setHydrated: (hydrated) => set({ hydrated }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      setHelpOpen: (helpOpen) => set({ helpOpen }),
    }),
    {
      name: "nexus:ui:v2",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
      }),
      merge: (persisted, current) => {
        const candidate = persisted as Partial<UiState> | undefined;
        return {
          ...current,
          ...candidate,
          hydrated: false,
          mobileNavOpen: false,
          commandOpen: false,
          helpOpen: false,
        };
      },
    },
  ),
);
