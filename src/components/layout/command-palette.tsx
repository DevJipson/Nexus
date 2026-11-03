"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  CheckIcon,
  CircleHelpIcon,
  KeyboardIcon,
  MoonIcon,
  MonitorIcon,
  SunIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { ALL_NAV_ITEMS } from "@/lib/nav";
import { seedWorkspaces } from "@/data/seed/shell";
import { useUiStore } from "@/store/ui-store";
import { initials } from "@/lib/format";

const APPEARANCE = [
  { value: "light", label: "Paper", icon: SunIcon },
  { value: "dark", label: "Graphite", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const;

export function CommandPalette() {
  const router = useRouter();
  const open = useUiStore((state) => state.commandOpen);
  const setOpen = useUiStore((state) => state.setCommandOpen);
  const setHelpOpen = useUiStore((state) => state.setHelpOpen);
  const activeWorkspaceId = useUiStore((state) => state.activeWorkspaceId);
  const setActiveWorkspaceId = useUiStore((state) => state.setActiveWorkspaceId);
  const { theme, setTheme } = useTheme();

  const run = (action: () => void) => {
    setOpen(false);
    // Defer so the dialog's close animation is not blocked by navigation.
    window.setTimeout(action, 10);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="top-[14%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-[560px]"
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search pages, switch workspace, change appearance or open help.
        </DialogDescription>

        <Command className="rounded-none! bg-transparent p-0">
          <CommandInput placeholder="Search pages, actions and workspaces…" autoFocus />

          <CommandList className="max-h-[min(58vh,420px)] px-1 pt-1 pb-1">
            <CommandEmpty className="py-10 text-center">
              <p className="text-[13px] font-medium">No results</p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                Try a page name, “theme”, or a workspace.
              </p>
            </CommandEmpty>

            <CommandGroup heading="Navigate">
              {ALL_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.href}
                    value={`${item.label} ${item.description}`}
                    onSelect={() => run(() => router.push(item.href))}
                  >
                    <Icon className="text-muted-foreground" />
                    <span className="flex-1 truncate">{item.label}</span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {item.description}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Switch workspace">
              {seedWorkspaces.map((workspace) => (
                <CommandItem
                  key={workspace.id}
                  value={`workspace ${workspace.name} ${workspace.plan}`}
                  onSelect={() =>
                    run(() => {
                      setActiveWorkspaceId(workspace.id);
                      router.push("/dashboard");
                      toast.success(`Switched to ${workspace.name}`);
                    })
                  }
                >
                  <span className="flex size-5 items-center justify-center rounded-[5px] border border-border/70 bg-surface font-mono text-[8.5px] font-semibold">
                    {initials(workspace.name)}
                  </span>
                  <span className="flex-1 truncate">{workspace.name}</span>
                  {workspace.id === activeWorkspaceId ? (
                    <CheckIcon className="size-3.5 text-primary" />
                  ) : (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {workspace.plan}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Appearance">
              {APPEARANCE.map((option) => {
                const Icon = option.icon;
                return (
                  <CommandItem
                    key={option.value}
                    value={`theme ${option.label} ${option.value}`}
                    onSelect={() => run(() => setTheme(option.value))}
                  >
                    <Icon className="text-muted-foreground" />
                    <span className="flex-1">Switch to {option.label}</span>
                    {theme === option.value ? (
                      <CheckIcon className="size-3.5 text-primary" />
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Support">
              <CommandItem
                value="keyboard shortcuts help"
                onSelect={() =>
                  run(() => {
                    setHelpOpen(true);
                  })
                }
              >
                <KeyboardIcon className="text-muted-foreground" />
                <span className="flex-1">Keyboard shortcuts</span>
              </CommandItem>
              <CommandItem
                value="help support about"
                onSelect={() =>
                  run(() => {
                    setHelpOpen(true);
                  })
                }
              >
                <CircleHelpIcon className="text-muted-foreground" />
                <span className="flex-1">Help &amp; support</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>

          <div className="flex items-center justify-between gap-4 border-t border-border/70 bg-surface/50 px-3.5 py-2">
            <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Kbd className="h-4 min-w-4 px-1 font-mono text-[9px]">↑</Kbd>
                <Kbd className="h-4 min-w-4 px-1 font-mono text-[9px]">↓</Kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <Kbd className="h-4 min-w-4 px-1 font-mono text-[9px]">↵</Kbd>
                open
              </span>
              <span className="flex items-center gap-1">
                <Kbd className="h-4 min-w-4 px-1 font-mono text-[9px]">esc</Kbd>
                close
              </span>
            </div>
            <span className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground/70 uppercase">
              Nexus
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
