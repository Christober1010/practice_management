#!/usr/bin/env node
/**
 * Build Theralytics/CL_PA_RPT session-import test workbooks.
 *
 * Usage:
 *   node docs/session-import-cases/build-test-excels.js
 *
 * Edit IDENTITY below so Client / Staff / Auth / Service Code exist in your DB
 * (unique name match + active authorization), then re-run.
 */
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const outDir = __dirname;
const templatePath = path.join(__dirname, "..", "session-calendar-sample-import.xlsx");

/**
 * REPLACE with real client / staff / auth that exist in YOUR DB.
 */
const IDENTITY = {
  clientFirst: "FirstName",
  clientLast: "LastName",
  staffFirst: "Mani",
  staffLast: "rbt",
  authNumber: "Auth1234",
  serviceCode: "97151",
  address: "100 Import Test St, Chicago, IL 60601",
};

/** Far-future DOS so these slots don't collide with normal calendar traffic. */
const DOS = "2026-11-10";

const wb0 = XLSX.read(fs.readFileSync(templatePath));
const templateHeaders = Object.keys(
  XLSX.utils.sheet_to_json(wb0.Sheets[wb0.SheetNames[0]], { defval: "" })[0] ||
    {}
);
const headers = templateHeaders.includes("Exclude Session")
  ? templateHeaders
  : [...templateHeaders, "Exclude Session"];

function excelSerial(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000 + 25569;
}

function excelTime(h, min) {
  return 25569 + (h * 3600 + min * 60) / 86400;
}

function buildRow({
  caseId,
  dosYmd,
  startHour,
  startMinute,
  durationMin,
  status,
  excludeSession = "No",
  renderedHrs = "",
  notes = "",
  serviceCode = IDENTITY.serviceCode,
}) {
  const endMin = startHour * 60 + startMinute + durationMin;
  const endH = Math.floor(endMin / 60);
  const endM = endMin % 60;
  const o = {};
  headers.forEach((h) => {
    o[h] = "";
  });
  const isRendered = String(status).toLowerCase() === "rendered";
  Object.assign(o, {
    "Client First Name": IDENTITY.clientFirst,
    "Client Last Name": IDENTITY.clientLast,
    "Staff First Name": IDENTITY.staffFirst,
    "Staff Last Name": IDENTITY.staffLast,
    "Authorization Number": IDENTITY.authNumber,
    "Service Code With Modifiers": serviceCode,
    DOS: excelSerial(dosYmd),
    "Apt Start Time": excelTime(startHour, startMinute),
    "Apt End Time": excelTime(endH, endM),
    "Duration Schedule In Min": String(durationMin),
    "Duration Schedule In Hrs": String(durationMin / 60),
    "Duration Render in Min": isRendered
      ? String(renderedHrs !== "" ? Number(renderedHrs) * 60 : durationMin)
      : "",
    "Duration Render in Hrs": isRendered
      ? String(renderedHrs !== "" ? renderedHrs : durationMin / 60)
      : "",
    "Location Code": "11",
    Address: IDENTITY.address,
    Status: status,
    Billable: "Yes",
    Notes: `[${caseId}] ${notes}`.trim(),
    "DIRECT or INDIRECT Service": "DIRECT",
    "Make-Up Session": "No",
    "Exclude Session": excludeSession,
  });
  return o;
}

function writeWorkbook(fileName, rows) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(rows, { header: headers }),
    "Sheet1"
  );
  const outPath = path.join(outDir, fileName);
  XLSX.writeFile(wb, outPath);
  console.log("Wrote", outPath, "rows=", rows.length);
}

const pass1 = [
  buildRow({
    caseId: "CASE1_CREATE_OK",
    dosYmd: DOS,
    startHour: 8,
    startMinute: 0,
    durationMin: 60,
    status: "Scheduled",
    excludeSession: "No",
    notes: "Baseline create — expect READY / create",
  }),
  buildRow({
    caseId: "CASE2_EXCLUDE_YES",
    dosYmd: DOS,
    startHour: 9,
    startMinute: 0,
    durationMin: 60,
    status: "Scheduled",
    excludeSession: "Yes",
    notes: "Exclude Session=Yes — create with exclude_session=Yes",
  }),
  buildRow({
    caseId: "CASE3_WITHIN_DUP_KEEP",
    dosYmd: DOS,
    startHour: 10,
    startMinute: 0,
    durationMin: 60,
    status: "Scheduled",
    notes: "First of within-file duplicate pair — expect create",
  }),
  buildRow({
    caseId: "CASE4_WITHIN_DUP_REJECT",
    dosYmd: DOS,
    startHour: 10,
    startMinute: 0,
    durationMin: 60,
    status: "Scheduled",
    notes: "SAME client+DOS+time+code as CASE3 — expect REJECT (in-file duplicate)",
  }),
  buildRow({
    caseId: "CASE5_CREATE_FOR_UPGRADE",
    dosYmd: DOS,
    startHour: 14,
    startMinute: 0,
    durationMin: 60,
    status: "Scheduled",
    notes: "Import as Scheduled now; Pass 2 upgrades this to Rendered",
  }),
  buildRow({
    caseId: "CASE6_CREATE_SECOND_OK",
    dosYmd: DOS,
    startHour: 15,
    startMinute: 0,
    durationMin: 60,
    status: "Scheduled",
    notes: "Second unique create — expect create",
  }),
];

const pass2 = [
  buildRow({
    caseId: "CASE7_UPGRADE_TO_RENDERED",
    dosYmd: DOS,
    startHour: 14,
    startMinute: 0,
    durationMin: 60,
    status: "Rendered",
    renderedHrs: 1,
    notes:
      "Same key as CASE5 — expect UPDATE Scheduled→Rendered (not duplicate error)",
  }),
  buildRow({
    caseId: "CASE8_DB_DUP_STILL_SCHEDULED",
    dosYmd: DOS,
    startHour: 8,
    startMinute: 0,
    durationMin: 60,
    status: "Scheduled",
    notes:
      "Same key as CASE1 (already Scheduled in DB) — expect REJECT duplicate",
  }),
  buildRow({
    caseId: "CASE9_ALREADY_RENDERED_DUP",
    dosYmd: DOS,
    startHour: 14,
    startMinute: 0,
    durationMin: 60,
    status: "Rendered",
    renderedHrs: 1,
    notes:
      "Same as CASE7 after upgrade — expect REJECT (already Rendered)",
  }),
  buildRow({
    caseId: "CASE10_CREATE_NEW_AFTER",
    dosYmd: DOS,
    startHour: 16,
    startMinute: 0,
    durationMin: 60,
    status: "Scheduled",
    notes: "Brand-new time slot — expect create",
  }),
];

writeWorkbook("pass1-create-exclude-duplicates.xlsx", pass1);
writeWorkbook("pass2-scheduled-to-rendered.xlsx", pass2);

fs.writeFileSync(
  path.join(outDir, "identity.placeholder.json"),
  JSON.stringify(
    {
      ...IDENTITY,
      dos: DOS,
      note: "Edit IDENTITY in build-test-excels.js then re-run to regenerate.",
    },
    null,
    2
  )
);

console.log("Done. DOS=", DOS, "client=", IDENTITY.clientFirst, IDENTITY.clientLast);
