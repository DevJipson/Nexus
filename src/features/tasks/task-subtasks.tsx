"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/domain";

export function TaskSubtasks({
  task,
  onToggle,
  onAdd,
}: {
  task: Task;
  onToggle: (subtaskId: string) => void;
  onAdd: (title: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const total = task.subtasks.length;
  const done = task.subtasks.filter((subtask) => subtask.done).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  const submit = () => {
    const title = draft.trim();
    if (!title) return;
    onAdd(title);
    setDraft("");
  };

  return (
    <section aria-labelledby="subtasks-heading">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow mb-1.5">Checklist</p>
          <h3 id="subtasks-heading" className="text-[13px] font-medium">
            Subtasks
          </h3>
        </div>
        <span className="tnum font-mono text-[10px] text-muted-foreground">
          {done}/{total}
        </span>
      </div>

      {total > 0 ? (
        <Progress value={percent} className="mb-3 h-1" aria-label="Subtask progress" />
      ) : null}

      <ul className="space-y-0.5">
        {task.subtasks.map((subtask) => (
          <li key={subtask.id}>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-1 py-1.5 text-[12.5px] transition-colors hover:bg-muted/50">
              <Checkbox
                checked={subtask.done}
                onCheckedChange={() => onToggle(subtask.id)}
                className="mt-0.5"
              />
              <span className={cn("leading-snug", subtask.done && "text-muted-foreground line-through")}>
                {subtask.title}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <form
        className="mt-2 flex items-center gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a subtask…"
          aria-label="New subtask"
          className="h-8 text-[12px]"
        />
        <Button
          type="submit"
          size="icon-sm"
          variant="ghost"
          disabled={!draft.trim()}
          aria-label="Add subtask"
        >
          <PlusIcon className="size-4" />
        </Button>
      </form>
    </section>
  );
}
