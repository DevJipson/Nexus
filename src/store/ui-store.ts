"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_WORKSPACE_ID, seedWorkspaces } from "@/data/seed/shell";

interface UiState {
  hydrated: boolean;
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  commandOpen: boolean;
  helpOpen: boolean;
  activeWorkspaceId: string;
  setHydrated: (hydrated: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
  setActiveWorkspaceId: (id: string) => void;
}

const validWorkspaceIds = new Set(seedWorkspaces.map((workspace) => workspace.id));

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      hydrated: false,
      sidebarCollapsed: false,
      mobileNavOpen: false,
      commandOpen: false,
      helpOpen: false,
      activeWorkspaceId: DEFAULT_WORKSPACE_ID,
      setHydrated: (hydrated) => set({ hydrated }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      setHelpOpen: (helpOpen) => set({ helpOpen }),
      setActiveWorkspaceId: (activeWorkspaceId) => {
        if (!validWorkspaceIds.has(activeWorkspaceId)) return;
        set({ activeWorkspaceId });
      },
    }),
    {
      name: "nexus:ui:v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        activeWorkspaceId: state.activeWorkspaceId,
      }),
      merge: (persisted, current) => {
        const candidate = persisted as Partial<UiState> | undefined;
        const activeWorkspaceId =
          candidate?.activeWorkspaceId && validWorkspaceIds.has(candidate.activeWorkspaceId)
            ? candidate.activeWorkspaceId
            : current.activeWorkspaceId;

        return {
          ...current,
          ...candidate,
          hydrated: false,
          mobileNavOpen: false,
          commandOpen: false,
          helpOpen: false,
          activeWorkspaceId,
        };
      },
    },
  ),
);
