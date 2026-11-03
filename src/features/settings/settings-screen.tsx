"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  BellIcon,
  CheckIcon,
  DownloadIcon,
  InfoIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  RotateCcwIcon,
  SunIcon,
  UserRoundIcon,
  Building2Icon,
  Trash2Icon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PRESENCE_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";

const PANELS = [
  { id: "profile", label: "Profile", icon: UserRoundIcon },
  { id: "workspace", label: "Workspace", icon: Building2Icon },
  { id: "appearance", label: "Appearance", icon: PaletteIcon },
  { id: "notifications", label: "Notifications", icon: BellIcon },
  { id: "data", label: "Data & reset", icon: RotateCcwIcon },
] as const;

type PanelId = (typeof PANELS)[number]["id"];

export function SettingsScreen() {
  const [panel, setPanel] = useState<PanelId>("profile");
  const state = useWorkspaceStore();
  const user = state.members[state.currentUserId];
  const workspace = state.workspaces[state.activeWorkspaceId];

  if (!user || !workspace) return null;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Settings"
        title="Make it yours."
        description="Shape NEXUS around how you and your team actually work. Everything you change here is saved to this browser."
      />

      <div className="grid gap-4 lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <Card className="gap-0 py-5">
            <CardContent className="flex flex-col items-center px-5 text-center">
              <EntityAvatar
                name={user.name}
                hue={user.avatarHue}
                size="xl"
                presence={user.presence}
              />
              <p className="mt-3 text-[14px] font-medium">{user.name}</p>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">{user.title}</p>
              <Badge variant="outline" className="mt-2 capitalize">
                {user.role} · {PRESENCE_LABEL[user.presence]}
              </Badge>
              <Separator className="my-4" />
              <dl className="w-full space-y-1.5 text-left text-[10.5px] text-muted-foreground">
                <div className="flex items-center justify-between gap-2">
                  <dt className="font-mono tracking-[0.1em] uppercase">Workspace</dt>
                  <dd className="truncate font-medium text-foreground">{workspace.name}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="font-mono tracking-[0.1em] uppercase">Plan</dt>
                  <dd className="font-medium text-foreground">{workspace.plan}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto lg:flex-col">
            {PANELS.map(({ id, label, icon: Icon }) => {
              const active = panel === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPanel(id)}
                  className={cn(
                    "flex h-9 shrink-0 items-center gap-2.5 rounded-lg border border-transparent px-3 text-[12.5px] font-medium whitespace-nowrap transition-colors",
                    active
                      ? "border-border/80 bg-card text-foreground shadow-card"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 space-y-4">
          {panel === "profile" ? <ProfilePanel /> : null}
          {panel === "workspace" ? <WorkspacePanel /> : null}
          {panel === "appearance" ? <AppearancePanel /> : null}
          {panel === "notifications" ? <NotificationsPanel /> : null}
          {panel === "data" ? <DataPanel /> : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

function ProfilePanel() {
  const state = useWorkspaceStore();
  const user = state.members[state.currentUserId];
  const [form, setForm] = useState(() => ({
    name: user?.name ?? "",
    title: user?.title ?? "",
    email: user?.email ?? "",
    bio: user?.bio ?? "",
    location: user?.location ?? "",
    timezone: user?.timezone ?? "",
  }));

  if (!user) return null;

  const dirty =
    form.name !== user.name ||
    form.title !== user.title ||
    form.email !== user.email ||
    form.bio !== user.bio ||
    form.location !== user.location ||
    form.timezone !== user.timezone;

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = () => {
    const name = form.name.trim();
    if (!name) {
      toast.error("Your name is required.");
      return;
    }
    state.updateProfile({
      name,
      title: form.title.trim(),
      email: form.email.trim(),
      bio: form.bio.trim(),
      location: form.location.trim(),
      timezone: form.timezone.trim(),
    });
    toast.success("Profile saved", { description: "Visible across your workspace immediately." });
  };

  return (
    <Card className="gap-0">
      <CardHeader className="border-b border-border/70 pb-4">
        <p className="eyebrow mb-2">Account</p>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          Your identity across this workspace — presence and avatars update live.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
        <Field label="Full name" htmlFor="profile-name">
          <Input id="profile-name" value={form.name} onChange={(event) => set("name")(event.target.value)} autoComplete="name" />
        </Field>
        <Field label="Role title" htmlFor="profile-title">
          <Input id="profile-title" value={form.title} onChange={(event) => set("title")(event.target.value)} placeholder="e.g. Design Engineer" />
        </Field>
        <Field label="Email" htmlFor="profile-email">
          <Input id="profile-email" type="email" value={form.email} onChange={(event) => set("email")(event.target.value)} autoComplete="email" />
        </Field>
        <Field label="Location" htmlFor="profile-location">
          <Input id="profile-location" value={form.location} onChange={(event) => set("location")(event.target.value)} placeholder="e.g. Berlin, Germany" />
        </Field>
        <Field label="Time zone" htmlFor="profile-timezone" className="sm:col-span-2">
          <Input id="profile-timezone" value={form.timezone} onChange={(event) => set("timezone")(event.target.value)} placeholder="e.g. Europe/Berlin" />
        </Field>
        <Field label="Bio" htmlFor="profile-bio" className="sm:col-span-2">
          <Textarea id="profile-bio" rows={3} value={form.bio} onChange={(event) => set("bio")(event.target.value)} placeholder="A line or two about how you like to work." />
        </Field>
        <div className="flex items-center justify-between gap-3 sm:col-span-2">
          <p className="text-[10.5px] text-muted-foreground">
            Demo workspace — nothing leaves this browser.
          </p>
          <Button onClick={save} disabled={!dirty}>
            <CheckIcon className="size-4" />
            Save changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Workspace                                                           */
/* ------------------------------------------------------------------ */

function WorkspacePanel() {
  const state = useWorkspaceStore();
  const workspace = state.workspaces[state.activeWorkspaceId];
  const [form, setForm] = useState(() => ({
    name: workspace?.name ?? "",
    description: workspace?.description ?? "",
  }));

  if (!workspace) return null;

  const dirty = form.name !== workspace.name || form.description !== workspace.description;
  const memberCount = workspace.memberIds.length;

  const save = () => {
    const name = form.name.trim();
    if (!name) {
      toast.error("Workspace name is required.");
      return;
    }
    state.updateWorkspace(workspace.id, {
      name,
      description: form.description.trim(),
    });
    toast.success("Workspace updated");
  };

  return (
    <Card className="gap-0">
      <CardHeader className="border-b border-border/70 pb-4">
        <p className="eyebrow mb-2">Identity</p>
        <CardTitle>Workspace</CardTitle>
        <CardDescription>
          The shared context for every project, task and thread in {workspace.name}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <Field label="Workspace name" htmlFor="workspace-name">
          <Input id="workspace-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
        </Field>
        <Field label="Description" htmlFor="workspace-description">
          <Textarea id="workspace-description" rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="What does this workspace exist to ship?" />
        </Field>
        <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border/70 bg-surface/50 p-3 text-[11px] sm:grid-cols-4">
          <div>
            <dt className="font-mono text-[8.5px] tracking-[0.12em] text-muted-foreground uppercase">ID</dt>
            <dd className="mt-0.5 font-mono">{workspace.id}</dd>
          </div>
          <div>
            <dt className="font-mono text-[8.5px] tracking-[0.12em] text-muted-foreground uppercase">Plan</dt>
            <dd className="mt-0.5">{workspace.plan}</dd>
          </div>
          <div>
            <dt className="font-mono text-[8.5px] tracking-[0.12em] text-muted-foreground uppercase">Members</dt>
            <dd className="tnum mt-0.5">{memberCount}</dd>
          </div>
          <div>
            <dt className="font-mono text-[8.5px] tracking-[0.12em] text-muted-foreground uppercase">Created</dt>
            <dd className="mt-0.5">{new Date(workspace.createdAt).getFullYear()}</dd>
          </div>
        </dl>
        <div className="flex justify-end">
          <Button onClick={save} disabled={!dirty}>
            <CheckIcon className="size-4" />
            Save workspace
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Appearance                                                          */
/* ------------------------------------------------------------------ */

const THEME_OPTIONS = [
  { value: "light", label: "Paper", hint: "Warm light", icon: SunIcon },
  { value: "dark", label: "Graphite", hint: "Warm dark", icon: MoonIcon },
  { value: "system", label: "System", hint: "Follow OS", icon: MonitorIcon },
] as const;

function AppearancePanel() {
  const { theme, setTheme } = useTheme();
  const state = useWorkspaceStore();
  const preferences = state.preferences;

  return (
    <Card className="gap-0">
      <CardHeader className="border-b border-border/70 pb-4">
        <p className="eyebrow mb-2">Appearance</p>
        <CardTitle>Paper or Graphite?</CardTitle>
        <CardDescription>
          One cobalt signal, warm neutrals. Changes apply instantly and persist.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        <fieldset>
          <legend className="eyebrow mb-2.5">Interface theme</legend>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Interface theme">
            {THEME_OPTIONS.map(({ value, label, hint, icon: Icon }) => {
              const active = theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTheme(value)}
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-xl border px-3.5 py-3 text-left transition-[border-color,box-shadow]",
                    active
                      ? "border-primary/50 bg-primary/5 shadow-[0_0_0_1px_var(--primary)]"
                      : "border-border/80 bg-surface hover:border-border",
                  )}
                >
                  <Icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                  <span>
                    <span className="block text-[13px] leading-tight font-medium">{label}</span>
                    <span className="block text-[10.5px] text-muted-foreground">{hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <Field label="Week starts on" htmlFor="week-start" description="Used by the calendar grid and agenda.">
          <div className="inline-flex rounded-lg border border-border/80 bg-surface p-0.5" id="week-start" role="radiogroup" aria-label="Week starts on">
            <WeekStartButton active={preferences.startOfWeek === 1} label="Monday" onClick={() => state.updatePreferences({ startOfWeek: 1 })} />
            <WeekStartButton active={preferences.startOfWeek === 0} label="Sunday" onClick={() => state.updatePreferences({ startOfWeek: 0 })} />
          </div>
        </Field>

        <ToggleRow
          label="Reduce motion"
          hint="Suppresses interface transitions and animations for a calmer, strobing-free surface."
          checked={preferences.reduceMotion}
          onCheckedChange={(checked) => state.updatePreferences({ reduceMotion: checked })}
        />
      </CardContent>
    </Card>
  );
}

function WeekStartButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "h-8 rounded-[7px] px-4 text-[12px] font-medium transition-colors",
        active ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

const NOTIFICATION_TOGGLES: Array<{
  key:
    | "taskAssigned"
    | "commentsMentions"
    | "dueDateReminders"
    | "projectUpdates"
    | "emailDigest";
  label: string;
  hint: string;
}> = [
  { key: "taskAssigned", label: "Task assignments", hint: "When someone assigns you a task." },
  { key: "commentsMentions", label: "Comments & mentions", hint: "Replies on your tasks and @-mentions anywhere." },
  { key: "dueDateReminders", label: "Due date reminders", hint: "Heads-up 24 hours before a due date." },
  { key: "projectUpdates", label: "Project updates", hint: "Status changes and shipped milestones." },
  { key: "emailDigest", label: "Weekly email digest", hint: "A Monday-morning summary of delivery health." },
];

function NotificationsPanel() {
  const state = useWorkspaceStore();
  const preferences = state.preferences;

  return (
    <Card className="gap-0">
      <CardHeader className="border-b border-border/70 pb-4">
        <p className="eyebrow mb-2">Signals</p>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          Stored locally in this browser. Email delivery does not exist in this demo —
          these toggles govern what NEXUS would send.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y divide-border/60 pt-2">
        {NOTIFICATION_TOGGLES.map(({ key, label, hint }) => (
          <ToggleRow
            key={key}
            label={label}
            hint={hint}
            checked={preferences[key]}
            onCheckedChange={(checked) => state.updatePreferences({ [key]: checked })}
            className="py-4"
          />
        ))}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

function DataPanel() {
  const router = useRouter();
  const resetDemoData = useWorkspaceStore((store) => store.resetDemoData);

  const exportBackup = () => {
    const snapshot = useWorkspaceStore.getState() as unknown as Record<string, unknown>;
    const data = Object.fromEntries(
      Object.entries(snapshot).filter(
        ([key, value]) => typeof value !== "function" && key !== "hydrated",
      ),
    );

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "nexus-workspace-backup.json";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded", { description: "Persisted workspace state as JSON." });
  };

  return (
    <div className="space-y-4">
      <Card className="gap-0">
        <CardHeader className="border-b border-border/70 pb-4">
          <p className="eyebrow mb-2">Your data</p>
          <CardTitle>Workspace backup</CardTitle>
          <CardDescription>
            NEXUS stores everything in this browser. Download the raw state if you want to
            inspect or archive it.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <Button variant="outline" onClick={exportBackup}>
            <DownloadIcon className="size-4" />
            Download backup (.json)
          </Button>
        </CardContent>
      </Card>

      <Card className="gap-0 border-danger/25">
        <CardHeader className="border-b border-border/70 pb-4">
          <p className="eyebrow mb-2 text-danger">Danger zone</p>
          <CardTitle>Reset demo data</CardTitle>
          <CardDescription>
            Discard every change you made — created tasks, edited projects, sent messages —
            and restore the original seeded workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="border-danger/40 text-danger hover:bg-danger/10">
                <Trash2Icon className="size-4" />
                Reset everything
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset all demo data?</AlertDialogTitle>
                <AlertDialogDescription>
                  All 46 seeded tasks, 9 projects, messages, comments and preferences will be
                  restored to their original state. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep my changes</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    resetDemoData();
                    toast.success("Demo data restored");
                    router.push("/dashboard");
                  }}
                >
                  Reset workspace
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      <Card className="gap-0 bg-surface/40">
        <CardContent className="flex items-start gap-3 pt-5">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-card text-muted-foreground">
            <InfoIcon className="size-3.5" aria-hidden="true" />
          </span>
          <div className="text-[11.5px] leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">NEXUS v0.1 · Local demo build</p>
            <p className="mt-1">
              A project-management workspace running entirely in your browser: Next.js,
              React, TypeScript, Zustand with localStorage persistence, Tailwind and Radix.
              Data is seeded, interactions are real, and nothing leaves this device.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function Field({
  label,
  htmlFor,
  description,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-[11px] font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {description ? (
        <p className="text-[10px] text-muted-foreground/80">{description}</p>
      ) : null}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onCheckedChange,
  className,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="min-w-0">
        <p className="text-[12.5px] font-medium">{label}</p>
        <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  );
}
