"use client";

import Link from "next/link";
import {
  CalendarPlusIcon,
  FolderPlusIcon,
  MessageSquarePlusIcon,
  PlusIcon,
  SquarePlusIcon,
  UserPlusIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/store/ui-store";

const ACTIONS = [
  {
    label: "Project",
    hint: "Plan a new body of work",
    href: "/projects",
    icon: FolderPlusIcon,
  },
  {
    label: "Task",
    hint: "Capture something to do",
    href: "/tasks",
    icon: SquarePlusIcon,
  },
  {
    label: "Event",
    hint: "Block time or a deadline",
    href: "/calendar",
    icon: CalendarPlusIcon,
  },
  {
    label: "Conversation",
    hint: "Start a thread with the team",
    href: "/messages",
    icon: MessageSquarePlusIcon,
  },
] as const;

export function QuickCreate() {
  const setCommandOpen = useUiStore((state) => state.setCommandOpen);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="default"
          size="sm"
          aria-label="Create new"
          className="pl-2.5"
        >
          <PlusIcon className="size-4!" />
          <span className="hidden sm:inline">New</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="eyebrow px-2 py-2">Create</DropdownMenuLabel>
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <DropdownMenuItem key={action.label} asChild className="gap-2.5 py-2">
              <Link href={action.href}>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-surface text-muted-foreground">
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-medium text-foreground">
                    {action.label}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {action.hint}
                  </span>
                </span>
              </Link>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="gap-2.5 py-2">
          <Link href="/team">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-surface text-muted-foreground">
              <UserPlusIcon className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-medium text-foreground">
                Invite teammate
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                Add someone to this workspace
              </span>
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => setCommandOpen(true)}
          className="justify-between gap-2.5 py-2 text-muted-foreground"
        >
          <span>Open command palette</span>
          <span className="font-mono text-[10px] tracking-wide">⌘K</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
