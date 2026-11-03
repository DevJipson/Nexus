import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type StatTone = "neutral" | "positive" | "negative" | "accent";

const ICON_TONE: Record<StatTone, string> = {
  neutral: "text-muted-foreground",
  positive: "text-success",
  negative: "text-danger",
  accent: "text-primary",
};

export function StatTile({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
  className,
}: {
  label: string;
  value: string;
  detail?: ReactNode;
  icon?: LucideIcon;
  tone?: StatTone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border border-border/80 bg-card px-4 py-3.5 shadow-card",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow pt-0.5">{label}</p>
        {Icon ? (
          <Icon
            className={cn("size-3.5 shrink-0", ICON_TONE[tone])}
            aria-hidden="true"
          />
        ) : null}
      </div>
      <p className="display-serif tnum mt-2.5 text-[27px] leading-none">{value}</p>
      {detail ? (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  );
}
