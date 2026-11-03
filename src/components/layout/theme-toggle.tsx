"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { CheckIcon, MonitorIcon } from "lucide-react";
import { useMounted } from "@/hooks/use-mounted";

const OPTIONS = [
  { value: "light", label: "Paper", hint: "Light", icon: SunIcon },
  { value: "dark", label: "Graphite", hint: "Dark", icon: MoonIcon },
  { value: "system", label: "System", hint: "Match device", icon: MonitorIcon },
] as const;

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? "icon-sm" : "icon"}
          aria-label="Change theme"
          className="text-muted-foreground"
        >
          {isDark ? (
            <MoonIcon className="size-4" aria-hidden="true" />
          ) : (
            <SunIcon className="size-4" aria-hidden="true" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="eyebrow px-2.5 py-2">Appearance</DropdownMenuLabel>
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = mounted && theme === option.value;

          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => setTheme(option.value)}
              className="gap-2.5 py-2"
            >
              <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="flex-1">
                {option.label}
                <span className="ml-1.5 text-[11px] text-muted-foreground">
                  {option.hint}
                </span>
              </span>
              {selected ? <CheckIcon className="size-3.5 text-primary" /> : null}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <p className="px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
          Themes are saved to this browser.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
