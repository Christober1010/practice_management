/** ABA CPT billing codes and their standard descriptions. */
export const ABA_SERVICE_CODE_NAMES = {
  "97151": "Behavior Identification Assessment",
  "97152": "Behavior Identification Supporting Assessment",
  "97153": "Adaptive Behavior Treatment by Protocol",
  "97154": "Group Adaptive Behavior Treatment by Protocol",
  "97155": "Adaptive Behavior Treatment with Protocol Modification",
  "97156": "Family Adaptive Behavior Treatment Guidance",
  "97157": "Multiple Family Group Adaptive Behavior Treatment Guidance",
  "97158": "Group Adaptive Behavior Treatment with Protocol Modification",
};

/**
 * "97153 - Adaptive Behavior Treatment by Protocol" for a session row.
 * Falls back to the bare code, then the auth/billing code, then "N/A".
 */
export function sessionServiceCodeLabel(session) {
  const code = String(session?.service_code ?? session?.serviceCode ?? "").trim();
  if (code) {
    const name = ABA_SERVICE_CODE_NAMES[code.slice(0, 5)];
    return name ? `${code} - ${name}` : code;
  }
  const auth = String(session?.auth_code ?? session?.authCode ?? "").trim();
  return auth || "N/A";
}
