/** Recording types for Behavior Reduction (Theralytics-aligned). */
export const RECORDING_TYPES = [
  { value: "Frequency", label: "Frequency" },
  { value: "Duration", label: "Duration" },
  { value: "MomentaryTimeSample", label: "Momentary Time Sample" },
  { value: "PartialInterval", label: "Partial Interval" },
  { value: "Rate", label: "Rate" },
];

export const DEFAULT_RECORDING_TYPE = "Frequency";

/** MySQL/mysqli often returns TINYINT flags as "0" / "1" strings. */
export function isDbTruthy(value) {
  return value === true || value === 1 || value === "1";
}

export function isDbArchived(row) {
  return isDbTruthy(row?.archived);
}

export function isDbActive(row, defaultActive = true) {
  if (row?.is_active === undefined || row?.is_active === null) return defaultActive;
  return isDbTruthy(row.is_active);
}

export function recordingTypeLabel(value) {
  const found = RECORDING_TYPES.find((t) => t.value === value);
  return found?.label || value || "—";
}

export function normalizeBehaviorRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    client_id: row.client_id,
    master_behavior_id: row.master_behavior_id,
    category_id: row.category_id,
    name: row.name || row.NAME || "",
    goal_name: row.goal_name || "",
    function: row.function || "",
    definition: row.definition || "",
    recording_type: row.recording_type || DEFAULT_RECORDING_TYPE,
    do_not_zero_out: isDbTruthy(row.do_not_zero_out),
    exclude_from_abc: isDbTruthy(row.exclude_from_abc),
    is_active: isDbActive(row),
    status: row.status || row.STATUS || "Active",
    archived: isDbArchived(row),
  };
}

export function behaviorsToSessionRows(behaviors, existingData = []) {
  const byId = new Map((existingData || []).map((r) => [String(r.id), r]));
  return (behaviors || [])
    .filter((b) => normalizeBehaviorRow(b)?.is_active && !normalizeBehaviorRow(b)?.archived)
    .map((b) => {
      const n = normalizeBehaviorRow(b);
      const prev = byId.get(String(n.id));
      return {
        id: n.id,
        behaviorName: n.name,
        behaviorCategory: n.category_id || "",
        goalName: n.goal_name,
        function: n.function,
        definition: n.definition,
        recordingType: n.recording_type,
        doNotZeroOut: n.do_not_zero_out,
        excludeFromAbc: n.exclude_from_abc,
        dataToday: prev?.dataToday ?? 0,
        durationSeconds: prev?.durationSeconds ?? 0,
        rateCount: prev?.rateCount ?? 0,
        intervalMarks: prev?.intervalMarks ?? [],
        archived: false,
      };
    });
}

/** Keep session counts while syncing to latest active client behavior definitions. */
export function mergeBehaviorSessionRows(clientBehaviors, sessionRows = []) {
  return behaviorsToSessionRows(clientBehaviors, sessionRows);
}
