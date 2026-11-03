"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { cn } from "@/lib/utils";
import type { Member } from "@/types/domain";

export function MemberPicker({
  members,
  selected,
  onToggle,
  label = "Members",
  className,
  maxHeight = "max-h-56",
}: {
  members: Member[];
  selected: string[];
  onToggle: (id: string) => void;
  label?: string;
  className?: string;
  maxHeight?: string;
}) {
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="sr-only">{label}</legend>
      <div
        className={cn(
          "no-scrollbar overflow-y-auto rounded-lg border border-border/80 bg-surface-raised",
          maxHeight,
        )}
      >
        <ul className="divide-y divide-border/60">
          {members.map((member) => {
            const checked = selected.includes(member.id);
            const id = `${label}-${member.id}`.replace(/\s+/g, "-").toLowerCase();
            return (
              <li key={member.id}>
                <label
                  htmlFor={id}
                  className="flex cursor-pointer items-center gap-2.5 px-3 py-2 transition-colors hover:bg-muted/50"
                >
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={() => onToggle(member.id)}
                  />
                  <EntityAvatar
                    name={member.name}
                    hue={member.avatarHue}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium">
                      {member.name}
                    </span>
                    <span className="block truncate text-[10.5px] text-muted-foreground">
                      {member.title}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </fieldset>
  );
}
