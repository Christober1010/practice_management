"use client";

import { mahaverseFetch } from "@/lib/mahaverse-api";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { SCHEDULE_TRACKER_EXCEL_COLUMNS } from "./report-column-exclusions";
import { cn } from "@/lib/utils";

function mapExcelRow(rawRow, excelColumns) {
  const keys = Object.keys(rawRow || {});
  const mapped = {};
  for (const requiredCol of excelColumns) {
    if (rawRow[requiredCol] !== undefined && rawRow[requiredCol] !== "") {
      mapped[requiredCol] = rawRow[requiredCol];
      continue;
    }
    const withSpace = `${requiredCol} `;
    if (rawRow[withSpace] !== undefined) {
      mapped[requiredCol] = rawRow[withSpace];
      continue;
    }
    const found = keys.find(
      (k) => k.trim().toLowerCase() === requiredCol.trim().toLowerCase()
    );
    mapped[requiredCol] = found ? rawRow[found] : "";
  }
  return mapped;
}

/** Optional Excel columns mapped to API snake_case for reports.client_id / reports.provider_id */
function attachOptionalReportIds(mappedRow, rawRow) {
  const keys = Object.keys(rawRow || {});
  const pick = (labels) => {
    for (const lab of labels) {
      const v = rawRow[lab];
      if (v !== undefined && v !== "" && v !== null) {
        return String(v).trim();
      }
      const found = keys.find((k) => k.trim().toLowerCase() === lab.trim().toLowerCase());
      if (found) {
        const v2 = rawRow[found];
        if (v2 !== undefined && v2 !== "" && v2 !== null) {
          return String(v2).trim();
        }
      }
    }
    return null;
  };
  const out = { ...mappedRow };
  const cid = pick(["Client ID", "client_id"]);
  const pid = pick(["Provider ID", "provider_id", "Staff ID", "staff_id"]);
  if (cid) out.client_id = cid;
  if (pid) out.provider_id = pid;
  return out;
}

export default function ScheduleTrackerImport({
  onImported,
  size = "default",
  variant = "default",
  className,
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, {
        type: "array",
        cellDates: true,
        cellText: false,
      });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
        raw: false,
        dateNF: "yyyy-mm-dd HH:MM:ss",
      });
      if (!rawRows.length) {
        toast.error("No data found in Excel file");
        return;
      }
      const mappedRows = rawRows.map((row) =>
        attachOptionalReportIds(mapExcelRow(row, SCHEDULE_TRACKER_EXCEL_COLUMNS), row)
      );

      setUploading(true);
      const res = await mahaverseFetch("/reports.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule_tracker: true, rows: mappedRows }),
      });
      const result = await res.json();
      if (!result.success) {
        toast.error(result.message || "Import failed");
        return;
      }
      toast.success(`Imported ${mappedRows.length} row(s) as Pending`);
      if (onImported) onImported();
    } catch (err) {
      console.error(err);
      toast.error("Failed to read or upload file");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFile}
        aria-hidden
        tabIndex={-1}
      />
      <Button
        type="button"
        size={size}
        variant={variant}
        className={cn(className)}
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        title={`Import .xlsx — all rows from the first sheet become Pending. Columns: ${SCHEDULE_TRACKER_EXCEL_COLUMNS.join(", ")}. Optional: Client ID, Provider ID.`}
      >
        <Upload className={`h-4 w-4 mr-1.5 ${uploading ? "animate-pulse" : ""}`} />
        {uploading ? "Uploading…" : "Import Excel"}
      </Button>
    </>
  );
}
