import type { Page, Response } from "@playwright/test";

export const API_BACKEND = /mahaverse-backend-(test|logics)/;

export function apiUrl(path: string): RegExp {
  const escaped = path.replace(/\./g, "\\.");
  return new RegExp(`${API_BACKEND.source}${escaped}`);
}

export function waitForApi(
  page: Page,
  path: string,
  options: { method?: string; status?: number } = {}
): Promise<Response> {
  const { method = "GET", status = 200 } = options;
  return page.waitForResponse(
    (res) =>
      apiUrl(path).test(res.url()) &&
      res.request().method() === method &&
      res.status() === status,
    { timeout: 30_000 }
  );
}
