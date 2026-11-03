import type { Metadata } from "next";
import {
  FolderKanbanIcon,
  FolderOpenIcon,
  LayoutGridIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { ModulePreview } from "@/components/shared/module-preview";

export const metadata: Metadata = {
  title: "Projects",
  description: "Plan, track and close every body of work in one considered view.",
};

export default function ProjectsPage() {
  return (
    <ModulePreview
      eyebrow="Workspace"
      title="Projects, in focus."
      description="Plan, track and close every body of work in one considered view — portfolio health, ownership and momentum at a glance."
      moduleIcon={FolderKanbanIcon}
      note="This gate establishes the shell, design language and navigation. The Projects module — grid and list views, filters, and the full project detail screen with tasks, activity and team — is the next surface to land here."
      capabilities={[
        {
          icon: LayoutGridIcon,
          title: "Portfolio grid & list",
          description:
            "Switch between a visual card grid and a dense, scannable list without losing your filters.",
        },
        {
          icon: FolderOpenIcon,
          title: "Project detail",
          description:
            "A dedicated workspace for each project: status, milestones, team, tasks and activity.",
        },
        {
          icon: SlidersHorizontalIcon,
          title: "Filters & sorting",
          description:
            "Narrow by status or priority, sort by due date or progress, and search by name.",
        },
      ]}
    />
  );
}
