/** Normalize report DOS to YYYY-MM-DD for comparisons and date inputs. */
export function reportDosKey(dos) {
  if (dos == null || dos === "") return "";
  const s = String(dos).trim();
  const iso = s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(Date.parse(iso))) return iso;
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) {
    const y = mdy[3];
    const mo = String(mdy[1]).padStart(2, "0");
    const d = String(mdy[2]).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }
  const t = Date.parse(s);
  if (Number.isNaN(t)) return "";
  const dt = new Date(t);
  const y = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

/** Format date portion as MM/DD/YYYY. */
export function formatReportDosDate(dos) {
  const key = reportDosKey(dos);
  if (!key) return "";
  const [y, mo, d] = key.split("-");
  return `${mo}/${d}/${y}`;
}

function formatReportTime(aptStart) {
  if (!aptStart) return "";
  const s = String(aptStart).trim();
  if (!s) return "";
  if (/^\d{1,2}:\d{2}/.test(s)) return s.slice(0, 5);
  if (s.length >= 16) return s.slice(11, 16);
  if (s.length >= 8) return s.slice(0, 8);
  return s;
}

/** Display DOS / optional appointment time (date always MM/DD/YYYY). */
export function formatReportDos(dos, aptStart) {
  if (!dos && !aptStart) return "—";
  const d = formatReportDosDate(dos);
  const t = formatReportTime(aptStart);
  if (d && t) return `${d} ${t}`;
  return d || t || "—";
}

/** True when row DOS falls within optional YYYY-MM-DD from/to (inclusive). */
export function reportDosInRange(dos, fromYmd, toYmd) {
  const key = reportDosKey(dos);
  if (!key) return false;
  const from = (fromYmd || "").trim();
  const to = (toYmd || "").trim();
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}
