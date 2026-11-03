"use client";

import { FileTextIcon, PaperclipIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize, relativeTime } from "@/lib/format";
import type { Attachment } from "@/types/domain";
import { toast } from "sonner";

const PLACEHOLDERS: Array<Omit<Attachment, "id" | "uploadedAt">> = [
  { name: "brief.pdf", size: 428_000, mimeType: "application/pdf" },
  { name: "notes.md", size: 12_600, mimeType: "text/markdown" },
  { name: "reference.png", size: 1_840_000, mimeType: "image/png" },
];

export function TaskAttachments({
  attachments,
  onAdd,
}: {
  attachments: Attachment[];
  onAdd: (input: Omit<Attachment, "id" | "uploadedAt">) => void;
}) {
  const add = () => {
    const next = PLACEHOLDERS[attachments.length % PLACEHOLDERS.length];
    onAdd(next);
    toast.info("Placeholder attachment added", {
      description: "This demo stores file metadata only — no bytes are uploaded.",
    });
  };

  return (
    <section aria-labelledby="attachments-heading">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow mb-1.5">Files</p>
          <h3 id="attachments-heading" className="text-[13px] font-medium">
            Attachments
          </h3>
        </div>
        <Button size="xs" variant="ghost" onClick={add}>
          <PlusIcon className="size-3" />
          Add
        </Button>
      </div>

      {attachments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/80 bg-surface/40 px-3 py-4 text-[12px] leading-relaxed text-muted-foreground">
          Nothing attached. Files are simulated in this demo — only metadata is stored.
        </p>
      ) : (
        <ul className="space-y-1">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-surface-raised px-2.5 py-2"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-card text-muted-foreground">
                <FileTextIcon className="size-3.5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium">{attachment.name}</span>
                <span className="block text-[10.5px] text-muted-foreground">
                  {formatFileSize(attachment.size)} · {relativeTime(attachment.uploadedAt)}
                </span>
              </span>
              <PaperclipIcon className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
