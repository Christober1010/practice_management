"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import SessionNotesSectionCard from "../session-notes/SessionNotesSectionCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Activity, Minus, Plus, Save, Play, Square, Timer } from "lucide-react";
import toast from "react-hot-toast";
import { RECORDING_TYPES, recordingTypeLabel } from "@/lib/behavior-recording-types";

const INTERVAL_SECONDS = 60;

function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function updateBehaviorRow(setSessionNotes, id, patch) {
  setSessionNotes((prev) => ({
    ...prev,
    behaviorReductionData: (prev.behaviorReductionData || []).map((row) =>
      row.id === id ? { ...row, ...patch } : row
    ),
  }));
}

function FrequencyTab({ rows, setSessionNotes }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Behavior</TableHead>
          <TableHead>Definition</TableHead>
          <TableHead className="text-center">Count Today</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((b) => (
          <TableRow key={b.id}>
            <TableCell className="font-medium">{b.behaviorName}</TableCell>
            <TableCell className="text-xs text-slate-600 max-w-[200px] truncate">
              {b.definition || "—"}
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-center gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 text-red-600"
                  onClick={() =>
                    updateBehaviorRow(setSessionNotes, b.id, {
                      dataToday: Math.max(0, Number(b.dataToday || 0) - 1),
                    })
                  }
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-10 text-center font-semibold">{Number(b.dataToday || 0)}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 text-green-600"
                  onClick={() =>
                    updateBehaviorRow(setSessionNotes, b.id, {
                      dataToday: Number(b.dataToday || 0) + 1,
                    })
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DurationTab({ rows, setSessionNotes }) {
  const [running, setRunning] = useState({});
  const timersRef = useRef({});

  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearInterval);
    };
  }, []);

  const toggleTimer = (id) => {
    if (running[id]) {
      clearInterval(timersRef.current[id]);
      delete timersRef.current[id];
      setRunning((prev) => ({ ...prev, [id]: false }));
      return;
    }
    setRunning((prev) => ({ ...prev, [id]: true }));
    timersRef.current[id] = setInterval(() => {
      setSessionNotes((prev) => ({
        ...prev,
        behaviorReductionData: (prev.behaviorReductionData || []).map((row) =>
          row.id === id
            ? { ...row, durationSeconds: Number(row.durationSeconds || 0) + 1 }
            : row
        ),
      }));
    }, 1000);
  };

  const cancelTimer = (id) => {
    if (running[id]) {
      clearInterval(timersRef.current[id]);
      delete timersRef.current[id];
      setRunning((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Behavior</TableHead>
          <TableHead className="text-center">Duration</TableHead>
          <TableHead className="text-right">Timer</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((b) => (
          <TableRow key={b.id}>
            <TableCell className="font-medium">{b.behaviorName}</TableCell>
            <TableCell className="text-center font-mono">
              {formatDuration(b.durationSeconds)}
            </TableCell>
            <TableCell className="text-right space-x-1">
              <Button
                type="button"
                size="sm"
                variant={running[b.id] ? "destructive" : "default"}
                onClick={() => toggleTimer(b.id)}
              >
                {running[b.id] ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => cancelTimer(b.id)}>
                Cancel
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function formatRatePerMinute(count, elapsedSeconds) {
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  const n = Math.max(0, Number(count) || 0);
  if (elapsed <= 0 || n <= 0) return "—";
  const perMin = (n / elapsed) * 60;
  return `${perMin.toFixed(2)}/min`;
}

function RateTab({ rows, setSessionNotes, rateSessionSeconds = 0 }) {
  const [rateRunning, setRateRunning] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const elapsed = Number(rateSessionSeconds) || 0;

  const toggleRateTimer = () => {
    if (rateRunning) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setRateRunning(false);
      return;
    }
    setRateRunning(true);
    timerRef.current = setInterval(() => {
      setSessionNotes((prev) => ({
        ...prev,
        behaviorRateSessionSeconds: Number(prev.behaviorRateSessionSeconds || 0) + 1,
      }));
    }, 1000);
  };

  const resetRateTimer = () => {
    if (rateRunning) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setRateRunning(false);
    }
    setSessionNotes((prev) => ({ ...prev, behaviorRateSessionSeconds: 0 }));
  };

  return (
    <div className="space-y-4">
      <Card className="border-slate-200">
        <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-blue-600 shrink-0" />
            <span className="font-mono text-lg">{formatDuration(elapsed)}</span>
            <span className="text-xs text-slate-500">session elapsed</span>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={toggleRateTimer}
              variant={rateRunning ? "destructive" : "default"}
              className={!rateRunning ? "bg-teal-600 hover:bg-teal-700" : undefined}
            >
              {rateRunning ? "Stop" : "Start"} Session Timer
            </Button>
            <Button type="button" variant="outline" onClick={resetRateTimer}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Behavior</TableHead>
            <TableHead className="text-center">Rate Count</TableHead>
            <TableHead className="text-center">Rate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-slate-500 py-6">
                No behaviors configured for Rate recording.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.behaviorName}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 text-red-600"
                      onClick={() =>
                        updateBehaviorRow(setSessionNotes, b.id, {
                          rateCount: Math.max(0, Number(b.rateCount || 0) - 1),
                        })
                      }
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-10 text-center font-semibold">{Number(b.rateCount || 0)}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 text-green-600"
                      onClick={() =>
                        updateBehaviorRow(setSessionNotes, b.id, {
                          rateCount: Number(b.rateCount || 0) + 1,
                        })
                      }
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="text-center font-mono text-sm text-slate-700">
                  {formatRatePerMinute(b.rateCount, elapsed)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function IntervalTab({ rows, setSessionNotes, recordingType }) {
  const [intervalRunning, setIntervalRunning] = useState(false);
  const [intervalIndex, setIntervalIndex] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const toggleIntervals = () => {
    if (intervalRunning) {
      clearInterval(timerRef.current);
      setIntervalRunning(false);
      return;
    }
    setIntervalRunning(true);
    timerRef.current = setInterval(() => {
      setIntervalIndex((i) => i + 1);
    }, INTERVAL_SECONDS * 1000);
  };

  const markInterval = (behaviorId, occurred) => {
    setSessionNotes((prev) => ({
      ...prev,
      behaviorReductionData: (prev.behaviorReductionData || []).map((row) => {
        if (row.id !== behaviorId) return row;
        const marks = [...(row.intervalMarks || [])];
        marks.push({ interval: intervalIndex, occurred: !!occurred, type: recordingType });
        return { ...row, intervalMarks: marks, dataToday: occurred ? Number(row.dataToday || 0) + 1 : row.dataToday };
      }),
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-md border p-3">
        <span className="text-sm">
          Interval {intervalIndex + 1} · {INTERVAL_SECONDS}s intervals
        </span>
        <Button type="button" size="sm" onClick={toggleIntervals} variant={intervalRunning ? "destructive" : "default"}>
          {intervalRunning ? "Stop Intervals" : "Start Intervals"}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Behavior</TableHead>
            <TableHead className="text-center">Mark interval</TableHead>
            <TableHead className="text-center">Total marks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((b) => (
            <TableRow key={b.id}>
              <TableCell className="font-medium">{b.behaviorName}</TableCell>
              <TableCell>
                <div className="flex justify-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => markInterval(b.id, false)}>
                    No
                  </Button>
                  <Button type="button" size="sm" onClick={() => markInterval(b.id, true)}>
                    Yes
                  </Button>
                </div>
              </TableCell>
              <TableCell className="text-center">{(b.intervalMarks || []).length}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function BehaviorReductionPanel({
  sessionNotes,
  setSessionNotes,
  onPersistSessionNotes,
}) {
  const [saving, setSaving] = useState(false);

  const behaviors = Array.isArray(sessionNotes.behaviorReductionData)
    ? sessionNotes.behaviorReductionData
    : [];
  const activeBehaviors = behaviors.filter((b) => !b.archived);

  const lastSavedAt = useMemo(() => {
    const times = behaviors
      .map((b) => b.savedAt)
      .filter(Boolean)
      .map((t) => new Date(t).getTime())
      .filter((n) => !Number.isNaN(n));
    if (!times.length) return null;
    return new Date(Math.max(...times));
  }, [behaviors]);

  const handleSaveBehaviors = async () => {
    const nextNotes = {
      ...sessionNotes,
      behaviorReductionData: (sessionNotes.behaviorReductionData || []).map((row) => ({
        ...row,
        savedAt: new Date().toISOString(),
      })),
    };

    setSessionNotes(nextNotes);

    if (!onPersistSessionNotes) {
      toast.success("Behaviors updated — save session notes to persist");
      return;
    }

    setSaving(true);
    try {
      await onPersistSessionNotes(nextNotes);
      toast.success("Behaviors saved");
    } catch {
      /* parent shows error toast */
    } finally {
      setSaving(false);
    }
  };

  const tabsPresent = useMemo(() => {
    const types = new Set(activeBehaviors.map((b) => b.recordingType || "Frequency"));
    return RECORDING_TYPES.filter((t) => types.has(t.value)).map((t) => t.value);
  }, [activeBehaviors]);

  const [activeTab, setActiveTab] = useState(tabsPresent[0] || "Frequency");

  useEffect(() => {
    if (tabsPresent.length && !tabsPresent.includes(activeTab)) {
      setActiveTab(tabsPresent[0]);
    }
  }, [tabsPresent, activeTab]);

  const rowsForType = (type) =>
    activeBehaviors.filter((b) => (b.recordingType || "Frequency") === type);

  return (
    <SessionNotesSectionCard
      icon={Activity}
      iconClassName="text-red-600"
      title="BEHAVIORS"
    >
      <div
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        role="toolbar"
        aria-label="Behavior data actions"
      >
        {lastSavedAt ? (
          <p className="text-sm text-slate-500">
            Last saved {lastSavedAt.toLocaleString()}
          </p>
        ) : (
          <p className="text-sm text-slate-500">
            Track frequency, duration, rate, and interval data by recording type.
          </p>
        )}
        <Button
          type="button"
          size="sm"
          className="bg-teal-600 hover:bg-teal-700 shrink-0 sm:ml-auto"
          disabled={saving || activeBehaviors.length === 0}
          onClick={handleSaveBehaviors}
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving…" : "Save behaviors"}
        </Button>
      </div>

      {activeBehaviors.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">
          No active behaviors configured for this client. Add behaviors under Configure data.
        </p>
      ) : tabsPresent.length === 0 ? (
        <p className="text-sm text-slate-500">No recording types available.</p>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            {tabsPresent.map((type) => (
              <TabsTrigger
                key={type}
                value={type}
                className="text-xs sm:text-sm data-[state=active]:bg-teal-600 data-[state=active]:text-white"
              >
                {recordingTypeLabel(type)}
                <Badge variant="secondary" className="ml-2">
                  {rowsForType(type).length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
          {tabsPresent.map((type) => (
            <TabsContent key={type} value={type} className="mt-4">
              {type === "Frequency" && (
                <FrequencyTab rows={rowsForType(type)} setSessionNotes={setSessionNotes} />
              )}
              {type === "Duration" && (
                <DurationTab rows={rowsForType(type)} setSessionNotes={setSessionNotes} />
              )}
              {type === "Rate" && (
                <RateTab
                  rows={rowsForType(type)}
                  setSessionNotes={setSessionNotes}
                  rateSessionSeconds={sessionNotes.behaviorRateSessionSeconds ?? 0}
                />
              )}
              {(type === "PartialInterval" || type === "MomentaryTimeSample") && (
                <IntervalTab
                  rows={rowsForType(type)}
                  setSessionNotes={setSessionNotes}
                  recordingType={type}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </SessionNotesSectionCard>
  );
}
