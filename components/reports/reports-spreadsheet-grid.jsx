"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Save, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";

/** Columns editable directly on the reports screen (horizontal scroll). */
export const REPORT_GRID_COLUMNS = [
  { key: "client_first_name", label: "Client first" },
  { key: "client_last_name", label: "Client last" },
  { key: "client_middle_name", label: "Client MI" },
  { key: "staff_first_name", label: "Staff first" },
  { key: "staff_last_name", label: "Staff last" },
  { key: "staff_middle_name", label: "Staff MI" },
  { key: "name_of_rbt_supervised", label: "RBT supervised" },
  { key: "dos", label: "DOS", type: "date" },
  { key: "status", label: "Status", type: "status" },
  { key: "payer", label: "Payer" },
  { key: "authorization_number", label: "Auth #" },
  { key: "service_code_with_modifiers", label: "Svc code" },
  { key: "activity_type", label: "Activity" },
  { key: "location_code", label: "Loc code" },
  { key: "apt_start_time", label: "Appt start" },
  { key: "apt_end_time", label: "Appt end" },
  { key: "rendered_date", label: "Rendered date", type: "date" },
  { key: "rendered_start_time", label: "Rend start" },
  { key: "rendered_end_time", label: "Rend end" },
  { key: "duration_schedule_in_min", label: "Sched min" },
  { key: "duration_schedule_in_hrs", label: "Sched hrs" },
  { key: "duration_render_in_min", label: "Rend min" },
  { key: "office", label: "Office" },
  { key: "address", label: "Address" },
  { key: "non_billable_notes", label: "NB notes" },
  { key: "notes", label: "Notes" },
  { key: "billable", label: "Bill", type: "bool" },
];

const STATUS_OPTIONS = [
  "Scheduled",
  "Rendered",
  "Completed",
  "Cancelled",
  "Pending",
];

function emptyDraftRow() {
  return {
    id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    client_first_name: "",
    client_last_name: "",
    client_middle_name: "",
    staff_first_name: "",
    staff_last_name: "",
    staff_middle_name: "",
    name_of_rbt_supervised: "",
    payer: "",
    activity_type: "",
    location_code: "",
    authorization_number: "",
    service_code_with_modifiers: "",
    dos: "",
    apt_start_time: "",
    apt_end_time: "",
    duration_schedule_in_min: "",
    duration_schedule_in_hrs: "",
    rendered_date: "",
    rendered_start_time: "",
    rendered_end_time: "",
    duration_render_in_min: "",
    address: "",
    status: "Scheduled",
    non_billable_notes: "",
    billable: true,
    office: "",
    notes: "",
    archived: false,
    rendering_provider_first_name: "",
    rendering_provider_last_name: "",
    rendering_provider_middlename: "",
    created_by: "",
    created_date: "",
    direct_or_indirect_service: "",
    make_up_session: false,
    make_up_session_hours: "",
    exclude_from_payroll: false,
    exclude_from_mileage: false,
    staff_signature_on_file: false,
    staff_sign_date: "",
    approx_location_staff_sign: "",
    guardian_signature_on_file: false,
    guardian_sign_date: "",
    approx_location_guardian_sign: "",
    session_completion_latency_hrs: "",
  };
}

function toDateInput(v) {
  if (v == null || v === "") return "";
  const s = String(v);
  if (s.length >= 10 && s[4] === "-" && s[7] === "-") return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function mergeRow(base, patch) {
  return { ...base, ...patch };
}

export default function ReportsSpreadsheetGrid({
  rows,
  disabled,
  readOnlyArchived,
  onSaveExisting,
  onCreateNew,
}) {
  const [overrides, setOverrides] = useState({});
  const [pendingRows, setPendingRows] = useState([]);
  const [savingId, setSavingId] = useState(null);

  const displayRows = useMemo(
    () => [...rows, ...pendingRows],
    [rows, pendingRows]
  );

  const getVal = useCallback(
    (row) => {
      const id = row.id;
      const o = overrides[id];
      if (!o) return row;
      return mergeRow(row, o);
    },
    [overrides]
  );

  const setField = useCallback((id, key, value) => {
    setOverrides((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [key]: value },
    }));
  }, []);

  const resetRow = useCallback((row) => {
    const id = row.id;
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (String(id).startsWith("temp-")) {
      setPendingRows((pr) => pr.filter((r) => r.id !== id));
    }
  }, []);

  const addPendingRow = useCallback(() => {
    if (readOnlyArchived) {
      toast.error("Switch to active reports to add a row.");
      return;
    }
    setPendingRows((pr) => [...pr, emptyDraftRow()]);
  }, [readOnlyArchived]);

  const handleSave = useCallback(
    async (row) => {
      const id = row.id;
      const merged = mergeRow(row, overrides[id] || {});
      setSavingId(id);
      try {
        if (String(id).startsWith("temp-")) {
          const { id: _drop, ...payload } = merged;
          const ok = await onCreateNew(payload);
          if (ok) {
            setPendingRows((pr) => pr.filter((r) => r.id !== id));
            setOverrides((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
          }
        } else {
          const ok = await onSaveExisting({ ...merged, id });
          if (ok) {
            setOverrides((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
          }
        }
      } finally {
        setSavingId(null);
      }
    },
    [overrides, onCreateNew, onSaveExisting]
  );

  const renderCell = (row, col) => {
    const r = getVal(row);
    const v = r[col.key];
    if (col.type === "bool") {
      return (
        <div className="flex justify-center px-1">
          <Checkbox
            checked={!!v}
            disabled={disabled}
            onCheckedChange={(c) =>
              setField(row.id, col.key, c === true)
            }
          />
        </div>
      );
    }
    if (col.type === "status") {
      return (
        <Select
          value={v || "Scheduled"}
          disabled={disabled}
          onValueChange={(val) => setField(row.id, col.key, val)}
        >
          <SelectTrigger className="h-8 text-xs min-w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (col.type === "date") {
      return (
        <Input
          type="date"
          className="h-8 text-xs min-w-[128px]"
          disabled={disabled}
          value={toDateInput(v)}
          onChange={(e) => setField(row.id, col.key, e.target.value || "")}
        />
      );
    }
    return (
      <Input
        className="h-8 text-xs min-w-[88px]"
        disabled={disabled}
        value={v == null ? "" : String(v)}
        onChange={(e) => setField(row.id, col.key, e.target.value)}
      />
    );
  };

  const tempRowReady = (row) => {
    const m = mergeRow(row, overrides[row.id] || {});
    return ["client_first_name", "client_last_name", "staff_first_name", "staff_last_name", "dos"].every(
      (k) => String(m[k] ?? "").trim() !== ""
    );
  };

  const rowNeedsSave = (row) => {
    if (String(row.id).startsWith("temp-")) return tempRowReady(row);
    const o = overrides[row.id];
    if (!o || Object.keys(o).length === 0) return false;
    for (const k of Object.keys(o)) {
      const a = row[k];
      const b = o[k];
      if (k === "billable") {
        if (!!a !== !!b) return true;
        continue;
      }
      const av = a == null ? "" : String(a);
      const bv = b == null ? "" : String(b);
      if (av !== bv) return true;
    }
    return false;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 px-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-teal-300"
          disabled={disabled || readOnlyArchived}
          onClick={addPendingRow}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add row
        </Button>
        <p className="text-xs text-slate-500">
          Edit cells inline, then Save per row. Use “Full form” in the header
          for every field including signatures.
        </p>
      </div>
      <div className="rounded-md border border-slate-200 overflow-x-auto max-h-[min(70vh,900px)] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 sticky top-0 z-20 shadow-sm">
              {REPORT_GRID_COLUMNS.map((col) => (
                <TableHead
                  key={col.key}
                  className="whitespace-nowrap text-xs font-semibold text-slate-700 min-w-[88px] px-2 py-2"
                >
                  {col.label}
                </TableHead>
              ))}
              <TableHead className="sticky right-0 z-20 bg-slate-50 text-xs font-semibold text-slate-700 w-[140px] min-w-[140px] px-2 py-2 text-center border-l border-slate-200">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={REPORT_GRID_COLUMNS.length + 1}
                  className="text-center text-slate-500 py-10 text-sm"
                >
                  No reports in this view. Add a row or switch back to the
                  summary list.
                </TableCell>
              </TableRow>
            ) : (
              displayRows.map((row) => {
                const canSave = rowNeedsSave(row);
                const saving = savingId === row.id;
                return (
                  <TableRow key={row.id} className="hover:bg-slate-50/80">
                    {REPORT_GRID_COLUMNS.map((col) => (
                      <TableCell key={col.key} className="px-2 py-1 align-middle">
                        {renderCell(row, col)}
                      </TableCell>
                    ))}
                    <TableCell className="sticky right-0 z-10 bg-white border-l border-slate-100 px-2 py-1 align-middle">
                      <div className="flex flex-col gap-1 sm:flex-row sm:justify-center">
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 text-xs bg-teal-600 hover:bg-teal-700"
                          disabled={disabled || saving || !canSave}
                          onClick={() => handleSave(row)}
                        >
                          <Save className="h-3 w-3 mr-1" />
                          {saving ? "…" : "Save"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          disabled={disabled || saving || !canSave}
                          onClick={() => resetRow(row)}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Reset
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
