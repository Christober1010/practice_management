import { expect } from "@playwright/test";
import type { ApiJson } from "./api-client";

/** MySQL / PHP responses when a migration was not applied on this DB. */
export const SCHEMA_ERROR_RE =
  /Unknown column|doesn't exist|Table '[^']+' doesn't exist|no such column/i;

export function getApiErrorText(data: ApiJson): string {
  return String(data.error ?? data.message ?? data.detail ?? "");
}

export function isSchemaDriftError(text: string): boolean {
  return SCHEMA_ERROR_RE.test(text);
}

/**
 * Fail the test when the API reports a missing table/column.
 * Use for prod (and test) so migration gaps surface as red failures, not skips.
 */
export function assertNoSchemaDrift(
  data: ApiJson,
  endpoint: string,
  status?: number
): void {
  const err = getApiErrorText(data);
  if (!isSchemaDriftError(err)) return;

  const target = process.env.E2E_TARGET || "unknown";
  const statusPart = status != null ? ` HTTP ${status}` : "";
  expect.fail(
    [
      `Database schema drift on ${target} (${endpoint}${statusPart}).`,
      err,
      "Apply pending SQL from docs/MIGRATIONS-CHECKLIST.md on this environment's MySQL host.",
    ].join(" ")
  );
}
