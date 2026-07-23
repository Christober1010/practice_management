import { expect, type APIRequestContext } from "@playwright/test";
import { MahaverseApiClient, type ApiJson } from "./api-client";
import { sessionIsRenderedOrReadyToBill } from "../../lib/scheduling-session-status";

/** Fields that should be populated after create + render for billing parity. */
export const BILLING_PARITY_KEYS = [
  "client_id",
  "provider_id",
  "auth_id",
  "auth_code",
  "place_of_service",
  "location_address",
  "status",
  "scheduled_hours",
  "rendered_hours",
  "claim_id",
  "claim_status",
  "unit_rate",
  "line_charge",
  "authorization_number",
  "service_code",
  "taxonomy_code",
  "recurring",
  "start_utc",
  "end_utc",
] as const;

export type BillingSnapshot = Record<(typeof BILLING_PARITY_KEYS)[number], unknown>;

export function normalizeBillingSnapshot(row: ApiJson): BillingSnapshot {
  const status = String(row.status ?? row.STATUS ?? "").trim();
  const rendered = Number.parseFloat(String(row.rendered_hours ?? 0)) || 0;
  return {
    client_id: row.client_id != null ? String(row.client_id) : "",
    provider_id: row.provider_id != null ? String(row.provider_id) : "",
    auth_id: row.auth_id != null ? String(row.auth_id) : "",
    auth_code: row.auth_code != null ? String(row.auth_code) : "",
    place_of_service: row.place_of_service ?? "",
    location_address: row.location_address ?? "",
    status,
    scheduled_hours: Number.parseFloat(String(row.scheduled_hours ?? 0)) || 0,
    rendered_hours: rendered,
    claim_id: row.claim_id != null ? String(row.claim_id) : "",
    claim_status: row.claim_status != null ? String(row.claim_status) : "",
    unit_rate:
      row.unit_rate != null && row.unit_rate !== ""
        ? Number.parseFloat(String(row.unit_rate))
        : null,
    line_charge:
      row.line_charge != null && row.line_charge !== ""
        ? Number.parseFloat(String(row.line_charge))
        : null,
    authorization_number: row.authorization_number ?? "",
    service_code: row.service_code ?? "",
    taxonomy_code: row.taxonomy_code ?? "",
    recurring: row.recurring ?? "",
    start_utc: row.start_utc ?? "",
    end_utc: row.end_utc ?? "",
  };
}

export function billingKeysPopulated(snap: BillingSnapshot): string[] {
  return BILLING_PARITY_KEYS.filter((k) => {
    const v = snap[k];
    if (v === null || v === undefined || v === "") return false;
    if (typeof v === "number" && Number.isNaN(v)) return false;
    return true;
  });
}

export function diffBillingSnapshots(
  manual: BillingSnapshot,
  imported: BillingSnapshot
): { missingOnImport: string[]; valueDiffs: Array<{ key: string; manual: unknown; imported: unknown }> } {
  const manualKeys = new Set(billingKeysPopulated(manual));
  const missingOnImport: string[] = [];
  const valueDiffs: Array<{ key: string; manual: unknown; imported: unknown }> = [];

  for (const key of manualKeys) {
    if (key === "start_utc" || key === "end_utc") continue;
    const iv = imported[key];
    if (iv === null || iv === undefined || iv === "") {
      missingOnImport.push(key);
      continue;
    }
    if (key === "scheduled_hours" || key === "rendered_hours" || key === "unit_rate" || key === "line_charge") {
      const m = Number(manual[key]);
      const n = Number(iv);
      if (Math.abs(m - n) > 0.01) {
        valueDiffs.push({ key, manual: m, imported: n });
      }
    } else if (String(manual[key]) !== String(iv)) {
      valueDiffs.push({ key, manual: manual[key], imported: iv });
    }
  }

  return { missingOnImport, valueDiffs };
}

export async function fetchSessionById(
  request: APIRequestContext,
  token: string,
  sessionId: string
): Promise<ApiJson> {
  const api = new MahaverseApiClient(request, token);
  const { data } = await api.expectOk(`add-session.php?id=${sessionId}`);
  return data;
}

export function assertReadyToBill(session: ApiJson, label: string) {
  const snap = normalizeBillingSnapshot(session);
  expect(
    sessionIsRenderedOrReadyToBill({
      status: snap.status,
      rendered_hours: snap.rendered_hours,
      claim_id: snap.claim_id,
      claim_status: snap.claim_status,
    }),
    `${label} should be rendered / ready to bill`
  ).toBeTruthy();
  expect(String(snap.status).toLowerCase()).toMatch(/rendered|completed/);
}
