"use client";

import { mahaverseFetch } from "@/lib/mahaverse-api";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "lucide-react";
import toast from "react-hot-toast";
import { reportDosInRange } from "@/lib/report-dos-format";
import { fetchClientsUtil } from "@/app/utils/fetchClients";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ScheduleTrackerTable from "./schedule-tracker-table";
import { formatMoneyDisplay } from "./schedule-tracker-table-utils";
import ReportFilterMultiSelect from "./report-filter-multi-select";
import {
  clientFilterKey,
  clientOptionLabelFromRow,
  rowMatchesClients,
  rowMatchesStaff,
  staffFilterKey,
  staffOptionLabelFromRow,
  uniquePersonOptionsFromRows,
} from "./report-person-filter-utils";
import {
  SCHEDULE_TRACKER_STATUSES,
  normalizeTrackerStatus,
} from "./report-column-exclusions";

function rowMatchesServiceCodes(row, selectedCodes) {
  if (!selectedCodes.length) return true;
  const code = String(row.service_code_with_modifiers ?? "").trim();
  return code !== "" && selectedCodes.includes(code);
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

const inputFilterClass =
  "border-slate-200 focus:border-teal-500 focus:ring-teal-500 focus-visible:ring-teal-500";

function defaultDosFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function defaultDosTo() {
  return new Date().toISOString().slice(0, 10);
}

function checkNumberForRow(rowId, amounts, savedPayments) {
  const pk = String(rowId);
  const draft = amounts[pk]?.check_number;
  if (draft != null && String(draft).trim() !== "") return String(draft).trim();
  const saved = savedPayments.find((s) => String(s.report_id) === pk);
  return saved?.check_number != null ? String(saved.check_number).trim() : "";
}

function rowPassesTableFilters(
  row,
  {
    selectedClientIds,
    selectedStaffIds,
    selectedServiceCodes,
    filterDosFrom,
    filterDosTo,
    filterCheckNumber,
    amounts,
    savedPayments,
    referenceRowsForClient,
    referenceRowsForStaff,
    applyCheckFilter,
  }
) {
  if (!rowMatchesClients(row, selectedClientIds, referenceRowsForClient)) return false;
  if (!rowMatchesStaff(row, selectedStaffIds, referenceRowsForStaff)) return false;
  if (!rowMatchesServiceCodes(row, selectedServiceCodes)) return false;
  const fromQ = filterDosFrom.trim();
  const toQ = filterDosTo.trim();
  if (fromQ || toQ) {
    if (!reportDosInRange(row.dos, fromQ, toQ)) return false;
  }
  if (applyCheckFilter && filterCheckNumber.trim()) {
    const ck = checkNumberForRow(row.id, amounts, savedPayments).toLowerCase();
    if (!ck.includes(filterCheckNumber.trim().toLowerCase())) return false;
  }
  return true;
}

const TAB_SLUGS = {
  Pending: "pending",
  Reviewed: "reviewed",
  Excluded: "excluded",
  "Pending Payment": "pending-payment",
  "Received Payment": "received-payment",
};

function authHeaders() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("aba_token");
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
    "X-Auth-Token": token,
  };
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

function savedPaymentField(saved, field) {
  if (!saved || saved[field] == null) return "";
  if (field === "ap_date" && saved[field]) {
    return String(saved[field]).slice(0, 10);
  }
  return String(saved[field]);
}

function paymentFieldsDirty(reportId, amounts, savedPayments) {
  const pk = String(reportId);
  const draft = amounts[pk];
  if (!draft) return false;
  const saved = savedPayments.find((s) => String(s.report_id) === pk);
  return PAYMENT_AMOUNT_FIELDS.some((field) => {
    const d = String(draft[field] ?? "").trim();
    const s = savedPaymentField(saved, field).trim();
    if (field === "check_number") return d !== s;
    const dn = d === "" ? "" : formatMoneyDisplay(d);
    const sn = s === "" ? "" : formatMoneyDisplay(s);
    return dn !== sn;
  });
}

function apFieldsDirty(reportId, amounts, savedPayments) {
  const pk = String(reportId);
  const draft = amounts[pk];
  if (!draft) return false;
  const saved = savedPayments.find((s) => String(s.report_id) === pk);
  return AP_FIELDS.some((field) => {
    const d = String(draft[field] ?? "").trim();
    const s = savedPaymentField(saved, field).trim();
    return d !== s;
  });
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

function rowHasLinkedIds(row) {
  return (
    String(row.client_id ?? "").trim() !== "" &&
    String(row.provider_id ?? "").trim() !== ""
  );
}

function tabSlug(status) {
  return TAB_SLUGS[status] ?? "pending";
}

function trackerStatusUsesCheckFilter(status) {
  return (
    status === "Pending" ||
    status === "Reviewed" ||
    status === "Excluded" ||
    status === "Pending Payment" ||
    status === "Received Payment"
  );
}

function statusFromSlug(slug) {
  const entry = Object.entries(TAB_SLUGS).find(([, s]) => s === slug);
  return entry ? entry[0] : "Pending";
}

function formatFilterDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function labelsForSelectedOptions(selected, options) {
  if (!selected.length) return [];
  const byValue = new Map(options.map((o) => [o.value, o.label]));
  return selected.map((v) => byValue.get(v) || v).filter(Boolean);
}

function TrackerContextBar({
  activeStatus,
  filteredCount,
  tabCount,
  totalCount,
  filterDosFrom,
  filterDosTo,
  selectedClientIds,
  selectedStaffIds,
  selectedServiceCodes,
  filterCheckNumber,
  clientOptions,
  staffOptions,
  serviceCodeOptions,
}) {
  const clientLabels = labelsForSelectedOptions(selectedClientIds, clientOptions);
  const staffLabels = labelsForSelectedOptions(selectedStaffIds, staffOptions);
  const codeLabels = labelsForSelectedOptions(selectedServiceCodes, serviceCodeOptions);
  const checkQ = filterCheckNumber.trim();

  const chips = [
    { key: "tab", label: "Tab", value: activeStatus },
    {
      key: "dos",
      label: "DOS",
      value: `${formatFilterDate(filterDosFrom)} – ${formatFilterDate(filterDosTo)}`,
    },
    clientLabels.length
      ? { key: "clients", label: "Client", value: clientLabels.join(", ") }
      : null,
    staffLabels.length ? { key: "staff", label: "Staff", value: staffLabels.join(", ") } : null,
    codeLabels.length
      ? { key: "codes", label: "Service code", value: codeLabels.join(", ") }
      : null,
    checkQ ? { key: "check", label: "Check #", value: `"${checkQ}"` } : null,
  ].filter(Boolean);

  return (
    <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-white/90">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <p className="font-medium text-slate-800">
          Showing {filteredCount} of {tabCount} row{tabCount === 1 ? "" : "s"} on{" "}
          <span className="text-teal-700">{activeStatus}</span>
          <span className="font-normal text-slate-500"> ({totalCount} total loaded)</span>
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex max-w-[min(100%,20rem)] items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-slate-600"
              title={`${chip.label}: ${chip.value}`}
            >
              <span className="shrink-0 font-medium text-slate-500">{chip.label}:</span>
              <span className="truncate">{chip.value}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ScheduleTrackerGrid({ onRegisterReload, onLoadingChange }) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingChanges, setSavingChanges] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState([]);
  const [selectedServiceCodes, setSelectedServiceCodes] = useState([]);
  const [filterDosFrom, setFilterDosFrom] = useState(defaultDosFrom);
  const [filterDosTo, setFilterDosTo] = useState(defaultDosTo);
  const [filterCheckNumber, setFilterCheckNumber] = useState("");
  const [activeTab, setActiveTab] = useState(tabSlug("Pending"));
  const [selectedRowIds, setSelectedRowIds] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [clients, setClients] = useState([]);
  const [paymentClientId, setPaymentClientId] = useState("");
  const [insuranceId, setInsuranceId] = useState("");
  const [amounts, setAmounts] = useState({});
  const [savedPayments, setSavedPayments] = useState([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const q = new URLSearchParams({
        archived: "0",
        context: "schedule_tracker",
      });
      const res = await mahaverseFetch(`/reports.php?${q.toString()}`);
      const json = await res.json();
      if (!json.success) {
        toast.error(json.message || "Failed to load schedule tracker");
        setAllRows([]);
        return;
      }
      setAllRows(
        Array.isArray(json.data)
          ? json.data.map((r) => ({
              ...r,
              tracker_status: normalizeTrackerStatus(r.tracker_status),
            }))
          : []
      );
    } catch (e) {
      console.error(e);
      toast.error("Failed to load schedule tracker");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  const loadSavedPayments = useCallback(async () => {
    try {
      const q = new URLSearchParams({ context: "schedule_tracker" });
      const res = await mahaverseFetch(`/payer-payment-entries.php?${q.toString()}`, {
        headers: { ...authHeaders() },
      });
      const json = await res.json();
      setSavedPayments(json.success && Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      console.error(e);
      setSavedPayments([]);
    }
  }, []);

  useEffect(() => {
    load();
    loadSavedPayments();
  }, [load, loadSavedPayments]);

  useEffect(() => {
    onRegisterReload?.(load);
    return () => onRegisterReload?.(null);
  }, [load, onRegisterReload]);

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  const loadClientsForPayments = useCallback(async () => {
    try {
      const idSet = new Set();
      for (const r of allRows) {
        if (normalizeTrackerStatus(r.tracker_status) !== "Reviewed") continue;
        const cid = String(r.client_id ?? "").trim();
        if (cid) idSet.add(cid);
      }
      let crmList = await fetchClientsUtil();
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
          const sample = allRows.find((r) => String(r.client_id ?? "").trim() === id);
          byId.set(id, {
            client_id: id,
            first_name: sample?.client_first_name ?? "",
            last_name: sample?.client_last_name ?? "",
            insurances: [],
          });
        }
      }
      setClients(
        Array.from(byId.values()).sort((a, b) =>
          `${a.first_name || ""} ${a.last_name || ""}`
            .trim()
            .localeCompare(`${b.first_name || ""} ${b.last_name || ""}`.trim())
        )
      );
    } catch (e) {
      console.error(e);
      setClients([]);
    }
  }, [allRows]);

  useEffect(() => {
    const tab = statusFromSlug(activeTab);
    if (
      tab === "Reviewed" ||
      tab === "Pending Payment" ||
      tab === "Received Payment"
    ) {
      loadClientsForPayments();
      loadSavedPayments();
    }
  }, [activeTab, loadClientsForPayments, loadSavedPayments]);

  const paymentClient = useMemo(
    () => clients.find((c) => String(c.client_id) === String(paymentClientId)),
    [clients, paymentClientId]
  );

  const insurances = useMemo(() => {
    if (!paymentClient?.insurances?.length) return [];
    return paymentClient.insurances;
  }, [paymentClient]);

  useEffect(() => {
    const paymentStatuses = new Set(["Reviewed", "Pending Payment", "Received Payment"]);
    const paymentRows = allRows.filter((r) =>
      paymentStatuses.has(normalizeTrackerStatus(r.tracker_status))
    );
    const fromSaved = {};
    for (const s of savedPayments) {
      if (s.report_id != null && String(s.report_id) !== "") {
        fromSaved[String(s.report_id)] = {
          coinsurance_amount: savedPaymentField(s, "coinsurance_amount"),
          copay_amount: savedPaymentField(s, "copay_amount"),
          deductible_amount: savedPaymentField(s, "deductible_amount"),
          payer_paid_amount: savedPaymentField(s, "payer_paid_amount"),
          check_number: savedPaymentField(s, "check_number"),
          ap_invoice: savedPaymentField(s, "ap_invoice"),
          ap_date: savedPaymentField(s, "ap_date"),
        };
      }
    }
    setAmounts((prev) => {
      const next = { ...prev };
      for (const r of paymentRows) {
        const id = String(r.id);
        if (fromSaved[id]) {
          next[id] = { ...fromSaved[id] };
        } else if (!next[id]) {
          next[id] = emptyAmountRow();
        }
      }
      return next;
    });
  }, [allRows, savedPayments]);

  const activeStatus = statusFromSlug(activeTab);

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(SCHEDULE_TRACKER_STATUSES.map((s) => [s, 0]));
    for (const status of SCHEDULE_TRACKER_STATUSES) {
      const rowsInStatus = allRows.filter(
        (r) => normalizeTrackerStatus(r.tracker_status) === status
      );
      const applyCheckFilter = trackerStatusUsesCheckFilter(status);
      for (const r of rowsInStatus) {
        if (
          rowPassesTableFilters(r, {
            selectedClientIds,
            selectedStaffIds,
            selectedServiceCodes,
            filterDosFrom,
            filterDosTo,
            filterCheckNumber,
            amounts,
            savedPayments,
            referenceRowsForClient: rowsInStatus,
            referenceRowsForStaff: rowsInStatus,
            applyCheckFilter,
          })
        ) {
          counts[status] = (counts[status] ?? 0) + 1;
        }
      }
    }
    return counts;
  }, [
    allRows,
    selectedClientIds,
    selectedStaffIds,
    selectedServiceCodes,
    filterDosFrom,
    filterDosTo,
    filterCheckNumber,
    amounts,
    savedPayments,
  ]);

  const rowsForActiveTab = useMemo(() => {
    return allRows.filter(
      (r) => normalizeTrackerStatus(r.tracker_status) === activeStatus
    );
  }, [allRows, activeStatus]);

  const clientOptionsFromRows = useMemo(
    () =>
      uniquePersonOptionsFromRows(rowsForActiveTab, {
        keyFn: clientFilterKey,
        labelFn: clientOptionLabelFromRow,
      }),
    [rowsForActiveTab]
  );

  useEffect(() => {
    const valid = new Set(clientOptionsFromRows.map((o) => o.value));
    setSelectedClientIds((prev) => prev.filter((id) => valid.has(id)));
  }, [clientOptionsFromRows]);

  const staffOptionsFromRows = useMemo(
    () =>
      uniquePersonOptionsFromRows(rowsForActiveTab, {
        keyFn: staffFilterKey,
        labelFn: staffOptionLabelFromRow,
      }),
    [rowsForActiveTab]
  );

  useEffect(() => {
    const valid = new Set(staffOptionsFromRows.map((o) => o.value));
    setSelectedStaffIds((prev) => prev.filter((id) => valid.has(id)));
  }, [staffOptionsFromRows]);

  const serviceCodeOptionsFromRows = useMemo(() => {
    const codes = new Set();
    for (const r of rowsForActiveTab) {
      const c = String(r.service_code_with_modifiers ?? "").trim();
      if (c) codes.add(c);
    }
    return Array.from(codes)
      .sort((a, b) => a.localeCompare(b))
      .map((c) => ({ value: c, label: c }));
  }, [rowsForActiveTab]);

  useEffect(() => {
    const valid = new Set(serviceCodeOptionsFromRows.map((o) => o.value));
    setSelectedServiceCodes((prev) => prev.filter((c) => valid.has(c)));
  }, [serviceCodeOptionsFromRows]);

  const filteredRows = useMemo(() => {
    const applyCheckFilter = trackerStatusUsesCheckFilter(activeStatus);

    return rowsForActiveTab.filter((r) =>
      rowPassesTableFilters(r, {
        selectedClientIds,
        selectedStaffIds,
        selectedServiceCodes,
        filterDosFrom,
        filterDosTo,
        filterCheckNumber,
        amounts,
        savedPayments,
        referenceRowsForClient: rowsForActiveTab,
        referenceRowsForStaff: rowsForActiveTab,
        applyCheckFilter,
      })
    );
  }, [
    rowsForActiveTab,
    selectedClientIds,
    selectedStaffIds,
    selectedServiceCodes,
    filterDosFrom,
    filterDosTo,
    filterCheckNumber,
    activeStatus,
    amounts,
    savedPayments,
  ]);

  useEffect(() => {
    const visible = new Set(filteredRows.map((r) => r.id));
    setSelectedRowIds((prev) => prev.filter((id) => visible.has(id)));
  }, [filteredRows, activeTab]);

  const showRowCheckboxes =
    activeStatus === "Pending" ||
    activeStatus === "Reviewed" ||
    activeStatus === "Pending Payment" ||
    activeStatus === "Received Payment";
  const canEditMisc =
    activeStatus === "Pending" ||
    activeStatus === "Reviewed" ||
    activeStatus === "Pending Payment";
  const canEditPayment =
    activeStatus === "Reviewed" || activeStatus === "Pending Payment";
  const canEditAp = activeStatus === "Received Payment";
  const canSaveChanges = canEditMisc || canEditPayment || canEditAp;
  const allVisibleSelected =
    showRowCheckboxes &&
    filteredRows.length > 0 &&
    filteredRows.every((r) => selectedRowIds.includes(r.id));

  const miscHrsDirtySelectedIds = useMemo(() => {
    return selectedRowIds.filter((id) => {
      if (drafts[id] === undefined) return false;
      const row = allRows.find((r) => r.id === id);
      if (!row) return false;
      const saved =
        row.misc_hrs != null && row.misc_hrs !== "" ? String(row.misc_hrs).trim() : "";
      return String(drafts[id]).trim() !== saved;
    });
  }, [selectedRowIds, drafts, allRows]);

  const dirtyRowIds = useMemo(() => {
    const ids = new Set();
    for (const id of selectedRowIds) {
      if (miscHrsDirtySelectedIds.includes(id)) ids.add(id);
      if (paymentFieldsDirty(id, amounts, savedPayments)) ids.add(id);
      if (apFieldsDirty(id, amounts, savedPayments)) ids.add(id);
    }
    return Array.from(ids);
  }, [selectedRowIds, miscHrsDirtySelectedIds, amounts, savedPayments]);

  const toggleRowSelection = (id) => {
    setSelectedRowIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllVisible = () => {
    if (!showRowCheckboxes) return;
    if (allVisibleSelected) {
      const visible = new Set(filteredRows.map((r) => r.id));
      setSelectedRowIds((prev) => prev.filter((id) => !visible.has(id)));
    } else {
      const ids = filteredRows.map((r) => r.id);
      setSelectedRowIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  const bulkSetStatus = async (status) => {
    if (selectedRowIds.length === 0) {
      toast.error("Select at least one row");
      return;
    }
    setBulkBusy(true);
    try {
      const res = await mahaverseFetch("/reports.php", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bulk: true,
          ids: selectedRowIds,
          tracker_status: status,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.message || "Update failed");
        return;
      }
      toast.success(`Marked ${selectedRowIds.length} row(s) as ${status}`);
      setSelectedRowIds([]);
      await load();
      await loadSavedPayments();
    } catch (e) {
      console.error(e);
      toast.error("Update failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const markReviewed = async () => {
    if (selectedRowIds.length === 0) {
      toast.error("Select at least one row");
      return;
    }
    const selected = allRows.filter((r) => selectedRowIds.includes(r.id));
    const missing = selected.filter((r) => !rowHasLinkedIds(r));
    if (missing.length > 0) {
      const ids = missing.map((r) => r.id).join(", ");
      toast.error(
        `${missing.length} row(s) missing Client ID or Provider ID (report #${ids})`,
        { duration: 6000 }
      );
      return;
    }
    await bulkSetStatus("Reviewed");
  };

  const postPendingPayment = async () => {
    if (!paymentClientId || !insuranceId) {
      toast.error("Select a client and insurance (payer) before posting payment");
      return;
    }
    if (selectedRowIds.length === 0) {
      toast.error("Select at least one row");
      return;
    }
    const entries = [];
    for (const id of selectedRowIds) {
      const r = allRows.find((row) => row.id === id);
      if (!r || normalizeTrackerStatus(r.tracker_status) !== "Reviewed") continue;
      const cid = String(r.client_id ?? "").trim();
      if (cid !== String(paymentClientId).trim()) {
        toast.error(`Report #${id} does not match the selected client`);
        return;
      }
      const pk = String(id);
      const a = amounts[pk] || emptyAmountRow();
      const paid = String(a.payer_paid_amount ?? "").trim();
      const check = String(a.check_number ?? "").trim();
      if (!paid || !check) {
        toast.error(`Report #${id}: payer paid amount and check # are required`);
        return;
      }
      entries.push({
        report_id: r.id,
        client_id: paymentClientId,
        insurance_id: Number(insuranceId),
        dos: r.dos ? String(r.dos).slice(0, 10) : "",
        service_code: r.service_code_with_modifiers || "",
        coinsurance_amount: a.coinsurance_amount || "",
        copay_amount: a.copay_amount || "",
        deductible_amount: a.deductible_amount || "",
        payer_paid_amount: paid,
        check_number: check,
      });
    }
    if (entries.length === 0) {
      toast.error("No reviewed rows selected for this client");
      return;
    }
    setBulkBusy(true);
    try {
      const res = await mahaverseFetch("/payer-payment-entries.php", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ entries }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.message || "Payment post failed");
        return;
      }
      toast.success(`Posted payment for ${entries.length} row(s)`);
      setSelectedRowIds([]);
      await load();
      await loadSavedPayments();
    } catch (e) {
      console.error(e);
      toast.error("Payment post failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkMarkReceived = async () => {
    if (selectedRowIds.length === 0) {
      toast.error("Select at least one row");
      return;
    }
    setBulkBusy(true);
    try {
      const res = await mahaverseFetch("/payer-payment-entries.php", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          action: "mark_cleared",
          report_ids: selectedRowIds,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.message || "Update failed");
        return;
      }
      toast.success(`Marked ${selectedRowIds.length} row(s) as Received Payment`);
      setSelectedRowIds([]);
      await load();
      await loadSavedPayments();
    } catch (e) {
      console.error(e);
      toast.error("Update failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const setPaymentField = (reportPk, field, value) => {
    setAmounts((prev) => ({
      ...prev,
      [reportPk]: {
        ...(prev[reportPk] || emptyAmountRow()),
        [field]: value,
      },
    }));
    setSelectedRowIds((prev) =>
      prev.includes(reportPk) ? prev : [...prev, reportPk]
    );
  };

  const amountForRow = (rowId) => {
    const pk = String(rowId);
    if (amounts[pk]) return amounts[pk];
    const saved = savedPayments.find((s) => String(s.report_id) === pk);
    if (!saved) return emptyAmountRow();
    return {
      coinsurance_amount: savedPaymentField(saved, "coinsurance_amount"),
      copay_amount: savedPaymentField(saved, "copay_amount"),
      deductible_amount: savedPaymentField(saved, "deductible_amount"),
      payer_paid_amount: savedPaymentField(saved, "payer_paid_amount"),
      check_number: savedPaymentField(saved, "check_number"),
      ap_invoice: savedPaymentField(saved, "ap_invoice"),
      ap_date: savedPaymentField(saved, "ap_date"),
    };
  };

  function resolvePaymentContext(rowId) {
    const saved = savedPayments.find((s) => String(s.report_id) === String(rowId));
    return {
      client_id: saved?.client_id
        ? String(saved.client_id)
        : String(paymentClientId || "").trim(),
      insurance_id: saved?.insurance_id
        ? Number(saved.insurance_id)
        : insuranceId
          ? Number(insuranceId)
          : 0,
    };
  }

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
    setSelectedStaffIds([]);
    setSelectedServiceCodes([]);
    setFilterDosFrom(defaultDosFrom());
    setFilterDosTo(defaultDosTo());
    setFilterCheckNumber("");
  };

  const setMiscDraft = (id, value) => {
    setDrafts((d) => ({ ...d, [id]: value }));
    setSelectedRowIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const saveChanges = async () => {
    const miscIds = miscHrsDirtySelectedIds;
    const paymentIds = selectedRowIds.filter((id) =>
      paymentFieldsDirty(id, amounts, savedPayments)
    );
    const apIds = selectedRowIds.filter((id) => apFieldsDirty(id, amounts, savedPayments));

    if (miscIds.length === 0 && paymentIds.length === 0 && apIds.length === 0) {
      toast.error("Edit misc hrs, payment $ values, check #, or AP fields on selected rows");
      return;
    }

    setSavingChanges(true);
    try {
      let miscSaved = 0;
      for (const id of miscIds) {
        const raw = drafts[id];
        const miscVal = raw === "" || raw == null ? null : raw;
        const res = await mahaverseFetch("/reports.php", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, misc_hrs: miscVal }),
        });
        const json = await res.json();
        if (!json.success) {
          toast.error(json.message || `Save failed for row ${id}`);
          return;
        }
        miscSaved += 1;
      }

      if (paymentIds.length > 0) {
        const entries = [];
        for (const id of paymentIds) {
          const r = allRows.find((row) => row.id === id);
          if (!r) continue;
          const ctx = resolvePaymentContext(id);
          if (!ctx.client_id || !ctx.insurance_id) {
            toast.error(
              `Row #${id}: select client and insurance (payer) before saving payment values`
            );
            return;
          }
          const pk = String(id);
          const a = amounts[pk] || emptyAmountRow();
          entries.push({
            report_id: r.id,
            client_id: ctx.client_id,
            insurance_id: ctx.insurance_id,
            dos: r.dos ? String(r.dos).slice(0, 10) : "",
            service_code: r.service_code_with_modifiers || "",
            coinsurance_amount: a.coinsurance_amount || "",
            copay_amount: a.copay_amount || "",
            deductible_amount: a.deductible_amount || "",
            payer_paid_amount: a.payer_paid_amount || "",
            check_number: a.check_number || "",
          });
        }
        if (entries.length > 0) {
          const res = await mahaverseFetch("/payer-payment-entries.php", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ save_only: true, entries }),
          });
          const json = await res.json();
          if (!json.success) {
            toast.error(json.message || "Payment save failed");
            return;
          }
        }
      }

      if (apIds.length > 0) {
        const apEntries = apIds.map((id) => {
          const pk = String(id);
          const a = amounts[pk] || emptyAmountRow();
          return {
            report_id: id,
            ap_invoice: a.ap_invoice || "",
            ap_date: a.ap_date || "",
          };
        });
        const res = await mahaverseFetch("/payer-payment-entries.php", {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ action: "save_ap", entries: apEntries }),
        });
        const json = await res.json();
        if (!json.success) {
          toast.error(json.message || "AP save failed");
          return;
        }
      }

      setDrafts((d) => {
        const next = { ...d };
        for (const id of miscIds) delete next[id];
        return next;
      });
      const parts = [];
      if (miscSaved > 0) parts.push(`${miscSaved} misc hrs`);
      if (paymentIds.length > 0) parts.push(`${paymentIds.length} payment`);
      if (apIds.length > 0) parts.push(`${apIds.length} AP`);
      toast.success(`Saved changes (${parts.join(", ")})`);
      await load();
      await loadSavedPayments();
    } catch (e) {
      console.error(e);
      toast.error("Save failed");
    } finally {
      setSavingChanges(false);
    }
  };

  const hasActiveFilters =
    selectedClientIds.length > 0 ||
    selectedStaffIds.length > 0 ||
    selectedServiceCodes.length > 0 ||
    filterDosFrom !== defaultDosFrom() ||
    filterDosTo !== defaultDosTo() ||
    filterCheckNumber.trim() !== "";
  const showCheckFilter = trackerStatusUsesCheckFilter(activeStatus);

  return (
    <div className="space-y-4">
      <Card className="shadow-lg border-0">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:gap-4">
            <div className="w-full lg:flex-1 lg:min-w-[14rem] lg:max-w-md">
              <ReportFilterMultiSelect
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
              <ReportFilterMultiSelect
                options={staffOptionsFromRows}
                selected={selectedStaffIds}
                onChange={setSelectedStaffIds}
                placeholder={
                  staffOptionsFromRows.length === 0
                    ? "No staff in loaded rows"
                    : "All staff in table"
                }
                disabled={loading || staffOptionsFromRows.length === 0}
                searchPlaceholder="Search staff…"
                emptySearchMessage="No staff found"
              />
            </div>
            <div className="w-full lg:w-52 lg:min-w-[12rem] min-w-0">
              <ReportFilterMultiSelect
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
            <div className="w-full lg:w-44 min-w-[10rem]">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none z-[1]" />
                <Input
                  type="date"
                  className={`pl-10 ${inputFilterClass}`}
                  value={filterDosFrom}
                  onChange={(e) => setFilterDosFrom(e.target.value)}
                  aria-label="DOS from"
                  title="DOS from"
                />
              </div>
            </div>
            <div className="w-full lg:w-44 min-w-[10rem]">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none z-[1]" />
                <Input
                  type="date"
                  className={`pl-10 ${inputFilterClass}`}
                  value={filterDosTo}
                  onChange={(e) => setFilterDosTo(e.target.value)}
                  aria-label="DOS to"
                  title="DOS to"
                />
              </div>
            </div>
            {showCheckFilter && (
              <div className="w-full lg:w-44 min-w-[10rem]">
                <Input
                  type="search"
                  className={inputFilterClass}
                  placeholder="Search check #"
                  value={filterCheckNumber}
                  onChange={(e) => setFilterCheckNumber(e.target.value)}
                  aria-label="Search by check number"
                />
              </div>
            )}
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
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Use Import Excel to upload a .xlsx file — all rows from the first sheet are added as
            Pending. DOS defaults to the last 7 days through today. Tab counts use the same filters
            as the table (client, staff, service code, DOS, check #). Client, staff, and service code lists come
            from the current tab only.
            {hasActiveFilters &&
              ` Showing ${filteredRows.length} of ${rowsForActiveTab.length} row(s) on this tab (${allRows.length} total).`}
          </p>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-slate-100 p-1">
          {SCHEDULE_TRACKER_STATUSES.map((status) => (
            <TabsTrigger
              key={status}
              value={tabSlug(status)}
              className="text-xs sm:text-sm data-[state=active]:bg-white"
            >
              {status}
              <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                {statusCounts[status] ?? 0}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {(showRowCheckboxes || canSaveChanges) && (
          <div className="flex flex-wrap items-center gap-2">
            {showRowCheckboxes && (
              <span className="text-sm text-slate-600">
                {selectedRowIds.length} selected
              </span>
            )}
            {canSaveChanges && (
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
            {activeStatus === "Pending" && (
              <>
                <Button
                  type="button"
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700"
                  disabled={bulkBusy || selectedRowIds.length === 0}
                  onClick={markReviewed}
                >
                  Mark Reviewed
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-slate-300"
                  disabled={bulkBusy || selectedRowIds.length === 0}
                  onClick={() => bulkSetStatus("Excluded")}
                >
                  Mark Excluded
                </Button>
              </>
            )}
            {activeStatus === "Reviewed" && (
              <Button
                type="button"
                size="sm"
                className="bg-teal-600 hover:bg-teal-700"
                disabled={bulkBusy || selectedRowIds.length === 0}
                onClick={postPendingPayment}
              >
                Pending Payment
              </Button>
            )}
            {activeStatus === "Pending Payment" && (
              <>
                <Button
                  type="button"
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700"
                  disabled={bulkBusy || selectedRowIds.length === 0}
                  onClick={bulkMarkReceived}
                >
                  Received Payment
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-slate-300"
                  disabled={bulkBusy || selectedRowIds.length === 0}
                  onClick={() => bulkSetStatus("Reviewed")}
                >
                  Back Review
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
                onClick={() => bulkSetStatus("Reviewed")}
              >
                Back Review
              </Button>
            )}
          </div>
        )}

        {(activeStatus === "Reviewed" || activeStatus === "Pending Payment") && (
          <Card className="shadow border-0">
            <CardContent className="p-4">
              <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
                <div className="space-y-2">
                  <Label>Client (for payment posting)</Label>
                  <Select
                    value={paymentClientId === "" ? "__none__" : paymentClientId}
                    onValueChange={(v) => {
                      setPaymentClientId(v === "__none__" ? "" : v);
                      setInsuranceId("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="__none__">Select client…</SelectItem>
                      {clients.map((c) => (
                        <SelectItem key={c.client_id} value={String(c.client_id)}>
                          {c.first_name} {c.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Payer (insurance)</Label>
                  <Select
                    value={insuranceId === "" ? "__none__" : insuranceId}
                    onValueChange={(v) => setInsuranceId(v === "__none__" ? "" : v)}
                    disabled={!paymentClientId || insurances.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select insurance" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="__none__">Select insurance…</SelectItem>
                      {insurances.map((ins) => (
                        <SelectItem key={ins.insurance_id} value={String(ins.insurance_id)}>
                          {insuranceLabel(ins)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3">
                {activeStatus === "Reviewed"
                  ? "Enter payment amounts on rows below, then Save Changes or select rows and click Pending Payment."
                  : "Edit payment values as needed, Save Changes, then select rows and click Received Payment."}
              </p>
            </CardContent>
          </Card>
        )}

      <Card className="shadow-lg border-0 overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center">
              <p className="text-sm text-slate-500 animate-pulse">Loading schedule tracker…</p>
            </div>
          ) : (
            <>
              <TrackerContextBar
                activeStatus={activeStatus}
                filteredCount={filteredRows.length}
                tabCount={rowsForActiveTab.length}
                totalCount={allRows.length}
                filterDosFrom={filterDosFrom}
                filterDosTo={filterDosTo}
                selectedClientIds={selectedClientIds}
                selectedStaffIds={selectedStaffIds}
                selectedServiceCodes={selectedServiceCodes}
                filterCheckNumber={filterCheckNumber}
                clientOptions={clientOptionsFromRows}
                staffOptions={staffOptionsFromRows}
                serviceCodeOptions={serviceCodeOptionsFromRows}
              />
              <ScheduleTrackerTable
              activeStatus={activeStatus}
              filteredRows={filteredRows}
              rowsForActiveTab={rowsForActiveTab}
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
              amountForRow={amountForRow}
              savedPayments={savedPayments}
              trackerColumnTotals={trackerColumnTotals}
              inputFilterClass={inputFilterClass}
            />
            </>
          )}
        </CardContent>
      </Card>
      </Tabs>
    </div>
  );
}
