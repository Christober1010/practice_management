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
  TRACKER_COLUMN_LABELS,
  formatMoneyDisplay,
  formatMoneyOnBlur,
  sumMoneyColumn,
  trackerColumnIsMoney,
  trackerColumnsForStatus,
  trackerPaymentFieldForColumn,
} from "./schedule-tracker-table-utils";

function parseHours(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

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

export default function ScheduleTrackerTable({
  activeStatus,
  filteredRows,
  rowsForActiveTab,
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
  amountForRow,
  savedPayments,
  trackerColumnTotals,
  inputFilterClass,
}) {
  const columns = trackerColumnsForStatus(activeStatus);
  const totalColCount = columns.length + (showRowCheckboxes ? 1 : 0);
  const durationIdx = columns.indexOf("duration");
  const sumLabelColSpan = (showRowCheckboxes ? 1 : 0) + durationIdx;

  const renderCellContent = (row, columnKey) => {
    const client = `${row.client_first_name || ""} ${row.client_last_name || ""}`.trim();
    const staff = `${row.staff_first_name || ""} ${row.staff_last_name || ""}`.trim();
    const miscDisplay =
      drafts[row.id] !== undefined
        ? drafts[row.id]
        : row.misc_hrs != null && row.misc_hrs !== ""
          ? String(row.misc_hrs)
          : "";
    const durNum = parseHours(row.duration_render_in_hrs);
    const miscNum = miscHrsNumeric(row, drafts);
    const durMinusMisc = (durNum ?? 0) - miscNum;
    const showNumericHrs = durNum != null || miscNum !== 0;
    const pay = amountForRow(row.id);
    const field = trackerPaymentFieldForColumn(columnKey);

    switch (columnKey) {
      case "dos":
        return formatReportDos(row.dos, row.apt_start_time);
      case "client":
        return client || "—";
      case "staff":
        return staff || "—";
      case "service_code":
        return row.service_code_with_modifiers || "—";
      case "duration":
        return row.duration_render_in_hrs != null && row.duration_render_in_hrs !== ""
          ? Number(row.duration_render_in_hrs).toFixed(2)
          : "—";
      case "misc_hrs":
        if (canEditMisc) {
          return (
            <Input
              className={`h-8 w-28 ${inputFilterClass}`}
              type="text"
              inputMode="decimal"
              value={miscDisplay}
              onChange={(e) => setMiscDraft(row.id, e.target.value)}
              placeholder="—"
            />
          );
        }
        return miscDisplay !== "" ? miscDisplay : "—";
      case "diff":
        return showNumericHrs ? durMinusMisc.toFixed(2) : "—";
      case "payer_paid":
      case "coinsurance":
      case "copay":
      case "deductible": {
        const value = pay[field] ?? "";
        if (canEditPayment) {
          return (
            <Input
              className={`h-8 w-24 ${inputFilterClass}`}
              inputMode="decimal"
              value={value}
              onChange={(e) => setPaymentField(row.id, field, e.target.value)}
              onBlur={(e) => setPaymentField(row.id, field, formatMoneyOnBlur(e.target.value))}
            />
          );
        }
        return value !== "" ? formatMoneyDisplay(value) : "—";
      }
      case "check_number":
        if (canEditPayment) {
          return (
            <Input
              className={`h-8 w-28 ${inputFilterClass}`}
              value={pay.check_number || ""}
              onChange={(e) => setPaymentField(row.id, "check_number", e.target.value)}
            />
          );
        }
        return pay.check_number || "—";
      case "ap_invoice":
        if (canEditAp) {
          return (
            <Input
              className={`h-8 w-28 ${inputFilterClass}`}
              value={pay.ap_invoice || ""}
              onChange={(e) => setPaymentField(row.id, "ap_invoice", e.target.value)}
            />
          );
        }
        return pay.ap_invoice || "—";
      case "ap_date":
        if (canEditAp) {
          return (
            <Input
              type="date"
              className={`h-8 w-36 ${inputFilterClass}`}
              value={pay.ap_date || ""}
              onChange={(e) => setPaymentField(row.id, "ap_date", e.target.value)}
            />
          );
        }
        return pay.ap_date || "—";
      case "client_id":
        return row.client_id || "—";
      case "provider_id":
        return row.provider_id || "—";
      case "payer":
        return row.payer || "—";
      case "rbt_supervised":
        return row.name_of_rbt_supervised || "—";
      default:
        return "—";
    }
  };

  const cellClass = (columnKey) => {
    if (columnKey === "duration" || columnKey === "diff") return "text-right tabular-nums text-xs";
    if (columnKey === "client_id" || columnKey === "provider_id") {
      return "text-xs text-slate-600 max-w-[7rem] truncate font-mono";
    }
    if (columnKey === "service_code") return "max-w-[140px] truncate text-xs";
    if (columnKey === "dos" || columnKey === "client" || columnKey === "staff") {
      return "whitespace-nowrap text-xs";
    }
    if (trackerColumnIsMoney(columnKey)) return "tabular-nums text-xs";
    return "text-xs";
  };

  return (
    <div className="max-h-[min(70vh,calc(100vh-13rem))] overflow-auto overscroll-contain">
      <table
        className={cn(
          "w-full caption-bottom text-sm border-collapse",
          "[&_td]:px-3 [&_td]:py-2.5 [&_th]:px-3 [&_th]:py-2.5 text-xs",
          columns.length > 11 ? "min-w-[80rem]" : "min-w-[56rem]"
        )}
      >
        <TableHeader>
          <TableRow className="border-b hover:bg-transparent">
            {showRowCheckboxes && (
              <TableHead className="sticky top-0 z-20 w-10 bg-slate-50 shadow-[inset_0_-1px_0_0_rgb(226_232_240)]">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={toggleSelectAllVisible}
                  aria-label="Select all visible rows"
                />
              </TableHead>
            )}
            {columns.map((key) => (
              <TableHead
                key={key}
                className={cn(
                  "sticky top-0 z-20 bg-slate-50 font-semibold text-slate-700 shadow-[inset_0_-1px_0_0_rgb(226_232_240)]",
                  (key === "duration" || key === "diff") && "text-right",
                  key === "misc_hrs" && "w-32"
                )}
                title={key === "diff" ? "Duration (hrs) minus Misc hrs" : undefined}
              >
                {TRACKER_COLUMN_LABELS[key] ?? key}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={totalColCount} className="text-center text-slate-500 py-10">
                {rowsForActiveTab.length === 0
                  ? `No ${activeStatus} rows yet.`
                  : "No rows match the current filters. Clear filters or adjust them."}
              </TableCell>
            </TableRow>
          ) : (
            <>
              {filteredRows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    "border-b hover:bg-slate-50/80",
                    dirtyRowIds.includes(row.id) && "bg-teal-50/40"
                  )}
                >
                  {showRowCheckboxes && (
                    <TableCell>
                      <Checkbox
                        checked={selectedRowIds.includes(row.id)}
                        onCheckedChange={() => toggleRowSelection(row.id)}
                        aria-label={`Select row ${row.id}`}
                      />
                    </TableCell>
                  )}
                  {columns.map((key) => (
                    <TableCell
                      key={`${row.id}-${key}`}
                      className={cellClass(key)}
                      title={
                        key === "client_id"
                          ? row.client_id || ""
                          : key === "provider_id"
                            ? row.provider_id || ""
                            : key === "service_code"
                              ? row.service_code_with_modifiers
                              : undefined
                      }
                    >
                      {renderCellContent(row, key)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              <TableRow className="border-t-2 border-slate-300 bg-slate-50 font-medium">
                <TableCell colSpan={sumLabelColSpan} className="text-right text-slate-700">
                  Sum (visible rows)
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
                {columns.slice(durationIdx + 3).map((key) => {
                  if (trackerColumnIsMoney(key)) {
                    const sum = sumMoneyColumn(filteredRows, amounts, savedPayments, key);
                    return (
                      <TableCell key={`sum-${key}`} className="text-right tabular-nums">
                        {sum != null ? sum.toFixed(2) : "—"}
                      </TableCell>
                    );
                  }
                  return <TableCell key={`sum-${key}`} />;
                })}
              </TableRow>
            </>
          )}
        </TableBody>
      </table>
    </div>
  );
}
