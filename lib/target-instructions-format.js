/** Encode SD + generalization plan + target instructions + optional meta in one DB text field. */

const META_MARKER = "<!--mhv-target-meta:";
const META_END = "-->";

export const TARGET_STATUS_OPTIONS = [
  "In-Treatment",
  "Mastered",
  "On hold",
  "Baseline",
  "Generalization",
];

export const MASTERY_TYPE_OPTIONS = ["Automatic", "Manual"];

export const DEFAULT_TARGET_META = {
  mastery_type: "Automatic",
  target_status: "In-Treatment",
  date_opened: "",
  date_mastered: "",
  date_closed: "",
  met_baseline: "",
  override_response_criteria: "100",
  override_consecutive_days: "3",
  override_first_trial_independent: "Yes",
  maintenance_level: "",
};

function stripMeta(text) {
  const raw = String(text || "");
  const start = raw.indexOf(META_MARKER);
  if (start === -1) {
    return { body: raw.trim(), meta: { ...DEFAULT_TARGET_META } };
  }
  const jsonStart = start + META_MARKER.length;
  const end = raw.indexOf(META_END, jsonStart);
  let meta = { ...DEFAULT_TARGET_META };
  if (end !== -1) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart, end).trim());
      if (parsed && typeof parsed === "object") {
        meta = { ...DEFAULT_TARGET_META, ...parsed };
      }
    } catch {
      // keep defaults
    }
  }
  const body = (
    raw.slice(0, start) + (end === -1 ? "" : raw.slice(end + META_END.length))
  ).trim();
  return { body, meta };
}

function parseBodySections(body) {
  let text = String(body || "").trim();
  let sd = "";
  let generalizationPlan = "";
  let instructions = text;

  const sdMatch = text.match(/^SD:\s*(.*?)(?:\n|$)/i);
  if (sdMatch) {
    sd = sdMatch[1].trim();
    text = text.slice(sdMatch[0].length).replace(/^\n+/, "");
  }

  const gpHeader = text.match(/^GENERALIZATION\s+PLAN:\s*/i);
  if (gpHeader) {
    text = text.slice(gpHeader[0].length);
    const instrHeader = text.match(/\n(?:TARGET\s+)?INSTRUCTIONS:\s*\n?/i);
    if (instrHeader && instrHeader.index != null) {
      generalizationPlan = text.slice(0, instrHeader.index).trim();
      instructions = text.slice(instrHeader.index + instrHeader[0].length).trim();
    } else {
      const blank = text.search(/\n\n+/);
      if (blank >= 0) {
        generalizationPlan = text.slice(0, blank).trim();
        instructions = text.slice(blank).replace(/^\n+/, "").trim();
      } else {
        generalizationPlan = text.trim();
        instructions = "";
      }
    }
  } else {
    const instrOnly = text.match(/^(?:TARGET\s+)?INSTRUCTIONS:\s*\n?/i);
    if (instrOnly) {
      instructions = text.slice(instrOnly[0].length).trim();
    } else {
      instructions = text.trim();
    }
  }

  return { sd, generalizationPlan, instructions };
}

/** Split stored instructions into SD, generalization plan, body, and meta. */
export function parseTargetInstructions(instructions) {
  const { body, meta } = stripMeta(instructions);
  const sections = parseBodySections(body);
  return {
    sd: sections.sd,
    generalizationPlan: sections.generalizationPlan,
    instructions: sections.instructions,
    meta,
  };
}

/**
 * Encode fields for storage in master_targets / client_targets.instructions.
 */
export function formatTargetInstructions(
  sd,
  instructionBody,
  generalizationPlan = "",
  meta = null
) {
  const stimulus = String(sd || "").trim();
  const plan = String(generalizationPlan || "").trim();
  const body = String(instructionBody || "").trim();
  const parts = [];

  if (stimulus) parts.push(`SD: ${stimulus}`);
  if (plan) parts.push(`GENERALIZATION PLAN:\n${plan}`);
  if (body) {
    if (stimulus || plan) {
      parts.push(`TARGET INSTRUCTIONS:\n${body}`);
    } else {
      parts.push(body);
    }
  }

  let text = parts.join("\n\n").trim();
  if (meta && typeof meta === "object") {
    const merged = { ...DEFAULT_TARGET_META, ...meta };
    text = `${text}\n\n${META_MARKER}${JSON.stringify(merged)}${META_END}`.trim();
  }
  return text;
}

export function normalizeTaskStepsForApi(tasks = []) {
  return [...tasks]
    .map((t, idx) => {
      const order = Number.parseInt(t.step_order ?? t.sequence, 10);
      return {
        id: t.id,
        name: String(t.name || "").trim(),
        step_order: Number.isFinite(order) && order > 0 ? order : idx + 1,
        sequence: Number.isFinite(order) && order > 0 ? order : idx + 1,
      };
    })
    .filter((t) => t.name)
    .sort((a, b) => a.step_order - b.step_order);
}

/** Local YYYY-MM-DD for date inputs. */
export function todayLocalYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
