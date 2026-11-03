"use client";

import { CreateProjectDialog } from "@/components/forms/create-project-dialog";
import { CreateTaskDialog } from "@/components/forms/create-task-dialog";
import { CreateEventDialog } from "@/components/forms/create-event-dialog";
import { CreateConversationDialog } from "@/components/forms/create-conversation-dialog";
import { useComposeStore } from "@/store/compose-store";

/**
 * One mount point for every create flow, so the header, command palette and
 * in-module buttons all open the same dialogs with the same validation.
 */
export function ComposeDialogs() {
  const kind = useComposeStore((state) => state.kind);
  const projectId = useComposeStore((state) => state.projectId);
  const date = useComposeStore((state) => state.date);
  const close = useComposeStore((state) => state.close);

  return (
    <>
      <CreateProjectDialog open={kind === "project"} onOpenChange={(open) => !open && close()} />
      <CreateTaskDialog
        open={kind === "task"}
        onOpenChange={(open) => !open && close()}
        defaultProjectId={projectId}
      />
      <CreateEventDialog
        open={kind === "event"}
        onOpenChange={(open) => !open && close()}
        defaultDate={date ? new Date(date) : undefined}
      />
      <CreateConversationDialog
        open={kind === "conversation"}
        onOpenChange={(open) => !open && close()}
      />
    </>
  );
}
