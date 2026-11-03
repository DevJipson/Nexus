"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRightIcon } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { cn } from "@/lib/utils";

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  tasks: "My Tasks",
  calendar: "Calendar",
  team: "Team",
  messages: "Messages",
  reports: "Reports",
  settings: "Settings",
  styleguide: "Styleguide",
};

function humanizeSegment(segment: string): string {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];

  return segment
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .slice(0, 28);
}

export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  const workspacesById = useWorkspaceStore((state) => state.workspaces);
  const projectsById = useWorkspaceStore((state) => state.projects);
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);

  const workspace = workspacesById[activeWorkspaceId];
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((segment, index) => ({
    label: projectsById[segment]?.name ?? humanizeSegment(segment),
    href: `/${segments.slice(0, index + 1).join("/")}`,
    current: index === segments.length - 1,
  }));

  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1.5">
        <li className="hidden min-w-0 items-center gap-1.5 sm:flex">
          <Link
            href="/dashboard"
            className="truncate text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {workspace?.name ?? "NEXUS"}
          </Link>
          <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground/45" aria-hidden="true" />
        </li>
        {crumbs.map((crumb) => (
          <li key={crumb.href} className="flex min-w-0 items-center gap-1.5">
            {crumb.current ? (
              <span
                aria-current="page"
                className="truncate text-[12px] font-medium text-foreground"
              >
                {crumb.label}
              </span>
            ) : (
              <>
                <Link
                  href={crumb.href}
                  className="hidden truncate text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
                >
                  {crumb.label}
                </Link>
                <ChevronRightIcon
                  className="hidden size-3.5 shrink-0 text-muted-foreground/45 sm:block"
                  aria-hidden="true"
                />
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
