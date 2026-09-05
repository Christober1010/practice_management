"use client";

import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatReportDos } from "@/lib/report-dos-format";
import {
  formatMoneyDisplay,
  formatMoneyOnBlur,
  parseMoney,
} from "./schedule-tracker-table-utils";

export const SESSION_LOG_STATUSES = [
  "Scheduled",
  "Rendered",
  "Pending Payment",
  "Received Payment",
];

const COLUMN_LABELS = {
  dos: "DOS",
  client: "Client",
  staff: "Staff",
  auth_code: "Billing code",
  scheduled_hours: "Scheduled hrs",
  rendered_hours: "Rendered hrs",
  misc_hrs: "Misc hrs",
  diff: "Diff (Rend − Misc)",
  payer_paid: "Payer paid $",
  check_number: "Check #",
  ap_invoice: "AP Invoice",
  ap_date: "AP date",
  coinsurance: "Co-insurance $",
  copay: "Copay $",
  deductible: "Deductible $",
  location: "Location",
  claim_id: "Claim ID",
  claim_status: "Status",
  session_id: "Session ID",
};

/** Workflow status for the Session Log tab the row belongs to (not billing claim_status). */
function rowWorkflowStatus(row, activeStatus) {
  const tab = String(row?.tab || "").trim();
  if (SESSION_LOG_STATUSES.includes(tab)) return tab;
  const log = String(row?.log_status || "").trim();
  if (log === "Pending Payment" || log === "Received Payment") return log;
  if (String(row?.session_status || "").toLowerCase() === "rendered") {
    return "Rendered";
  }
  if (SESSION_LOG_STATUSES.includes(activeStatus)) return activeStatus;
  return "Scheduled";
}

const PAYMENT_MIDDLE = [
  "payer_paid",
  "check_number",
  "coinsurance",
  "copay",
  "deductible",
];
const RECEIVED_PAYMENT_MIDDLE = [
  "payer_paid",
  "check_number",
  "ap_invoice",
  "ap_date",
  "coinsurance",
  "copay",
  "deductible",
];

const HOUR_SUM_KEYS = new Set([
  "scheduled_hours",
  "rendered_hours",
  "misc_hrs",
  "diff",
]);

const MONEY_KEYS = new Set([
  "payer_paid",
  "coinsurance",
  "copay",
  "deductible",
]);

const PAYMENT_FIELD_MAP = {
  payer_paid: "payer_paid_amount",
  coinsurance: "coinsurance_amount",
  copay: "copay_amount",
  deductible: "deductible_amount",
  check_number: "check_number",
  ap_invoice: "ap_invoice",
  ap_date: "ap_date",
};

function columnsForStatus(activeStatus, { hideMiscAndDiff = false } = {}) {
  const base = [
    "dos",
    "client",
    "staff",
    "auth_code",
    "scheduled_hours",
    "rendered_hours",
  ];
  if (activeStatus === "Rendered") {
    if (!hideMiscAndDiff) base.push("misc_hrs", "diff");
  } else if (activeStatus === "Pending Payment") {
    if (!hideMiscAndDiff) base.push("misc_hrs", "diff");
    base.push(...PAYMENT_MIDDLE);
  } else if (activeStatus === "Received Payment") {
    if (!hideMiscAndDiff) base.push("misc_hrs", "diff");
    base.push(...RECEIVED_PAYMENT_MIDDLE);
  }
  base.push("location", "claim_id", "claim_status", "session_id");
  return base;
}

function parseHours(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatHours(value) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

function miscNumeric(row, drafts) {
  const raw =
    drafts[row.session_id] !== undefined
      ? drafts[row.session_id]
      : row.misc_hrs != null && row.misc_hrs !== ""
        ? String(row.misc_hrs)
        : "";
  if (raw === "" || raw == null) return 0;
  const n = Number(String(raw).trim());
  return Number.isFinite(n) ? n : 0;
}

function miscDisplay(row, drafts) {
  if (drafts[row.session_id] !== undefined) return drafts[row.session_id];
  if (row.misc_hrs != null && row.misc_hrs !== "") return String(row.misc_hrs);
  return "";
}

function rowDiff(row, drafts) {
  const rendered = parseHours(row.rendered_hours) ?? 0;
  return rendered - miscNumeric(row, drafts);
}

function amountForRow(row, amounts) {
  const pk = String(row.session_id);
  const draft = amounts?.[pk];
  const fromRow = {
    coinsurance_amount:
      row.coinsurance_amount != null && row.coinsurance_amount !== ""
        ? formatMoneyDisplay(row.coinsurance_amount)
        : "",
    copay_amount:
      row.copay_amount != null && row.copay_amount !== ""
        ? formatMoneyDisplay(row.copay_amount)
        : "",
    deductible_amount:
      row.deductible_amount != null && row.deductible_amount !== ""
        ? formatMoneyDisplay(row.deductible_amount)
        : "",
    payer_paid_amount:
      row.payer_paid_amount != null && row.payer_paid_amount !== ""
        ? formatMoneyDisplay(row.payer_paid_amount)
        : "",
    check_number: row.check_number != null ? String(row.check_number) : "",
    ap_invoice: row.ap_invoice != null ? String(row.ap_invoice) : "",
    ap_date:
      row.ap_date != null && row.ap_date !== ""
        ? String(row.ap_date).slice(0, 10)
        : "",
  };
  return draft ? { ...fromRow, ...draft } : fromRow;
}

function columnSums(rows, drafts, amounts, columns) {
  const sums = {};
  for (const key of columns) {
    if (HOUR_SUM_KEYS.has(key)) {
      let total = 0;
      for (const row of rows) {
        if (key === "misc_hrs") total += miscNumeric(row, drafts);
        else if (key === "diff") total += rowDiff(row, drafts);
        else total += parseHours(row[key]) ?? 0;
      }
      sums[key] = total;
    } else if (MONEY_KEYS.has(key)) {
      const field = PAYMENT_FIELD_MAP[key];
      let total = 0;
      for (const row of rows) {
        const pay = amountForRow(row, amounts);
        const n = parseMoney(pay[field]);
        if (n != null) total += n;
      }
      sums[key] = total;
    }
  }
  return sums;
}

export default function SessionLogTable({
  activeStatus,
  filteredRows,
  showRowCheckboxes,
  canEditMisc,
  canEditPayment,
  canEditAp,
  selectedRowIds,
  dirtyRowIds,
  allVisibleSelected,
  toggleSelectAllVisible,
  toggleRowSelection,
  drafts,
  setMiscDraft,
  amounts,
  setPaymentField,
  inputFilterClass,
  hideMiscAndDiff = false,
}) {
  const columns = columnsForStatus(activeStatus, { hideMiscAndDiff });
  const totalColCount = columns.length + (showRowCheckboxes ? 1 : 0);
  const firstSumIdx = columns.findIndex(
    (k) => HOUR_SUM_KEYS.has(k) || MONEY_KEYS.has(k)
  );
  const sumLabelColSpan =
    (showRowCheckboxes ? 1 : 0) +
    (firstSumIdx >= 0 ? firstSumIdx : columns.length);
  const sums = columnSums(filteredRows, drafts, amounts || {}, columns);
  const showSumRow = filteredRows.length > 0 && firstSumIdx >= 0;

  const cellClass = (key) =>
    cn(
      "px-2 py-1.5 align-middle",
      (HOUR_SUM_KEYS.has(key) || MONEY_KEYS.has(key)) && "text-right tabular-nums"
    );

  const renderCell = (row, key) => {
    const client = `${row.client_first_name || ""} ${row.client_last_name || ""}`.trim();
    const staff =
      `${row.staff_first_name || ""} ${row.staff_last_name || ""}`.trim() ||
      row.provider_name ||
      "";
    const pay = amountForRow(row, amounts || {});
    const field = PAYMENT_FIELD_MAP[key];

    switch (key) {
      case "dos":
        return formatReportDos(row.dos, row.start_utc) || row.dos || "—";
      case "client":
        return client || "—";
      case "staff":
        return staff || "—";
      case "auth_code":
        return row.auth_code || "—";
      case "scheduled_hours":
        return formatHours(row.scheduled_hours);
      case "rendered_hours":
        return formatHours(row.rendered_hours);
      case "misc_hrs":
        if (canEditMisc) {
          return (
            <Input
              type="number"
              step="0.25"
              min="0"
              className={cn("h-8 text-xs text-right", inputFilterClass)}
              value={miscDisplay(row, drafts)}
              onChange={(e) => setMiscDraft(row.session_id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          );
        }
        return formatHours(row.misc_hrs);
      case "diff":
        return rowDiff(row, drafts).toFixed(2);
      case "payer_paid":
      case "coinsurance":
      case "copay":
      case "deductible": {
        const value = pay[field] ?? "";
        if (canEditPayment) {
          return (
            <Input
              className={cn("h-8 w-24 text-xs text-right", inputFilterClass)}
              inputMode="decimal"
              value={value}
              onChange={(e) =>
                setPaymentField(row.session_id, field, e.target.value)
              }
              onBlur={(e) =>
                setPaymentField(
                  row.session_id,
                  field,
                  formatMoneyOnBlur(e.target.value)
                )
              }
              onClick={(e) => e.stopPropagation()}
            />
          );
        }
        return value !== "" ? formatMoneyDisplay(value) : "—";
      }
      case "check_number":
        if (canEditPayment) {
          return (
            <Input
              className={cn("h-8 w-28 text-xs", inputFilterClass)}
              value={pay.check_number || ""}
              onChange={(e) =>
                setPaymentField(row.session_id, "check_number", e.target.value)
              }
              onClick={(e) => e.stopPropagation()}
            />
          );
        }
        return pay.check_number || "—";
      case "ap_invoice":
        if (canEditAp) {
          return (
            <Input
              className={cn("h-8 w-28 text-xs", inputFilterClass)}
              value={pay.ap_invoice || ""}
              onChange={(e) =>
                setPaymentField(row.session_id, "ap_invoice", e.target.value)
              }
              onClick={(e) => e.stopPropagation()}
            />
          );
        }
        return pay.ap_invoice || "—";
      case "ap_date":
        if (canEditAp) {
          return (
            <Input
              type="date"
              className={cn("h-8 w-36 text-xs", inputFilterClass)}
              value={pay.ap_date || ""}
              onChange={(e) =>
                setPaymentField(row.session_id, "ap_date", e.target.value)
              }
              onClick={(e) => e.stopPropagation()}
            />
          );
        }
        return pay.ap_date || "—";
      case "location":
        return row.location_address || "—";
      case "claim_id":
        return row.claim_id || "—";
      case "claim_status":
        return rowWorkflowStatus(row, activeStatus);
      case "session_id":
        return row.session_id != null && row.session_id !== ""
          ? String(row.session_id)
          : "—";
      default:
        return "—";
    }
  };

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table
        className={cn(
          "w-full caption-bottom text-xs",
          columns.length > 12 ? "min-w-[90rem]" : "min-w-[56rem]"
        )}
      >
        <TableHeader>
          <TableRow className="bg-slate-50 hover:bg-slate-50">
            {showRowCheckboxes && (
              <TableHead className="w-10 px-2">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={toggleSelectAllVisible}
                  aria-label="Select all"
                />
              </TableHead>
            )}
            {columns.map((key) => (
              <TableHead
                key={key}
                className={cn(
                  "px-2 py-2 font-semibold text-slate-700 whitespace-nowrap",
                  key === "misc_hrs" && "w-28",
                  (HOUR_SUM_KEYS.has(key) || MONEY_KEYS.has(key)) && "text-right"
                )}
                title={
                  key === "diff" ? "Rendered hrs minus Misc hrs" : undefined
                }
              >
                {COLUMN_LABELS[key] || key}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredRows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={totalColCount}
                className="h-24 text-center text-slate-500"
              >
                No sessions in this tab for the selected filters.
              </TableCell>
            </TableRow>
          ) : (
            <>
              {filteredRows.map((row) => {
                const id = String(row.session_id);
                const selected = selectedRowIds.includes(id);
                const dirty = dirtyRowIds.includes(id);
                return (
                  <TableRow
                    key={id}
                    className={cn(
                      "hover:bg-slate-50/80",
                      selected && "bg-teal-50/60",
                      dirty && "bg-amber-50/40"
                    )}
                    onClick={() => {
                      if (showRowCheckboxes) toggleRowSelection(id);
                    }}
                  >
                    {showRowCheckboxes && (
                      <TableCell
                        className="px-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => toggleRowSelection(id)}
                          aria-label={`Select session ${id}`}
                        />
                      </TableCell>
                    )}
                    {columns.map((key) => (
                      <TableCell key={key} className={cellClass(key)}>
                        {renderCell(row, key)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
              {showSumRow && (
                <TableRow className="border-t-2 border-slate-300 bg-slate-50 font-medium">
                  <TableCell
                    colSpan={sumLabelColSpan}
                    className="px-2 py-2 text-right text-slate-700"
                  >
                    Sum (visible rows)
                  </TableCell>
                  {columns.slice(firstSumIdx).map((key) => (
                    <TableCell key={`sum-${key}`} className={cellClass(key)}>
                      {HOUR_SUM_KEYS.has(key)
                        ? (sums[key] ?? 0).toFixed(2)
                        : MONEY_KEYS.has(key)
                          ? `$${(sums[key] ?? 0).toFixed(2)}`
                          : null}
                    </TableCell>
                  ))}
                </TableRow>
              )}
            </>
          )}
        </TableBody>
      </table>
    </div>
  );
}
