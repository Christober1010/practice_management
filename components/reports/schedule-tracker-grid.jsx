"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar, RotateCw, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

/** Prefix for multiselect value when row has no client_id (match by normalized name). */
const CLIENT_NAME_VALUE_PREFIX = "__name__:";

function formatDosTime(dos, aptStart) {
  if (!dos && !aptStart) return "—";
  const d = dos ? String(dos).slice(0, 10) : "";
  let t = "";
  if (aptStart) {
    const s = String(aptStart);
    t = s.length >= 8 ? s.slice(11, 16) || s.slice(0, 5) : s.slice(0, 8);
  }
  return [d, t].filter(Boolean).join(" ");
}

function normalizeNameParts(first, last) {
  return `${first || ""} ${last || ""}`
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function clientOptionValueFromRow(row) {
  const id = row.client_id ? String(row.client_id).trim() : "";
  if (id) return id;
  const nk = normalizeNameParts(row.client_first_name, row.client_last_name);
  if (!nk) return null;
  return `${CLIENT_NAME_VALUE_PREFIX}${nk}`;
}

function clientOptionLabelFromRow(row) {
  const name = `${row.client_first_name || ""} ${row.client_last_name || ""}`.trim();
  const id = row.client_id ? String(row.client_id).trim() : "";
  if (name) return name;
  if (id) return `Client ${id.length > 10 ? `${id.slice(0, 8)}…` : id}`;
  return "Unknown client";
}

function rowMatchesClients(row, selectedIds) {
  if (!selectedIds.length) return true;
  const v = clientOptionValueFromRow(row);
  if (!v) return false;
  return selectedIds.includes(v);
}

function rowMatchesServiceCodes(row, selectedCodes) {
  if (!selectedCodes.length) return true;
  const code = String(row.service_code_with_modifiers ?? "").trim();
  return code !== "" && selectedCodes.includes(code);
}

function reportDosKey(dos) {
  if (dos == null || dos === "") return "";
  const t = Date.parse(String(dos).slice(0, 10));
  if (Number.isNaN(t)) return "";
  return String(dos).slice(0, 10);
}

function parseHours(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Misc hrs as number for display/math; drafts override saved row. */
function miscHrsNumeric(row, drafts) {
  const raw =
    drafts[row.id] !== undefined
      ? drafts[row.id]
      : row.misc_hrs != null && row.misc_hrs !== ""
        ? String(row.misc_hrs)
        : "";
  if (raw === "" || raw == null) return 0;
  const n = Number(String(raw).trim());
  return Number.isFinite(n) ? n : 0;
}

/** Multi-select for tracker filters (clients, service codes, …) — staff-modal–style. */
function TrackerFilterMultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  disabled,
  searchPlaceholder = "Search…",
  emptySearchMessage = "No matches",
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);

  const filteredOptions = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggle = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const summary =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? "1 selected"
        : `${selected.length} selected`;

  return (
    <div ref={dropdownRef} className="relative w-full min-w-[12rem]">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        className={cn(
          "w-full justify-between font-normal border-slate-200 bg-transparent",
          !selected.length && "text-muted-foreground"
        )}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open);
          if (open) setSearch("");
        }}
      >
        <span className="truncate text-left">{summary}</span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div className="absolute z-50 w-full mt-2 border border-slate-200 rounded-lg shadow-lg bg-white">
          <div className="p-2 border-b border-slate-100">
            <Input
              placeholder={searchPlaceholder}
              value={search}
              className="border-slate-200 focus:border-teal-500 focus:ring-teal-500"
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => {
                e.stopPropagation();
              }}
            />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500">{emptySearchMessage}</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="w-full px-3 py-2 flex items-center gap-2 text-sm text-left hover:bg-slate-100"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggle(option.value);
                  }}
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      selected.includes(option.value) ? "opacity-100 text-teal-600" : "opacity-0"
                    )}
                  />
                  <span className="truncate" title={option.label}>
                    {option.label}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const inputFilterClass =
  "border-slate-200 focus:border-teal-500 focus:ring-teal-500 focus-visible:ring-teal-500";

export default function ScheduleTrackerGrid() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const [selectedServiceCodes, setSelectedServiceCodes] = useState([]);
  const [filterDos, setFilterDos] = useState("");

  const clientOptionsFromRows = useMemo(() => {
    const byValue = new Map();
    for (const r of allRows) {
      const v = clientOptionValueFromRow(r);
      if (!v) continue;
      if (!byValue.has(v)) {
        byValue.set(v, { value: v, label: clientOptionLabelFromRow(r) });
      }
    }
    return Array.from(byValue.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [allRows]);

  useEffect(() => {
    const valid = new Set(clientOptionsFromRows.map((o) => o.value));
    setSelectedClientIds((prev) => prev.filter((id) => valid.has(id)));
  }, [clientOptionsFromRows]);

  const serviceCodeOptionsFromRows = useMemo(() => {
    const codes = new Set();
    for (const r of allRows) {
      const c = String(r.service_code_with_modifiers ?? "").trim();
      if (c) codes.add(c);
    }
    return Array.from(codes)
      .sort((a, b) => a.localeCompare(b))
      .map((c) => ({ value: c, label: c }));
  }, [allRows]);

  useEffect(() => {
    const valid = new Set(serviceCodeOptionsFromRows.map((o) => o.value));
    setSelectedServiceCodes((prev) => prev.filter((c) => valid.has(c)));
  }, [serviceCodeOptionsFromRows]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const q = new URLSearchParams({
        archived: "0",
        context: "schedule_tracker",
      });
      const res = await fetch(`${baseUrl}/reports.php?${q.toString()}`);
      const json = await res.json();
      if (!json.success) {
        toast.error(json.message || "Failed to load schedule tracker");
        setAllRows([]);
        return;
      }
      setAllRows(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load schedule tracker");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const dosQ = filterDos.trim();

    return allRows.filter((r) => {
      if (!rowMatchesClients(r, selectedClientIds)) return false;
      if (!rowMatchesServiceCodes(r, selectedServiceCodes)) return false;
      if (dosQ) {
        if (reportDosKey(r.dos) !== dosQ) return false;
      }
      return true;
    });
  }, [allRows, selectedClientIds, selectedServiceCodes, filterDos]);

  const trackerColumnTotals = useMemo(() => {
    let sumDur = 0;
    let sumMisc = 0;
    let sumDurMinusMisc = 0;
    for (const r of filteredRows) {
      const d = parseHours(r.duration_render_in_hrs) ?? 0;
      const m = miscHrsNumeric(r, drafts);
      sumDur += d;
      sumMisc += m;
      sumDurMinusMisc += d - m;
    }
    return { sumDur, sumMisc, sumDurMinusMisc };
  }, [filteredRows, drafts]);

  const clearFilters = () => {
    setSelectedClientIds([]);
    setSelectedServiceCodes([]);
    setFilterDos("");
  };

  const setMiscDraft = (id, value) => {
    setDrafts((d) => ({ ...d, [id]: value }));
  };

  const saveMisc = async (row) => {
    const id = row.id;
    const raw =
      drafts[id] !== undefined ? drafts[id] : row.misc_hrs != null ? String(row.misc_hrs) : "";
    const miscVal = raw === "" ? null : raw;
    try {
      setSavingId(id);
      const res = await fetch(`${baseUrl}/reports.php`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, misc_hrs: miscVal }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.message || "Save failed");
        return;
      }
      toast.success("Misc hrs saved");
      setDrafts((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
      await load();
    } catch (e) {
      console.error(e);
      toast.error("Save failed");
    } finally {
      setSavingId(null);
    }
  };

  const hasActiveFilters =
    selectedClientIds.length > 0 ||
    selectedServiceCodes.length > 0 ||
    filterDos.trim() !== "";

  return (
    <div className="space-y-4">
      <Card className="shadow-lg border-0">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:gap-4">
            <div className="w-full lg:flex-1 lg:min-w-[14rem] lg:max-w-md">
              <TrackerFilterMultiSelect
                options={clientOptionsFromRows}
                selected={selectedClientIds}
                onChange={setSelectedClientIds}
                placeholder={
                  clientOptionsFromRows.length === 0
                    ? "No clients in loaded rows"
                    : "All clients in table"
                }
                disabled={loading || clientOptionsFromRows.length === 0}
                searchPlaceholder="Search clients…"
                emptySearchMessage="No clients found"
              />
            </div>
            <div className="w-full lg:w-52 lg:min-w-[12rem] min-w-0">
              <TrackerFilterMultiSelect
                options={serviceCodeOptionsFromRows}
                selected={selectedServiceCodes}
                onChange={setSelectedServiceCodes}
                placeholder={
                  serviceCodeOptionsFromRows.length === 0
                    ? "No codes in loaded rows"
                    : "All service codes"
                }
                disabled={loading || serviceCodeOptionsFromRows.length === 0}
                searchPlaceholder="Search codes…"
                emptySearchMessage="No codes found"
              />
            </div>
            <div className="relative w-full lg:w-48 min-w-[10rem]">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none z-[1]" />
              <Input
                type="date"
                className={`pl-10 ${inputFilterClass}`}
                value={filterDos}
                onChange={(e) => setFilterDos(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              {hasActiveFilters && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-slate-200"
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-slate-200"
                onClick={() => load()}
                disabled={loading}
              >
                <RotateCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                Refresh data
              </Button>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Client and service code lists come only from the loaded table rows. Filters run in the
            browser; Refresh data reloads from the server.
            {hasActiveFilters &&
              ` Showing ${filteredRows.length} of ${allRows.length} row(s).`}
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-lg border-0 overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center">
              <p className="text-sm text-slate-500 animate-pulse">Loading schedule tracker…</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table
                className={
                  "[&_td]:px-3 [&_td]:py-2.5 [&_th]:px-3 [&_th]:py-2.5 min-w-[56rem] text-sm"
                }
              >
                <TableHeader>
                  <TableRow className="bg-slate-50 border-b">
                    <TableHead className="font-semibold text-slate-700">Client ID</TableHead>
                    <TableHead className="font-semibold text-slate-700">Provider ID</TableHead>
                    <TableHead className="font-semibold text-slate-700">Client</TableHead>
                    <TableHead className="font-semibold text-slate-700">Staff</TableHead>
                    <TableHead className="font-semibold text-slate-700">RBT supervised</TableHead>
                    <TableHead className="font-semibold text-slate-700">Payer</TableHead>
                    <TableHead className="font-semibold text-slate-700">Service code</TableHead>
                    <TableHead className="font-semibold text-slate-700">DOS / time</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right">
                      Duration (hrs)
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700 w-32">Misc hrs</TableHead>
                    <TableHead
                      className="font-semibold text-slate-700 text-right"
                      title="Duration (hrs) minus Misc hrs"
                    >
                      Diff
                    </TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center text-slate-500 py-10">
                        {allRows.length === 0
                          ? "No rows yet. Import on the Import tab, then refresh."
                          : "No rows match the current filters. Clear filters or adjust them."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {filteredRows.map((r) => {
                      const client = `${r.client_first_name || ""} ${
                        r.client_last_name || ""
                      }`.trim();
                      const staff = `${r.staff_first_name || ""} ${
                        r.staff_last_name || ""
                      }`.trim();
                      const miscDisplay =
                        drafts[r.id] !== undefined
                          ? drafts[r.id]
                          : r.misc_hrs != null && r.misc_hrs !== ""
                            ? String(r.misc_hrs)
                            : "";
                      const durNum = parseHours(r.duration_render_in_hrs);
                      const miscNum = miscHrsNumeric(r, drafts);
                      const durMinusMisc = (durNum ?? 0) - miscNum;
                      const showNumericHrs = durNum != null || miscNum !== 0;
                      return (
                        <TableRow key={r.id} className="border-b hover:bg-slate-50/80">
                          <TableCell
                            className="text-xs text-slate-600 max-w-[7rem] truncate font-mono"
                            title={r.client_id || ""}
                          >
                            {r.client_id || "—"}
                          </TableCell>
                          <TableCell
                            className="text-xs text-slate-600 max-w-[7rem] truncate font-mono"
                            title={r.provider_id || ""}
                          >
                            {r.provider_id || "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{client || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{staff || "—"}</TableCell>
                          <TableCell>{r.name_of_rbt_supervised || "—"}</TableCell>
                          <TableCell>{r.payer || "—"}</TableCell>
                          <TableCell
                            className="max-w-[140px] truncate"
                            title={r.service_code_with_modifiers}
                          >
                            {r.service_code_with_modifiers || "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {formatDosTime(r.dos, r.apt_start_time)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.duration_render_in_hrs != null && r.duration_render_in_hrs !== ""
                              ? Number(r.duration_render_in_hrs).toFixed(2)
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Input
                              className={`h-8 w-28 ${inputFilterClass}`}
                              type="text"
                              inputMode="decimal"
                              value={miscDisplay}
                              onChange={(e) => setMiscDraft(r.id, e.target.value)}
                              placeholder="—"
                            />
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-slate-800">
                            {showNumericHrs ? durMinusMisc.toFixed(2) : "—"}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              size="sm"
                              className="bg-teal-600 hover:bg-teal-700 shadow-sm"
                              disabled={savingId === r.id}
                              onClick={() => saveMisc(r)}
                            >
                              {savingId === r.id ? "…" : "Save"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                      <TableRow className="border-t-2 border-slate-300 bg-slate-50 font-medium">
                        <TableCell colSpan={8} className="text-right text-slate-700">
                          Totals (visible rows)
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {trackerColumnTotals.sumDur.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {trackerColumnTotals.sumMisc.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {trackerColumnTotals.sumDurMinusMisc.toFixed(2)}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
