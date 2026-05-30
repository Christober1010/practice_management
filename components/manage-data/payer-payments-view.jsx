"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import toast from "react-hot-toast";
import { Calendar, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchClientsUtil } from "@/app/utils/fetchClients";

function authHeaders() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("aba_token");
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
    "X-Auth-Token": token,
  };
}

function insuranceLabel(ins) {
  const name =
    ins.insurance_name ||
    ins.payer_name ||
    ins.provider_name ||
    ins.carrier_name ||
    "Insurance";
  return `${name} (ID ${ins.insurance_id})`;
}

function formatReportDos(dos, aptStart) {
  if (!dos && !aptStart) return "—";
  const d = dos ? String(dos).slice(0, 10) : "";
  let t = "";
  if (aptStart) {
    const s = String(aptStart);
    t = s.length >= 8 ? s.slice(11, 16) || s.slice(0, 5) : s.slice(0, 8);
  }
  return [d, t].filter(Boolean).join(" ");
}

function reportDosKey(dos) {
  if (dos == null || dos === "") return "";
  const t = Date.parse(String(dos).slice(0, 10));
  if (Number.isNaN(t)) return "";
  return String(dos).slice(0, 10);
}

/** All primitive values on the row, for client-side search (matches table + linked IDs). */
function reportRowSearchableText(row) {
  if (!row || typeof row !== "object") return "";
  const chunks = [];
  for (const v of Object.values(row)) {
    if (v == null || v === "") continue;
    const t = typeof v;
    if (t === "string" || t === "number" || t === "boolean") {
      chunks.push(String(v));
    }
  }
  return chunks.join(" ").toLowerCase();
}

function payerRowMatchesSearch(row, rawQuery, amountsRow) {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  const basis = [
    reportRowSearchableText(row),
    formatReportDos(row.dos, row.apt_start_time),
    `${row.client_first_name || ""} ${row.client_last_name || ""}`.trim(),
    `${row.staff_first_name || ""} ${row.staff_last_name || ""}`.trim(),
  ];
  if (amountsRow && typeof amountsRow === "object") {
    for (const v of Object.values(amountsRow)) {
      if (v != null && String(v).trim() !== "") basis.push(String(v));
    }
  }
  const hay = basis.join(" ").toLowerCase();
  return tokens.every((t) => hay.includes(t));
}

export default function PayerPaymentsView() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
  const [clients, setClients] = useState([]);
  const [loadingIndex, setLoadingIndex] = useState(true);
  const [clientId, setClientId] = useState("");
  const [insuranceId, setInsuranceId] = useState("");
  const [allReportRows, setAllReportRows] = useState([]);
  const [saving, setSaving] = useState(false);
  /** @type {Record<string, { coinsurance_amount: string, copay_amount: string, deductible_amount: string, payer_paid_amount: string, check_number: string }>} */
  const [amounts, setAmounts] = useState({});
  const [filterDos, setFilterDos] = useState("");
  const [filterCheckNumber, setFilterCheckNumber] = useState("all");
  const [tableSearch, setTableSearch] = useState("");
  const [savedRows, setSavedRows] = useState([]);

  const selectedClient = useMemo(
    () => clients.find((c) => String(c.client_id) === String(clientId)),
    [clients, clientId]
  );

  const insurances = useMemo(() => {
    if (!selectedClient?.insurances?.length) return [];
    return selectedClient.insurances;
  }, [selectedClient]);

  const reportLines = useMemo(() => {
    if (!clientId) return allReportRows;
    return allReportRows.filter((r) => String(r.client_id ?? "").trim() === String(clientId).trim());
  }, [allReportRows, clientId]);

  const filteredReportLines = useMemo(() => {
    const q = filterDos.trim();
    if (!q) return reportLines;
    return reportLines.filter((r) => reportDosKey(r.dos) === q);
  }, [reportLines, filterDos]);

  /** After DOS: filter by whether Check # column (current draft / loaded saved) is empty or not. */
  const linesAfterCheckFilter = useMemo(() => {
    if (filterCheckNumber === "all") return filteredReportLines;
    const wantFilled = filterCheckNumber === "has_check";
    return filteredReportLines.filter((r) => {
      const pk = String(r.id);
      const ck = amounts[pk]?.check_number;
      const has = ck != null && String(ck).trim() !== "";
      return wantFilled ? has : !has;
    });
  }, [filteredReportLines, filterCheckNumber, amounts]);

  const displayReportLines = useMemo(() => {
    if (!tableSearch.trim()) return linesAfterCheckFilter;
    return linesAfterCheckFilter.filter((r) =>
      payerRowMatchesSearch(r, tableSearch, amounts[String(r.id)])
    );
  }, [linesAfterCheckFilter, tableSearch, amounts]);

  const loadPayerIndex = useCallback(async () => {
    setLoadingIndex(true);
    try {
      const repRes = await fetch(
        `${baseUrl}/reports.php?archived=0&context=schedule_tracker`,
        { headers: { ...authHeaders() } }
      );
      const repJson = await repRes.json();
      const lines = repJson.success && Array.isArray(repJson.data) ? repJson.data : [];
      if (!repJson.success) {
        toast.error(repJson.message || "Failed to load report index");
      }
      setAllReportRows(lines);

      const idSet = new Set();
      for (const r of lines) {
        const cid = r.client_id != null && String(r.client_id).trim() !== "" ? String(r.client_id).trim() : "";
        if (cid) idSet.add(cid);
      }

      let crmList = [];
      try {
        crmList = await fetchClientsUtil();
      } catch (e) {
        console.error(e);
        toast.error("Failed to load client insurance data");
      }
      crmList = Array.isArray(crmList) ? crmList : [];

      const byId = new Map();
      for (const c of crmList) {
        const id = String(c.client_id ?? "").trim();
        if (id && idSet.has(id)) {
          byId.set(id, { ...c, insurances: Array.isArray(c.insurances) ? c.insurances : [] });
        }
      }
      for (const id of idSet) {
        if (!byId.has(id)) {
          const sample = lines.find((r) => String(r.client_id ?? "").trim() === id);
          byId.set(id, {
            client_id: id,
            first_name: sample?.client_first_name ?? "",
            last_name: sample?.client_last_name ?? "",
            insurances: [],
          });
        }
      }
      const merged = Array.from(byId.values()).sort((a, b) =>
        `${a.first_name || ""} ${a.last_name || ""}`
          .trim()
          .localeCompare(`${b.first_name || ""} ${b.last_name || ""}`.trim())
      );
      setClients(merged);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load payer data");
      setAllReportRows([]);
      setClients([]);
    } finally {
      setLoadingIndex(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    loadPayerIndex();
  }, [loadPayerIndex]);

  const loadSaved = useCallback(async () => {
    try {
      const q = clientId ? new URLSearchParams({ client_id: clientId }) : new URLSearchParams();
      const res = await fetch(`${baseUrl}/payer-payment-entries.php?${q}`, {
        headers: { ...authHeaders() },
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setSavedRows(json.data);
      } else {
        setSavedRows([]);
      }
    } catch (e) {
      console.error(e);
      setSavedRows([]);
    }
  }, [baseUrl, clientId]);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  function emptyAmountRow() {
    return {
      coinsurance_amount: "",
      copay_amount: "",
      deductible_amount: "",
      payer_paid_amount: "",
      check_number: "",
    };
  }

  useEffect(() => {
    if (!allReportRows.length) {
      setAmounts({});
      return;
    }
    const lines = clientId
      ? allReportRows.filter((r) => String(r.client_id ?? "").trim() === String(clientId).trim())
      : allReportRows;
    const fromSaved = {};
    for (const s of savedRows) {
      if (s.report_id != null && String(s.report_id) !== "") {
        fromSaved[String(s.report_id)] = {
          coinsurance_amount: s.coinsurance_amount != null ? String(s.coinsurance_amount) : "",
          copay_amount: s.copay_amount != null ? String(s.copay_amount) : "",
          deductible_amount: s.deductible_amount != null ? String(s.deductible_amount) : "",
          payer_paid_amount: s.payer_paid_amount != null ? String(s.payer_paid_amount) : "",
          check_number: s.check_number != null ? String(s.check_number) : "",
        };
      }
    }
    setAmounts((prev) => {
      const next = {};
      for (const r of lines) {
        const id = String(r.id);
        if (fromSaved[id]) {
          next[id] = { ...fromSaved[id] };
        } else {
          next[id] = prev[id] ? { ...prev[id] } : emptyAmountRow();
        }
      }
      return next;
    });
  }, [clientId, allReportRows, savedRows]);

  const setField = (reportPk, field, value) => {
    setAmounts((prev) => ({
      ...prev,
      [reportPk]: {
        ...(prev[reportPk] || {
          coinsurance_amount: "",
          copay_amount: "",
          deductible_amount: "",
          payer_paid_amount: "",
          check_number: "",
        }),
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    if (!clientId || !insuranceId) {
      toast.error("Select a client and payer (insurance) to save — saving is per client.");
      return;
    }
    const rowsForSave = displayReportLines;
    const entries = [];
    for (const r of rowsForSave) {
      if (String(r.client_id ?? "").trim() !== String(clientId).trim()) {
        continue;
      }
      const pk = String(r.id);
      const a = amounts[pk] || {};
      const hasValue =
        (a.coinsurance_amount && String(a.coinsurance_amount).trim() !== "") ||
        (a.copay_amount && String(a.copay_amount).trim() !== "") ||
        (a.deductible_amount && String(a.deductible_amount).trim() !== "") ||
        (a.payer_paid_amount && String(a.payer_paid_amount).trim() !== "") ||
        (a.check_number && String(a.check_number).trim() !== "");
      if (!hasValue) continue;
      entries.push({
        report_id: r.id,
        client_id: clientId,
        insurance_id: Number(insuranceId),
        dos: r.dos ? String(r.dos).slice(0, 10) : "",
        service_code: r.service_code_with_modifiers || "",
        coinsurance_amount: a.coinsurance_amount || "",
        copay_amount: a.copay_amount || "",
        deductible_amount: a.deductible_amount || "",
        payer_paid_amount: a.payer_paid_amount || "",
        check_number: a.check_number || "",
      });
    }
    if (entries.length === 0) {
      toast.error("Enter at least one amount or check number on a row to save");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${baseUrl}/payer-payment-entries.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ entries }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.message || "Save failed");
        return;
      }
      toast.success(`Saved ${entries.length} payment line(s)`);
      await loadSaved();
    } catch (e) {
      console.error(e);
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const hasActiveFilters =
    tableSearch.trim() !== "" || filterDos.trim() !== "" || filterCheckNumber !== "all";

  const visibleAmountTotals = useMemo(() => {
    const toNumber = (v) => {
      if (v == null) return 0;
      const s = String(v).trim();
      if (!s) return 0;
      const n = Number(s);
      return Number.isFinite(n) ? n : 0;
    };

    let coinsurance = 0;
    let copay = 0;
    let deductible = 0;
    let payerPaid = 0;

    for (const row of displayReportLines) {
      const a = amounts[String(row.id)] || {};
      coinsurance += toNumber(a.coinsurance_amount);
      copay += toNumber(a.copay_amount);
      deductible += toNumber(a.deductible_amount);
      payerPaid += toNumber(a.payer_paid_amount);
    }

    return { coinsurance, copay, deductible, payerPaid };
  }, [displayReportLines, amounts]);

  const clearAllFilters = useCallback(() => {
    setTableSearch("");
    setFilterDos("");
    setFilterCheckNumber("all");
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Payer Payments</h2>
        <p className="text-slate-600 mt-1 text-sm">
          By default all imported report lines are shown. Use Client to narrow to one client. Search,
          DOS, and Check # filters apply to whatever is on screen. To post A/R, select that client and
          an insurance, then save.
        </p>
      </div>

      <Card className="shadow border-0">
        <CardHeader>
          <CardTitle className="text-lg">Report lines &amp; A/R</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingIndex ? (
            <p className="text-sm text-slate-500">Loading clients from report imports…</p>
          ) : (
            <div className="space-y-4">
             
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2 lg:col-span-1">
                <Label>Search report rows</Label>
                <div className="relative max-w-2xl">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none z-[1]" />
                  <Input
                    type="search"
                    placeholder="Search all columns (report #, DOS, code, payer, staff, IDs, amounts…)"
                    className={cn(
                      "pl-10 border-slate-200 focus:border-teal-500 focus:ring-teal-500 focus-visible:ring-teal-500",
                      tableSearch.trim() !== "" ? "pr-10" : "pr-3"
                    )}
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    autoComplete="off"
                  />
                  {tableSearch.trim() !== "" && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1"
                      onClick={() => setTableSearch("")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {reportLines.length > 0 && tableSearch.trim() !== "" && (
                  <p className="text-xs text-slate-500">
                    {displayReportLines.length} row(s) match search
                    {filterDos.trim() !== "" || filterCheckNumber !== "all"
                      ? ` (${linesAfterCheckFilter.length} after other filters)`
                      : ` (${reportLines.length} in current view)`}
                    .
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Client</Label>
                <Select
                  value={clientId === "" ? "__all__" : clientId}
                  onValueChange={(v) => {
                    const id = v === "__all__" ? "" : v;
                    setClientId(id);
                    setInsuranceId("");
                    setFilterDos("");
                    setFilterCheckNumber("all");
                    setTableSearch("");
                    setAmounts({});
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All clients" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="__all__">All clients</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.client_id} value={String(c.client_id)}>
                        {c.first_name} {c.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Filter by DOS</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none z-[1]" />
                  <Input
                    type="date"
                    className={cn(
                      "border-slate-200 focus:border-teal-500 focus:ring-teal-500 focus-visible:ring-teal-500",
                      "pl-10",
                      filterDos.trim() !== "" ? "pr-10" : "pr-3"
                    )}
                    value={filterDos}
                    onChange={(e) => setFilterDos(e.target.value)}
                    disabled={allReportRows.length === 0}
                  />
                  {allReportRows.length > 0 && filterDos.trim() !== "" && (
                    <button
                      type="button"
                      aria-label="Clear date filter"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1"
                      onClick={() => setFilterDos("")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {filterDos.trim() !== "" && reportLines.length > 0 && (
                  <p className="text-xs text-slate-500">
                    Showing {filteredReportLines.length} of {reportLines.length} row(s)
                    {clientId ? " for this client" : " (all clients)"}.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Check #</Label>
                <Select
                  value={filterCheckNumber}
                  onValueChange={setFilterCheckNumber}
                  disabled={allReportRows.length === 0}
                >
                  <SelectTrigger className="border-slate-200">
                    <SelectValue placeholder="Check number" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All rows</SelectItem>
                    <SelectItem value="has_check">Has check #</SelectItem>
                    <SelectItem value="no_check">No check #</SelectItem>
                  </SelectContent>
                </Select>
                {reportLines.length > 0 && filterCheckNumber !== "all" && (
                  <p className="text-xs text-slate-500">
                    {linesAfterCheckFilter.length} row(s) after check # filter
                    {filterDos.trim() !== "" ? ` (of ${filteredReportLines.length} for this DOS)` : ""}.
                  </p>
                )}
              </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-slate-200 text-slate-700"
                  disabled={!hasActiveFilters || allReportRows.length === 0}
                  onClick={clearAllFilters}
                >
                  Clear filters
                </Button>
              </div>
            </div>
          )}

          {!loadingIndex && allReportRows.length === 0 && (
            <p className="text-sm text-slate-500">
              No imported schedule / report rows yet.
            </p>
          )}

          {!loadingIndex &&
            clientId &&
            allReportRows.length > 0 &&
            reportLines.length === 0 && (
            <p className="text-sm text-slate-500">
              No report rows for this client — confirm imports include a matching{" "}
              <span className="font-mono text-xs">client_id</span>.
            </p>
          )}

          {!loadingIndex &&
            reportLines.length > 0 &&
            filteredReportLines.length === 0 &&
            filterDos.trim() !== "" && (
              <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                No report lines for this date of service. Clear the DOS filter or choose another
                date.
              </p>
            )}

          {!loadingIndex && filteredReportLines.length > 0 && (
            <div className="overflow-x-auto border rounded-lg">
              <Table
                className={
                  "[&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3 " +
                  "[&_th]:align-bottom [&_td]:align-middle min-w-[64rem] " +
                  "[&_th]:whitespace-nowrap text-sm"
                }
              >
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">Report #</TableHead>
                    <TableHead className="font-semibold">Client</TableHead>
                    <TableHead className="font-semibold">DOS / time</TableHead>
                    <TableHead className="font-semibold">Code</TableHead>
                    <TableHead className="font-semibold">Payer (report)</TableHead>
                    <TableHead className="font-semibold">Staff</TableHead>
                    <TableHead className="font-semibold text-right">Dur. hrs</TableHead>
                    <TableHead>Co-insurance $</TableHead>
                    <TableHead>Copay $</TableHead>
                    <TableHead>Deductible $</TableHead>
                    <TableHead>Payer paid $</TableHead>
                    <TableHead>Check #</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayReportLines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center text-sm text-slate-500 py-10">
                        No rows match your search. Clear the search box or try different keywords.
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {displayReportLines.map((row) => {
                        const pk = String(row.id);
                        const a = amounts[pk] || {
                          coinsurance_amount: "",
                          copay_amount: "",
                          deductible_amount: "",
                          payer_paid_amount: "",
                          check_number: "",
                        };
                        const staff = `${row.staff_first_name || ""} ${row.staff_last_name || ""}`.trim();
                        const clientLabel =
                          `${row.client_first_name || ""} ${row.client_last_name || ""}`.trim() ||
                          (row.client_id != null && String(row.client_id).trim() !== ""
                            ? `Client #${row.client_id}`
                            : "—");
                        return (
                          <TableRow key={pk}>
                            <TableCell className="font-mono text-xs">{row.id}</TableCell>
                            <TableCell
                              className="max-w-[10rem] truncate text-xs font-medium"
                              title={clientLabel}
                            >
                              {clientLabel}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs">
                              {formatReportDos(row.dos, row.apt_start_time)}
                            </TableCell>
                            <TableCell className="max-w-[120px] truncate font-medium" title={row.service_code_with_modifiers}>
                              {row.service_code_with_modifiers || "—"}
                            </TableCell>
                            <TableCell className="max-w-[10rem] truncate text-xs" title={row.payer}>
                              {row.payer || "—"}
                            </TableCell>
                            <TableCell className="max-w-[8rem] truncate text-xs" title={staff}>
                              {staff || "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-xs">
                              {row.duration_render_in_hrs != null && row.duration_render_in_hrs !== ""
                                ? Number(row.duration_render_in_hrs).toFixed(2)
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-9 min-w-[6.25rem] px-3"
                                value={a.coinsurance_amount || ""}
                                onChange={(e) => setField(pk, "coinsurance_amount", e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-9 min-w-[6.25rem] px-3"
                                value={a.copay_amount || ""}
                                onChange={(e) => setField(pk, "copay_amount", e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-9 min-w-[6.25rem] px-3"
                                value={a.deductible_amount || ""}
                                onChange={(e) => setField(pk, "deductible_amount", e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-9 min-w-[6.25rem] px-3"
                                value={a.payer_paid_amount || ""}
                                onChange={(e) => setField(pk, "payer_paid_amount", e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-9 min-w-[9rem] px-3"
                                value={a.check_number || ""}
                                onChange={(e) => setField(pk, "check_number", e.target.value)}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-slate-50 border-t-2">
                        <TableCell colSpan={7} className="text-right font-medium text-slate-700">
                          Totals (visible rows)
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {visibleAmountTotals.coinsurance.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {visibleAmountTotals.copay.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {visibleAmountTotals.deductible.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {visibleAmountTotals.payerPaid.toFixed(2)}
                        </TableCell>
                        <TableCell>—</TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
              <div className="p-3 border-t flex flex-col sm:flex-row flex-wrap gap-4 items-end justify-between">
                <div className="space-y-2 w-full sm:w-auto sm:min-w-[18rem]">
                  <Label>Payer (insurance)</Label>
                  {!clientId && (
                    <p className="text-xs text-slate-500">
                      Select a client above to choose insurance and save.
                    </p>
                  )}
                  <Select
                    value={insuranceId || undefined}
                    onValueChange={(v) => setInsuranceId(v)}
                    disabled={!clientId || insurances.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payer for save" />
                    </SelectTrigger>
                    <SelectContent>
                      {insurances.map((ins) => (
                        <SelectItem key={ins.insurance_id} value={String(ins.insurance_id)}>
                          {insuranceLabel(ins)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" onClick={handleSave} disabled={saving || !insuranceId}>
                  {saving ? "Saving…" : "Save payment lines"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow border-0">
        <CardHeader>
          <CardTitle className="text-lg">
            Saved entries
            {clientId ? " (this client)" : " (all clients, up to 500)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {savedRows.length === 0 ? (
            <p className="text-sm text-slate-500">No saved payment lines for this client.</p>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <Table
                className={
                  "[&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3 min-w-[46rem] " +
                  "[&_td]:align-middle [&_th]:align-bottom text-sm"
                }
              >
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Report</TableHead>
                    <TableHead>DOS</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Co-ins.</TableHead>
                    <TableHead>Copay</TableHead>
                    <TableHead>Deduct.</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Check</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {savedRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.report_id ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.dos}</TableCell>
                      <TableCell>{r.service_code}</TableCell>
                      <TableCell>{r.coinsurance_amount ?? "—"}</TableCell>
                      <TableCell>{r.copay_amount ?? "—"}</TableCell>
                      <TableCell>{r.deductible_amount ?? "—"}</TableCell>
                      <TableCell>{r.payer_paid_amount ?? "—"}</TableCell>
                      <TableCell>{r.check_number ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
