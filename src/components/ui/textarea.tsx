import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full resize-y rounded-lg border border-input bg-surface-raised px-3 py-2 text-sm leading-relaxed text-foreground transition-[border-color,box-shadow,background-color] outline-none placeholder:text-muted-foreground/75 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-55 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/15 md:text-[13px] dark:bg-input/25 dark:disabled:bg-input/60",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
