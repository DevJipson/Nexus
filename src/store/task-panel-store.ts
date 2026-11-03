"use client";

import { create } from "zustand";
import type { ID } from "@/types/domain";

interface TaskPanelState {
  taskId: ID | null;
  open: (taskId: ID) => void;
  close: () => void;
}

/** Ephemeral: the task detail sheet is shared by the board, table and project view. */
export const useTaskPanelStore = create<TaskPanelState>((set) => ({
  taskId: null,
  open: (taskId) => set({ taskId }),
  close: () => set({ taskId: null }),
}));
