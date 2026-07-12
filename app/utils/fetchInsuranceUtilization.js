import { mahaverseFetch } from "@/lib/mahaverse-api";

export async function fetchInsuranceUtilization(params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, String(value));
  }
  const suffix = query.toString();
  const res = await mahaverseFetch(
    `/reports-insurance-utilization.php${suffix ? `?${suffix}` : ""}`,
  );
  const json = await res.json();
  if (!json?.success) {
    throw new Error(json?.message || "Failed to load insurance utilization");
  }
  return json?.data || { rows: [], insurance_rollups: [], summary: {} };
}
