"use client";

import { useState } from "react";
import { SendIcon } from "lucide-react";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { relativeTime } from "@/lib/format";
import type { Member, Task } from "@/types/domain";

export function TaskComments({
  task,
  membersById,
  currentUser,
  onSend,
}: {
  task: Task;
  membersById: Record<string, Member>;
  currentUser: Member | null;
  onSend: (body: string) => void;
}) {
  const [draft, setDraft] = useState("");

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    onSend(body);
    setDraft("");
  };

  return (
    <section aria-labelledby="comments-heading">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow mb-1.5">Discussion</p>
          <h3 id="comments-heading" className="text-[13px] font-medium">
            Comments
          </h3>
        </div>
        <span className="tnum font-mono text-[10px] text-muted-foreground">
          {task.comments.length}
        </span>
      </div>

      {task.comments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/80 bg-surface/40 px-3 py-4 text-[12px] leading-relaxed text-muted-foreground">
          No comments yet. Add the context someone will need next week.
        </p>
      ) : (
        <ul className="space-y-3">
          {task.comments.map((comment) => {
            const author = membersById[comment.authorId];
            return (
              <li key={comment.id} className="flex gap-2.5">
                <EntityAvatar
                  name={author?.name ?? "Unknown"}
                  hue={author?.avatarHue ?? 264}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[12px] font-medium">{author?.name ?? "Unknown"}</span>
                    <span className="text-[10.5px] text-muted-foreground">
                      {relativeTime(comment.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-foreground/90">
                    {comment.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex gap-2.5">
        {currentUser ? (
          <EntityAvatar name={currentUser.name} hue={currentUser.avatarHue} size="sm" />
        ) : null}
        <div className="min-w-0 flex-1">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                send();
              }
            }}
            rows={2}
            placeholder="Add a comment… ⌘↵ to send"
            aria-label="New comment"
            className="min-h-16 text-[12.5px]"
          />
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="text-[10.5px] text-muted-foreground">
              Visible to everyone on this project.
            </span>
            <Button size="xs" onClick={send} disabled={!draft.trim()}>
              <SendIcon className="size-3" />
              Comment
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
