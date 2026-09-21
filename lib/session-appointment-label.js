import { extractProcedureCodesFromBillingText } from "@/lib/authorization-billing-code";

/** Billing code text stored on a scheduling session row. */
export function sessionBillingCodeText(session) {
  if (!session) return "";
  return String(
    session.auth_code ?? session.authCode ?? session.service_code ?? ""
  ).trim();
}

/**
 * Human-readable appointment label for Session Notes Overview.
 * Prefers master service code description; falls back to billing code text.
 */
export function sessionAppointmentLabel(session, serviceCodeDescriptions = {}) {
  const billing = sessionBillingCodeText(session);
  if (!billing) return "";

  const cpts = extractProcedureCodesFromBillingText(billing);
  for (const cpt of cpts) {
    const description = serviceCodeDescriptions[cpt];
    if (description) return description;
  }

  return billing;
}

/** Build { [cptCode]: description } from service-codes.php rows. */
export function serviceCodeDescriptionMap(codes) {
  const map = {};
  for (const row of codes || []) {
    const code = String(row?.code ?? "").trim();
    const description = String(row?.code_description ?? "").trim();
    if (code && description) map[code] = description;
  }
  return map;
}
