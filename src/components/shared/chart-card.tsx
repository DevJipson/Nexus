import type { ReactNode } from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ChartCard({
  eyebrow,
  title,
  description,
  action,
  children,
  footer,
  className,
  contentClassName,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn("gap-0", className)}>
      <CardHeader className="border-b border-border/70 pb-4">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className={cn("pt-4", contentClassName)}>{children}</CardContent>
      {footer ? (
        <div className="mt-4 border-t border-border/70 px-(--card-spacing) pt-3 pb-(--card-spacing)">
          {footer}
        </div>
      ) : null}
    </Card>
  );
}
