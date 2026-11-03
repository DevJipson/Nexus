"use client";

import { SearchIcon } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { QuickCreate } from "@/components/layout/quick-create";
import { NotificationCenter } from "@/components/layout/notification-center";
import { UserMenu } from "@/components/layout/user-menu";
import { Kbd } from "@/components/ui/kbd";
import { useUiStore } from "@/store/ui-store";

function SearchTrigger() {
  const setCommandOpen = useUiStore((state) => state.setCommandOpen);

  return (
    <>
      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        aria-label="Search NEXUS"
        className="hidden h-8 w-[188px] items-center gap-2 rounded-lg border border-border/80 bg-surface-raised px-2.5 text-left text-[12.5px] text-muted-foreground transition-colors hover:border-border hover:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none md:flex xl:w-[232px]"
      >
        <SearchIcon className="size-3.5 shrink-0 text-muted-foreground/80" aria-hidden="true" />
        <span className="flex-1 truncate">Search or jump to…</span>
        <Kbd className="h-4.5 min-w-0 px-1 font-mono text-[9.5px]">⌘K</Kbd>
      </button>
      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        aria-label="Search NEXUS"
        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none md:hidden"
      >
        <SearchIcon className="size-4" aria-hidden="true" />
      </button>
    </>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur-md supports-backdrop-filter:bg-background/70 sm:px-6 lg:px-8">
      <Breadcrumbs className="flex-1" />

      <div className="flex shrink-0 items-center gap-1.5">
        <SearchTrigger />
        <QuickCreate />
        <NotificationCenter />
        <ThemeToggle compact />
        <span aria-hidden="true" className="mx-0.5 hidden h-5 w-px bg-border sm:block" />
        <div className="lg:hidden">
          <UserMenu compact />
        </div>
      </div>
    </header>
  );
}
