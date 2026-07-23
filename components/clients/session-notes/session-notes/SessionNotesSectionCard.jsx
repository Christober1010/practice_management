"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Matches section cards in Session Notes tabs (Overview, Clinical, etc.).
 */
export default function SessionNotesSectionCard({
  icon: Icon,
  iconClassName = "text-teal-600",
  title,
  children,
  className,
  contentClassName,
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {Icon ? <Icon className={cn("h-5 w-5 shrink-0", iconClassName)} /> : null}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className={cn("space-y-4", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
