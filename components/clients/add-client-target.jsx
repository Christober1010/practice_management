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
  ArrowRight,
  ChevronRight,
  Edit,
  Plus,
  Target,
  TargetIcon,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import { Card, CardContent, CardHeader } from "../ui/card";
import { mahaverseFetch } from "@/lib/mahaverse-api";
import PromptMultiSelect from "@/components/master-data/prompt-multi-select";

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
    (d) => d.id === selectedProgram?.domain_id
  );
  const selectedModule = modules.find(
    (m) => m.id === selectedDomain?.module_id
  );

  const sortedFilteredPrograms = [...programs]
    .filter((p) => p.id && String(p.id).trim() !== "")
    .sort((a, b) => {
      const domainA = domains.find((d) => d.id === a.domain_id);
      const domainB = domains.find((d) => d.id === b.domain_id);
      const moduleA =
        modules.find((m) => m.id === domainA?.module_id)?.name || "";
      const moduleB =
        modules.find((m) => m.id === domainB?.module_id)?.name || "";

      const moduleCompare = moduleA.localeCompare(moduleB);
      if (moduleCompare !== 0) return moduleCompare;

      const domainCompare = (domainA?.name || "").localeCompare(
        domainB?.name || ""
      );
      if (domainCompare !== 0) return domainCompare;

      return a.name.localeCompare(b.name);
    })
    .filter((p) => {
      const domain = domains.find((d) => d.id === p.domain_id);
      const module = modules.find((m) => m.id === domain?.module_id);
      const label = `${module?.name || ""} - ${domain?.name || ""} - ${p.name}`;
      return label.toLowerCase().includes(programSearch.toLowerCase());
    });

  const selectedProgramLabel = selectedProgram
    ? `${selectedModule?.name || "Module"} - ${
        selectedDomain?.name || "Domain"
      } - ${selectedProgram.name}`
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

            {selectedModule && selectedDomain && selectedProgram && (
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground flex-wrap justify-center">
                <span className="font-medium">{clientName}</span>
                <ChevronRight size={16} className="text-muted-foreground" />
                <span className="font-medium">{selectedModule.name}</span>
                <ChevronRight size={16} className="text-muted-foreground" />
                <span className="font-medium">{selectedDomain.name}</span>
                <ChevronRight size={16} className="text-muted-foreground" />
                <span className="font-medium">{selectedProgram.name}</span>
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
                  sortedFilteredPrograms.map((program) => {
                    const domain = domains.find(
                      (d) => d.id === program.domain_id
                    );
                    const module = modules.find(
                      (m) => m.id === domain?.module_id
                    );
                    const label = `${module?.name} - ${domain?.name} - ${program.name}`;

                    return (
                      <SelectItem key={program.id} value={String(program.id)}>
                        {label}
                      </SelectItem>
                    );
                  })
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

  const handleDeleteTarget = async (targetId) => {
    if (!confirm("Are you sure you want to delete this target?")) return;
    try {
      const res = await mahaverseFetch("/client-modules.php", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          activityId: targetId,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        toast.success("Target deleted");
        await onReload();
      } else {
        toast.error(json.message || "Failed to delete target");
      }
    } catch (err) {
      toast.error("Failed to delete target");
    }
  };

  return (
    <>
      {/* List modal */}
      <Dialog open={isOpen} onOpenChange={onClose}>
        {console.log(programs, "programs")}
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <TargetIcon className="h-6 w-6 text-teal-600" />
              Targets for {clientName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Button onClick={openAdd} className="bg-teal-600 hover:bg-teal-700">
              <Plus className="h-4 w-4 mr-2" /> Add Target
            </Button>

            {loading ? (
              <p className="text-center py-8 text-gray-500">Loading...</p>
            ) : targets.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <TargetIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p>No targets yet. Create one!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {targets.map((target) => {
                  const program = programs.find(
                    (p) => String(p.id) === String(target.program_id)
                  );
                  const domain = domains.find(
                    (d) => d.id === program?.domain_id
                  );
                  const module = modules.find(
                    (m) => m.id === domain?.module_id
                  );

                  return (
                    <Card
                      key={target.id}
                      className="border-l-4 border-l-teal-500"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg capitalize">
                              {target.name}
                            </h3>
                            {target.description && (
                              <p className="text-sm text-gray-600 mt-1">
                                {target.description}
                              </p>
                            )}
                            <div className="flex items-center gap-1 mt-2 flex-wrap text-xs text-black">
                              <span className="flex items-center gap-1">
                                <span className="font-medium">Module:</span>
                                <span>{module?.name || "Not assigned"}</span>
                              </span>

                              <ArrowRight className="w-3 h-3 text-muted-foreground" />

                              <span className="flex items-center gap-1">
                                <span className="font-medium">Domain:</span>
                                <span>{domain?.name || "Not assigned"}</span>
                              </span>

                              <ArrowRight className="w-3 h-3 text-muted-foreground" />

                              <span className="flex items-center gap-1">
                                <span className="font-medium">Program:</span>
                                <span>{program?.name || "Not assigned"}</span>
                              </span>

                              <ArrowRight className="w-3 h-3 text-muted-foreground" />

                              <span className="flex items-center gap-1">
                                <span className="font-medium">
                                  Activity type:
                                </span>
                                <span>
                                  {target.activity_type || "No activity type"}
                                </span>
                              </span>

                              <ArrowRight className="w-3 h-3 text-muted-foreground" />

                              <span className="flex items-center gap-1">
                                <span className="font-medium">Status:</span>
                                <span>{target.status || "Active"}</span>
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
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTarget(target.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
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

      {/* Add/Edit modal */}
      <ClientTargetModal
        isOpen={isTargetFormOpen}
        onClose={() => {
          setIsTargetFormOpen(false);
          setEditingTarget(null);
        }}
        onAdd={(newTarget) => handleTargetSaved(newTarget, false)}
        onEdit={(updatedTarget) => handleTargetSaved(updatedTarget, true)}
        clientId={clientId}
        clientName={clientName}
        programs={programs}
        domains={domains}
        modules={modules}
        allPrompts={allPrompts}
        loading={loading}
        editingTarget={editingTarget}
      />
    </>
  );
}
