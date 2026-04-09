"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CheckCircle2, Layers } from "lucide-react";

/**
 * Right-rail summary: counts, modules with any enabled permission, dirty state.
 */
export default function PermissionSummary({
  totalEnabled,
  totalPermissions,
  modulesWithEnabled,
  dirty,
  lastSavedLabel,
  className,
}) {
  return (
    <Card
      className={cn(
        "border-slate-200/90 shadow-sm lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto",
        className
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Layers className="h-5 w-5 text-teal-600" />
          Summary
        </CardTitle>
        <CardDescription>Overview for the role you are editing.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-600">Unsaved changes</span>
          <Badge
            variant={dirty ? "outline" : "secondary"}
            className={cn(
              dirty && "border-amber-400 bg-amber-50 text-amber-900",
              !dirty && "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
            )}
          >
            {dirty ? "Yes" : "Saved"}
          </Badge>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-2xl font-semibold tabular-nums text-slate-900">
            {totalEnabled}
            <span className="text-base font-normal text-slate-500">
              {" "}
              / {totalPermissions}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Permission keys enabled (pairs such as menu+screen count as two keys in the database).
          </p>
        </div>

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Enabled by module
          </h4>
          {modulesWithEnabled.length === 0 ? (
            <p className="text-slate-500">No permissions enabled.</p>
          ) : (
            <ul className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {modulesWithEnabled.map(({ title, count }) => (
                <li
                  key={title}
                  className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-slate-800"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-teal-600" />
                    <span className="truncate">{title}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-xs text-slate-500">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {lastSavedLabel ? (
          <p className="text-xs text-slate-400">{lastSavedLabel}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
