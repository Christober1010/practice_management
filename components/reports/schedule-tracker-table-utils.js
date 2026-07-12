/** Column keys and layout per Session Import tab. */

export const TRACKER_COLUMN_LABELS = {
  dos: "DOS / time",
  client: "Client",
  staff: "Staff",
  service_code: "Service code",
  duration: "Duration (hrs)",
  misc_hrs: "Misc hrs",
  diff: "Diff",
  payer_paid: "Payer paid $",
  check_number: "Check #",
  ap_invoice: "AP Invoice",
  ap_date: "AP date",
  coinsurance: "Co-insurance $",
  copay: "Copay $",
  deductible: "Deductible $",
  client_id: "Client ID",
  provider_id: "Provider ID",
  payer: "Payer",
  rbt_supervised: "RBT supervised",
};

const SESSION_PREFIX = ["dos", "client", "staff", "service_code", "duration", "misc_hrs", "diff"];
const SESSION_TAIL = ["client_id", "provider_id", "payer", "rbt_supervised"];
const PAYMENT_MIDDLE = ["payer_paid", "check_number", "coinsurance", "copay", "deductible"];
const RECEIVED_PAYMENT_MIDDLE = [
  "payer_paid",
  "check_number",
  "ap_invoice",
  "ap_date",
  "coinsurance",
  "copay",
  "deductible",
];

export function trackerColumnsForStatus(status) {
  if (status === "Reviewed" || status === "Pending Payment") {
    return [...SESSION_PREFIX, ...PAYMENT_MIDDLE, ...SESSION_TAIL];
  }
  if (status === "Received Payment") {
    return [...SESSION_PREFIX, ...RECEIVED_PAYMENT_MIDDLE, ...SESSION_TAIL];
  }
  return [...SESSION_PREFIX, ...SESSION_TAIL];
}

export function trackerColumnIsMoney(key) {
  return key === "payer_paid" || key === "coinsurance" || key === "copay" || key === "deductible";
}

export function trackerPaymentFieldForColumn(key) {
  const map = {
    payer_paid: "payer_paid_amount",
    coinsurance: "coinsurance_amount",
    copay: "copay_amount",
    deductible: "deductible_amount",
    check_number: "check_number",
    ap_invoice: "ap_invoice",
    ap_date: "ap_date",
  };
  return map[key] ?? null;
}

export function formatMoneyDisplay(value) {
  if (value == null || value === "") return "";
  const n = Number(String(value).trim());
  if (!Number.isFinite(n)) return String(value);
  return n.toFixed(2);
}

export function formatMoneyOnBlur(value) {
  const t = String(value ?? "").trim();
  if (!t) return "";
  const n = Number(t.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n)) return t;
  return n.toFixed(2);
}

export function parseMoney(value) {
  if (value == null || value === "") return null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

export function sumMoneyColumn(rows, amounts, savedPayments, columnKey) {
  const field = trackerPaymentFieldForColumn(columnKey);
  if (!field || field === "check_number" || field === "ap_invoice" || field === "ap_date") {
    return null;
  }
  let sum = 0;
  let any = false;
  for (const row of rows) {
    const pk = String(row.id);
    const draft = amounts[pk];
    const saved = savedPayments.find((s) => String(s.report_id) === pk);
    const raw =
      draft?.[field] !== undefined
        ? draft[field]
        : saved?.[field] != null
          ? String(saved[field])
          : "";
    const n = parseMoney(raw);
    if (n != null) {
      sum += n;
      any = true;
    }
  }
  return any ? sum : null;
}
