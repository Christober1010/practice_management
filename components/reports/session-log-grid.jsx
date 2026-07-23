"use client";

import { mahaverseFetch } from "@/lib/mahaverse-api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import toast from "react-hot-toast";
import SessionLogTable, { SESSION_LOG_STATUSES } from "./session-log-table";
import { formatMoneyDisplay } from "./schedule-tracker-table-utils";

function defaultDosTo() {
  return new Date().toISOString().slice(0, 10);
}

function defaultDosFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function tabSlug(status) {
  return String(status)
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function statusFromSlug(slug) {
  return (
    SESSION_LOG_STATUSES.find((s) => tabSlug(s) === slug) || "Scheduled"
  );
}

function normalizeTab(row) {
  const t = String(row.tab || "").trim();
  if (SESSION_LOG_STATUSES.includes(t)) return t;
  const log = String(row.log_status || "").trim();
  if (log === "Pending Payment" || log === "Received Payment") return log;
  if (String(row.session_status || "").toLowerCase() === "rendered") {
    return "Rendered";
  }
  return "Scheduled";
}

function emptyAmountRow() {
  return {
    coinsurance_amount: "",
    copay_amount: "",
    deductible_amount: "",
    payer_paid_amount: "",
    check_number: "",
    ap_invoice: "",
    ap_date: "",
  };
}

const PAYMENT_AMOUNT_FIELDS = [
  "coinsurance_amount",
  "copay_amount",
  "deductible_amount",
  "payer_paid_amount",
  "check_number",
];

const AP_FIELDS = ["ap_invoice", "ap_date"];

function savedField(row, field) {
  if (!row || row[field] == null || row[field] === "") return "";
  if (field === "ap_date") return String(row[field]).slice(0, 10);
  if (
    field === "coinsurance_amount" ||
    field === "copay_amount" ||
    field === "deductible_amount" ||
    field === "payer_paid_amount"
  ) {
    return formatMoneyDisplay(row[field]);
  }
  return String(row[field]);
}

function amountsFromRows(rows) {
  const next = {};
  for (const r of rows) {
    const pk = String(r.session_id);
    next[pk] = {
      coinsurance_amount: savedField(r, "coinsurance_amount"),
      copay_amount: savedField(r, "copay_amount"),
      deductible_amount: savedField(r, "deductible_amount"),
      payer_paid_amount: savedField(r, "payer_paid_amount"),
      check_number: savedField(r, "check_number"),
      ap_invoice: savedField(r, "ap_invoice"),
      ap_date: savedField(r, "ap_date"),
    };
  }
  return next;
}

function paymentFieldsDirty(sessionId, amounts, row) {
  const pk = String(sessionId);
  const draft = amounts[pk];
  if (!draft) return false;
  return PAYMENT_AMOUNT_FIELDS.some((field) => {
    const d = String(draft[field] ?? "").trim();
    const s = savedField(row, field).trim();
    if (field === "check_number") return d !== s;
    const dn = d === "" ? "" : formatMoneyDisplay(d);
    const sn = s === "" ? "" : formatMoneyDisplay(s);
    return dn !== sn;
  });
}

function apFieldsDirty(sessionId, amounts, row) {
  const pk = String(sessionId);
  const draft = amounts[pk];
  if (!draft) return false;
  return AP_FIELDS.some((field) => {
    const d = String(draft[field] ?? "").trim();
    const s = savedField(row, field).trim();
    return d !== s;
  });
}

export default function SessionLogGrid({ onRegisterReload, onLoadingChange }) {
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingChanges, setSavingChanges] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [amounts, setAmounts] = useState({});
  const [filterDosFrom, setFilterDosFrom] = useState(defaultDosFrom);
  const [filterDosTo, setFilterDosTo] = useState(defaultDosTo);
  const [filterClient, setFilterClient] = useState("");
  const [filterStaff, setFilterStaff] = useState("");
  const [filterCheckNumber, setFilterCheckNumber] = useState("");
  const [activeTab, setActiveTab] = useState(tabSlug("Scheduled"));
  const [selectedRowIds, setSelectedRowIds] = useState([]);

  const activeStatus = statusFromSlug(activeTab);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const q = new URLSearchParams();
      if (filterDosFrom.trim()) q.set("dos_from", filterDosFrom.trim());
      if (filterDosTo.trim()) q.set("dos_to", filterDosTo.trim());
      const res = await mahaverseFetch(`/session-log.php?${q.toString()}`);
      const json = await res.json();
      if (!json.success) {
        toast.error(json.message || "Failed to load session log");
        setAllRows([]);
        return;
      }
      const rows = Array.isArray(json.data)
        ? json.data.map((r) => ({ ...r, tab: normalizeTab(r) }))
        : [];
      setAllRows(rows);
      setAmounts(amountsFromRows(rows));
      setDrafts({});
      setSelectedRowIds([]);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load session log");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [filterDosFrom, filterDosTo]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    onRegisterReload?.(load);
    return () => onRegisterReload?.(null);
  }, [load, onRegisterReload]);

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  const filteredBySearch = useMemo(() => {
    const clientQ = filterClient.trim().toLowerCase();
    const staffQ = filterStaff.trim().toLowerCase();
    const checkQ = filterCheckNumber.trim().toLowerCase();
    return allRows.filter((row) => {
      if (clientQ) {
        const name = `${row.client_first_name || ""} ${row.client_last_name || ""}`
          .trim()
          .toLowerCase();
        if (!name.includes(clientQ)) return false;
      }
      if (staffQ) {
        const name = `${row.staff_first_name || ""} ${row.staff_last_name || ""} ${row.provider_name || ""}`
          .trim()
          .toLowerCase();
        if (!name.includes(staffQ)) return false;
      }
      if (checkQ) {
        const pk = String(row.session_id);
        const ck = String(amounts[pk]?.check_number ?? row.check_number ?? "")
          .trim()
          .toLowerCase();
        if (!ck.includes(checkQ)) return false;
      }
      return true;
    });
  }, [allRows, filterClient, filterStaff, filterCheckNumber, amounts]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(SESSION_LOG_STATUSES.map((s) => [s, 0]));
    for (const row of filteredBySearch) {
      const t = normalizeTab(row);
      if (c[t] != null) c[t] += 1;
    }
    return c;
  }, [filteredBySearch]);

  const rowsForActiveTab = useMemo(
    () => filteredBySearch.filter((r) => normalizeTab(r) === activeStatus),
    [filteredBySearch, activeStatus]
  );

  const dirtyRowIds = useMemo(() => {
    const ids = new Set();
    for (const [sid, draft] of Object.entries(drafts)) {
      const row = allRows.find((r) => String(r.session_id) === String(sid));
      if (!row) continue;
      const saved =
        row.misc_hrs != null && row.misc_hrs !== ""
          ? String(row.misc_hrs)
          : "";
      if (String(draft).trim() !== saved.trim()) ids.add(String(sid));
    }
    for (const row of allRows) {
      const sid = String(row.session_id);
      if (paymentFieldsDirty(sid, amounts, row) || apFieldsDirty(sid, amounts, row)) {
        ids.add(sid);
      }
    }
    return Array.from(ids);
  }, [drafts, amounts, allRows]);

  const showRowCheckboxes =
    activeStatus === "Rendered" ||
    activeStatus === "Pending Payment" ||
    activeStatus === "Received Payment";

  const canEditMisc = activeStatus === "Rendered";
  const canEditPayment =
    activeStatus === "Pending Payment" || activeStatus === "Received Payment";
  const canEditAp = activeStatus === "Received Payment";
  const showSaveChanges =
    canEditMisc || canEditPayment || canEditAp;

  const allVisibleSelected =
    rowsForActiveTab.length > 0 &&
    rowsForActiveTab.every((r) =>
      selectedRowIds.includes(String(r.session_id))
    );

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visible = new Set(rowsForActiveTab.map((r) => String(r.session_id)));
      setSelectedRowIds((prev) => prev.filter((id) => !visible.has(id)));
    } else {
      const ids = rowsForActiveTab.map((r) => String(r.session_id));
      setSelectedRowIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  const toggleRowSelection = (id) => {
    const sid = String(id);
    setSelectedRowIds((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]
    );
  };

  const setMiscDraft = (sessionId, value) => {
    const sid = String(sessionId);
    setDrafts((prev) => ({ ...prev, [sid]: value }));
    setSelectedRowIds((prev) => (prev.includes(sid) ? prev : [...prev, sid]));
  };

  const setPaymentField = (sessionId, field, value) => {
    const sid = String(sessionId);
    setAmounts((prev) => ({
      ...prev,
      [sid]: {
        ...(prev[sid] || emptyAmountRow()),
        [field]: value,
      },
    }));
    setSelectedRowIds((prev) => (prev.includes(sid) ? prev : [...prev, sid]));
  };

  const saveChanges = async () => {
    if (dirtyRowIds.length === 0) {
      toast.error("No changes to save");
      return;
    }
    setSavingChanges(true);
    try {
      const rows = dirtyRowIds.map((sid) => {
        const row = allRows.find((r) => String(r.session_id) === sid);
        const a = amounts[sid] || emptyAmountRow();
        const patch = { session_id: Number(sid) };
        if (drafts[sid] !== undefined) {
          patch.misc_hrs =
            drafts[sid] === "" || drafts[sid] == null ? null : drafts[sid];
        }
        if (row && paymentFieldsDirty(sid, amounts, row)) {
          patch.coinsurance_amount = a.coinsurance_amount || "";
          patch.copay_amount = a.copay_amount || "";
          patch.deductible_amount = a.deductible_amount || "";
          patch.payer_paid_amount = a.payer_paid_amount || "";
          patch.check_number = a.check_number || "";
        }
        if (row && apFieldsDirty(sid, amounts, row)) {
          patch.ap_invoice = a.ap_invoice || "";
          patch.ap_date = a.ap_date || "";
        }
        return patch;
      });
      const res = await mahaverseFetch("/session-log.php", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.message || "Failed to save changes");
        return;
      }
      toast.success(`Saved ${json.updated || rows.length} row(s)`);
      await load();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save changes");
    } finally {
      setSavingChanges(false);
    }
  };

  const bulkSetStatus = async (logStatus) => {
    if (selectedRowIds.length === 0) {
      toast.error("Select at least one row");
      return;
    }
    if (logStatus === "Received Payment") {
      for (const sid of selectedRowIds) {
        const a = amounts[sid] || emptyAmountRow();
        const paid = String(a.payer_paid_amount ?? "").trim();
        const check = String(a.check_number ?? "").trim();
        if (!paid || !check) {
          toast.error(
            `Session #${sid}: enter payer paid $ and check # before Received Payment`
          );
          return;
        }
      }
    }
    setBulkBusy(true);
    try {
      const rows = selectedRowIds.map((sid) => {
        const a = amounts[sid] || emptyAmountRow();
        const patch = {
          session_id: Number(sid),
          log_status: logStatus,
        };
        if (logStatus === "Received Payment" || logStatus === "Pending Payment") {
          patch.payer_paid_amount = a.payer_paid_amount || "";
          patch.check_number = a.check_number || "";
          patch.coinsurance_amount = a.coinsurance_amount || "";
          patch.copay_amount = a.copay_amount || "";
          patch.deductible_amount = a.deductible_amount || "";
          patch.ap_invoice = a.ap_invoice || "";
          patch.ap_date = a.ap_date || "";
        }
        return patch;
      });
      const res = await mahaverseFetch("/session-log.php", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.message || "Failed to update status");
        return;
      }
      toast.success(
        logStatus === "clear" || logStatus === null
          ? `Moved ${json.updated || rows.length} row(s) back to Rendered`
          : `Moved ${json.updated || rows.length} row(s) to ${logStatus}`
      );
      await load();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update status");
    } finally {
      setBulkBusy(false);
    }
  };

  const inputFilterClass = "h-8 text-xs bg-white";
  const showCheckFilter =
    activeStatus === "Pending Payment" ||
    activeStatus === "Received Payment";

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">DOS From</Label>
              <Input
                type="date"
                className={inputFilterClass}
                value={filterDosFrom}
                onChange={(e) => setFilterDosFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">DOS To</Label>
              <Input
                type="date"
                className={inputFilterClass}
                value={filterDosTo}
                onChange={(e) => setFilterDosTo(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Client</Label>
              <Input
                className={inputFilterClass}
                placeholder="Search client…"
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Staff</Label>
              <Input
                className={inputFilterClass}
                placeholder="Search staff…"
                value={filterStaff}
                onChange={(e) => setFilterStaff(e.target.value)}
              />
            </div>
            {showCheckFilter && (
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">Check #</Label>
                <Input
                  className={inputFilterClass}
                  placeholder="Search check #…"
                  value={filterCheckNumber}
                  onChange={(e) => setFilterCheckNumber(e.target.value)}
                />
              </div>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-slate-200"
              onClick={load}
              disabled={loading}
            >
              Apply filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v);
            setSelectedRowIds([]);
          }}
        >
          <TabsList className="flex flex-wrap h-auto gap-1 bg-slate-100 p-1">
            {SESSION_LOG_STATUSES.map((status) => (
              <TabsTrigger
                key={status}
                value={tabSlug(status)}
                className="text-xs data-[state=active]:bg-white"
              >
                {status}
                <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                  {counts[status] ?? 0}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          {showSaveChanges && (
            <Button
              type="button"
              size="sm"
              className="bg-teal-600 hover:bg-teal-700"
              disabled={savingChanges || dirtyRowIds.length === 0}
              onClick={saveChanges}
            >
              {savingChanges
                ? "Saving…"
                : `Save Changes${dirtyRowIds.length > 0 ? ` (${dirtyRowIds.length})` : ""}`}
            </Button>
          )}
          {activeStatus === "Rendered" && (
            <Button
              type="button"
              size="sm"
              className="bg-teal-600 hover:bg-teal-700"
              disabled={bulkBusy || selectedRowIds.length === 0}
              onClick={() => bulkSetStatus("Pending Payment")}
            >
              Pending Payments
            </Button>
          )}
          {activeStatus === "Pending Payment" && (
            <>
              <Button
                type="button"
                size="sm"
                className="bg-teal-600 hover:bg-teal-700"
                disabled={bulkBusy || selectedRowIds.length === 0}
                onClick={() => bulkSetStatus("Received Payment")}
              >
                Received Payments
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-slate-300"
                disabled={bulkBusy || selectedRowIds.length === 0}
                onClick={() => bulkSetStatus("clear")}
              >
                Back to Rendered
              </Button>
            </>
          )}
          {activeStatus === "Received Payment" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-slate-300"
              disabled={bulkBusy || selectedRowIds.length === 0}
              onClick={() => bulkSetStatus("Pending Payment")}
            >
              Back to Pending
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 animate-pulse">Loading session log…</p>
      ) : (
        <SessionLogTable
          activeStatus={activeStatus}
          filteredRows={rowsForActiveTab}
          showRowCheckboxes={showRowCheckboxes}
          canEditMisc={canEditMisc}
          canEditPayment={canEditPayment}
          canEditAp={canEditAp}
          selectedRowIds={selectedRowIds}
          dirtyRowIds={dirtyRowIds}
          allVisibleSelected={allVisibleSelected}
          toggleSelectAllVisible={toggleSelectAllVisible}
          toggleRowSelection={toggleRowSelection}
          drafts={drafts}
          setMiscDraft={setMiscDraft}
          amounts={amounts}
          setPaymentField={setPaymentField}
          inputFilterClass={inputFilterClass}
        />
      )}
    </div>
  );
}
