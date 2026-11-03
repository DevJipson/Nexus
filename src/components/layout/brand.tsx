import { cn } from "@/lib/utils";

export function NexusMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("size-5", className)}
    >
      <path
        d="M12 2.25 21.75 12 12 21.75 2.25 12 12 2.25Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path
        d="M12 7.25v9.5M7.25 12h9.5"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.45"
      />
      <circle cx="12" cy="12" r="2.15" fill="currentColor" />
    </svg>
  );
}

export function NexusWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display text-[19px] leading-none tracking-[0.14em] uppercase",
        className,
      )}
    >
      Nexus
    </span>
  );
}
