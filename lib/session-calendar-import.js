import { FULL_REPORT_REQUIRED_COLUMN_LABELS } from "@/components/reports/report-column-exclusions";

export const SESSION_CALENDAR_EXCEL_COLUMNS = FULL_REPORT_REQUIRED_COLUMN_LABELS;

/** Optional CL_PA_RPT / Theralytics columns — not required for header validation. */
export const SESSION_CALENDAR_OPTIONAL_COLUMNS = ["Exclude Session"];

/** Excel → session field mapping for the import preview UI. */
export const SESSION_CALENDAR_FIELD_MAP = [
  { excel: "Client First Name + Client Last Name", session: "client_id (lookup)" },
  { excel: "Staff First Name + Staff Last Name", session: "provider_id (lookup)" },
  { excel: "Name of RBT Supervised", session: "not mapped (supervisee ≠ Supervising Provider)" },
  { excel: "Authorization Number + Service Code With Modifiers (+ DOS if duplicate auth periods)", session: "auth_id (lookup)" },
  { excel: "DOS + Apt Start Time / Apt End Time", session: "start_utc / end_utc" },
  { excel: "Duration Schedule In Hrs", session: "scheduled_hours" },
  { excel: "Duration Render in Hrs", session: "rendered_hours" },
  { excel: "Location Code", session: "place_of_service" },
  { excel: "Address", session: "location_address" },
  { excel: "Status", session: "status" },
  { excel: "Billable", session: "claim_status (Not Applicable if No)" },
  { excel: "Exclude Session (optional)", session: "exclude_session" },
  { excel: "Notes / Non-Billable Notes", session: "quick_note" },
];

function pickColumnValue(rawRow, requiredCol, keys) {
  if (rawRow[requiredCol] !== undefined && rawRow[requiredCol] !== "") {
    return rawRow[requiredCol];
  }
  const withSpace = `${requiredCol} `;
  if (rawRow[withSpace] !== undefined) {
    return rawRow[withSpace];
  }
  const found = keys.find(
    (k) => k.trim().toLowerCase() === requiredCol.trim().toLowerCase()
  );
  return found ? rawRow[found] : "";
}

export function mapExcelRow(rawRow, excelColumns = SESSION_CALENDAR_EXCEL_COLUMNS) {
  const keys = Object.keys(rawRow || {});
  const mapped = {};
  for (const requiredCol of excelColumns) {
    mapped[requiredCol] = pickColumnValue(rawRow, requiredCol, keys);
  }
  for (const optionalCol of SESSION_CALENDAR_OPTIONAL_COLUMNS) {
    const value = pickColumnValue(rawRow, optionalCol, keys);
    if (value !== "" && value !== undefined && value !== null) {
      mapped[optionalCol] = value;
    }
  }
  return mapped;
}

export function validateExcelHeaders(rawRows) {
  if (!rawRows?.length) {
    return {
      ok: false,
      message: "No data rows found in the first worksheet.",
      missing: SESSION_CALENDAR_EXCEL_COLUMNS,
      extra: [],
      matched: 0,
      expected: SESSION_CALENDAR_EXCEL_COLUMNS.length,
    };
  }

  const fileHeaders = Object.keys(rawRows[0] || {});
  const fileNorm = new Map(
    fileHeaders.map((h) => [h.trim().toLowerCase(), h])
  );

  const missing = SESSION_CALENDAR_EXCEL_COLUMNS.filter(
    (col) => !fileNorm.has(col.trim().toLowerCase())
  );

  const expectedNorm = new Set(
    SESSION_CALENDAR_EXCEL_COLUMNS.map((c) => c.trim().toLowerCase())
  );
  const extra = fileHeaders.filter(
    (h) => !expectedNorm.has(h.trim().toLowerCase())
  );

  const matched = SESSION_CALENDAR_EXCEL_COLUMNS.length - missing.length;

  return {
    ok: missing.length === 0,
    message:
      missing.length === 0
        ? `All ${SESSION_CALENDAR_EXCEL_COLUMNS.length} CL_PA_RPT columns match.`
        : `${missing.length} required column(s) missing.`,
    missing,
    extra,
    matched,
    expected: SESSION_CALENDAR_EXCEL_COLUMNS.length,
  };
}

function personLabel(first, last) {
  return [first, last].map((s) => String(s ?? "").trim()).filter(Boolean).join(" ");
}

/** Format Excel serial / Date / string for import preview only. */
function previewExcelDateTime(value) {
  if (value === "" || value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    const whole = Math.floor(value);
    const fraction = value - whole;
    const utcMs = Date.UTC(1899, 11, 30) + whole * 86400000;
    const day = new Date(utcMs);
    const y = day.getUTCFullYear();
    const m = String(day.getUTCMonth() + 1).padStart(2, "0");
    const d = String(day.getUTCDate()).padStart(2, "0");
    const totalMin = Math.round(fraction * 1440);
    const hh = String(Math.floor(totalMin / 60) % 24).padStart(2, "0");
    const mm = String(totalMin % 60).padStart(2, "0");
    return fraction > 0 ? `${y}-${m}-${d} ${hh}:${mm}` : `${y}-${m}-${d}`;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 19).replace("T", " ");
  }
  return String(value);
}

export function previewImportRow(row, lineNo) {
  const scheduledHrs = row["Duration Schedule In Hrs"];
  const renderedHrs = row["Duration Render in Hrs"];
  const excludeRaw = row["Exclude Session"] ?? row["Exclude session"] ?? "";
  const excludeNorm = String(excludeRaw).trim().toLowerCase();
  const excludeSession =
    excludeNorm === "yes" ||
    excludeNorm === "y" ||
    excludeNorm === "1" ||
    excludeNorm === "true"
      ? "Yes"
      : "No";
  const billableRaw = String(row["Billable"] ?? "").trim().toLowerCase();
  let billable = "";
  if (["no", "n", "0", "false"].includes(billableRaw)) billable = "No";
  else if (["yes", "y", "1", "true"].includes(billableRaw)) billable = "Yes";
  return {
    line: lineNo,
    client: personLabel(row["Client First Name"], row["Client Last Name"]),
    staff: personLabel(row["Staff First Name"], row["Staff Last Name"]),
    serviceCode: String(row["Service Code With Modifiers"] ?? "").trim(),
    authNumber: String(row["Authorization Number"] ?? "").trim(),
    dos: previewExcelDateTime(row["DOS"]),
    aptStart: previewExcelDateTime(row["Apt Start Time"]),
    aptEnd: previewExcelDateTime(row["Apt End Time"]),
    status: String(row["Status"] ?? "").trim() || "Scheduled",
    billable,
    excludeSession,
    scheduledHrs,
    renderedHrs,
    address: String(row["Address"] ?? "").trim(),
  };
}

export async function parseSessionImportWorkbook(arrayBuffer) {
  const XLSX = await import("xlsx");
  // Keep Excel date/time serials numeric. cellDates + local TZ formatting
  // turns 8:00 into 07:59 and then Chicago display becomes 2:59 AM.
  const workbook = XLSX.read(arrayBuffer, {
    type: "array",
    cellDates: false,
    cellText: false,
  });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils
    .sheet_to_json(sheet, {
      defval: "",
      raw: true,
    })
    .filter((row) => {
      const first = String(row["Client First Name"] ?? "").trim();
      const last = String(row["Client Last Name"] ?? "").trim();
      return first !== "" || last !== "";
    });
  const headerCheck = validateExcelHeaders(rawRows);
  const mappedRows = rawRows.map((row) => mapExcelRow(row));
  const preview = mappedRows.map((row, i) => previewImportRow(row, i + 1));

  return {
    sheetName,
    headerCheck,
    rows: mappedRows,
    preview,
    rowCount: mappedRows.length,
  };
}
