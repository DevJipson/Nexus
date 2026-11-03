"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ClockIcon,
  MailIcon,
  MapPinIcon,
  SearchIcon,
  SearchXIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatFullDate, PRESENCE_LABEL } from "@/lib/format";
import { workspaceMembers, workspaceTasks } from "@/lib/selectors";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { Presence, WorkspaceRole } from "@/types/domain";

const ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

const PRESENCE_DOT: Record<Presence, string> = {
  online: "bg-success",
  away: "bg-warning",
  offline: "bg-muted-foreground/45",
};

type RoleFilter = WorkspaceRole | "all";

export function TeamDirectory() {
  const state = useWorkspaceStore();
  const workspace = state.workspaces[state.activeWorkspaceId];

  const [query, setQuery] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");

  const members = workspace ? workspaceMembers(state, workspace.id) : [];
  const openByMember = new Map<string, number>();
  if (workspace) {
    for (const task of workspaceTasks(state, workspace.id)) {
      if (!task.assigneeId || task.status === "done") continue;
      openByMember.set(task.assigneeId, (openByMember.get(task.assigneeId) ?? 0) + 1);
    }
  }

  const needle = query.trim().toLowerCase();
  const filtered = members.filter((member) => {
    if (role !== "all" && member.role !== role) return false;
    if (!needle) return true;
    return [member.name, member.title, member.email, member.location]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });

  const online = members.filter((member) => member.presence === "online").length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Collaboration"
        title="The people behind the work."
        description={`Roles, focus and time zones for everyone in ${workspace.name}. Presence is simulated for this demo workspace.`}
        actions={
          <Button variant="outline" asChild>
            <Link href="/settings">
              <SettingsIcon className="size-4" />
              Workspace settings
            </Link>
          </Button>
        }
        meta={
          <>
            <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <UsersIcon className="size-3.5" aria-hidden="true" />
              {members.length} members
            </span>
            <span className="h-3 w-px bg-border" aria-hidden="true" />
            <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
              {online} online
            </span>
            <span className="h-3 w-px bg-border" aria-hidden="true" />
            <span className="text-[11.5px] text-muted-foreground">
              {members.filter((member) => member.role === "admin" || member.role === "owner").length}{" "}
              leads
            </span>
          </>
        }
      />

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground/70"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, role, email or city…"
            aria-label="Search team members"
            className="pl-8.5"
          />
        </div>
        <Select value={role} onValueChange={(value) => setRole(value as RoleFilter)}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by role">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
        <p className="shrink-0 text-[11.5px] text-muted-foreground tabular-nums sm:pl-1">
          {filtered.length} of {members.length}
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={SearchXIcon}
          title="No teammates match"
          description="Try a different name or clear the role filter to see everyone in this workspace."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("");
                setRole("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((member) => (
            <li key={member.id}>
              <Card className="h-full gap-0 p-0">
                <CardContent className="flex h-full flex-col gap-4 p-4">
                  <div className="flex items-start gap-3">
                    <EntityAvatar
                      name={member.name}
                      hue={member.avatarHue}
                      size="xl"
                      presence={member.presence}
                    />
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="truncate text-[14px] font-medium tracking-[-0.01em]">
                        {member.name}
                      </p>
                      <p className="truncate text-[11.5px] text-muted-foreground">
                        {member.title}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">{ROLE_LABEL[member.role]}</Badge>
                        <span className="flex items-center gap-1.5 rounded-md bg-muted/70 px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
                          <span
                            aria-hidden="true"
                            className={cn("size-1.5 rounded-full", PRESENCE_DOT[member.presence])}
                          />
                          {PRESENCE_LABEL[member.presence]}
                        </span>
                      </div>
                      {openByMember.get(member.id) ? (
                        <p className="mt-1.5 text-[10.5px] text-muted-foreground">
                          {openByMember.get(member.id)} open{" "}
                          {openByMember.get(member.id) === 1 ? "task" : "tasks"}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <p className="line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
                    {member.bio}
                  </p>

                  <dl className="mt-auto space-y-1.5 border-t border-border/60 pt-3 text-[11.5px]">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPinIcon className="size-3.5 shrink-0" aria-hidden="true" />
                      <dd className="truncate">{member.location}</dd>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <ClockIcon className="size-3.5 shrink-0" aria-hidden="true" />
                      <dd className="truncate">{member.timezone.replaceAll("_", " ")}</dd>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MailIcon className="size-3.5 shrink-0" aria-hidden="true" />
                      <dd className="truncate">{member.email}</dd>
                    </div>
                  </dl>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10.5px] text-muted-foreground">
                      Joined {formatFullDate(member.joinedAt)}
                    </span>
                    <Button variant="ghost" size="xs" asChild>
                      <Link href="/messages">Message</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
