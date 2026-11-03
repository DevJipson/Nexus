import { Skeleton } from "@/components/ui/skeleton";

export function ShellSkeleton() {
  return (
    <div className="min-h-dvh" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading workspace…</span>

      <div className="fixed inset-y-0 left-0 hidden w-[256px] flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border/70 px-4">
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="h-3.5 w-20" />
        </div>
        <div className="border-b border-sidebar-border/70 p-2.5">
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
        <div className="flex-1 space-y-6 px-2 py-5">
          {[0, 1, 2].map((group) => (
            <div key={group} className="space-y-1.5">
              <Skeleton className="mx-3 h-2 w-14" />
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-8 w-full rounded-md" />
              ))}
            </div>
          ))}
        </div>
        <div className="border-t border-sidebar-border/70 p-2">
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>

      <div className="lg:pl-[256px]">
        <div className="flex h-14 items-center justify-between border-b border-border/70 px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-3 w-40" />
          <div className="flex items-center gap-2">
            <Skeleton className="hidden h-8 w-[188px] rounded-lg md:block" />
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="mt-4 h-8 w-64 max-w-full" />
          <Skeleton className="mt-3 h-3 w-[420px] max-w-full" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((card) => (
              <Skeleton key={card} className="h-32 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
