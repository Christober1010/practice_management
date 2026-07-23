/**
 * Columns omitted from Reports UI, Excel import mapping, and API responses (GET).
 * Matches billing-style headers users do not want on session reports.
 */

/** CL_PA_RPT export headers — used by Reports and Scheduling session import. */
export const FULL_REPORT_REQUIRED_COLUMN_LABELS = [
  "Client First Name",
  "Client Last Name",
  "Client Middle Name",
  "Staff First Name",
  "Staff Last Name",
  "Staff Middle Name",
  "Name of RBT Supervised",
  "Payer",
  "Activity Type",
  "Location Code",
  "Authorization Number",
  "Service Code With Modifiers",
  "DOS",
  "Apt Start Time",
  "Apt End Time",
  "Duration Schedule In Min",
  "Duration Schedule In Hrs",
  "Rendered Date",
  "Rendered Start Time",
  "Rendered End Time",
  "Duration Render in Min",
  "Duration Render in Hrs",
  "Session Completion Latency in Hrs",
  "Address",
  "Status",
  "Non-Billable Notes",
  "Billable",
  "Office",
  "Rendering Provider First Name",
  "Rendering Provider Last Name",
  "Rendering Provider MiddleName",
  "Created By",
  "Created Date",
  "Notes",
  "Staff Signature On File",
  "Staff Sign Date",
  "Approx. location of Staff Sign",
  "Guardian Signature On File",
  "Guardian Sign Date",
  "Approx. location of Guardian Sign",
  "DIRECT or INDIRECT Service",
  "Make-Up Session",
  "Make-Up Session Hours",
  "Exclude From Payroll",
  "Exclude From Mileage",
];

/** Display / Excel header names excluded (case-insensitive). */
const EXCLUDED_LABELS_LOWER = new Set(
  [
    "Duration Render in Hrs",
    "Session hrs",
    "Coinsurance",
    "Copay",
    "copay",
    "Deductible",
    "Insurance Actual $ Paid",
    "Insurance Acutal $ Paid",
    "Insurance Acutal $  Paid",
    "Check num",
    "Cube payment date",
    "Cube Invoice ref",
  ].map((s) => s.trim().toLowerCase())
);

export const REQUIRED_COLUMNS = FULL_REPORT_REQUIRED_COLUMN_LABELS.filter(
  (c) => !EXCLUDED_LABELS_LOWER.has(String(c).trim().toLowerCase())
);

/** DB / JSON keys removed from each report row on read (and mirrored in PHP GET). */
export const EXCLUDED_REPORT_ROW_KEYS = [
  "duration_render_in_hrs",
  "coinsurance",
  "copay",
  "deductible",
  "insurance_actual_paid",
  "insurance_acutal_paid",
  "check_num",
  "cube_payment_date",
  "cube_invoice_ref",
  "session_hrs",
];

/**
 * Excel headers required for Schedule Tracker import (includes Duration Render in Hrs; optional Misc Hrs).
 * Duplicate detection uses client + staff + service code + DOS + Apt Start Time.
 */
export const SCHEDULE_TRACKER_EXCEL_COLUMNS = [
  "Client First Name",
  "Client Last Name",
  "Staff First Name",
  "Staff Last Name",
  "Name of RBT Supervised",
  "Payer",
  "Service Code With Modifiers",
  "DOS",
  "Apt Start Time",
  "Duration Render in Hrs",
  "Misc Hrs",
];

/** Schedule Tracker workflow tabs / reports.tracker_status values */
export const SCHEDULE_TRACKER_STATUSES = [
  "Pending",
  "Reviewed",
  "Excluded",
  "Pending Payment",
  "Received Payment",
];

const TRACKER_STATUS_LEGACY = {
  "payment posted": "Pending Payment",
  "payment cleared": "Received Payment",
};

export function normalizeTrackerStatus(value) {
  const s = value != null ? String(value).trim() : "";
  if (!s) return "Pending";
  const legacy = TRACKER_STATUS_LEGACY[s.toLowerCase()];
  if (legacy) return legacy;
  const found = SCHEDULE_TRACKER_STATUSES.find(
    (st) => st.toLowerCase() === s.toLowerCase()
  );
  return found ?? "Pending";
}

export function stripExcludedReportFields(row) {
  if (!row || typeof row !== "object") return row;
  const out = { ...row };
  for (const k of EXCLUDED_REPORT_ROW_KEYS) {
    if (Object.prototype.hasOwnProperty.call(out, k)) delete out[k];
  }
  for (const key of Object.keys(out)) {
    if (EXCLUDED_LABELS_LOWER.has(String(key).trim().toLowerCase())) {
      delete out[key];
    }
  }
  return out;
}
