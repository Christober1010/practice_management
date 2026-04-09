"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListChecks, Target, Trash2 } from "lucide-react";

const TRIAL_OUTCOMES = [
  { value: "Correct", label: "Correct" },
  { value: "Gestural Prompt", label: "Gestural Prompt" },
  { value: "Partial Physical", label: "Partial Physical" },
  { value: "Full Physical", label: "Full Physical" },
  { value: "Verbal Prompt", label: "Verbal Prompt" },
  { value: "Incorrect", label: "Incorrect" },
];

export default function TrialsPanel({
  loading,
  sessionDate,
  setSessionDate,
  targets,
  selectedTarget,
  setSelectedTarget,
  selectedTargetData,
  trials,
  currentTrialOutcome,
  setCurrentTrialOutcome,
  onSaveTrial,
  onDeletePreviousTrial,
}) {
  const trialsDone = trials.length;
  const totalTrials = selectedTargetData?.trials || 5;

  return (
    <>
      <div className="flex items-center gap-4">
        <Label htmlFor="session-date">Session Date:</Label>
        <input
          id="session-date"
          type="date"
          value={sessionDate}
          onChange={(e) => setSessionDate(e.target.value)}
          className="px-3 py-2 border rounded-md"
        />
      </div>

      <div>
        <Label className="mb-2 block">Select Target:</Label>
        <Select
          value={selectedTarget?.id != null ? String(selectedTarget.id) : ""}
          onValueChange={(value) => {
            const target = (targets || []).find((t) => String(t.id) === String(value));
            setSelectedTarget(target || null);
            setCurrentTrialOutcome("");
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a target" />
          </SelectTrigger>
          <SelectContent>
            {(targets || []).map((target) => (
              <SelectItem key={String(target.id)} value={String(target.id)}>
                {target.name || target.NAME || "Unnamed Target"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedTargetData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-4 w-4 text-teal-600" />
              {selectedTargetData.name || selectedTargetData.NAME}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedTargetData.goal_description && (
              <div>
                <Label className="text-sm font-semibold">SD (Stimulus Discriminative):</Label>
                <p className="text-sm text-slate-600 mt-1">{selectedTargetData.goal_description}</p>
              </div>
            )}

            {selectedTargetData.instructions && (
              <div>
                <Label className="text-sm font-semibold">Instructions:</Label>
                <ol className="list-decimal list-inside text-sm text-slate-600 mt-1 space-y-1">
                  {selectedTargetData.instructions
                    .split("\n")
                    .filter((line) => line.trim())
                    .map((line, idx) => (
                      <li key={idx}>{line.trim()}</li>
                    ))}
                </ol>
              </div>
            )}

            {selectedTargetData.tasks && selectedTargetData.tasks.length > 0 && (
              <div>
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <ListChecks className="h-4 w-4" />
                  Tasks:
                </Label>
                <ol className="list-decimal list-inside text-sm text-slate-600 mt-1 space-y-1">
                  {selectedTargetData.tasks
                    .slice()
                    .sort((a, b) => (a.step_order || 0) - (b.step_order || 0))
                    .map((task, idx) => (
                      <li key={task.id || idx}>{task.name || task.NAME}</li>
                    ))}
                </ol>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Label className="text-sm font-semibold">Trials Done:</Label>
              <span className="text-blue-600 font-semibold">
                {trialsDone} out of {totalTrials}
              </span>
            </div>

            {trials.length > 0 && (
              <div>
                <Label className="text-sm font-semibold">Previous Trial:</Label>
                <Badge variant="outline" className="ml-2">
                  {trials[trials.length - 1].trial_outcome}
                </Badge>
              </div>
            )}

            <div>
              <Label className="text-sm font-semibold mb-3 block">Record Trial Outcome:</Label>
              <div className="grid grid-cols-2 gap-3">
                {TRIAL_OUTCOMES.map((outcome) => (
                  <div key={outcome.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={outcome.value}
                      checked={currentTrialOutcome === outcome.value}
                      onCheckedChange={(checked) =>
                        setCurrentTrialOutcome(Boolean(checked) ? outcome.value : "")
                      }
                    />
                    <Label htmlFor={outcome.value} className="text-sm font-normal cursor-pointer">
                      {outcome.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={onSaveTrial}
                disabled={!currentTrialOutcome || trialsDone >= totalTrials}
                className="flex-1 bg-teal-600 hover:bg-teal-700"
              >
                Save Trial
              </Button>
              <Button
                variant="outline"
                onClick={onDeletePreviousTrial}
                disabled={trials.length === 0}
                className="flex-1"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Previous Trial
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="text-center py-4">
          <p className="text-slate-500">Loading...</p>
        </div>
      )}

      {!loading && (targets || []).length === 0 && (
        <div className="text-center py-4">
          <p className="text-slate-500">No targets found for this client. Please add targets first.</p>
        </div>
      )}
    </>
  );
}


