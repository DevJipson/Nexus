import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-surface/40 text-center",
        compact ? "px-5 py-8" : "px-6 py-14",
        className,
      )}
    >
      <span className="mb-4 inline-flex size-10 items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground shadow-card">
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      <h3 className="text-[13.5px] font-medium">{title}</h3>
      <p className="mt-1.5 max-w-xs text-[12.5px] leading-relaxed text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
