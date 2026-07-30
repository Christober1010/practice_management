"use client";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * @param {object} props
 * @param {string[]} props.permKeys
 * @param {string} props.label
 * @param {Record<string, boolean>} props.enabledMap
 * @param {Record<string, boolean>} props.baselineMap
 * @param {(keys: string[], checked: boolean) => void} props.onSetKeys
 */
export default function PermissionToggle({
  permKeys,
  label,
  enabledMap,
  baselineMap,
  onSetKeys,
  disabled,
  compact,
}) {
  const enabled = permKeys.length > 0 && permKeys.every((k) => !!enabledMap[k]);
  const modified = permKeys.some((k) => !!enabledMap[k] !== !!baselineMap[k]);
  const title = `Technical IDs: ${permKeys.join(", ")}`;

  return (
    <div
      className={cn(
        !compact &&
          "flex w-full min-w-0 flex-nowrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-colors border-slate-200/80 bg-white hover:border-slate-300 min-h-[2.75rem]",
        compact &&
          "flex items-center gap-2 rounded-md px-1 py-0.5 transition-colors",
        modified &&
          !compact &&
          "border-amber-400/70 bg-amber-50/40 ring-1 ring-amber-200/60",
        compact && modified && "rounded-md bg-amber-50/50 ring-1 ring-amber-200/50"
      )}
      title={title}
    >
      <span
        className={cn(
          compact ? "sr-only" : "min-w-0 flex-1 truncate text-sm font-medium leading-snug text-slate-800"
        )}
      >
        {label}
      </span>
      <Switch
        checked={enabled}
        onCheckedChange={(checked) => onSetKeys(permKeys, checked)}
        disabled={disabled}
        className="shrink-0 data-[state=checked]:bg-teal-600"
        aria-label={label}
      />
    </div>
  );
}
