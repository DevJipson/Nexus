"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CircleHelpIcon,
  EllipsisIcon,
  SettingsIcon,
} from "lucide-react";
import { MOBILE_NAV_ITEMS, NAV_GROUPS, SETTINGS_NAV_ITEM } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { NexusMark, NexusWordmark } from "@/components/layout/brand";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { UserMenu } from "@/components/layout/user-menu";

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const MORE_ACTIVE_PREFIXES = [
  "/team",
  "/messages",
  "/reports",
  "/settings",
];

export function MobileNav() {
  const pathname = usePathname();
  const open = useUiStore((state) => state.mobileNavOpen);
  const setOpen = useUiStore((state) => state.setMobileNavOpen);
  const setHelpOpen = useUiStore((state) => state.setHelpOpen);
  const close = () => setOpen(false);

  const moreActive = MORE_ACTIVE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  return (
    <>
      <nav
        aria-label="Primary mobile"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {MOBILE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors outline-none focus-visible:bg-muted",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {active ? (
                    <span
                      aria-hidden="true"
                      className="absolute top-0 h-[2px] w-8 rounded-full bg-primary"
                    />
                  ) : null}
                  <Icon className="size-[18px]" aria-hidden="true" />
                  {item.shortLabel}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              className={cn(
                "relative flex h-14 w-full flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors outline-none focus-visible:bg-muted",
                moreActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {moreActive ? (
                <span
                  aria-hidden="true"
                  className="absolute top-0 h-[2px] w-8 rounded-full bg-primary"
                />
              ) : null}
              <EllipsisIcon className="size-[18px]" aria-hidden="true" />
              More
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[86dvh] gap-0 rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)]"
        >
          <SheetHeader className="pb-4">
            <span className="mb-1 flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <NexusMark className="size-3.5" />
              </span>
              <NexusWordmark className="text-[15px]" />
            </span>
            <SheetTitle className="sr-only">Navigation menu</SheetTitle>
            <SheetDescription className="sr-only">
              Browse every workspace module, switch workspaces, or open help.
            </SheetDescription>
            <div className="mt-2">
              <WorkspaceSwitcher menuSide="top" />
            </div>
          </SheetHeader>

          <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-2">
            {NAV_GROUPS.map((group) => (
              <div key={group.id} className="pb-5">
                <p className="eyebrow px-2 pb-2">{group.label}</p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActivePath(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={close}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-[13px] font-medium transition-colors",
                            active
                              ? "bg-accent text-accent-foreground"
                              : "text-foreground hover:bg-muted",
                          )}
                        >
                          <Icon
                            className={cn(
                              "size-4",
                              active ? "text-primary" : "text-muted-foreground",
                            )}
                          />
                          <span className="flex-1">{item.label}</span>
                          <span className="truncate text-[11px] font-normal text-muted-foreground">
                            {item.description}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            <div className="space-y-0.5 border-t border-border/70 pt-3 pb-3">
              <Link
                href={SETTINGS_NAV_ITEM.href}
                onClick={close}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-[13px] font-medium transition-colors",
                  isActivePath(pathname, SETTINGS_NAV_ITEM.href)
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-muted",
                )}
              >
                <SettingsIcon className="size-4 text-muted-foreground" />
                Settings
              </Link>
              <button
                type="button"
                onClick={() => {
                  close();
                  setHelpOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
              >
                <CircleHelpIcon className="size-4 text-muted-foreground" />
                Help & shortcuts
              </button>
            </div>
          </div>

          <div className="border-t border-border/70 px-4 pt-3">
            <UserMenu />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
