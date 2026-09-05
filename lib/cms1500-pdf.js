import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const TEMPLATE_PATH = "/cms1500-template.pdf";

function safe(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/** CMS-1500 filled data: typewritten look uses all-caps monospace (NUCC / OCR-style claims). */
function filledDisplayText(v) {
  const t = safe(v);
  return t ? t.toUpperCase() : "";
}

function joinAddress(parts = []) {
  return parts.filter(Boolean).join(", ");
}

/** Box 33b: NUCC secondary ID; default qualifier ZZ for taxonomy when absent. */
function formatBox33bTaxonomy(code) {
  const t = safe(code).replace(/\s/g, "");
  if (!t) return "";
  if (/^[A-Za-z]{2}\d/.test(t)) return t.toUpperCase();
  return `ZZ${t.toUpperCase()}`;
}

/**
 * Box 24J shaded (non-NPI) when 24I is ZZ: taxonomy code only.
 * Qualifier ZZ is already in 24I — do not repeat it here.
 */
function formatBox24jTaxonomy(code) {
  const t = safe(code).replace(/\s/g, "").toUpperCase();
  if (!t) return "";
  if (t.startsWith("ZZ") && t.length > 2) return t.slice(2);
  return t;
}

/** Box 1 "Other" fallback if template field layout differs (cms1500-template.pdf widget 6). */
const BOX1_OTHER_MARK_FALLBACK = { x: 338, topY: 116.65 };

/**
 * Compute mark() args so a Courier "X" sits optically centered in a PDF checkbox rect
 * (origin bottom-left). drawText uses baseline y; most of the glyph sits above baseline.
 */
function checkboxXMarkParams(rect, pageHeight, size = 9) {
  const r = rect;
  const midY = r.y + r.height / 2;
  const baselineY = midY - size * 0.36;
  const cx = r.x + r.width / 2;
  const x = cx - size * 0.32;
  return { x, topY: pageHeight - baselineY };
}

/** CMS-1500 Box 24E uses A–L; legacy payloads may send 1–12. */
function formatCharge(amount) {
  if (amount === null || amount === undefined || amount === "") return "";
  const n = Number(amount);
  if (!Number.isFinite(n)) return "";
  return n.toFixed(2);
}

function formatDiagnosisPointers(pointers) {
  return (Array.isArray(pointers) ? pointers : [])
    .map((p) => {
      const s = safe(p).toUpperCase();
      if (/^[A-L]$/.test(s)) return s;
      const n = Number.parseInt(s, 10);
      if (Number.isFinite(n) && n >= 1 && n <= 12) {
        return String.fromCharCode(64 + n);
      }
      return "";
    })
    .filter(Boolean)
    .join(",");
}

function splitDateYMD(value) {
  const raw = safe(value);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return { yy: "", mm: "", dd: "" };
  // CMS-1500 service-line year widgets (sv*_yy_*) allow max 2 characters.
  return { yy: m[1].slice(-2), mm: m[2], dd: m[3] };
}

function formatSlashDate(isoPrimary, isoFallback = "") {
  const raw = safe(isoPrimary) || safe(isoFallback);
  const d = splitDateYMD(raw);
  if (!d.mm) return "";
  return `${d.mm}/${d.dd}/${d.yy}`;
}

function splitPhone(value) {
  const digits = safe(value).replace(/\D/g, "");
  if (digits.length >= 10) {
    return { area: digits.slice(0, 3), number: digits.slice(3, 10) };
  }
  return { area: "", number: "" };
}

function normalizeSex(value) {
  const v = safe(value).toLowerCase();
  if (v.startsWith("m")) return "M";
  if (v.startsWith("f")) return "F";
  return "";
}

/**
 * Box 6 (patient relationship to insured): `rel_to_ins` widgets on template, left → right:
 * 0 Self, 1 Spouse, 2 Child, 3 Other.
 * Backend sets `insured.same_as_patient` from `client_insurance.insured_same_as_client` (YES ⇒ Self).
 */
function relInsWidgetIndex(insured) {
  const same = safe(insured.same_as_patient).toUpperCase();
  if (same === "YES" || same === "Y" || same === "1" || same === "TRUE") {
    return 0;
  }
  const rel = safe(insured.relationship).toLowerCase();
  if (!rel) return null;
  if (/\bself\b/.test(rel) || rel === "subscriber") return 0;
  if (rel.includes("spouse") || rel.includes("wife") || rel.includes("husband")) return 1;
  if (
    rel.includes("child") ||
    rel.includes("son") ||
    rel.includes("daughter") ||
    rel.includes("dependent") ||
    rel.includes("minor")
  ) {
    return 2;
  }
  return 3;
}

function formatFederalTaxId(value) {
  const raw = safe(value);
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 9) {
    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  }
  return raw;
}

async function buildCms1500TemplatePdfBytes(payload) {
  const templateResp = await fetch(TEMPLATE_PATH, { cache: "no-store" });
  if (!templateResp.ok) {
    throw new Error("CMS-1500 template could not be loaded from public assets.");
  }

  const templateBytes = await templateResp.arrayBuffer();
  const pdfDoc = await PDFDocument.load(templateBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Courier);
  const bold = await pdfDoc.embedFont(StandardFonts.CourierBold);
  const page = pdfDoc.getPages()[0];
  const { height } = page.getSize();
  const form = pdfDoc.getForm();

  const patient = payload?.patient || {};
  const insured = payload?.insured || {};
  const policy = payload?.policy || {};
  const diagnosis = payload?.diagnosis || {};
  const billing = payload?.billing_provider || {};
  const payer = payload?.payer || {};
  const facility = payload?.service_facility || {};
  const rendering = payload?.rendering_provider || {};
  const lines = Array.isArray(payload?.lines) ? payload.lines : [];
  const patientDob = splitDateYMD(patient.dob);
  const insuredDob = splitDateYMD(insured.dob);
  const today = splitDateYMD(new Date().toISOString().slice(0, 10));
  const patientPhone = splitPhone(patient.phone || patient.phone_number || "");
  const sex = normalizeSex(patient.sex);

  let box1OtherMark = { ...BOX1_OTHER_MARK_FALLBACK };
  let sexMarkCoords = null;
  let relBox6MarkCoords = null;
  /** Box 10a/10b/10c and Box 11d: template uses widget 1 = NO (right checkbox). */
  const box10And11dNoMarks = [];
  let assignmentYesMark = null;
  /** Box 25 EIN checkbox (left widget on `ssn` field, beside `tax_id`). */
  let box25EinMark = null;

  const pt = (x, topY) => ({ x, y: height - topY });
  const draw = (text, x, topY, opts = {}) => {
    const value = opts.raw ? safe(text) : filledDisplayText(text);
    if (!value) return;
    const p = pt(x, topY);
    page.drawText(value, {
      x: p.x,
      y: p.y,
      size: opts.size || 8,
      font: opts.bold ? bold : font,
      color: rgb(0, 0, 0),
      maxWidth: opts.maxWidth || 260,
      lineHeight: (opts.size || 8) + 1,
    });
  };
  const mark = (x, y) => draw("X", x, y, { size: 9, bold: true, raw: true });
  const setText = (name, value) => {
    const v = filledDisplayText(value);
    try {
      const f = form.getTextField(name);
      f.setText(v);
    } catch {
      // Ignore unknown/missing fields in different CMS-1500 variants.
    }
  };
  const setCheck = (name, checked) => {
    try {
      const f = form.getCheckBox(name);
      if (checked) f.check();
      else f.uncheck();
    } catch {
      // Ignore unknown/missing fields.
    }
  };

  // Top-of-form header (template fields `insurance_*`): insurance carrier from Manage Providers.
  setText("insurance_name", payer.name);
  setText("insurance_address", payer.address_line_1);
  setText("insurance_address2", payer.address_line_2);
  setText(
    "insurance_city_state_zip",
    `${safe(payer.city)}, ${safe(payer.state)} ${safe(payer.zip)}`.replace(/^,\s*|,\s*$/g, "").trim()
  );

  // Native AcroForm mapping (preferred for exact alignment); values uppercased via setText
  setText("pt_name", `${safe(patient.last_name)}, ${safe(patient.first_name)}`);
  setText("insurance_id", insured.member_id);

  setText("birth_mm", patientDob.mm);
  setText("birth_dd", patientDob.dd);
  setText("birth_yy", patientDob.yy);

  setText("pt_street", joinAddress([patient.address_line_1, patient.address_line_2]));
  setText("pt_city", patient.city);
  setText("pt_state", patient.state);
  setText("pt_zip", patient.zip);
  setText("pt_AreaCode", patientPhone.area);
  setText("pt_phone", patientPhone.number);

  const insuredIsSelf = relInsWidgetIndex(insured) === 0;

  // Box 4 (insured name) and Box 7 (insured address) stay blank when Box 6 = Self.
  setText(
    "ins_name",
    insuredIsSelf ? "" : `${safe(insured.last_name)}, ${safe(insured.first_name)}`
  );
  setText("ins_policy", policy.group_number);
  setText("ins_dob_mm", insuredDob.mm);
  setText("ins_dob_dd", insuredDob.dd);
  setText("ins_dob_yy", insuredDob.yy);
  setText("ins_plan_name", policy.plan_name);

  setText(
    "ins_street",
    insuredIsSelf ? "" : joinAddress([insured.address_line_1, insured.address_line_2])
  );
  setText("ins_city", insuredIsSelf ? "" : insured.city);
  setText("ins_state", insuredIsSelf ? "" : insured.state);
  setText("ins_zip", insuredIsSelf ? "" : insured.zip);

  setText("accident_place", "");

  const box12On = safe(payload?.authorized_release_box12).toUpperCase() === "YES";
  const box12FallbackIso = `${today.yy}-${today.mm}-${today.dd}`;
  setText("pt_signature", box12On ? "SIGNATURE ON FILE" : "");
  setText(
    "pt_date",
    box12On ? formatSlashDate(safe(payload?.box12_signature_date), box12FallbackIso) : ""
  );
  setText(
    "ins_signature",
    safe(payload?.authorized_release_box13).toUpperCase() === "YES" ? "SIGNATURE ON FILE" : ""
  );
  setText("prior_auth", payload?.prior_authorization_number);
  setText("pt_account", payload?.patient_account_number);

  // Diagnosis box (A-L)
  const dx = (diagnosis.codes || []).slice(0, 12);
  dx.forEach((code, idx) => setText(`diagnosis${idx + 1}`, code));

  // Service lines (1-6)
  lines.slice(0, 6).forEach((line, idx) => {
    const n = idx + 1;
    const from = splitDateYMD(line.dos_from);
    const to = splitDateYMD(line.dos_to);
    setText(`sv${n}_mm_from`, from.mm);
    setText(`sv${n}_dd_from`, from.dd);
    setText(`sv${n}_yy_from`, from.yy);
    setText(`sv${n}_mm_end`, to.mm || from.mm);
    setText(`sv${n}_dd_end`, to.dd || from.dd);
    setText(`sv${n}_yy_end`, to.yy || from.yy);
    setText(`place${n}`, line.place_of_service);
    setText(`cpt${n}`, line.procedure_code);
    const mods = Array.isArray(line.modifiers) ? line.modifiers : [];
    setText(`mod${n}`, mods[0] || "");
    setText(`mod${n}a`, mods[1] || "");
    setText(`mod${n}b`, mods[2] || "");
    setText(`mod${n}c`, mods[3] || "");
    setText(`diag${n}`, formatDiagnosisPointers(line.diagnosis_pointers));
    setText(`ch${n}`, formatCharge(line.charges));
    setText(`day${n}`, line.units);
    // Template quirk: `emg{n}` widgets sit in column 24I (ID QUAL); `local{n}a` is the shaded
    // top of column 24J, and `local{n}` is the NPI line below the pre-printed "NPI" label.
    const idQual = safe(line.rendering_provider_id_qualifier) || "ZZ";
    setText(`emg${n}`, idQual);
    const taxonomySrc =
      safe(line.rendering_provider_taxonomy_code) ||
      safe(billing.taxonomy_code);
    setText(
      `local${n}a`,
      idQual === "ZZ" ? formatBox24jTaxonomy(taxonomySrc) : ""
    );
    setText(`local${n}`, safe(line.rendering_provider_npi));
  });

  const totalFromLines = lines.reduce((sum, line) => {
    const n = Number(line.charges);
    return Number.isFinite(n) ? sum + n : sum;
  }, 0);
  const payloadTotal = payload?.amounts?.total_charge;
  const totalCharge =
    payloadTotal !== null && payloadTotal !== undefined && payloadTotal !== ""
      ? payloadTotal
      : totalFromLines > 0
        ? totalFromLines
        : null;
  // Box 28 — total charge (template field `t_charge`).
  setText("t_charge", formatCharge(totalCharge));

  const taxIdDigits = safe(billing.tax_id).replace(/\D/g, "");
  setText("tax_id", formatFederalTaxId(billing.tax_id));

  const signing = payload?.signing_provider || {};
  setText("physician_signature", signing.name);
  setText("physician_date", `${today.mm}/${today.dd}/${today.yy}`);
  setText("id_physician", rendering.npi);

  setText("fac_name", facility.name);
  setText("fac_street", joinAddress([facility.address_line_1, facility.address_line_2]));
  const facLocLine = safe(facility.location_line);
  setText(
    "fac_location",
    facLocLine || `${safe(facility.city)}, ${safe(facility.state)} ${safe(facility.zip)}`
  );
  setText("pin1", facility.npi);
  setText("grp1", "");

  setText("doc_name", billing.name);
  setText("doc_street", joinAddress([billing.address_line_1, billing.address_line_2]));
  setText("doc_location", `${safe(billing.city)}, ${safe(billing.state)} ${safe(billing.zip)}`);
  setText("pin", billing.npi);
  setText("grp", formatBox33bTaxonomy(billing.taxonomy_code));

  try {
    const insType = form.getCheckBox("insurance_type");
    const ws = insType.acroField.getWidgets();
    if (ws[6]) {
      box1OtherMark = checkboxXMarkParams(ws[6].getRectangle(), height, 9);
    }
    insType.uncheck();
  } catch {
    // keep box1OtherMark fallback
  }

  try {
    const sexField = form.getCheckBox("sex");
    const sw = sexField.acroField.getWidgets();
    if (sex === "M" && sw[0]) {
      sexMarkCoords = checkboxXMarkParams(sw[0].getRectangle(), height, 9);
    } else if (sex === "F" && sw[1]) {
      sexMarkCoords = checkboxXMarkParams(sw[1].getRectangle(), height, 9);
    }
    sexField.uncheck();
  } catch {
    // no sex mark overlay
  }

  try {
    const relField = form.getCheckBox("rel_to_ins");
    const rw = relField.acroField.getWidgets();
    const relIdx = relInsWidgetIndex(insured);
    if (relIdx !== null && rw[relIdx]) {
      relBox6MarkCoords = checkboxXMarkParams(rw[relIdx].getRectangle(), height, 9);
    }
    relField.uncheck();
  } catch {
    // no Box 6 mark
  }

  for (const fieldName of ["employment", "pt_auto_accident", "other_accident", "ins_benefit_plan"]) {
    try {
      const cb = form.getCheckBox(fieldName);
      const ws = cb.acroField.getWidgets();
      if (ws[1]) {
        box10And11dNoMarks.push(checkboxXMarkParams(ws[1].getRectangle(), height, 9));
      }
      cb.uncheck();
    } catch {
      // Field missing on some template variants.
    }
  }

  try {
    const ssnCb = form.getCheckBox("ssn");
    ssnCb.uncheck();
    const sw = ssnCb.acroField.getWidgets();
    // Box 25 on this template: widget 0 = SSN (left), widget 1 = EIN (right).
    const taxIdType = safe(payload?.federal_tax_id_type || billing.tax_id_type).toUpperCase();
    if (taxIdType === "SSN" && sw[0]) {
      box25EinMark = checkboxXMarkParams(sw[0].getRectangle(), height, 9);
    } else if (taxIdDigits.length > 0 && sw[1]) {
      box25EinMark = checkboxXMarkParams(sw[1].getRectangle(), height, 9);
    }
  } catch {
    // Template variant without Box 25 EIN/SSN toggles.
  }

  try {
    const asg = form.getCheckBox("assignment");
    const aws = asg.acroField.getWidgets();
    if (payload?.assignment && aws[0]) {
      assignmentYesMark = checkboxXMarkParams(aws[0].getRectangle(), height, 9);
    }
    asg.uncheck();
  } catch {
    // assignment field missing
  }

  try {
    form.updateFieldAppearances(font);
  } catch {
    // Some templates fail appearance generation for unusual widgets.
  }

  try {
    form.flatten();
  } catch {
    // Some templates can fail flatten due to unusual widgets; keep unflattened if needed.
  }

  mark(box1OtherMark.x, box1OtherMark.topY);
  if (sexMarkCoords) mark(sexMarkCoords.x, sexMarkCoords.topY);
  if (relBox6MarkCoords) mark(relBox6MarkCoords.x, relBox6MarkCoords.topY);
  for (const c of box10And11dNoMarks) {
    mark(c.x, c.topY);
  }
  if (assignmentYesMark) {
    mark(assignmentYesMark.x, assignmentYesMark.topY);
  }
  if (box25EinMark) {
    mark(box25EinMark.x, box25EinMark.topY);
  }

  // Template PDF may include a second page; output is CMS-1500 page 1 only.
  while (pdfDoc.getPageCount() > 1) {
    pdfDoc.removePage(pdfDoc.getPageCount() - 1);
  }

  const output = await pdfDoc.save();
  return output;
}

async function buildCms1500TemplatePdfBlob(payload) {
  const bytes = await buildCms1500TemplatePdfBytes(payload);
  return new Blob([bytes], { type: "application/pdf" });
}

export async function createMergedCms1500PdfBlob(payloads) {
  const list = Array.isArray(payloads) ? payloads.filter(Boolean) : [];
  if (list.length === 0) {
    throw new Error("No CMS-1500 payloads to merge.");
  }
  if (list.length === 1) {
    return buildCms1500TemplatePdfBlob(list[0]);
  }

  const mergedPdf = await PDFDocument.create();
  for (const payload of list) {
    const bytes = await buildCms1500TemplatePdfBytes(payload);
    const src = await PDFDocument.load(bytes);
    const n = src.getPageCount();
    if (n < 1) continue;
    const copied = await mergedPdf.copyPages(src, [0]);
    copied.forEach((p) => mergedPdf.addPage(p));
  }

  if (mergedPdf.getPageCount() === 0) {
    throw new Error("Merged CMS-1500 PDF has no pages.");
  }

  const output = await mergedPdf.save();
  return new Blob([output], { type: "application/pdf" });
}

export async function createCms1500PdfBlob(payload) {
  return buildCms1500TemplatePdfBlob(payload);
}

export async function downloadCms1500Pdf(payload, filename) {
  const blob = await createCms1500PdfBlob(payload);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safe =
    filename && String(filename).trim()
      ? String(filename).replace(/[^\w.\-]+/g, "_")
      : `cms1500-claim-${Date.now()}`;
  link.download = safe.endsWith(".pdf") ? safe : `${safe}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function downloadMergedCms1500Pdf(payloads, filename) {
  const blob = await createMergedCms1500PdfBlob(payloads);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safe =
    filename && String(filename).trim()
      ? String(filename).replace(/[^\w.\-]+/g, "_")
      : `cms1500-bundle-${Date.now()}`;
  link.download = safe.endsWith(".pdf") ? safe : `${safe}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
