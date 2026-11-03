"use client";

import { create } from "zustand";
import type { ID } from "@/types/domain";

export type ComposerKind = "project" | "task" | "event" | "conversation";

interface ComposeState {
  kind: ComposerKind | null;
  projectId: ID | null;
  date: string | null;
  open: (kind: ComposerKind, options?: { projectId?: ID | null; date?: Date | null }) => void;
  close: () => void;
}

/** Ephemeral: which create dialog is open, and what it should be pre-filled with. */
export const useComposeStore = create<ComposeState>((set) => ({
  kind: null,
  projectId: null,
  date: null,
  open: (kind, options) =>
    set({
      kind,
      projectId: options?.projectId ?? null,
      date: options?.date ? options.date.toISOString() : null,
    }),
  close: () => set({ kind: null, projectId: null, date: null }),
}));
