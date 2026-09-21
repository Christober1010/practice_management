"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import ReportFilterMultiSelect from "@/components/reports/report-filter-multi-select";
import {
  clientDisplayName,
  isClientActive,
  sortClientsByName,
} from "@/lib/sort-clients";
import { resolveClientRecordId } from "@/lib/master-data-client-scope";

export default function ClientAssignMultiSelect({
  clients = [],
  selectedIds = [],
  onChange,
  disabled = false,
}) {
  const selected = Array.isArray(selectedIds) ? selectedIds.map(String) : [];
  const options = useMemo(() => {
    const selectedSet = new Set(
      Array.isArray(selectedIds) ? selectedIds.map(String) : []
    );
    return sortClientsByName(clients)
      .map((client) => {
        const value = resolveClientRecordId(client);
        if (!value) return null;
        if (!isClientActive(client) && !selectedSet.has(value)) return null;
        return {
          value,
          label: clientDisplayName(client) || "Unnamed Client",
        };
      })
      .filter(Boolean);
  }, [clients, selectedIds]);

  const hint =
    selected.length === 0
      ? "Leave empty for generic (no client)."
      : selected.length === 1
        ? "Assigned to 1 client."
        : `Assigned to ${selected.length} clients. A copy is created for each.`;

  return (
    <div className="space-y-2">
      <Label>Assign to Client</Label>
      <ReportFilterMultiSelect
        options={options}
        selected={selected}
        onChange={onChange}
        placeholder="Generic (no client)"
        searchPlaceholder="Search clients…"
        emptySearchMessage="No clients found"
        disabled={disabled}
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
