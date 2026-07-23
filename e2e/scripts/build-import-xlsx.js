#!/usr/bin/env node
/** Build a CL_PA_RPT-format xlsx for Playwright import tests. */
const XLSX = require("xlsx");
const fs = require("fs");

const [templatePath, outPath, rowsJson] = process.argv.slice(2);
if (!templatePath || !outPath || !rowsJson) {
  console.error(
    "Usage: node build-import-xlsx.js <template.xlsx> <out.xlsx> '<json rows>'"
  );
  process.exit(1);
}

const rowsIn = JSON.parse(rowsJson);
const wb0 = XLSX.read(fs.readFileSync(templatePath));
const headers = Object.keys(
  XLSX.utils.sheet_to_json(wb0.Sheets[wb0.SheetNames[0]], { defval: "" })[0] ||
    {}
);

function excelSerial(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000 + 25569;
}

function excelTime(h, min) {
  return 25569 + (h * 3600 + min * 60) / 86400;
}

const outRows = rowsIn.map((r) => {
  const o = {};
  headers.forEach((h) => {
    o[h] = "";
  });
  const endMin = r.startHour * 60 + r.startMinute + r.durationMin;
  const endH = Math.floor(endMin / 60);
  const endM = endMin % 60;
  Object.assign(o, {
    "Client First Name": r.clientFirst,
    "Client Last Name": r.clientLast,
    "Staff First Name": r.staffFirst,
    "Staff Last Name": r.staffLast,
    "Authorization Number": r.authNumber,
    "Service Code With Modifiers": r.serviceCode,
    DOS: excelSerial(r.dosYmd),
    "Apt Start Time": excelTime(r.startHour, r.startMinute),
    "Apt End Time": excelTime(endH, endM),
    "Duration Schedule In Min": String(r.durationMin),
    "Duration Schedule In Hrs": String(r.durationMin / 60),
    "Location Code": "11",
    Address: r.address,
    Status: r.status || "Scheduled",
    Billable: "Yes",
    Notes: r.notes,
    "DIRECT or INDIRECT Service": "DIRECT",
    "Make-Up Session": "No",
  });
  return o;
});

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.json_to_sheet(outRows, { header: headers }),
  "Sheet1"
);
XLSX.writeFile(wb, outPath);
console.log("Wrote", outPath, outRows.length, "rows");
