"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  CalendarPlusIcon,
  CheckIcon,
  CircleHelpIcon,
  FolderIcon,
  FolderPlusIcon,
  KeyboardIcon,
  MessageSquarePlusIcon,
  MonitorIcon,
  MoonIcon,
  SquareIcon,
  SquarePlusIcon,
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
import { rankTasks } from "@/lib/selectors";
import { initials } from "@/lib/format";
import { useComposeStore, type ComposerKind } from "@/store/compose-store";
import { useTaskPanelStore } from "@/store/task-panel-store";
import { useUiStore } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";

const APPEARANCE = [
  { value: "light", label: "Paper", icon: SunIcon },
  { value: "dark", label: "Graphite", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const;

const CREATE_ACTIONS: Array<{
  kind: ComposerKind;
  label: string;
  icon: typeof FolderPlusIcon;
}> = [
  { kind: "task", label: "New task", icon: SquarePlusIcon },
  { kind: "project", label: "New project", icon: FolderPlusIcon },
  { kind: "event", label: "New calendar event", icon: CalendarPlusIcon },
  { kind: "conversation", label: "New conversation", icon: MessageSquarePlusIcon },
];

export function CommandPalette() {
  const router = useRouter();
  const open = useUiStore((state) => state.commandOpen);
  const setOpen = useUiStore((state) => state.setCommandOpen);
  const setHelpOpen = useUiStore((state) => state.setHelpOpen);
  const openComposer = useComposeStore((state) => state.open);
  const openTask = useTaskPanelStore((state) => state.open);

  const workspacesById = useWorkspaceStore((state) => state.workspaces);
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const setActiveWorkspaceId = useWorkspaceStore((state) => state.setActiveWorkspaceId);
  const projectsById = useWorkspaceStore((state) => state.projects);
  const tasksById = useWorkspaceStore((state) => state.tasks);

  const { theme, setTheme } = useTheme();

  const workspaces = Object.values(workspacesById);
  const projects = Object.values(projectsById)
    .filter((project) => project.workspaceId === activeWorkspaceId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const tasks = rankTasks(
    Object.values(tasksById).filter((task) => task.workspaceId === activeWorkspaceId),
  );

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
          Search pages, projects and tasks, switch workspace, change appearance or open
          help.
        </DialogDescription>

        <Command className="rounded-none! bg-transparent p-0">
          <CommandInput placeholder="Search pages, projects and tasks…" autoFocus />

          <CommandList className="max-h-[min(58vh,440px)] px-1 pt-1 pb-1">
            <CommandEmpty className="py-10 text-center">
              <p className="text-[13px] font-medium">No results</p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                Try a page name, a project, a task or “theme”.
              </p>
            </CommandEmpty>

            <CommandGroup heading="Create">
              {CREATE_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <CommandItem
                    key={action.kind}
                    value={`create ${action.label}`}
                    onSelect={() => run(() => openComposer(action.kind))}
                  >
                    <Icon className="text-muted-foreground" />
                    <span className="flex-1">{action.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>

            <CommandSeparator />

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

            {projects.length > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup heading="Projects">
                  {projects.map((project) => (
                    <CommandItem
                      key={project.id}
                      value={`project ${project.name} ${project.key} ${project.id}`}
                      onSelect={() => run(() => router.push(`/projects/${project.id}`))}
                    >
                      <FolderIcon className="text-muted-foreground" />
                      <span className="flex-1 truncate">{project.name}</span>
                      <span className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
                        {project.key}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}

            {tasks.length > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup heading="Open tasks">
                  {tasks.map((task) => {
                    const project = projectsById[task.projectId];
                    return (
                      <CommandItem
                        key={task.id}
                        value={`task ${task.title} ${project?.name ?? ""} ${task.id}`}
                        onSelect={() =>
                          run(() => {
                            openTask(task.id);
                          })
                        }
                      >
                        <SquareIcon className="text-muted-foreground" />
                        <span className="flex-1 truncate">{task.title}</span>
                        <span className="truncate font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
                          {project?.key ?? "Task"}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            ) : null}

            <CommandSeparator />

            <CommandGroup heading="Switch workspace">
              {workspaces.map((workspace) => (
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
