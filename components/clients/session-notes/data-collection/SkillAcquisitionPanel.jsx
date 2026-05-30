"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import SessionNotesSectionCard from "../session-notes/SessionNotesSectionCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, Pencil, Plus, Target } from "lucide-react";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import SkillAcquisitionEntryModal from "./SkillAcquisitionEntryModal";
import { skillRowHasRecordedData } from "@/lib/skill-acquisition-trials";

function normalizeProgram(p) {
  return {
    id: String(p.id),
    name: p.name || p.NAME || "Unnamed Program",
    domain_id: String(p.domain_id || p.domainId || p.domainID || ""),
    archived: Boolean(p.archived === 1 || p.archived === true),
    status: p.status || p.STATUS || "Active",
    raw: p,
  };
}

function normalizeTarget(t) {
  return {
    id: String(t.id),
    name: t.name || t.NAME || "Unnamed Target",
    program_id: String(t.program_id || t.programId || ""),
    status: t.status || t.STATUS || "Active",
    raw: t,
  };
}

function upsertSkillRow(prev, rowPatch) {
  const list = [...(prev.skillAcquisitionData || [])];
  const targetId = String(rowPatch.targetId || "");
  const idx = list.findIndex((r) => {
    if (rowPatch.id && r.id === rowPatch.id) return true;
    return targetId && String(r.targetId || "") === targetId;
  });
  const nextRow = {
    ...rowPatch,
    savedAt: rowPatch.savedAt || new Date().toISOString(),
  };
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...nextRow };
  } else {
    list.push({
      id: rowPatch.id || `skill_${targetId || Date.now()}_${Date.now()}`,
      ...nextRow,
    });
  }
  return { ...prev, skillAcquisitionData: list };
}

export default function SkillAcquisitionPanel({
  clientId = null,
  sessionDate = null,
  clientPrograms,
  clientTargets,
  sessionNotes,
  setSessionNotes,
  onPersistSessionNotes,
}) {
  const [selectedProgramId, setSelectedProgramId] = useState("all");
  const [selectedTargetId, setSelectedTargetId] = useState("all");
  const [showSkillArchived, setShowSkillArchived] = useState(false);
  const [entryModal, setEntryModal] = useState({
    open: false,
    mode: "edit",
    row: null,
  });
  const [saving, setSaving] = useState(false);

  const allPrograms = useMemo(() => {
    return (clientPrograms || [])
      .map(normalizeProgram)
      .filter((p) => (showSkillArchived ? p.archived : !p.archived))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clientPrograms, showSkillArchived]);

  const targets = useMemo(
    () => (Array.isArray(clientTargets) ? clientTargets : []).map(normalizeTarget),
    [clientTargets],
  );

  const targetRawById = useMemo(() => {
    const map = new Map();
    (clientTargets || []).forEach((t) => {
      const id = String(t.id ?? "");
      if (id) map.set(id, t);
    });
    return map;
  }, [clientTargets]);

  const targetsInProgram = useMemo(() => {
    if (selectedProgramId === "all") return [];
    return targets
      .filter((t) => t.program_id === selectedProgramId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [targets, selectedProgramId]);

  useEffect(() => {
    if (
      selectedProgramId !== "all" &&
      !allPrograms.some((p) => p.id === selectedProgramId)
    ) {
      setSelectedProgramId("all");
    }
  }, [allPrograms, selectedProgramId]);

  const handleProgramChange = (programId) => {
    setSelectedProgramId(programId);
    setSelectedTargetId("all");
  };

  useEffect(() => {
    if (selectedProgramId === "all") {
      setSelectedTargetId("all");
      return;
    }
    if (targetsInProgram.length === 1) {
      setSelectedTargetId(targetsInProgram[0].id);
      return;
    }
    if (
      selectedTargetId !== "all" &&
      !targetsInProgram.some((t) => t.id === selectedTargetId)
    ) {
      setSelectedTargetId("all");
    }
  }, [selectedProgramId, targetsInProgram, selectedTargetId]);

  const programNameById = useMemo(() => {
    const map = new Map();
    allPrograms.forEach((p) => map.set(p.id, p.name));
    (clientPrograms || []).forEach((p) => {
      const id = String(p.id);
      if (!map.has(id)) map.set(id, p.name || p.NAME || "Unnamed Program");
    });
    return map;
  }, [allPrograms, clientPrograms]);

  const resolveRowProgramId = useCallback(
    (row) => {
      if (row.programId) return String(row.programId);
      const byName = allPrograms.find((p) => p.name === row.programName);
      return byName?.id || "";
    },
    [allPrograms],
  );

  const resolveRowTargetId = useCallback(
    (row) => {
      if (row.targetId) return String(row.targetId);
      const programId = resolveRowProgramId(row);
      const inProgram = targets.filter((t) => t.program_id === programId);
      const byName = inProgram.find((t) => t.name === row.targetName);
      return byName?.id || "";
    },
    [targets, resolveRowProgramId],
  );

  const dataEntryRows = useMemo(() => {
    const saved = sessionNotes.skillAcquisitionData || [];
    const savedByTargetId = new Map();
    saved.forEach((row) => {
      const tid = resolveRowTargetId(row);
      if (tid) savedByTargetId.set(tid, row);
    });

    if (selectedProgramId !== "all") {
      let list = targetsInProgram;
      if (selectedTargetId !== "all") {
        list = list.filter((t) => t.id === selectedTargetId);
      }
      return list.map((t) => {
        const existing = savedByTargetId.get(t.id);
        const program = allPrograms.find((p) => p.id === t.program_id);
        if (existing) return existing;
        return {
          id: `skill_pending_${t.id}`,
          programId: t.program_id,
          programName: program?.name || programNameById.get(t.program_id) || "",
          targetId: t.id,
          targetName: t.name,
          value: "",
        };
      });
    }

    let rows = saved;
    if (selectedTargetId !== "all") {
      rows = rows.filter((row) => resolveRowTargetId(row) === selectedTargetId);
    }
    return rows;
  }, [
    sessionNotes.skillAcquisitionData,
    selectedProgramId,
    selectedTargetId,
    targetsInProgram,
    allPrograms,
    programNameById,
    resolveRowTargetId,
  ]);

  const openEntryModal = (row, mode) => {
    const targetId = resolveRowTargetId(row);
    const targetData = targetId ? targetRawById.get(targetId) : null;
    setEntryModal({ open: true, mode, row, targetData });
  };

  const closeEntryModal = () => {
    setEntryModal({ open: false, mode: "edit", row: null });
  };

  const handleModalSave = async (payload, meta) => {
    if (meta?.switchToEdit) {
      setEntryModal((prev) => ({ ...prev, mode: "edit" }));
      return;
    }

    const row = entryModal.row;
    if (!row) return;

    const entry =
      payload && typeof payload === "object"
        ? payload
        : { value: String(payload || "").trim(), trials: [] };

    const nextNotes = upsertSkillRow(sessionNotes, {
      ...row,
      value: entry.value || "",
      trials: Array.isArray(entry.trials) ? entry.trials : [],
      notes: entry.notes || "",
      activityType: entry.activityType || row.activityType || "",
      plannedTrials: entry.plannedTrials ?? row.plannedTrials,
      savedAt: new Date().toISOString(),
    });

    setSessionNotes(nextNotes);

    if (onPersistSessionNotes) {
      setSaving(true);
      try {
        await onPersistSessionNotes(nextNotes);
        toast.success("Skill acquisition saved");
        closeEntryModal();
      } catch {
        /* parent shows error toast */
      } finally {
        setSaving(false);
      }
    } else {
      toast.success("Entry updated — save session notes to persist");
      closeEntryModal();
    }
  };

  const selectedProgram = allPrograms.find((p) => p.id === selectedProgramId) || null;
  const selectedTarget =
    targetsInProgram.find((t) => t.id === selectedTargetId) || null;
  const showTargetDropdown =
    selectedProgramId !== "all" && targetsInProgram.length > 1;

  const showTargetColumn =
    selectedProgramId === "all" ||
    (selectedProgramId !== "all" && selectedTargetId === "all" && targetsInProgram.length > 1);

  return (
    <>
      <SessionNotesSectionCard
        icon={Target}
        iconClassName="text-green-600"
        title="SKILL ACQUISITION (Data Entry)"
      >
        <div
          className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
          role="toolbar"
          aria-label="Skill acquisition filters"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-1 sm:max-w-3xl">
            <div className="space-y-2 flex-1">
              <Label htmlFor="skill-acq-program">Program</Label>
              <Select value={selectedProgramId} onValueChange={handleProgramChange}>
                <SelectTrigger id="skill-acq-program">
                  <SelectValue placeholder="Select a program" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All programs</SelectItem>
                  {allPrograms.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showTargetDropdown && (
              <div className="space-y-2 flex-1">
                <Label htmlFor="skill-acq-target">Target</Label>
                <Select value={selectedTargetId} onValueChange={setSelectedTargetId}>
                  <SelectTrigger id="skill-acq-target">
                    <SelectValue placeholder="Select a target" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All targets</SelectItem>
                    {targetsInProgram.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setShowSkillArchived((v) => !v)}
          >
            {showSkillArchived ? "Show active" : "Show archived"}
          </Button>
        </div>

        {allPrograms.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">
            No programs configured for this client. Add programs under Configure data.
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              {selectedProgramId === "all"
                ? "Use the action icons to record or view today’s value per target. Entries save to this session."
                : selectedTarget
                  ? `Record or view today’s value for ${selectedTarget.name}.`
                  : targetsInProgram.length === 0
                    ? "This program has no targets yet."
                    : `Select a target or use the icons in the table to record session values.`}
            </p>

            {selectedProgramId !== "all" && targetsInProgram.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">
                Add targets under Configure data to record skill acquisition for this program.
              </p>
            ) : (
              <Table>
                  <TableHeader>
                    <TableRow>
                      {selectedProgramId === "all" && <TableHead>Program</TableHead>}
                      {showTargetColumn && <TableHead>Target</TableHead>}
                      <TableHead>Value</TableHead>
                      <TableHead className="w-[100px] text-center">Status</TableHead>
                      <TableHead className="w-[100px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dataEntryRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={
                            (selectedProgramId === "all" ? 1 : 0) +
                            (showTargetColumn ? 1 : 0) +
                            3
                          }
                          className="text-center text-slate-500"
                        >
                          {selectedProgramId === "all"
                            ? "No skill acquisition rows found."
                            : "No matching targets for this selection."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      dataEntryRows.map((row) => {
                        const recorded = skillRowHasRecordedData(row);
                        return (
                          <TableRow key={row.id}>
                            {selectedProgramId === "all" && (
                              <TableCell className="font-medium">
                                {row.programName ||
                                  programNameById.get(resolveRowProgramId(row)) ||
                                  "—"}
                              </TableCell>
                            )}
                            {showTargetColumn && (
                              <TableCell>{row.targetName || "—"}</TableCell>
                            )}
                            <TableCell className="max-w-[220px] truncate text-slate-700">
                              {recorded ? row.value : "—"}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant={recorded ? "default" : "secondary"}
                                className={
                                  recorded
                                    ? "bg-green-100 text-green-800 hover:bg-green-100"
                                    : ""
                                }
                              >
                                {recorded ? "Recorded" : "Pending"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {recorded ? (
                                  <>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      title="View entry"
                                      onClick={() => openEntryModal(row, "view")}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      title="Edit entry"
                                      onClick={() => openEntryModal(row, "edit")}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-teal-600"
                                    title="Record entry"
                                    onClick={() => openEntryModal(row, "edit")}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
              </Table>
            )}
          </>
        )}
      </SessionNotesSectionCard>

      <SkillAcquisitionEntryModal
        isOpen={entryModal.open}
        onClose={closeEntryModal}
        mode={entryModal.mode}
        row={entryModal.row}
        targetData={entryModal.targetData}
        clientId={clientId}
        sessionDate={sessionDate}
        saving={saving}
        onSave={handleModalSave}
      />
    </>
  );
}
