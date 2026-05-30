export const TRIAL_OUTCOMES = [
  { value: "Correct", label: "Correct" },
  { value: "Gestural Prompt", label: "Gestural Prompt" },
  { value: "Partial Physical", label: "Partial Physical" },
  { value: "Full Physical", label: "Full Physical" },
  { value: "Verbal Prompt", label: "Verbal Prompt" },
  { value: "Incorrect", label: "Incorrect" },
];

const CORRECT_OUTCOMES = new Set(["Correct"]);

export function getTargetActivityType(target) {
  return String(target?.activity_type || target?.activityType || "").trim();
}

export function isDiscreteTrialTraining(activityType) {
  const t = getTargetActivityType({ activity_type: activityType }).toLowerCase();
  return t.includes("discrete trial") || t === "dtt";
}

export function isTaskAnalysis(activityType) {
  const t = getTargetActivityType({ activity_type: activityType }).toLowerCase();
  return t.includes("task analysis");
}

/** DTT and Task Analysis both use discrete trial outcome recording. */
export function usesTrialRecording(activityType) {
  return isDiscreteTrialTraining(activityType) || isTaskAnalysis(activityType);
}

export function getTargetPlannedTrials(target, fallback = 10) {
  const n = Number.parseInt(target?.trials, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function countCorrectTrials(trials = []) {
  return trials.filter((t) => CORRECT_OUTCOMES.has(t.trial_outcome)).length;
}

/** Human-readable summary for table + payload value field. */
export function formatTrialsSummary(trials = [], plannedTrials = 10) {
  const done = trials.length;
  const correct = countCorrectTrials(trials);
  if (done === 0) return "";
  const pct = done > 0 ? Math.round((correct / done) * 100) : 0;
  return `${correct}/${done} correct (${pct}%) · ${done}/${plannedTrials} trials`;
}

export function skillRowHasRecordedData(row) {
  if (!row) return false;
  if (Array.isArray(row.trials) && row.trials.length > 0) return true;
  return String(row?.value || "").trim().length > 0;
}
