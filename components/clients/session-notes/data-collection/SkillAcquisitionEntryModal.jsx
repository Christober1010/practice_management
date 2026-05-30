"use client";

import { mahaverseFetch } from "@/lib/mahaverse-api";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ListChecks, Target, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { getMahaverseAuthHeaders } from "@/lib/api-auth";
import {
  TRIAL_OUTCOMES,
  formatTrialsSummary,
  getTargetActivityType,
  getTargetPlannedTrials,
  isTaskAnalysis,
  usesTrialRecording,
} from "@/lib/skill-acquisition-trials";
import { parseTargetInstructions } from "@/lib/target-instructions-format";

async function readJson(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid server response (HTTP ${res.status})`);
  }
}

export default function SkillAcquisitionEntryModal({
  isOpen,
  onClose,
  mode = "edit",
  row,
  targetData = null,
  clientId = null,
  sessionDate = null,
  saving = false,
  onSave,
}) {
  const [value, setValue] = useState("");
  const [trials, setTrials] = useState([]);
  const [currentTrialOutcome, setCurrentTrialOutcome] = useState("");
  const [loadingTrials, setLoadingTrials] = useState(false);
  const [trialActionLoading, setTrialActionLoading] = useState(false);

  const readOnly = mode === "view";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";

  const activityType = getTargetActivityType(targetData);
  const showTrialsUi = usesTrialRecording(activityType);
  const showTaskAnalysisUi = isTaskAnalysis(activityType);
  const plannedTrials = getTargetPlannedTrials(targetData, 10);

  const loadTrials = useCallback(async () => {
    const targetId = row?.targetId;
    if (!clientId || !targetId || !sessionDate || !baseUrl) return;

    setLoadingTrials(true);
    try {
      const params = new URLSearchParams({
        client_id: String(clientId),
        target_id: String(targetId),
        session_date: String(sessionDate),
      });
      const res = await mahaverseFetch(`/session-notes.php?${params}`, {
        headers: getMahaverseAuthHeaders(),
      });
      const data = await readJson(res);
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || "Failed to load trials");
      }
      setTrials(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Could not load trials");
      setTrials(row?.trials || []);
    } finally {
      setLoadingTrials(false);
    }
  }, [baseUrl, clientId, row?.targetId, row?.trials, sessionDate]);

  useEffect(() => {
    if (!isOpen || !row) return;
    setValue(row.value || "");
    setCurrentTrialOutcome("");
    if (showTrialsUi && clientId && row.targetId) {
      if (Array.isArray(row.trials) && row.trials.length > 0) {
        setTrials(row.trials);
        loadTrials();
      } else {
        loadTrials();
      }
    } else {
      setTrials(row.trials || []);
    }
  }, [isOpen, row, showTrialsUi, clientId, loadTrials]);

  const trialsDone = trials.length;
  const trialsSummary = useMemo(
    () => formatTrialsSummary(trials, plannedTrials),
    [trials, plannedTrials]
  );

  const handleSaveTrial = async () => {
    if (readOnly || !currentTrialOutcome || !row?.targetId || !clientId) return;
    if (trialsDone >= plannedTrials) {
      toast.error(`All ${plannedTrials} trials are recorded`);
      return;
    }

    setTrialActionLoading(true);
    try {
      const res = await mahaverseFetch('/session-notes.php', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getMahaverseAuthHeaders(),
        },
        body: JSON.stringify({
          client_id: clientId,
          target_id: row.targetId,
          session_date: sessionDate,
          trial_outcome: currentTrialOutcome,
          notes: value.trim() || null,
        }),
      });
      const data = await readJson(res);
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || "Failed to save trial");
      }
      await loadTrials();
      setCurrentTrialOutcome("");
      toast.success("Trial saved");
    } catch (err) {
      toast.error(err?.message || "Failed to save trial");
    } finally {
      setTrialActionLoading(false);
    }
  };

  const handleDeletePreviousTrial = async () => {
    if (readOnly || trials.length === 0) return;
    const last = trials[trials.length - 1];
    if (!last?.id) {
      setTrials((prev) => prev.slice(0, -1));
      return;
    }

    setTrialActionLoading(true);
    try {
      const res = await mahaverseFetch('/session-notes.php', {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...getMahaverseAuthHeaders(),
        },
        body: JSON.stringify({ id: last.id }),
      });
      const data = await readJson(res);
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || "Failed to delete trial");
      }
      await loadTrials();
      toast.success("Previous trial removed");
    } catch (err) {
      toast.error(err?.message || "Failed to delete trial");
    } finally {
      setTrialActionLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (readOnly) {
      onClose();
      return;
    }

    if (showTrialsUi) {
      if (trials.length === 0) {
        toast.error("Record at least one trial before saving");
        return;
      }
      onSave?.({
        value: trialsSummary,
        trials,
        notes: value.trim(),
        activityType,
        plannedTrials,
      });
      return;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      toast.error("Enter a session value or notes");
      return;
    }
    onSave?.({
      value: trimmed,
      trials: [],
      notes: trimmed,
      activityType,
    });
  };

  if (!row) return null;

  const goalDescription =
    targetData?.goal_description || targetData?.goalDescription || "";
  const parsedInstructions = parseTargetInstructions(targetData?.instructions || "");
  const sd = parsedInstructions.sd;
  const targetInstructions = parsedInstructions.instructions;
  const instructions = targetInstructions;
  const tasks = Array.isArray(targetData?.tasks) ? targetData.tasks : [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-green-600 shrink-0" />
            {readOnly ? "View skill acquisition" : "Record skill acquisition"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm space-y-1">
            <div>
              <span className="text-slate-500">Program: </span>
              <span className="font-medium text-slate-800">{row.programName || "—"}</span>
            </div>
            <div>
              <span className="text-slate-500">Target: </span>
              <span className="font-medium text-slate-800">{row.targetName || "—"}</span>
            </div>
            {activityType && (
              <div>
                <span className="text-slate-500">Activity type: </span>
                <Badge variant="outline" className="ml-1 text-xs font-normal">
                  {activityType}
                </Badge>
              </div>
            )}
            {row.savedAt && (
              <div className="pt-1">
                <Badge variant="secondary" className="text-xs font-normal">
                  Last saved {new Date(row.savedAt).toLocaleString()}
                </Badge>
              </div>
            )}
          </div>

          {goalDescription && (
            <div>
              <Label className="text-sm font-semibold">
                {showTaskAnalysisUi ? "Goal Name" : "Goal / SD"}
              </Label>
              <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{goalDescription}</p>
            </div>
          )}

          {showTaskAnalysisUi && sd && (
            <div>
              <Label className="text-sm font-semibold">SD (Discriminative Stimulus)</Label>
              <p className="text-sm text-slate-600 mt-1">{sd}</p>
            </div>
          )}

          {instructions && (
            <div>
              <Label className="text-sm font-semibold">
                {showTaskAnalysisUi ? "Target Instructions" : "Instructions"}
              </Label>
              <ol className="list-decimal list-inside text-sm text-slate-600 mt-1 space-y-1">
                {instructions
                  .split("\n")
                  .filter((line) => line.trim())
                  .map((line, idx) => (
                    <li key={idx}>{line.trim()}</li>
                  ))}
              </ol>
            </div>
          )}

          {showTaskAnalysisUi && tasks.length > 0 && (
            <div>
              <Label className="text-sm font-semibold flex items-center gap-2">
                <ListChecks className="h-4 w-4" />
                Task analysis steps
              </Label>
              <ol className="list-decimal list-inside text-sm text-slate-600 mt-1 space-y-1">
                {tasks
                  .slice()
                  .sort(
                    (a, b) =>
                      (a.step_order ?? a.sequence ?? 0) - (b.step_order ?? b.sequence ?? 0)
                  )
                  .map((task, idx) => (
                    <li key={task.id || idx}>
                      <span className="font-medium text-slate-700">
                        {task.step_order ?? task.sequence ?? idx + 1}.
                      </span>{" "}
                      {task.name || task.NAME}
                    </li>
                  ))}
              </ol>
            </div>
          )}

          {showTrialsUi && (
            <div className="space-y-4 rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-sm font-semibold">Trials</Label>
                <span className="text-sm text-blue-700 font-medium">
                  {loadingTrials
                    ? "Loading…"
                    : `${trialsDone} of ${plannedTrials} daily trials recorded`}
                </span>
                {trialsSummary && (
                  <Badge variant="secondary" className="text-xs font-normal">
                    {trialsSummary}
                  </Badge>
                )}
              </div>

              {trials.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Recorded outcomes</Label>
                  <div className="flex flex-wrap gap-1">
                    {trials.map((t) => (
                      <Badge key={t.id || t.trial_number} variant="outline" className="text-xs">
                        #{t.trial_number}: {t.trial_outcome}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {!readOnly && (
                <>
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Record trial outcome</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {TRIAL_OUTCOMES.map((outcome) => (
                        <div key={outcome.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`trial-${outcome.value}`}
                            checked={currentTrialOutcome === outcome.value}
                            onCheckedChange={(checked) =>
                              setCurrentTrialOutcome(Boolean(checked) ? outcome.value : "")
                            }
                            disabled={trialActionLoading || saving}
                          />
                          <Label
                            htmlFor={`trial-${outcome.value}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {outcome.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      className="flex-1 bg-teal-600 hover:bg-teal-700"
                      disabled={
                        !currentTrialOutcome ||
                        trialsDone >= plannedTrials ||
                        trialActionLoading ||
                        saving
                      }
                      onClick={handleSaveTrial}
                    >
                      {trialActionLoading ? "Saving…" : "Save trial"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      disabled={trials.length === 0 || trialActionLoading || saving}
                      onClick={handleDeletePreviousTrial}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete previous
                    </Button>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="skill-acq-notes">Session notes (optional)</Label>
                {readOnly ? (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{value || "—"}</p>
                ) : (
                  <Textarea
                    id="skill-acq-notes"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Additional notes for this target…"
                    rows={2}
                    disabled={saving || trialActionLoading}
                  />
                )}
              </div>
            </div>
          )}

          {!showTrialsUi && (
            <div className="space-y-2">
              <Label htmlFor="skill-acq-value">
                {showTaskAnalysisUi ? "Session notes / outcome" : "Session value"}
              </Label>
              {readOnly ? (
                <p
                  id="skill-acq-value"
                  className="min-h-[2.5rem] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 whitespace-pre-wrap"
                >
                  {value || "—"}
                </p>
              ) : (
                <Textarea
                  id="skill-acq-value"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={
                    showTaskAnalysisUi
                      ? "e.g. completed 4/5 steps independently…"
                      : "e.g. 80%, independent, prompt level…"
                  }
                  rows={4}
                  disabled={saving}
                  autoFocus
                />
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving || trialActionLoading}
            >
              {readOnly ? "Close" : "Cancel"}
            </Button>
            {!readOnly && (
              <Button
                type="submit"
                disabled={saving || trialActionLoading}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {saving ? "Saving…" : "Save entry"}
              </Button>
            )}
            {readOnly && (
              <Button
                type="button"
                className="bg-teal-600 hover:bg-teal-700"
                onClick={() => onSave?.(null, { switchToEdit: true })}
              >
                Edit
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
