"use client";

import React from "react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  ChevronRight,
  Copy,
  Edit,
  Plus,
  Target,
  TargetIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { Card, CardContent, CardHeader } from "../ui/card";
import { mahaverseFetch } from "@/lib/mahaverse-api";
import { isRowArchived, setClientConfigArchived } from "@/lib/client-config-archive";
import PromptMultiSelect from "@/components/master-data/prompt-multi-select";
import { getDomainModuleLabel, DEFAULT_DOMAIN_MODULE_KEY } from "@/lib/domain-module-options";
import AddTargetModal from "@/components/master-data/add-target-modal";

const activityTypes = [
  "Task Analysis",
  "Discrete Trial Training",
  "Natural Environment Training",
  "Group Instruction",
];

export default function ClientTargetModal({
  isOpen,
  onClose,
  onAdd,
  onEdit,
  clientId,
  clientName,
  programs = [],
  domains = [],
  modules = [],
  allPrompts = [],
  loading,
  editingTarget,
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [programId, setProgramId] = useState("");
  const [programSearch, setProgramSearch] = useState("");
  const [activityType, setActivityType] = useState("");
  const [selectedPrompts, setSelectedPrompts] = useState([]);
  const isEditMode = !!editingTarget;
  const isTaskAnalysisType = activityType === "Task Analysis";

  useEffect(() => {
    if (editingTarget) {
      setName(editingTarget.name || "");
      setDescription(editingTarget.description || "");
      setProgramId(editingTarget.program_id || editingTarget.programId || "");
      setActivityType(
        editingTarget.activity_type || editingTarget.activityType || ""
      );
      const promptIds =
        editingTarget.prompts?.map((p) =>
          String(typeof p === "string" || typeof p === "number" ? p : p.id)
        ) || [];
      setSelectedPrompts(promptIds);
    } else {
      setName("");
      setDescription("");
      setProgramId("");
      setActivityType("");
      setSelectedPrompts([]);
    }
  }, [editingTarget, isOpen]);

  const selectedProgram = programs.find(
    (p) => String(p.id) === String(programId)
  );
  const selectedDomain = domains.find(
    (d) =>
      String(d.id) ===
      String(selectedProgram?.domain_id || selectedProgram?.domainId)
  );
  const selectedModuleLabel = getDomainModuleLabel(
    modules,
    selectedDomain?.module_id ||
      selectedDomain?.moduleId ||
      selectedDomain?.MODULE_ID ||
      (selectedDomain ? DEFAULT_DOMAIN_MODULE_KEY : "")
  );

  const programOptionLabel = (program) => {
    const domain = domains.find(
      (d) =>
        String(d.id) ===
        String(program.domain_id || program.domainId || program.DOMAIN_ID)
    );
    const moduleName = domain
      ? getDomainModuleLabel(
          modules,
          domain.module_id ||
            domain.moduleId ||
            domain.MODULE_ID ||
            DEFAULT_DOMAIN_MODULE_KEY
        )
      : "—";
    const domainName = domain?.name || domain?.NAME || "";
    const programName = program.name || program.NAME || "Unnamed Program";
    const modulePart =
      moduleName && moduleName !== "—" ? moduleName : domain ? "Skill Acquisition" : "Module";
    const domainPart = domainName || "Domain";
    return `${modulePart} - ${domainPart} - ${programName}`;
  };

  const sortedFilteredPrograms = [...programs]
    .filter((p) => p.id && String(p.id).trim() !== "")
    .sort((a, b) => programOptionLabel(a).localeCompare(programOptionLabel(b)))
    .filter((p) =>
      programOptionLabel(p)
        .toLowerCase()
        .includes(programSearch.toLowerCase())
    );

  const selectedProgramLabel = selectedProgram
    ? programOptionLabel(selectedProgram)
    : "";

  const buildPromptObjects = () => {
    if (isTaskAnalysisType) return [];
    return selectedPrompts
      .map((id) => {
        const prompt = allPrompts.find((p) => String(p.id) === String(id));
        return prompt
          ? {
              id: prompt.id,
              prompt_name: prompt.prompt_name,
              max_score: prompt.max_score,
              score_as_independent: prompt.score_as_independent,
              dtt: prompt.dtt,
              ta: prompt.ta,
              maintenance: prompt.maintenance,
              status: prompt.status,
            }
          : { id };
      })
      .filter((p) => p?.id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim() || !programId || !activityType) {
      toast.error("Target name, program, and activity type are required");
      return;
    }

    try {
      const prompts = buildPromptObjects();
      let ok = true;
      if (isEditMode) {
        const updatedTarget = {
          ...editingTarget,
          name: name.trim(),
          description: description.trim(),
          program_id: programId,
          activity_type: activityType,
          prompts,
        };
        ok = await onEdit(updatedTarget);
      } else {
        const newTarget = {
          id: `target_${Date.now()}`,
          client_id: clientId,
          program_id: programId,
          name: name.trim(),
          description: description.trim(),
          activity_type: activityType,
          status: "Active",
          archived: 0,
          prompts,
        };
        ok = await onAdd(newTarget);
      }

      if (ok === false) return;

      setName("");
      setDescription("");
      setProgramId("");
      setProgramSearch("");
      setActivityType("");
      setSelectedPrompts([]);
      onClose();
    } catch (error) {
      console.error("Error saving target:", error);
      toast.error("Failed to save target");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex flex-col items-center text-center capitalize">
            <div className="flex items-center gap-2">
              <Target size={20} className="text-teal-600" />
              <span className="text-lg font-semibold">
                {isEditMode ? "Edit Target" : "Add Target"}
              </span>
            </div>

            {selectedModuleLabel &&
              selectedModuleLabel !== "—" &&
              selectedDomain &&
              selectedProgram && (
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground flex-wrap justify-center">
                <span className="font-medium">{clientName}</span>
                <ChevronRight size={16} className="text-muted-foreground" />
                <span className="font-medium">{selectedModuleLabel}</span>
                <ChevronRight size={16} className="text-muted-foreground" />
                <span className="font-medium">
                  {selectedDomain.name || selectedDomain.NAME}
                </span>
                <ChevronRight size={16} className="text-muted-foreground" />
                <span className="font-medium">
                  {selectedProgram.name || selectedProgram.NAME}
                </span>
                {name && (
                  <>
                    <ChevronRight size={16} className="text-muted-foreground" />
                    <span className="font-medium text-teal-600">{name}</span>
                  </>
                )}
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Program Selection */}
          <div className="space-y-2">
            <Label htmlFor="program-select">Select Program *</Label>

            <Select
              value={programId}
              onValueChange={(value) => {
                setProgramId(value);
                setProgramSearch("");
              }}
              disabled={loading}
            >
              <SelectTrigger id="program-select">
                <SelectValue placeholder="Choose a program">
                  {selectedProgramLabel}
                </SelectValue>
              </SelectTrigger>

              <SelectContent>
                <div className="px-2 py-2 sticky top-0 bg-white z-10">
                  <Input
                    placeholder="Search programs..."
                    value={programSearch}
                    onChange={(e) => setProgramSearch(e.target.value)}
                    className="h-8"
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>

                {sortedFilteredPrograms.length > 0 ? (
                  sortedFilteredPrograms.map((program) => (
                    <SelectItem key={program.id} value={String(program.id)}>
                      {programOptionLabel(program)}
                    </SelectItem>
                  ))
                ) : (
                  <div className="py-2 px-3 text-sm text-muted-foreground">
                    No programs found
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Activity Type */}
          <div className="space-y-2">
            <Label htmlFor="activity-type">Activity Type *</Label>
            <Select
              value={activityType}
              onValueChange={setActivityType}
              disabled={loading}
            >
              <SelectTrigger id="activity-type">
                <SelectValue placeholder="Select activity type" />
              </SelectTrigger>
              <SelectContent>
                {activityTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Target Name */}
          <div className="space-y-2">
            <Label htmlFor="target-name">Target Name *</Label>
            <Input
              id="target-name"
              placeholder="Enter target name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Target Description */}
          <div className="space-y-2">
            <Label htmlFor="target-description">Description (optional)</Label>
            <Textarea
              id="target-description"
              placeholder="Enter target description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              rows={3}
            />
          </div>

          {!isTaskAnalysisType && (
            <div className="space-y-2">
              <Label>Prompts</Label>
              <PromptMultiSelect
                allPrompts={allPrompts}
                selectedIds={selectedPrompts}
                onChange={setSelectedPrompts}
                disabled={loading}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? isEditMode
                  ? "Updating..."
                  : "Adding..."
                : isEditMode
                ? "Save Changes"
                : "Add Target"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TargetsListModal({
  isOpen,
  onClose,
  clientId,
  clientName,
  targets,
  programs,
  domains,
  modules,
  allPrompts = [],
  loading,
  onReload, // call loadClientTargets again
  onAddTarget, // wraps handleAddTarget
  onEditTarget, // wraps handleEditTarget
}) {
  const [isTargetFormOpen, setIsTargetFormOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const openAdd = () => {
    setEditingTarget(null);
    setIsTargetFormOpen(true);
  };

  const openEdit = (target) => {
    setEditingTarget(target);
    setIsTargetFormOpen(true);
  };

  const handleTargetSaved = async (target, isEdit) => {
    const ok = isEdit
      ? await onEditTarget(target)
      : await onAddTarget(target);
    if (ok === false) return false;
    await onReload();
    return true;
  };

  const handleToggleArchiveTarget = async (target) => {
    const archiving = !isRowArchived(target);
    if (
      archiving &&
      !confirm("Archive this target? You can restore it from Show Archived.")
    ) {
      return;
    }
    const ok = await setClientConfigArchived({
      clientId,
      kind: "target",
      id: target.id,
      archived: archiving,
    });
    if (ok) await onReload();
  };

  /** Same copy rules as Configure data → Targets → Clone. */
  const handleCloneTarget = async (target) => {
    const stamp = Date.now();
    const activity = {
      id: `target_${stamp}_${Math.random().toString(36).slice(2, 9)}`,
      programId: target.programId || target.program_id,
      name: `${target.name || "Target"} (Copy)`,
      goalDescription: target.goalDescription || target.description || "",
      trials: target.trials || 1,
      activityType: target.activityType || target.activity_type || "",
      instructions: target.instructions || "",
      status: "Active",
      archived: 0,
      prompts: (target.prompts || []).map((p) =>
        typeof p === "object" && p
          ? { ...p, id: p.id ? `${p.id}_clone_${stamp}` : undefined }
          : p
      ),
      tasks: (target.tasks || []).map((t, idx) => ({
        ...t,
        id: t.id ? `${t.id}_clone_${stamp}_${idx}` : `task_${stamp}_${idx}`,
      })),
    };
    try {
      const res = await mahaverseFetch("/client-modules.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, activities: [activity] }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        toast.success("Target cloned!");
        await onReload();
      } else {
        toast.error(json.message || "Clone failed");
      }
    } catch (err) {
      toast.error("Clone failed");
    }
  };

  const visibleTargets = (targets || []).filter(
    (t) => isRowArchived(t) === showArchived
  );

  return (
    <>
      {/* List modal */}
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <TargetIcon className="h-6 w-6 text-teal-600" />
              Targets for {clientName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={openAdd} className="bg-teal-600 hover:bg-teal-700">
                <Plus className="h-4 w-4 mr-2" /> Add Target
              </Button>
              <Button variant="outline" onClick={() => setShowArchived(!showArchived)}>
                {showArchived ? (
                  <>
                    <ArchiveRestore className="h-4 w-4 mr-2" /> Show Active
                  </>
                ) : (
                  <>
                    <Archive className="h-4 w-4 mr-2" /> Show Archived
                  </>
                )}
              </Button>
            </div>

            {loading ? (
              <p className="text-center py-8 text-gray-500">Loading...</p>
            ) : visibleTargets.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <TargetIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p>{showArchived ? "No archived targets." : "No targets yet. Create one!"}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {visibleTargets.map((target) => {
                  const program = programs.find(
                    (p) =>
                      String(p.id) ===
                      String(target.program_id || target.programId)
                  );
                  const domain = domains.find(
                    (d) =>
                      String(d.id) ===
                      String(program?.domain_id || program?.domainId)
                  );
                  const moduleLabel = domain
                    ? getDomainModuleLabel(
                        modules,
                        domain.module_id ||
                          domain.moduleId ||
                          domain.MODULE_ID ||
                          DEFAULT_DOMAIN_MODULE_KEY
                      )
                    : "—";

                  return (
                    <Card
                      key={target.id}
                      className="border-l-4 border-l-teal-500"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg capitalize">
                              {target.name || target.NAME || "Unnamed Target"}
                            </h3>
                            {target.description && (
                              <p className="text-sm text-gray-600 mt-1">
                                {target.description}
                              </p>
                            )}
                            <div className="flex items-center gap-1 mt-2 flex-wrap text-xs text-black">
                              <span className="flex items-center gap-1">
                                <span className="font-medium">Module:</span>
                                <span>
                                  {moduleLabel && moduleLabel !== "—"
                                    ? moduleLabel
                                    : "Not assigned"}
                                </span>
                              </span>

                              <ArrowRight className="w-3 h-3 text-muted-foreground" />

                              <span className="flex items-center gap-1">
                                <span className="font-medium">Domain:</span>
                                <span>
                                  {domain?.name ||
                                    domain?.NAME ||
                                    "Not assigned"}
                                </span>
                              </span>

                              <ArrowRight className="w-3 h-3 text-muted-foreground" />

                              <span className="flex items-center gap-1">
                                <span className="font-medium">Program:</span>
                                <span>
                                  {program?.name ||
                                    program?.NAME ||
                                    "Not assigned"}
                                </span>
                              </span>

                              <ArrowRight className="w-3 h-3 text-muted-foreground" />

                              <span className="flex items-center gap-1">
                                <span className="font-medium">
                                  Activity type:
                                </span>
                                <span>
                                  {target.activity_type ||
                                    target.activityType ||
                                    "No activity type"}
                                </span>
                              </span>

                              <ArrowRight className="w-3 h-3 text-muted-foreground" />

                              <span className="flex items-center gap-1">
                                <span className="font-medium">Status:</span>
                                <span>
                                  {target.status || target.STATUS || "Active"}
                                </span>
                              </span>
                            </div>
                            {Array.isArray(target.prompts) &&
                              target.prompts.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {target.prompts.map((p) => {
                                    const id =
                                      typeof p === "string" ||
                                      typeof p === "number"
                                        ? p
                                        : p.id;
                                    const label =
                                      typeof p === "object" && p?.prompt_name
                                        ? p.prompt_name
                                        : allPrompts.find(
                                            (ap) =>
                                              String(ap.id) === String(id)
                                          )?.prompt_name || String(id);
                                    return (
                                      <Badge
                                        key={String(id)}
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {label}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(target)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {!isRowArchived(target) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCloneTarget(target)}
                                title="Clone"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleArchiveTarget(target)}
                              title={isRowArchived(target) ? "Restore" : "Archive"}
                              className={
                                isRowArchived(target)
                                  ? "text-green-600 hover:text-green-700"
                                  : "text-amber-600 hover:text-amber-700"
                              }
                            >
                              {isRowArchived(target) ? (
                                <ArchiveRestore className="h-4 w-4" />
                              ) : (
                                <Archive className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit modal — same form as Configure data → Targets */}
      <AddTargetModal
        isOpen={isTargetFormOpen}
        onClose={() => {
          setIsTargetFormOpen(false);
          setEditingTarget(null);
        }}
        onAdd={(newTarget) => handleTargetSaved(newTarget, false)}
        onEdit={(updatedTarget) => handleTargetSaved(updatedTarget, true)}
        programs={programs}
        domains={domains}
        modules={modules}
        allPrompts={allPrompts}
        loading={loading}
        editingTarget={editingTarget}
        lockedClientId={clientId ? String(clientId) : ""}
        lockedClientName={clientName || ""}
      />
    </>
  );
}
