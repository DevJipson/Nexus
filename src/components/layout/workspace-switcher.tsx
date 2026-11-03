"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon, ChevronsUpDownIcon, Settings2Icon, UsersIcon } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { avatarTint, initials } from "@/lib/format";
import { seedWorkspaces } from "@/data/seed/shell";
import { useUiStore } from "@/store/ui-store";

export function WorkspaceSwitcher({
  collapsed = false,
  menuSide = "right",
}: {
  collapsed?: boolean;
  menuSide?: "right" | "left" | "top" | "bottom";
}) {
  const router = useRouter();
  const activeWorkspaceId = useUiStore((state) => state.activeWorkspaceId);
  const setActiveWorkspaceId = useUiStore((state) => state.setActiveWorkspaceId);

  const active =
    seedWorkspaces.find((workspace) => workspace.id === activeWorkspaceId) ??
    seedWorkspaces[0];

  const switchWorkspace = (id: string) => {
    if (id === activeWorkspaceId) return;
    const next = seedWorkspaces.find((workspace) => workspace.id === id);
    if (!next) return;

    setActiveWorkspaceId(id);
    router.push("/dashboard");
    toast.success(`Switched to ${next.name}`, {
      description: "Projects, tasks and activity are scoped to this workspace.",
    });
  };

  const trigger = collapsed ? (
    <button
      type="button"
      aria-label={`Workspace: ${active.name}. Switch workspace`}
      className="mx-auto flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-sidebar-accent focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none"
    >
      <span
        style={avatarTint(active.accentHue) as CSSProperties}
        className="avatar-tint flex size-7 items-center justify-center rounded-md text-[10px] font-semibold"
      >
        {initials(active.name)}
      </span>
    </button>
  ) : (
    <button
      type="button"
      aria-label={`Switch workspace. Current: ${active.name}`}
      className="group/ws flex w-full items-center gap-2.5 rounded-lg border border-sidebar-border/80 bg-card/60 px-2 py-1.5 text-left transition-colors hover:border-sidebar-border hover:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none"
    >
      <span
        style={avatarTint(active.accentHue) as CSSProperties}
        className="avatar-tint flex size-7 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold"
      >
        {initials(active.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] leading-tight font-medium">
          {active.name}
        </span>
        <span className="mt-0.5 block font-mono text-[9px] tracking-[0.12em] text-muted-foreground uppercase">
          {active.plan} plan
        </span>
      </span>
      <ChevronsUpDownIcon className="size-3.5 shrink-0 text-muted-foreground/70" />
    </button>
  );

  return (
    <DropdownMenu>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">{active.name}</TooltipContent>
        </Tooltip>
      ) : (
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      )}
      <DropdownMenuContent align="start" side={menuSide} sideOffset={12} className="w-64">
        <DropdownMenuLabel className="eyebrow px-2.5 py-2">Workspaces</DropdownMenuLabel>
        {seedWorkspaces.map((workspace) => {
          const isActive = workspace.id === activeWorkspaceId;
          return (
            <DropdownMenuItem
              key={workspace.id}
              onSelect={() => switchWorkspace(workspace.id)}
              className="gap-2.5 py-2"
            >
              <span
                style={avatarTint(workspace.accentHue) as CSSProperties}
                className="avatar-tint flex size-7 items-center justify-center rounded-md text-[10px] font-semibold"
              >
                {initials(workspace.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium">{workspace.name}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {workspace.plan} · {workspace.memberIds.length} members
                </span>
              </span>
              {isActive ? <CheckIcon className="size-3.5 text-primary" /> : null}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/team" className="gap-2.5 py-2">
            <UsersIcon className="size-4 text-muted-foreground" />
            Manage members
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings" className="gap-2.5 py-2">
            <Settings2Icon className="size-4 text-muted-foreground" />
            Workspace settings
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
