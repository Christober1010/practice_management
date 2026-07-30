"use client";

import { AccordionContent, AccordionItem } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import PermissionToggle from "./permission-toggle";
import PermissionScopeToggle from "./permission-scope-toggle";
import {
  permissionDisplayLabel,
  permissionLabelSansModule,
} from "@/lib/permission-display";
import { rowPermKeys } from "@/lib/nav-view-unify";
import { rbacPermUsesTriState } from "@/lib/rbac-scope-ui";

/**
 * Collapsible module with bulk actions and permission switches.
 */
export default function PermissionModule({
  moduleId,
  title,
  items,
  enabledMap,
  baselineMap,
  onSetKeys,
  onSelectAll,
  onClearAll,
  disabled,
}) {
  // Nav+view pairs are the "module master" gate — render outside the scroll of fine-grained rows.
  const masterRows = items.filter((row) => row.type === "paired");
  const detailRows = items.filter((row) => row.type !== "paired");

  // Count UI rows (one permission row each), not raw DB keys — nav+view pairs are one row.
  const rowFullyEnabled = (row) => {
    const keys = rowPermKeys(row);
    if (!keys.length) return false;
    return keys.every((k) => {
      if (rbacPermUsesTriState(k)) {
        const v = enabledMap[k];
        return v === "self" || v === "all";
      }
      return !!enabledMap[k];
    });
  };
  const total = items.length;
  const enabledCount = items.filter((row) => rowFullyEnabled(row)).length;

  const renderRow = (row, { compact } = {}) => {
    const keys = rowPermKeys(row);
    const label =
      row.type === "paired"
        ? row.label
        : permissionLabelSansModule(permissionDisplayLabel(row), title);
    const useScope = keys.some((k) => rbacPermUsesTriState(k));
    const rowKey =
      row.type === "paired" ? row.id : row.id ?? row.perm_key;
    return useScope ? (
      <PermissionScopeToggle
        key={rowKey}
        permKeys={keys}
        label={label}
        valueMap={enabledMap}
        baselineMap={baselineMap}
        onSetKeys={onSetKeys}
        disabled={disabled}
        compact={compact}
      />
    ) : (
      <PermissionToggle
        key={rowKey}
        permKeys={keys}
        label={label}
        enabledMap={enabledMap}
        baselineMap={baselineMap}
        onSetKeys={onSetKeys}
        disabled={disabled}
        compact={compact}
      />
    );
  };

  return (
    <AccordionItem
      value={moduleId}
      className={cn(
        "rounded-xl border border-slate-200/90 bg-slate-50/40 shadow-sm border-b-0 min-w-0",
        "transition-shadow duration-200 data-[state=open]:shadow-md"
      )}
    >
      <AccordionPrimitive.Header className="flex w-full flex-wrap items-stretch gap-0">
        <AccordionPrimitive.Trigger
          className={cn(
            "flex min-w-[12rem] flex-1 items-center justify-between gap-2 py-3.5 pl-4 pr-2 text-left",
            "text-base font-semibold text-slate-800 transition-all hover:underline",
            "[&[data-state=open]]:border-b [&[data-state=open]]:border-slate-200/80",
            "[&[data-state=open]>svg]:rotate-180"
          )}
        >
          <span className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
            <span>{title}</span>
            <span className="text-xs font-normal text-slate-500">
              {enabledCount} / {total} enabled
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200" />
        </AccordionPrimitive.Trigger>
        {masterRows.length > 0 ? (
          <div
            className="flex shrink-0 items-center gap-2 border-l border-slate-200/80 py-1.5 pr-1 pl-3"
            title="Sidebar link and opening this module’s screens (sets nav + view together)."
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="hidden text-xs text-slate-500 sm:inline">
              Module access
            </span>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
              {masterRows.map((row) => renderRow(row, { compact: true }))}
            </div>
          </div>
        ) : null}
        <div
          className="flex shrink-0 items-center gap-0.5 border-l border-slate-200/80 py-1 pr-2 pl-1"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-teal-700 hover:bg-teal-50 hover:text-teal-800"
            onClick={() => onSelectAll(moduleId)}
            disabled={disabled || !total}
          >
            All
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-slate-600 hover:bg-slate-100"
            onClick={() => onClearAll(moduleId)}
            disabled={disabled || !total}
          >
            None
          </Button>
        </div>
      </AccordionPrimitive.Header>

      <AccordionContent className="px-3 pb-3 pt-2 data-[state=open]:overflow-visible">
        <div className="flex min-w-0 flex-col gap-2">
          {detailRows.length > 0 ? (
            <>
              {masterRows.length > 0 ? (
                <p className="text-xs font-medium text-slate-500">
                  Specific actions & data
                </p>
              ) : null}
              {detailRows.map((row) => renderRow(row))}
            </>
          ) : null}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
