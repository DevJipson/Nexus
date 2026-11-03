"use client";

import Link from "next/link";
import {
  ChevronDownIcon,
  CircleHelpIcon,
  KeyboardIcon,
  SettingsIcon,
  UserRoundIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { useUiStore } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { cn } from "@/lib/utils";

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const setHelpOpen = useUiStore((state) => state.setHelpOpen);
  const user = useWorkspaceStore((state) => state.members[state.currentUserId]);

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Account menu for ${user.name}`}
          className={cn(
            "flex items-center rounded-lg transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none",
            compact ? "size-9 justify-center" : "w-full gap-2.5 px-2 py-1.5 text-left",
          )}
        >
          <EntityAvatar name={user.name} hue={user.avatarHue} size="md" presence={user.presence} />
          {compact ? null : (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] leading-tight font-medium">
                  {user.name}
                </span>
                <span className="mt-0.5 block truncate text-[10.5px] text-muted-foreground">
                  {user.title}
                </span>
              </span>
              <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground/70" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? "end" : "start"} side="top" sideOffset={10} className="w-60">
        <DropdownMenuLabel className="flex items-center gap-2.5 px-2 py-2">
          <EntityAvatar name={user.name} hue={user.avatarHue} size="md" />
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] font-medium text-foreground">
              {user.name}
            </span>
            <span className="block truncate text-[11px] font-normal text-muted-foreground">
              {user.email}
            </span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="gap-2.5 py-2">
          <Link href="/settings">
            <UserRoundIcon className="size-4 text-muted-foreground" />
            Profile & preferences
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="gap-2.5 py-2">
          <Link href="/settings">
            <SettingsIcon className="size-4 text-muted-foreground" />
            Workspace settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2.5 py-2"
          onSelect={() => setHelpOpen(true)}
        >
          <KeyboardIcon className="size-4 text-muted-foreground" />
          Keyboard shortcuts
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2.5 py-2"
          onSelect={() => setHelpOpen(true)}
        >
          <CircleHelpIcon className="size-4 text-muted-foreground" />
          Help & support
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <p className="px-2.5 py-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
          Local demo · data stays in this browser
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
