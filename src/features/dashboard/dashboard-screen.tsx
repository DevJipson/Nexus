"use client";

import Link from "next/link";
import {
  ArrowUpRightIcon,
  CalendarDaysIcon,
  ChartNoAxesColumnIcon,
  FolderKanbanIcon,
  MessagesSquareIcon,
  SquareCheckIcon,
  UsersIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CURRENT_USER_ID, seedMembers, seedWorkspaces } from "@/data/seed/shell";
import { formatFullDate, PRESENCE_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";
import type { Member, Presence } from "@/types/domain";

const PRESENCE_TONE: Record<Presence, string> = {
  online: "bg-success",
  away: "bg-warning",
  offline: "bg-muted-foreground/45",
};

const MODULE_LINKS = [
  {
    label: "Projects",
    description: "Portfolio and project detail",
    href: "/projects",
    icon: FolderKanbanIcon,
  },
  {
    label: "My Tasks",
    description: "Board, list and table views",
    href: "/tasks",
    icon: SquareCheckIcon,
  },
  {
    label: "Calendar",
    description: "Meetings and deadlines",
    href: "/calendar",
    icon: CalendarDaysIcon,
  },
  {
    label: "Messages",
    description: "Team conversations",
    href: "/messages",
    icon: MessagesSquareIcon,
  },
  {
    label: "Reports",
    description: "Delivery and workload",
    href: "/reports",
    icon: ChartNoAxesColumnIcon,
  },
] as const;

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-card">
      <p className="eyebrow">{label}</p>
      <p className="mt-3 display-serif tnum text-[28px] leading-none">{value}</p>
      <p className="mt-2 text-[11.5px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function PresencedRow({ member }: { member: Member }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <EntityAvatar
        name={member.name}
        hue={member.avatarHue}
        size="md"
        presence={member.presence}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium">{member.name}</p>
        <p className="truncate text-[11px] text-muted-foreground">{member.title}</p>
      </div>
      <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-full", PRESENCE_TONE[member.presence])}
        />
        {PRESENCE_LABEL[member.presence]}
      </span>
      <Badge variant="outline" className="capitalize">
        {member.role}
      </Badge>
    </li>
  );
}

export function DashboardScreen() {
  const activeWorkspaceId = useUiStore((state) => state.activeWorkspaceId);
  const workspace =
    seedWorkspaces.find((item) => item.id === activeWorkspaceId) ?? seedWorkspaces[0];
  const currentUser =
    seedMembers.find((member) => member.id === CURRENT_USER_ID) ?? seedMembers[0];
  const members = seedMembers.filter((member) =>
    workspace.memberIds.includes(member.id),
  );
  const online = members.filter((member) => member.presence === "online").length;
  const firstName = currentUser.name.split(" ")[0];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace overview"
        title={`Good to see you, ${firstName}.`}
        description={`Here is the shape of ${workspace.name} today — who is around, how the team is set up, and where to pick up next.`}
        actions={
          <Button variant="outline" asChild>
            <Link href="/reports">
              <ChartNoAxesColumnIcon className="size-4" />
              View reports
            </Link>
          </Button>
        }
        meta={
          <>
            <Badge variant="soft" className="gap-1.5">
              <span className="size-1.5 rounded-full bg-primary" />
              {workspace.plan} plan
            </Badge>
            <span className="text-[11.5px] text-muted-foreground">
              Created {formatFullDate(workspace.createdAt)}
            </span>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Team members"
          value={String(members.length)}
          detail={`People in ${workspace.name}`}
        />
        <Stat
          label="Online now"
          value={String(online)}
          detail={
            online === 1
              ? "1 teammate is available"
              : `${online} teammates are available`
          }
        />
        <Stat
          label="Workspaces"
          value={String(seedWorkspaces.length)}
          detail="Across your account"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Card className="gap-0">
          <CardHeader className="border-b border-border/70 pb-4">
            <p className="eyebrow mb-2">Team</p>
            <CardTitle>Who is around</CardTitle>
            <CardDescription>
              Presence, role and focus across {workspace.name}.
            </CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/team">
                  Directory
                  <ArrowUpRightIcon className="size-3.5" />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="pt-1">
            <ul className="divide-y divide-border/60">
              {members.slice(0, 5).map((member) => (
                <PresencedRow key={member.id} member={member} />
              ))}
            </ul>
            {members.length > 5 ? (
              <p className="pt-2 text-[11px] text-muted-foreground">
                +{members.length - 5} more in the directory
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="gap-4">
            <CardHeader>
              <p className="eyebrow mb-2">Workspace</p>
              <CardTitle className="display-serif text-[22px] leading-tight">
                {workspace.name}
              </CardTitle>
              <CardDescription>{workspace.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">{workspace.plan}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground">Members</span>
                <span className="font-medium tnum">{members.length}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium">{formatFullDate(workspace.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground">Slug</span>
                <span className="font-mono text-[10.5px] text-muted-foreground">
                  {workspace.slug}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0">
            <CardHeader className="border-b border-border/70 pb-3.5">
              <p className="eyebrow mb-2">Modules</p>
              <CardTitle>Jump back in</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pt-1 pb-2">
              <ul>
                {MODULE_LINKS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="group flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-muted/70"
                      >
                        <span className="flex size-7 items-center justify-center rounded-md border border-border/70 bg-surface text-muted-foreground transition-colors group-hover:text-foreground">
                          <Icon className="size-3.5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12.5px] font-medium">{item.label}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {item.description}
                          </span>
                        </span>
                        <ArrowUpRightIcon className="size-3.5 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-surface/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-card text-primary shadow-card">
            <UsersIcon className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[12.5px] font-medium">Foundation build</p>
            <p className="text-[11.5px] text-muted-foreground">
              The shell, design system and team directory are live. Project, task,
              calendar, message and report modules land next.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild className="shrink-0">
          <Link href="/styleguide">View design system</Link>
        </Button>
      </div>
    </div>
  );
}
