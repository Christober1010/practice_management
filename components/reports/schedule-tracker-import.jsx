"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { SCHEDULE_TRACKER_EXCEL_COLUMNS } from "./report-column-exclusions";

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

export default function ScheduleTrackerImport({ onImported }) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
  const [warnings, setWarnings] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setWarnings(null);
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
      const missing = SCHEDULE_TRACKER_EXCEL_COLUMNS.filter((col) => {
        const ok = mappedRows.some(
          (r) => r[col] !== "" && r[col] !== undefined && r[col] !== null
        );
        return !ok;
      });
      if (missing.length === SCHEDULE_TRACKER_EXCEL_COLUMNS.length) {
        toast.error(
          `No Schedule Tracker columns found. Expected headers such as: ${SCHEDULE_TRACKER_EXCEL_COLUMNS.slice(0, 4).join(", ")}…`
        );
        return;
      }

      setUploading(true);
      const res = await fetch(`${baseUrl}/reports.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mappedRows),
      });
      const result = await res.json();
      if (!result.success) {
        toast.error(result.message || "Import failed");
        return;
      }
      if (result.warnings) {
        setWarnings(result.warnings);
        const wCount =
          (result.warnings.duplicatesWithinFile?.length || 0) +
          (result.warnings.duplicatesInDb?.length || 0);
        if (wCount > 0) {
          toast.error(
            `Import blocked: ${wCount} duplicate group(s) were detected. Duplicate rows were not added.`,
            { icon: "⛔", duration: 8000 }
          );
          return;
        } else {
   
          toast.success(`Imported ${mappedRows.length} row(s)`);
        }
      } else {
        toast.success(`Imported ${mappedRows.length} row(s)`);
      }
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
    <div className="space-y-4">
      <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
        <Upload className="h-10 w-10 mx-auto text-slate-400 mb-3" />
        <Label htmlFor="schedule-tracker-excel" className="cursor-pointer">
          <Button variant="outline" asChild disabled={uploading}>
            <span>{uploading ? "Uploading…" : "Upload Excel (.xlsx)"}</span>
          </Button>
        </Label>
        <Input
          id="schedule-tracker-excel"
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFile}
        />
        <p className="text-xs text-slate-500 mt-3 mx-auto">
          Required columns: {SCHEDULE_TRACKER_EXCEL_COLUMNS.join(", ")}.<br />
          Optional: Client ID, Provider ID. Matching by name if blank.<br />
          Duplicate rows will not be imported.
        </p>
      </div>

      {warnings &&
        ((warnings.duplicatesWithinFile?.length > 0) ||
          (warnings.duplicatesInDb?.length > 0)) && (
          <Alert variant="default" className="border-amber-400 bg-amber-50 relative">
            {/* Close Icon/Button */}
            <button
              type="button"
              aria-label="Close"
              className="absolute top-2 right-2 p-1 rounded hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
              onClick={() => setWarnings(null)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-amber-800"
                fill="none"
                viewBox="0 0 20 20"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l8 8M6 14L14 6" />
              </svg>
            </button>
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            <AlertTitle className="text-amber-900">Duplicate warnings</AlertTitle>
            <AlertDescription className="text-amber-950 text-sm space-y-2 mt-2">
              {warnings.duplicatesWithinFile?.length > 0 && (
                <div>
                  <p className="font-medium">Within this file</p>
                  <ul className="list-disc pl-5 space-y-1">
                    {warnings.duplicatesWithinFile.map((w, i) => (
                      <li key={`f-${i}`}>
                        Rows {w.rowIndexes?.join(", ")} — fingerprint{" "}
                        <code className="text-xs break-all">{w.fingerprint}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {warnings.duplicatesInDb?.length > 0 && (
                <div>
                  <p className="font-medium">Already previously imported</p>
             
                  <ul className="list-disc pl-5 space-y-2">
                    {warnings.duplicatesInDb.map((w, i) => (
                      <li key={`d-${i}`}>
                        <div>
                          <span className="font-semibold text-amber-900">
                            Row{w.rowIndexes?.length > 1 ? "s" : ""} {w.rowIndexes?.join(", ")}
                          </span>
                          {" "}has already been imported.
                        </div>
                        <div className="ml-2 text-slate-700 text-xs">
                          <span>
                            <span className="font-medium">Existing Record ID{w.existingIds?.length > 1 ? "s" : ""}:</span>{" "}
                            {w.existingIds?.join(", ")}
                          </span>
                          <br />
                          <span>
                            <span className="font-medium">Duplicate Details:</span>{" "}
                            <code className="break-all">{w.fingerprint}</code>
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
             
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
   
    </div>
  );
}
