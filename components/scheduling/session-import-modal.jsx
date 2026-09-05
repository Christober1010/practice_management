"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  parseSessionImportWorkbook,
  previewImportRow,
} from "@/lib/session-calendar-import";
import { cn } from "@/lib/utils";

const jsonAuthHeaders = () =>
  getMahaverseAuthHeaders({
    "Content-Type": "application/json",
    Accept: "application/json",
  });

function staffKey(first, last) {
  return `${String(first || "").trim()}|${String(last || "").trim()}`;
}

function isProviderConflict(row) {
  if (row?.error_code === "provider_double_booked") return true;
  const msg = (row?.errors || []).join(" ").toLowerCase();
  return (
    msg.includes("already booked") ||
    msg.includes("provider_double_booked") ||
    msg.includes("choose a different time or provider")
  );
}

function isStaffLookupError(row) {
  const msg = (row?.errors || []).join(" ").toLowerCase();
  return msg.includes("staff not found");
}

/** Small clock face with spinning hand — shown while rows validate. */
function ValidationClock({ className }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-9 w-9 shrink-0 items-center justify-center",
        className
      )}
      aria-hidden
    >
      <span className="absolute inset-0 rounded-full border-2 border-teal-600/30" />
      <span className="absolute inset-[3px] rounded-full border border-teal-600/20" />
      <span className="absolute left-1/2 top-1/2 z-[1] h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-700" />
      <span className="absolute inset-0 animate-spin [animation-duration:1s]">
        <span className="absolute left-1/2 top-[7px] h-[11px] w-[2px] -translate-x-1/2 rounded-full bg-teal-700" />
      </span>
    </span>
  );
}

export default function SessionImportModal({ isOpen, onClose, onImported }) {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState(null);
  const [validation, setValidation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [staffOptions, setStaffOptions] = useState([]);
  const [progress, setProgress] = useState(null); // { done, total, phase: 'validate'|'import' }

  const reset = () => {
    setFileName("");
    setParsed(null);
    setValidation(null);
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose?.();
  };

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await mahaverseFetch("/staff.php", {
          headers: jsonAuthHeaders(),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled || !res.ok) return;
        const rows = (data.staff_records || []).filter(
          (s) =>
            String(s.status || "Active") === "Active" &&
            String(s.archived) !== "1"
        );
        setStaffOptions(
          rows.map((s) => ({
            id: String(s.id),
            firstName: String(s.firstName || s.first_name || "").trim(),
            lastName: String(s.lastName || s.last_name || "").trim(),
            fullName: String(
              s.fullName ||
                s.full_name ||
                `${s.firstName || ""} ${s.lastName || ""}`
            ).trim(),
          }))
        );
      } catch {
        /* staff picker optional until validate */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setBusy(true);
      setValidation(null);
      setProgress(null);
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
    setValidation(null);
    const total = parsed.rows.length;
    setProgress({ done: 0, total, phase: "validate" });

    let raf = 0;
    const started = performance.now();
    const tick = () => {
      // Ease toward ~90% while waiting; snap to 100% when the request finishes.
      const elapsed = performance.now() - started;
      const approx = Math.min(
        total - 1,
        Math.floor((1 - Math.exp(-elapsed / 1800)) * total * 0.9)
      );
      setProgress((prev) =>
        prev?.phase === "validate" ? { ...prev, done: Math.max(prev.done, approx) } : prev
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    try {
      const res = await mahaverseFetch("/import-sessions.php", {
        method: "POST",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ validateOnly: true, rows: parsed.rows }),
      });
      const data = await res.json().catch(() => ({}));
      cancelAnimationFrame(raf);
      setProgress({ done: total, total, phase: "validate" });

      if (!res.ok || data.success !== true) {
        const msg = String(data.message || data.error || "Validation failed");
        const conflict =
          /ProviderScheduleConflictException|already booked/i.test(msg);
        toast.error(msg.slice(0, 240));
        if (conflict) {
          setValidation({
            success: false,
            readyCount: 0,
            total,
            rows: [
              {
                line: 1,
                ready: false,
                error_code: "provider_double_booked",
                errors: [msg.replace(/^Uncaught\s+/i, "").split(" in /")[0]],
                client: parsed.preview?.[0]?.client || "",
                staff: parsed.preview?.[0]?.staff || "",
              },
            ],
          });
        }
        return;
      }

      setValidation(data);
      const ready = data.readyCount ?? 0;
      const failed = Math.max(0, total - ready);
      if (failed > 0) {
        toast.error(
          `${failed} of ${total} row(s) have errors — fix provider below, then re-validate`
        );
      } else {
        toast.success(`${ready} of ${total} row(s) ready to import`);
      }
    } catch (err) {
      console.error(err);
      cancelAnimationFrame(raf);
      toast.error("Validation request failed");
    } finally {
      cancelAnimationFrame(raf);
      setBusy(false);
      // Brief beat on 100% so the counter is readable
      await new Promise((r) => setTimeout(r, 280));
      setProgress(null);
    }
  };

  const runImport = async () => {
    if (!parsed?.rows?.length) return;
    setBusy(true);

    const readyLineToRow = new Map();
    if (validation?.rows?.length) {
      for (const r of validation.rows) {
        if (r.ready && r.line >= 1 && r.line <= parsed.rows.length) {
          readyLineToRow.set(r.line, parsed.rows[r.line - 1]);
        }
      }
    }
    const rowsToImport =
      readyLineToRow.size > 0
        ? [...readyLineToRow.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([, row]) => row)
        : parsed.rows;

    const total = rowsToImport.length;
    setProgress({ done: 0, total, phase: "import" });

    let raf = 0;
    const started = performance.now();
    const tick = () => {
      const elapsed = performance.now() - started;
      const approx = Math.min(
        total - 1,
        Math.floor((1 - Math.exp(-elapsed / 2200)) * total * 0.9)
      );
      setProgress((prev) =>
        prev?.phase === "import" ? { ...prev, done: Math.max(prev.done, approx) } : prev
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    try {
      const res = await mahaverseFetch("/import-sessions.php", {
        method: "POST",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ rows: rowsToImport }),
      });
      const data = await res.json().catch(() => ({}));
      cancelAnimationFrame(raf);
      setProgress({ done: total, total, phase: "import" });

      if (!res.ok || data.success !== true) {
        const msg = String(data.message || data.error || "Import failed");
        toast.error(msg.slice(0, 280));
        if (/already booked|ProviderScheduleConflict/i.test(msg)) {
          setValidation({
            success: false,
            readyCount: 0,
            total: parsed.rowCount,
            rows: [
              {
                line: 1,
                ready: false,
                error_code: "provider_double_booked",
                errors: [msg.replace(/^Uncaught\s+/i, "").split(" in /")[0]],
              },
            ],
          });
        }
        return;
      }

      const imported = data.imported ?? 0;
      const updated = data.updated ?? 0;
      if (imported === 0 && updated === 0) {
        const firstErr = data.rows?.find((r) => r.errors?.length)?.errors?.[0];
        toast.error(
          firstErr
            ? `No sessions imported — ${firstErr}`
            : "No sessions imported (all rows skipped or failed validation)"
        );
        setValidation(data);
        return;
      }

      const parts = [];
      if (imported > 0) parts.push(`imported ${imported}`);
      if (updated > 0) parts.push(`updated ${updated}`);

      const failed = (data.rows || []).filter((r) => !r.ready).length;
      if (failed > 0) {
        toast.success(
          `${parts.join(", ")}; ${failed} row(s) still need fixes`
        );
        setValidation(data);
        return;
      }
      toast.success(
        data.session_ids?.length
          ? `${parts.join(", ")} — IDs: ${data.session_ids.join(", ")}`
          : parts.join(", ")
      );
      onImported?.();
      handleClose();
    } catch (err) {
      console.error(err);
      cancelAnimationFrame(raf);
      toast.error("Import request failed");
    } finally {
      cancelAnimationFrame(raf);
      setBusy(false);
      await new Promise((r) => setTimeout(r, 280));
      setProgress(null);
    }
  };

  const updateRowStaff = (line, staff) => {
    if (!parsed?.rows?.length || !staff) return;
    const idx = line - 1;
    if (idx < 0 || idx >= parsed.rows.length) return;

    const nextRows = parsed.rows.map((row, i) =>
      i === idx
        ? {
            ...row,
            "Staff First Name": staff.firstName,
            "Staff Last Name": staff.lastName,
          }
        : row
    );
    const nextPreview = nextRows.map((row, i) => previewImportRow(row, i + 1));
    setParsed({ ...parsed, rows: nextRows, preview: nextPreview });

    if (validation?.rows) {
      setValidation({
        ...validation,
        readyCount: 0,
        rows: validation.rows.map((r) =>
          r.line === line
            ? {
                ...r,
                ready: false,
                staff: staff.fullName,
                staff_first: staff.firstName,
                staff_last: staff.lastName,
                errors: ["Provider changed — click Validate rows again"],
                error_code: r.error_code,
              }
            : r
        ),
      });
    }
  };

  const headerOk = parsed?.headerCheck?.ok;
  const readyCount = validation?.readyCount ?? 0;
  const totalCount = validation?.total ?? parsed?.rowCount ?? 0;
  const errorRows = useMemo(() => {
    if (!validation?.rows?.length) return [];
    return validation.rows.filter(
      (r) => !r.ready && Array.isArray(r.errors) && r.errors.length > 0
    );
  }, [validation]);

  const uniqueStaffOptions = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const s of staffOptions) {
      if (!s.firstName || !s.lastName) continue;
      const k = staffKey(s.firstName, s.lastName);
      if (seen.has(k)) continue;
      const dup = staffOptions.filter(
        (o) => staffKey(o.firstName, o.lastName) === k
      );
      if (dup.length !== 1) continue;
      seen.add(k);
      out.push(s);
    }
    return out.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [staffOptions]);

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
            columns; optional &quot;Exclude Session&quot;). Validate rows, fix any
            provider conflicts, then import.
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

          {/* Live validation / import progress */}
          {progress && (
            <div className="flex items-center gap-4 rounded-lg border border-teal-200 bg-teal-50/60 px-4 py-5">
              <ValidationClock />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-teal-950">
                  {progress.phase === "import"
                    ? "Importing sessions"
                    : "Validating rows"}
                </p>
                <p
                  className="mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight text-teal-900"
                  aria-live="polite"
                >
                  {progress.done}
                  <span className="text-teal-700/60">/{progress.total}</span>
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-teal-200/70">
                  <div
                    className="h-full rounded-full bg-teal-600 transition-[width] duration-300 ease-out"
                    style={{
                      width: `${
                        progress.total
                          ? Math.min(
                              100,
                              Math.round((progress.done / progress.total) * 100)
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* After validation: errors only, editable provider */}
          {validation && !progress && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {errorRows.length > 0
                    ? `Rows with errors (${errorRows.length})`
                    : "Validation — all rows ready"}
                </p>
                <Badge variant={errorRows.length > 0 ? "destructive" : "secondary"}>
                  {readyCount} ready / {totalCount} total
                </Badge>
              </div>

              {errorRows.length === 0 ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  All {readyCount} row(s) passed validation and can be imported.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-red-200 max-h-96">
                  <table className="w-full text-xs">
                    <thead className="bg-red-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-2 text-left">#</th>
                        <th className="px-2 py-2 text-left">Client</th>
                        <th className="px-2 py-2 text-left min-w-[11rem]">
                          Staff / provider
                        </th>
                        <th className="px-2 py-2 text-left">DOS</th>
                        <th className="px-2 py-2 text-left">Code</th>
                        <th className="px-2 py-2 text-left">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {errorRows.map((r) => {
                        const p = parsed?.preview?.[r.line - 1] || {};
                        const allowProviderEdit =
                          isProviderConflict(r) || isStaffLookupError(r);
                        const selected =
                          uniqueStaffOptions.find(
                            (s) =>
                              staffKey(s.firstName, s.lastName) ===
                              staffKey(
                                parsed?.rows?.[r.line - 1]?.["Staff First Name"],
                                parsed?.rows?.[r.line - 1]?.["Staff Last Name"]
                              )
                          ) || null;

                        return (
                          <tr key={r.line} className="border-t align-top">
                            <td className="px-2 py-2">{r.line}</td>
                            <td className="px-2 py-2">
                              {r.client || p.client || "—"}
                            </td>
                            <td className="px-2 py-2">
                              {allowProviderEdit ? (
                                <select
                                  className="w-full max-w-[14rem] rounded border border-input bg-background px-2 py-1 text-xs"
                                  value={
                                    selected
                                      ? staffKey(
                                          selected.firstName,
                                          selected.lastName
                                        )
                                      : ""
                                  }
                                  onChange={(e) => {
                                    const next = uniqueStaffOptions.find(
                                      (s) =>
                                        staffKey(s.firstName, s.lastName) ===
                                        e.target.value
                                    );
                                    if (next) updateRowStaff(r.line, next);
                                  }}
                                >
                                  <option value="">
                                    {r.staff || p.staff || "Select provider…"}
                                  </option>
                                  {uniqueStaffOptions.map((s) => (
                                    <option
                                      key={s.id}
                                      value={staffKey(s.firstName, s.lastName)}
                                    >
                                      {s.fullName}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                r.staff || p.staff || "—"
                              )}
                            </td>
                            <td className="px-2 py-2 whitespace-nowrap">
                              {r.dos || p.dos || "—"}
                            </td>
                            <td className="px-2 py-2">
                              {r.service_code || p.serviceCode || "—"}
                            </td>
                            <td className="px-2 py-2 text-red-700">
                              {(r.errors || []).join("; ")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={busy}
            >
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
                  {busy && progress?.phase === "validate"
                    ? "Validating…"
                    : "Validate rows"}
                </Button>
                <Button
                  type="button"
                  className="bg-teal-600 hover:bg-teal-700 text-white active:scale-[0.97] transition-transform"
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
