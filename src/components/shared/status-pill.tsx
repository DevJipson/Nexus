import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { toneVar, type Tone } from "@/lib/domain-meta";
import type { Priority } from "@/types/domain";
import { PRIORITY_META } from "@/lib/domain-meta";

export function StatusPill({
  label,
  tone,
  dot = true,
  className,
}: {
  label: string;
  tone: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      style={{ "--tone": toneVar(tone) } as CSSProperties}
      className={cn(
        "tone-pill inline-flex h-[22px] items-center gap-1.5 rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap",
        className,
      )}
    >
      {dot ? <span className="tone-dot size-1.5 rounded-full" /> : null}
      {label}
    </span>
  );
}

export function PriorityIndicator({
  priority,
  withLabel = false,
  className,
}: {
  priority: Priority;
  withLabel?: boolean;
  className?: string;
}) {
  const meta = PRIORITY_META[priority];
  const bars = meta.rank;

  return (
    <span
      style={{ "--tone": `var(--priority-${priority})` } as CSSProperties}
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap",
        className,
      )}
      title={`${meta.label} priority`}
    >
      <span className="flex items-end gap-[2px]" aria-hidden="true">
        {[1, 2, 3, 4].map((level) => (
          <span
            key={level}
            className={cn(
              "w-[3px] rounded-[1px]",
              level <= bars ? "tone-dot" : "bg-muted-foreground/25",
            )}
            style={{ height: `${3 + level * 2}px` }}
          />
        ))}
      </span>
      {withLabel ? <span className="text-muted-foreground">{meta.label}</span> : null}
    </span>
  );
}
