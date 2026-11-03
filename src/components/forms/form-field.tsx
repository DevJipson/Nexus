import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[12px] font-medium text-foreground">
          {label}
        </label>
        {hint ? <span className="text-[10.5px] text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
      {error ? (
        <p role="alert" className="text-[11px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
