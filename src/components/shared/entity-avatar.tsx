import type { CSSProperties } from "react";
import { avatarTint, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Presence } from "@/types/domain";

const SIZE_CLASS = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-8 text-[11px]",
  lg: "size-10 text-[13px]",
  xl: "size-16 text-[19px]",
} as const;

export type AvatarSize = keyof typeof SIZE_CLASS;

interface EntityAvatarProps {
  name: string;
  hue: number;
  size?: AvatarSize;
  presence?: Presence;
  className?: string;
  ring?: boolean;
}

export function EntityAvatar({
  name,
  hue,
  size = "md",
  presence,
  className,
  ring = false,
}: EntityAvatarProps) {
  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={avatarTint(hue) as CSSProperties}
    >
      <span
        title={name}
        className={cn(
          "avatar-tint inline-flex items-center justify-center rounded-full font-medium tracking-[0.02em] select-none",
          SIZE_CLASS[size],
          ring && "ring-2 ring-background",
        )}
      >
        {initials(name)}
      </span>
      {presence ? (
        <span
          aria-label={presence}
          className={cn(
            "absolute -right-0.5 -bottom-0.5 rounded-full ring-2 ring-background",
            size === "xs" || size === "sm" ? "size-1.5" : "size-2",
            presence === "online" && "presence-online",
            presence === "away" && "presence-away",
            presence === "offline" && "presence-offline",
          )}
        />
      ) : null}
    </span>
  );
}

export function AvatarStack({
  people,
  max = 4,
  size = "sm",
  className,
}: {
  people: Array<{ id: string; name: string; avatarHue: number }>;
  max?: number;
  size?: AvatarSize;
  className?: string;
}) {
  const visible = people.slice(0, max);
  const overflow = people.length - visible.length;

  return (
    <div className={cn("flex items-center", className)}>
      <div className="flex -space-x-1.5">
        {visible.map((person) => (
          <EntityAvatar
            key={person.id}
            name={person.name}
            hue={person.avatarHue}
            size={size}
            ring
          />
        ))}
      </div>
      {overflow > 0 ? (
        <span className="ml-2 font-mono text-[10px] text-muted-foreground">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
