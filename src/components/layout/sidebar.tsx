"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CircleHelpIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SettingsIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NAV_GROUPS, SETTINGS_NAV_ITEM, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { NexusMark, NexusWordmark } from "@/components/layout/brand";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { UserMenu } from "@/components/layout/user-menu";

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarRow({
  label,
  icon: Icon,
  href,
  active,
  collapsed,
  onSelect,
}: {
  label: string;
  icon: LucideIcon;
  href?: string;
  active?: boolean;
  collapsed: boolean;
  onSelect?: () => void;
}) {
  const className = cn(
    "group relative flex h-8 w-full items-center gap-2.5 rounded-md text-[12.5px] font-medium transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
    collapsed ? "justify-center px-0" : "pl-3 pr-2.5",
    active
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
  );

  const inner = (
    <>
      {active ? (
        <span
          aria-hidden="true"
          className="absolute top-1.5 bottom-1.5 left-0 w-[2px] rounded-full bg-primary"
        />
      ) : null}
      <Icon
        aria-hidden="true"
        className={cn(
          "size-[15px] shrink-0 transition-colors",
          active ? "text-primary" : "text-muted-foreground/75 group-hover:text-foreground",
        )}
      />
      {collapsed ? null : <span className="truncate">{label}</span>}
    </>
  );

  const control = href ? (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={className}
      onClick={onSelect}
    >
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onSelect} className={className}>
      {inner}
    </button>
  );

  if (!collapsed) return control;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{control}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const setHelpOpen = useUiStore((state) => state.setHelpOpen);

  return (
    <aside
      data-collapsed={collapsed}
      aria-label="Primary"
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out lg:flex",
        collapsed ? "w-[76px]" : "w-[256px]",
      )}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-sidebar-border/70",
          collapsed ? "justify-center px-2" : "gap-2.5 px-4",
        )}
      >
        <Link
          href="/dashboard"
          aria-label="NEXUS home"
          className="flex min-w-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.18)]">
            <NexusMark className="size-4" />
          </span>
          {collapsed ? null : <NexusWordmark className="pt-px" />}
        </Link>
      </div>

      <div className="shrink-0 border-b border-sidebar-border/70 p-2.5">
        <WorkspaceSwitcher collapsed={collapsed} />
      </div>

      <nav className="no-scrollbar flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.id} className="pb-4 last:pb-0">
            {collapsed ? (
              <div aria-hidden="true" className="mx-auto mb-2 h-px w-6 bg-sidebar-border" />
            ) : (
              <p className="eyebrow px-3 pb-1.5">{group.label}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item: NavItem) => (
                <li key={item.href}>
                  <SidebarRow
                    label={item.label}
                    icon={item.icon}
                    href={item.href}
                    active={isActivePath(pathname, item.href)}
                    collapsed={collapsed}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border/70 p-2">
        <ul className="space-y-0.5">
          <li>
            <SidebarRow
              label="Help & shortcuts"
              icon={CircleHelpIcon}
              collapsed={collapsed}
              onSelect={() => setHelpOpen(true)}
            />
          </li>
          <li>
            <SidebarRow
              label={SETTINGS_NAV_ITEM.label}
              icon={SettingsIcon}
              href={SETTINGS_NAV_ITEM.href}
              active={isActivePath(pathname, SETTINGS_NAV_ITEM.href)}
              collapsed={collapsed}
            />
          </li>
        </ul>

        <div className="mt-2 border-t border-sidebar-border/70 pt-2">
          {collapsed ? (
            <div className="flex flex-col items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={toggleSidebar}
                    aria-label="Expand sidebar"
                    className="text-muted-foreground"
                  >
                    <PanelLeftOpenIcon className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                  Expand sidebar <KbdHint>⌘B</KbdHint>
                </TooltipContent>
              </Tooltip>
              <UserMenu compact />
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <UserMenu />
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={toggleSidebar}
                    aria-label="Collapse sidebar"
                    className="shrink-0 text-muted-foreground/80"
                  >
                    <PanelLeftCloseIcon className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                  Collapse sidebar <KbdHint>⌘B</KbdHint>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function KbdHint({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-0.5 rounded border border-background/25 px-1 py-px font-mono text-[9px] text-background/80">
      {children}
    </span>
  );
}
