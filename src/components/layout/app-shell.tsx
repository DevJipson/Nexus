"use client";

import { useEffect, type ReactNode } from "react";
import { useUiStore } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { CommandPalette } from "@/components/layout/command-palette";
import { HelpSheet } from "@/components/layout/help-sheet";
import { ShellSkeleton } from "@/components/layout/shell-skeleton";
import { ComposeDialogs } from "@/components/forms/compose-dialogs";
import { TaskDetailSheet } from "@/features/tasks/task-detail-sheet";
import { cn } from "@/lib/utils";

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function AppShell({ children }: { children: ReactNode }) {
  const chromeHydrated = useUiStore((state) => state.hydrated);
  const dataHydrated = useWorkspaceStore((state) => state.hydrated);
  const reduceMotion = useWorkspaceStore((state) => state.preferences.reduceMotion);
  const hydrated = chromeHydrated && dataHydrated;
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = reduceMotion ? "true" : "false";
    return () => {
      delete document.documentElement.dataset.reduceMotion;
    };
  }, [reduceMotion]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;

      const key = event.key.toLowerCase();

      if (key === "k") {
        event.preventDefault();
        const state = useUiStore.getState();
        state.setCommandOpen(!state.commandOpen);
        return;
      }

      if (key === "b") {
        const target = event.target as HTMLElement | null;
        const isEditable =
          target?.isContentEditable === true ||
          (target?.tagName ? EDITABLE_TAGS.has(target.tagName) : false);
        if (isEditable) return;
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleSidebar]);

  if (!hydrated) return <ShellSkeleton />;

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:rounded-lg focus:bg-primary focus:px-3.5 focus:py-2 focus:text-[12.5px] focus:font-medium focus:text-primary-foreground focus:shadow-pop"
      >
        Skip to content
      </a>

      <Sidebar />

      <div
        className={cn(
          "flex min-h-dvh flex-col transition-[padding-left] duration-200 ease-out",
          collapsed ? "lg:pl-[76px]" : "lg:pl-[256px]",
        )}
      >
        <Header />
        <main
          id="main-content"
          className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-6 pb-24 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12"
        >
          {children}
        </main>
        <footer className="mx-auto hidden w-full max-w-[1440px] items-center justify-between gap-4 px-8 pb-6 font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground/60 uppercase lg:flex">
          <span>NEXUS · Local demo workspace</span>
          <span>Seeded dataset · Saved in this browser</span>
        </footer>
      </div>

      <MobileNav />
      <CommandPalette />
      <HelpSheet />
      <ComposeDialogs />
      <TaskDetailSheet />
    </div>
  );
}
