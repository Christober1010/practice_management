import { test, expect } from "@playwright/test";
import { gotoApp, clickSidebar } from "./helpers/navigation";
import { MahaverseApiClient } from "./helpers/api-client";

/** Write distinctive values via API, then confirm they appear in Session Import UI. */
test.describe.configure({ mode: "serial" });

type ReportRow = {
  id: number;
  tracker_status?: string;
  client_id?: string;
  client_first_name?: string;
  client_last_name?: string;
  service_code_with_modifiers?: string;
  dos?: string;
  misc_hrs?: number | string | null;
};

type PaymentRow = {
  report_id?: number;
  client_id?: string;
  insurance_id?: number;
  check_number?: string | null;
  payer_paid_amount?: string | null;
  coinsurance_amount?: string | null;
  copay_amount?: string | null;
  deductible_amount?: string | null;
  ap_invoice?: string | null;
  ap_date?: string | null;
};

const stamp = Date.now().toString().slice(-6);

const markers = {
  miscHrs: `7.${stamp.slice(0, 2)}`,
  payerPaid: `4${stamp.slice(0, 2)}.99`,
  coinsurance: "11.11",
  checkNumber: `E2EUI${stamp}`,
  ppCheckNumber: `E2EPP${stamp}`,
  ppPayerPaid: `3${stamp.slice(0, 2)}.50`,
  apInvoice: `INV-E2E-${stamp}`,
  apDate: "2026-06-20",
};

const seed: {
  pending?: { id: number; clientLabel: string; origMisc: string };
  paymentRow?: {
    id: number;
    clientId: string;
    insuranceId: number;
    dos: string;
    serviceCode: string;
    clientLabel: string;
    origStatus: string;
    orig: PaymentRow;
  };
  received?: { id: number; checkNumber: string; origApInvoice: string; origApDate: string };
} = {};

async function clearDosFilters(page: import("@playwright/test").Page) {
  await page.getByLabel("DOS from").fill("");
  await page.getByLabel("DOS to").fill("");
}

async function openSessionImport(page: import("@playwright/test").Page) {
  await gotoApp(page);
  await clickSidebar(page, "Reports");
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Session Import" }).first()).toBeVisible();
}

function clientLabel(row: ReportRow) {
  return `${row.client_first_name || ""} ${row.client_last_name || ""}`.trim();
}

async function filterByClient(page: import("@playwright/test").Page, label: string) {
  await page.getByRole("combobox").first().click();
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.keyboard.press("Escape");
}

async function savePaymentEntry(
  api: MahaverseApiClient,
  row: NonNullable<(typeof seed)["paymentRow"]>,
  values: {
    coinsurance_amount?: string;
    copay_amount?: string;
    deductible_amount?: string;
    payer_paid_amount?: string;
    check_number?: string;
  }
) {
  await api.expectOk("payer-payment-entries.php", "POST", {
    save_only: true,
    entries: [
      {
        report_id: row.id,
        client_id: row.clientId,
        insurance_id: row.insuranceId,
        dos: row.dos,
        service_code: row.serviceCode,
        coinsurance_amount: values.coinsurance_amount ?? "",
        copay_amount: values.copay_amount ?? "",
        deductible_amount: values.deductible_amount ?? "",
        payer_paid_amount: values.payer_paid_amount ?? "",
        check_number: values.check_number ?? "",
      },
    ],
  });
}

test.describe("Session Import — API values in UI", () => {
  test.beforeAll(async ({ request }) => {
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;
    if (!email || !password) {
      test.skip(true, "E2E_EMAIL / E2E_PASSWORD not set");
      return;
    }

    const api = await MahaverseApiClient.login(request, email, password);
    const { data: listData } = await api.expectOk(
      "reports.php?archived=0&context=schedule_tracker"
    );
    const rows = (listData.data as ReportRow[]) || [];
    const { data: payData } = await api.expectOk("payer-payment-entries.php");
    const payments = (payData.data as PaymentRow[]) || [];

    const pending = rows.find((r) => r.tracker_status === "Pending");
    if (!pending) throw new Error("No Pending row in test DB for API→UI seed");

    const origMisc =
      pending.misc_hrs != null && pending.misc_hrs !== "" ? String(pending.misc_hrs) : "";
    await api.expectOk("reports.php", "PUT", {
      id: pending.id,
      misc_hrs: markers.miscHrs,
    });
    seed.pending = { id: pending.id, clientLabel: clientLabel(pending), origMisc };

    const paymentEntry = payments.find((p) => {
      if (!p.report_id || !p.client_id || !p.insurance_id) return false;
      const row = rows.find((r) => r.id === p.report_id);
      return (
        row &&
        (row.tracker_status === "Pending Payment" || row.tracker_status === "Reviewed")
      );
    });
    if (!paymentEntry?.report_id) {
      throw new Error("No Pending Payment / Reviewed row with payment entry for API→UI seed");
    }
    const paymentReport = rows.find((r) => r.id === paymentEntry.report_id)!;
    seed.paymentRow = {
      id: paymentEntry.report_id,
      clientId: String(paymentEntry.client_id),
      insuranceId: Number(paymentEntry.insurance_id),
      dos: String(paymentReport.dos ?? "").slice(0, 10),
      serviceCode: String(paymentReport.service_code_with_modifiers ?? ""),
      clientLabel: clientLabel(paymentReport),
      origStatus: String(paymentReport.tracker_status ?? "Pending Payment"),
      orig: { ...paymentEntry },
    };

    const receivedPayment = payments.find((p) => {
      if (!p.report_id) return false;
      const row = rows.find((r) => r.id === p.report_id);
      return row?.tracker_status === "Received Payment";
    });
    if (!receivedPayment?.report_id) {
      throw new Error("No Received Payment row with payment entry for API→UI seed");
    }
    seed.received = {
      id: receivedPayment.report_id,
      checkNumber: String(receivedPayment.check_number ?? markers.checkNumber),
      origApInvoice: receivedPayment.ap_invoice ? String(receivedPayment.ap_invoice) : "",
      origApDate: receivedPayment.ap_date ? String(receivedPayment.ap_date).slice(0, 10) : "",
    };
    await api.expectOk("payer-payment-entries.php", "PUT", {
      action: "save_ap",
      entries: [
        {
          report_id: seed.received.id,
          ap_invoice: markers.apInvoice,
          ap_date: markers.apDate,
        },
      ],
    });
  });

  test.afterAll(async ({ request }) => {
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;
    if (!email || !password || !seed.pending) return;

    const api = await MahaverseApiClient.login(request, email, password);

    if (seed.pending) {
      await api.put("reports.php", {
        id: seed.pending.id,
        misc_hrs: seed.pending.origMisc === "" ? null : seed.pending.origMisc,
      });
    }
    if (seed.paymentRow) {
      const o = seed.paymentRow.orig;
      await savePaymentEntry(api, seed.paymentRow, {
        coinsurance_amount: o.coinsurance_amount ?? "",
        copay_amount: o.copay_amount ?? "",
        deductible_amount: o.deductible_amount ?? "",
        payer_paid_amount: o.payer_paid_amount ?? "",
        check_number: o.check_number ?? "",
      });
      await api.put("reports.php", {
        bulk: true,
        ids: [seed.paymentRow.id],
        tracker_status: seed.paymentRow.origStatus,
      });
    }
    if (seed.received) {
      await api.put("payer-payment-entries.php", {
        action: "save_ap",
        entries: [
          {
            report_id: seed.received.id,
            ap_invoice: seed.received.origApInvoice,
            ap_date: seed.received.origApDate,
          },
        ],
      });
    }
  });

  test("Pending tab shows misc hrs written via reports.php API", async ({ page }) => {
    test.skip(!seed.pending, "Seed not prepared");

    await openSessionImport(page);
    await clearDosFilters(page);
    await filterByClient(page, seed.pending!.clientLabel);

    await expect(page.locator("tbody input[inputmode='decimal']").first()).toHaveValue(
      markers.miscHrs,
      { timeout: 20_000 }
    );
  });

  test("Reviewed tab shows payment $ and check # from payer-payment-entries API", async ({
    page,
    request,
  }) => {
    test.skip(!seed.paymentRow, "Seed not prepared");

    const api = await MahaverseApiClient.login(request, process.env.E2E_EMAIL!, process.env.E2E_PASSWORD!);
    await api.expectOk("reports.php", "PUT", {
      bulk: true,
      ids: [seed.paymentRow!.id],
      tracker_status: "Reviewed",
    });
    await savePaymentEntry(api, seed.paymentRow!, {
      coinsurance_amount: markers.coinsurance,
      copay_amount: "0.00",
      deductible_amount: "0.00",
      payer_paid_amount: markers.payerPaid,
      check_number: markers.checkNumber,
    });

    await openSessionImport(page);
    await clearDosFilters(page);
    const paymentsReq = page.waitForResponse(
      (r) => r.url().includes("payer-payment-entries.php") && r.status() === 200
    );
    await page.getByRole("tab", { name: /^Reviewed\s+\d+/ }).click();
    await paymentsReq;
    await filterByClient(page, seed.paymentRow!.clientLabel);

    await expect(page.locator(`tbody input[value="${markers.checkNumber}"]`)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator(`tbody input[value="${markers.payerPaid}"]`)).toBeVisible();
    await expect(page.locator(`tbody input[value="${markers.coinsurance}"]`)).toBeVisible();
  });

  test("Pending Payment tab shows payment values from API (save_only)", async ({
    page,
    request,
  }) => {
    test.skip(!seed.paymentRow, "Seed not prepared");

    const api = await MahaverseApiClient.login(request, process.env.E2E_EMAIL!, process.env.E2E_PASSWORD!);
    await api.expectOk("reports.php", "PUT", {
      bulk: true,
      ids: [seed.paymentRow!.id],
      tracker_status: "Pending Payment",
    });
    await savePaymentEntry(api, seed.paymentRow!, {
      coinsurance_amount: seed.paymentRow!.orig.coinsurance_amount ?? "",
      copay_amount: seed.paymentRow!.orig.copay_amount ?? "",
      deductible_amount: seed.paymentRow!.orig.deductible_amount ?? "",
      payer_paid_amount: markers.ppPayerPaid,
      check_number: markers.ppCheckNumber,
    });

    await openSessionImport(page);
    await clearDosFilters(page);
    const paymentsReq = page.waitForResponse(
      (r) => r.url().includes("payer-payment-entries.php") && r.status() === 200
    );
    await page.getByRole("tab", { name: /^Pending Payment\s+\d+/ }).click();
    await paymentsReq;
    await filterByClient(page, seed.paymentRow!.clientLabel);

    await expect(page.locator(`tbody input[value="${markers.ppCheckNumber}"]`)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator(`tbody input[value="${markers.ppPayerPaid}"]`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Received Payment", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Save Changes/ })).toBeVisible();
  });

  test("Received Payment tab shows AP Invoice and AP date from save_ap API", async ({
    page,
  }) => {
    test.skip(!seed.received, "Seed not prepared");

    await openSessionImport(page);
    await clearDosFilters(page);
    const paymentsReq = page.waitForResponse(
      (r) => r.url().includes("payer-payment-entries.php") && r.status() === 200
    );
    await page.getByRole("tab", { name: /^Received Payment\s+\d+/ }).click();
    await paymentsReq;
    await page.getByLabel("Search by check number").fill(seed.received!.checkNumber);

    await expect(page.locator(`tbody input[value="${markers.apInvoice}"]`)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator(`tbody input[value="${markers.apDate}"]`)).toBeVisible();
  });
});
