"use client";

import { useEffect, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * Scoped permissions: Off is not in the dropdown — use the switch to revoke;
 * Self / All are the only scope choices when enabled.
 *
 * @param {object} props
 * @param {string[]} props.permKeys
 * @param {string} props.label
 * @param {Record<string, boolean|string>} props.valueMap perm_key -> 'off'|'self'|'all'|boolean
 * @param {Record<string, boolean|string>} props.baselineMap
 * @param {(keys: string[], value: 'off'|'self'|'all') => void} props.onSetKeys
 */
export default function PermissionScopeToggle({
  permKeys,
  label,
  valueMap,
  baselineMap,
  onSetKeys,
  disabled,
  compact,
}) {
  const primaryKey = permKeys[0];
  const raw = valueMap[primaryKey];
  const v =
    raw === "self" || raw === "all" || raw === "off"
      ? raw
      : raw
        ? "all"
        : "off";
  const baseRaw = baselineMap[primaryKey];
  const base =
    baseRaw === "self" || baseRaw === "all" || baseRaw === "off"
      ? baseRaw
      : baseRaw
        ? "all"
        : "off";
  const modified = v !== base;

  const granted = v === "self" || v === "all";
  const scopePick = v === "all" ? "all" : "self";

  /** Remember Self vs All when toggling scope off so turning back on restores the choice. */
  const preferredScopeRef = useRef(
    base === "all" || v === "all" ? "all" : "self"
  );
  useEffect(() => {
    if (granted && (v === "self" || v === "all")) {
      preferredScopeRef.current = v;
    }
  }, [granted, v]);

  const setGranted = (on) => {
    if (!on) {
      onSetKeys(permKeys, "off");
      return;
    }
    onSetKeys(permKeys, preferredScopeRef.current);
  };

  const setScopePick = (nv) => {
    if (nv !== "self" && nv !== "all") return;
    onSetKeys(permKeys, nv);
  };

  const controlsDisabled = disabled;

  const switchId = `scope-enable-${primaryKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  const controls = (
    <div className="flex shrink-0 flex-nowrap items-center gap-2">
      <div className="flex shrink-0 items-center gap-2">
        <Switch
          id={switchId}
          checked={granted}
          onCheckedChange={setGranted}
          disabled={controlsDisabled}
          className="shrink-0 data-[state=checked]:bg-teal-600"
          aria-label={`Enable scoped permission: ${label}`}
        />
        {!compact ? (
          <label
            htmlFor={switchId}
            className="cursor-pointer text-xs font-medium text-slate-600 whitespace-nowrap select-none"
          >
            Scoped
          </label>
        ) : null}
      </div>
      {granted ? (
        <Select value={scopePick} onValueChange={setScopePick} disabled={controlsDisabled}>
          <SelectTrigger
            className={cn(
              // Override Select's default w-full so the control doesn't overflow the row.
              "w-auto shrink-0 border-slate-200 focus:ring-offset-0",
              compact ? "h-8 min-w-[6.5rem] text-xs" : "h-9 min-w-[6.5rem]"
            )}
          >
            <SelectValue placeholder="Scope" />
          </SelectTrigger>
          <SelectContent className="z-[200]">
            <SelectItem value="self">Self</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );

  return (
    <div
      className={cn(
        !compact &&
          "flex w-full min-w-0 flex-nowrap items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors border-slate-200/80 bg-white hover:border-slate-300 min-h-[2.75rem]",
        compact &&
          "flex flex-row flex-nowrap items-center gap-2 rounded-md px-1 py-0.5 transition-colors",
        modified &&
          !compact &&
          "border-amber-400/70 bg-amber-50/40 ring-1 ring-amber-200/60",
        compact && modified && "rounded-md bg-amber-50/50 ring-1 ring-amber-200/50"
      )}
      title={`Technical IDs: ${permKeys.join(", ")}`}
    >
      <span
        className={cn(
          compact ? "sr-only" : "min-w-0 flex-1 truncate text-sm font-medium leading-snug text-slate-800"
        )}
      >
        {label}
      </span>
      <div className="flex shrink-0">{controls}</div>
    </div>
  );
}
