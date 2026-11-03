import type { Metadata } from "next";
import {
  ListTodoIcon,
  SlidersHorizontalIcon,
  SquareCheckIcon,
  SquareKanbanIcon,
} from "lucide-react";
import { ModulePreview } from "@/components/shared/module-preview";

export const metadata: Metadata = {
  title: "My Tasks",
  description: "Everything assigned to you, across every project.",
};

export default function TasksPage() {
  return (
    <ModulePreview
      eyebrow="Workspace"
      title="Your work, ordered."
      description="Everything assigned to you, across every project, ordered by what matters next — with the full context behind each task."
      moduleIcon={SquareCheckIcon}
      note="Task management is the heart of NEXUS. This gate wires the shell and design system; the next gate brings the kanban board, list and table views, drag-and-drop, and the task detail panel with subtasks, comments and attachments."
      capabilities={[
        {
          icon: SquareKanbanIcon,
          title: "Kanban, list & table",
          description:
            "Five status columns with stable drag-and-drop, a compact list, and a sortable table.",
        },
        {
          icon: ListTodoIcon,
          title: "Rich task detail",
          description:
            "Subtasks, comments, attachments, labels, assignee, priority and due dates in one panel.",
        },
        {
          icon: SlidersHorizontalIcon,
          title: "Saved views",
          description:
            "Filter by assignee, priority, project or label — and keep the view you return to.",
        },
      ]}
    />
  );
}
