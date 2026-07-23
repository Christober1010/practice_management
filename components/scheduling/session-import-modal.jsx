"use client";

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { mahaverseFetch } from "@/lib/mahaverse-api";
import { getMahaverseAuthHeaders } from "@/lib/api-auth";
import {
  SESSION_CALENDAR_EXCEL_COLUMNS,
  SESSION_CALENDAR_FIELD_MAP,
  parseSessionImportWorkbook,
} from "@/lib/session-calendar-import";
import { cn } from "@/lib/utils";

const jsonAuthHeaders = () =>
  getMahaverseAuthHeaders({
    "Content-Type": "application/json",
    Accept: "application/json",
  });

export default function SessionImportModal({ isOpen, onClose, onImported }) {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState(null);
  const [validation, setValidation] = useState(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFileName("");
    setParsed(null);
    setValidation(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose?.();
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setBusy(true);
      setValidation(null);
      const data = await file.arrayBuffer();
      const result = await parseSessionImportWorkbook(data);
      setFileName(file.name);
      setParsed(result);

      if (!result.headerCheck.ok) {
        toast.error(result.headerCheck.message);
        return;
      }

      toast.success(`Loaded ${result.rowCount} row(s) from ${file.name}`);
    } catch (err) {
      console.error(err);
      toast.error("Could not read the Excel file.");
      reset();
    } finally {
      setBusy(false);
    }
  };

  const runValidation = async () => {
    if (!parsed?.rows?.length) return;
    setBusy(true);
    try {
      const res = await mahaverseFetch("/import-sessions.php", {
        method: "POST",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ validateOnly: true, rows: parsed.rows }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success !== true) {
        toast.error(data.message || data.error || "Validation failed");
        return;
      }
      setValidation(data);
      toast.success(
        `${data.readyCount ?? 0} of ${data.total ?? parsed.rowCount} row(s) ready to import`
      );
    } catch (err) {
      console.error(err);
      toast.error("Validation request failed");
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    if (!parsed?.rows?.length) return;
    setBusy(true);
    try {
      const res = await mahaverseFetch("/import-sessions.php", {
        method: "POST",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ rows: parsed.rows }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success !== true) {
        toast.error(data.message || data.error || "Import failed");
        return;
      }
      const imported = data.imported ?? 0;
      if (imported === 0) {
        const firstErr = data.rows?.find((r) => r.errors?.length)?.errors?.[0];
        toast.error(
          firstErr
            ? `No sessions imported — ${firstErr}`
            : "No sessions imported (all rows skipped or failed validation)"
        );
        setValidation(data);
        return;
      }
      toast.success(
        data.session_ids?.length
          ? `Imported ${imported} session(s) — IDs: ${data.session_ids.join(", ")}`
          : `Imported ${imported} session(s)`
      );
      onImported?.();
      handleClose();
    } catch (err) {
      console.error(err);
      toast.error("Import request failed");
    } finally {
      setBusy(false);
    }
  };

  const headerOk = parsed?.headerCheck?.ok;
  const readyCount = validation?.readyCount ?? 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-teal-600" />
            Import Sessions
          </DialogTitle>
          <DialogDescription>
            Upload a CL_PA_RPT Excel export ({SESSION_CALENDAR_EXCEL_COLUMNS.length}{" "}
            columns). Rows are matched to clients, staff, and authorizations before
            creating calendar sessions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFile}
            aria-hidden
            tabIndex={-1}
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {fileName ? "Choose another file" : "Choose Excel file"}
            </Button>
            {fileName && (
              <span className="text-sm text-muted-foreground truncate max-w-xs">
                {fileName}
              </span>
            )}
          </div>

          {parsed && (
            <div
              className={cn(
                "rounded-lg border p-4 flex gap-3",
                headerOk
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-amber-200 bg-amber-50"
              )}
            >
              {headerOk ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-2 text-sm">
                <p className="font-medium text-foreground">
                  {parsed.headerCheck.message}
                </p>
                <p className="text-muted-foreground">
                  {parsed.rowCount} data row(s) on sheet &quot;{parsed.sheetName}&quot;
                </p>
                {!headerOk && parsed.headerCheck.missing?.length > 0 && (
                  <div>
                    <p className="font-medium text-amber-900">Missing columns:</p>
                    <p className="text-amber-800">
                      {parsed.headerCheck.missing.join(", ")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="rounded-lg border bg-slate-50 p-4">
            <p className="text-sm font-medium mb-2">Excel → calendar session mapping</p>
            <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {SESSION_CALENDAR_FIELD_MAP.map(({ excel, session }) => (
                <li key={excel}>
                  <span className="text-foreground">{excel}</span>
                  {" → "}
                  {session}
                </li>
              ))}
            </ul>
          </div>

          {parsed?.preview?.length > 0 && headerOk && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Preview (first 10 rows)</p>
                {validation && (
                  <Badge variant="secondary">
                    {readyCount} ready / {validation.total ?? parsed.rowCount} total
                  </Badge>
                )}
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-2 py-2 text-left">#</th>
                      <th className="px-2 py-2 text-left">Client</th>
                      <th className="px-2 py-2 text-left">Staff</th>
                      <th className="px-2 py-2 text-left">DOS</th>
                      <th className="px-2 py-2 text-left">Start</th>
                      <th className="px-2 py-2 text-left">Code</th>
                      <th className="px-2 py-2 text-left">Status</th>
                      {validation && (
                        <th className="px-2 py-2 text-left">Validation</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.preview.slice(0, 10).map((row) => {
                      const v = validation?.rows?.find((r) => r.line === row.line);
                      return (
                        <tr key={row.line} className="border-t">
                          <td className="px-2 py-2">{row.line}</td>
                          <td className="px-2 py-2">{row.client || "—"}</td>
                          <td className="px-2 py-2">{row.staff || "—"}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{row.dos || "—"}</td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            {row.aptStart || "—"}
                          </td>
                          <td className="px-2 py-2">{row.serviceCode || "—"}</td>
                          <td className="px-2 py-2">{row.status}</td>
                          {validation && (
                            <td className="px-2 py-2">
                              {v?.ready ? (
                                <span className="text-emerald-700">Ready</span>
                              ) : (
                                <span className="text-red-700" title={v?.errors?.join("; ")}>
                                  {v?.errors?.[0] || "Error"}
                                </span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={busy}>
              Cancel
            </Button>
            {parsed?.headerCheck?.ok && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy || !parsed?.rows?.length}
                  onClick={runValidation}
                >
                  Validate rows
                </Button>
                <Button
                  type="button"
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                  disabled={busy || !validation || readyCount === 0}
                  onClick={runImport}
                >
                  Import {readyCount > 0 ? `${readyCount} session(s)` : "sessions"}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
