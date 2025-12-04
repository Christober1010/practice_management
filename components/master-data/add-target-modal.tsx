"use client";

import type React from "react";
import { useState, useEffect, useRef } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus,
  Trash2,
  ChevronDown,
  CheckIcon,
  XIcon,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface AddTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (target: any) => Promise<void>;
  onEdit: (target: any) => Promise<void>;
  programs: any[];
  domains: any[];
  modules: any[];
  allPrompts: any[];
  loading: boolean;
  editingTarget?: any | null;
}

const activityTypes = [
  "Task Analysis",
  "Discrete Trial Training",
  "Natural Environment Training",
  "Group Instruction",
];

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default function AddTargetModal({
  isOpen,
  onClose,
  onAdd,
  onEdit,
  programs,
  domains,
  modules,
  allPrompts,
  loading,
  editingTarget,
}: AddTargetModalProps) {
  const [name, setName] = useState("");
  const [programId, setProgramId] = useState("");
  const [activityType, setActivityType] = useState("");
  const [status, setStatus] = useState("Active");

  const [goalDescription, setGoalDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [trials, setTrials] = useState("1");
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([]);

  const [tasks, setTasks] = useState<
    { id: string; name: string; sequence: number }[]
  >([]);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskSequence, setNewTaskSequence] = useState("1");

  const isEditMode = !!editingTarget;

  // Pre-fill fields when editing
  useEffect(() => {
    if (editingTarget) {
      setName(editingTarget.name || "");
      setProgramId(editingTarget.programId || "");
      setActivityType(editingTarget.activityType || "");
      setStatus(editingTarget.status || "Active");
      setGoalDescription(editingTarget.goalDescription || "");
      setInstructions(editingTarget.instructions || "");
      setTrials(String(editingTarget.trials || 1));

      // Set prompts - extract IDs from prompt objects
      const promptIds =
        editingTarget.prompts?.map((p) => (typeof p === "string" ? p : p.id)) ||
        [];
      setSelectedPrompts(promptIds);

      // Set tasks
      const taskList =
        editingTarget.tasks?.map((t) => ({
          id: t.id || generateId(),
          name: t.name,
          sequence: t.step_order || t.sequence || 1,
        })) || [];
      setTasks(taskList);
    } else {
      resetForm();
    }
  }, [editingTarget]);

  const handleAddTask = () => {
    if (!newTaskName.trim()) {
      toast.error("Task step name is required");
      return;
    }
    const newTask = {
      id: generateId(),
      name: newTaskName.trim(),
      sequence: Number.parseInt(newTaskSequence) || 1,
    };
    setTasks([...tasks, newTask]);
    setNewTaskName("");
    setNewTaskSequence("1");
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(tasks.filter((task) => task.id !== taskId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !programId || !activityType.trim()) {
      toast.error("Target name, program, and type are required");
      return;
    }

    if (!goalDescription.trim() || !instructions.trim()) {
      toast.error("Goal Description and Instructions are required");
      return;
    }

    if (Number.parseInt(trials) < 1 || Number.parseInt(trials) > 100) {
      toast.error("Number of Trials must be between 1 and 100");
      return;
    }

    if (activityType === "Task Analysis" && tasks.length === 0) {
      toast.error("Task Analysis requires at least one task step");
      return;
    }

    // Convert selected prompt IDs into full prompt objects
    const promptObjects = selectedPrompts
      .map((id) => {
        const prompt = allPrompts.find((p) => p.id === id);
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
          : null;
      })
      .filter(Boolean);

    try {
      if (isEditMode) {
        // Update existing target
        const updatedTarget = {
          ...editingTarget,
          programId,
          name: name.trim(),
          activityType: activityType.trim(),
          status,
          goalDescription: goalDescription.trim(),
          instructions: instructions.trim(),
          trials: Number.parseInt(trials) || 1,
          prompts: promptObjects,
          tasks: activityType === "Task Analysis" ? tasks : [],
        };
        await onEdit(updatedTarget);
      } else {
        // Add new target
        const newTarget = {
          id: `target_${Date.now()}`,
          programId,
          name: name.trim(),
          activityType: activityType.trim(),
          status,
          archived: 0,
          goalDescription: goalDescription.trim(),
          instructions: instructions.trim(),
          trials: Number.parseInt(trials) || 1,
          prompts: promptObjects,
          tasks: activityType === "Task Analysis" ? tasks : [],
        };
        await onAdd(newTarget);
      }

      resetForm();
      onClose();
    } catch (error) {
      console.error("Error saving target:", error);
      toast.error("Failed to save target");
    }
  };

  const resetForm = () => {
    setName("");
    setProgramId("");
    setActivityType("");
    setStatus("Active");
    setGoalDescription("");
    setInstructions("");
    setTrials("1");
    setTasks([]);
    setNewTaskName("");
    setNewTaskSequence("1");
    setSelectedPrompts([]);
  };

  const MultiSelectPrompts = () => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const dropdownRef = useRef(null);

    const filteredOptions = Array.isArray(allPrompts)
      ? allPrompts.filter((option) =>
          option?.prompt_name?.toLowerCase().includes(search.toLowerCase())
        )
      : [];

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target as Node)
        ) {
          setOpen(false);
          setSearch("");
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, []);

    const handleSelect = (promptId: string) => {
      if (selectedPrompts.includes(promptId)) {
        setSelectedPrompts(selectedPrompts.filter((item) => item !== promptId));
      } else {
        setSelectedPrompts([...selectedPrompts, promptId]);
      }
    };

    const handleRemovePrompt = (promptId: string) => {
      setSelectedPrompts(selectedPrompts.filter((id) => id !== promptId));
    };

    const getPromptName = (promptId: string) => {
      const prompt = Array.isArray(allPrompts)
        ? allPrompts.find((p) => p.id === promptId)
        : null;
      return prompt?.prompt_name || promptId;
    };

    return (
      <div ref={dropdownRef} className="relative">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between bg-transparent"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(!open);
            setSearch("");
          }}
        >
          {selectedPrompts.length > 0
            ? `${selectedPrompts.length} selected`
            : "Select Prompts..."}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
        {open && (
          <div className="absolute z-10 w-full p-0 mt-2 border border-slate-200 bg-white rounded-lg shadow-lg">
            <div className="p-2">
              <Input
                placeholder="Search prompts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="p-2 text-sm text-gray-500">
                  {allPrompts?.length === 0
                    ? "No prompts available"
                    : "No results found"}
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <div
                    key={option.id}
                    className="p-2 flex items-center space-x-2 cursor-pointer hover:bg-slate-100 text-sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelect(option.id);
                    }}
                  >
                    <CheckIcon
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedPrompts.includes(option.id)
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {option.prompt_name}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedPrompts.map((promptId) => (
            <Badge
              key={promptId}
              variant="outline"
              className="flex items-center space-x-1 pr-1"
            >
              <span>{getPromptName(promptId)}</span>
              <button
                type="button"
                onClick={() => handleRemovePrompt(promptId)}
                className="p-0.5 rounded-full hover:bg-red-200 hover:text-red-800 transition-colors"
                aria-label={`Remove ${getPromptName(promptId)}`}
              >
                <XIcon className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  const selectedProgram = programs.find((p) => p.id === programId);
  const selectedDomain = domains.find(
    (d) => d.id === selectedProgram?.domainId
  );
  const selectedModule = modules.find((m) => m.id === selectedDomain?.moduleId);

  // Dynamic Title
  const renderTitle = () => {
    if (selectedProgram && selectedDomain && selectedModule) {
      return (
        <div className="flex flex-col items-center text-center">
          <span className="text-lg font-semibold">
            {isEditMode ? "Edit Target" : "Add Target"}
          </span>

          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <span className="font-medium">{selectedModule.name}</span>
            <ChevronRight size={18} className="text-muted-foreground" />

            <span className="font-medium">{selectedDomain.name}</span>
            <ChevronRight size={18} className="text-muted-foreground" />

            <span className="font-medium">{selectedProgram.name}</span>
            <ChevronRight size={18} className="text-muted-foreground" />

            <span className="font-medium">{name || "Target"}</span>

            {activityType === "Task Analysis" && (
              <>
                <ChevronRight size={18} className="text-muted-foreground" />
                <span className="font-medium">Task</span>
              </>
            )}
          </div>
        </div>
      );
    }

    return (
      <span className="text-lg font-semibold">
        {isEditMode ? "Edit Target" : "Add Target"}
      </span>
    );
  };
  const [programSearch, setProgramSearch] = useState("");
  const selectedProgramObj = programs.find((p) => p.id === programId);

  const selectedProgramLabel = selectedProgramObj
    ? (() => {
        const dom = domains.find((d) => d.id === selectedProgramObj.domainId);
        const mod = modules.find((m) => m.id === dom?.moduleId);
        return `${mod?.name || "Module"} - ${dom?.name || "Domain"} - ${
          selectedProgramObj.name
        }`;
      })()
    : "";
  const sortedFilteredPrograms = [...programs]
    .filter((p) => p.id && String(p.id).trim() !== "")
    .sort((a, b) => {
      const domainA = domains.find((d) => d.id === a.domainId);
      const domainB = domains.find((d) => d.id === b.domainId);

      const moduleA =
        modules.find((m) => m.id === domainA?.moduleId)?.name || "";
      const moduleB =
        modules.find((m) => m.id === domainB?.moduleId)?.name || "";

      const moduleCompare = moduleA.localeCompare(moduleB);
      if (moduleCompare !== 0) return moduleCompare;

      const domainCompare = (domainA?.name || "").localeCompare(
        domainB?.name || ""
      );
      if (domainCompare !== 0) return domainCompare;

      return a.name.localeCompare(b.name);
    })
    .filter((p) => {
      const dom = domains.find((d) => d.id === p.domainId);
      const mod = modules.find((m) => m.id === dom?.moduleId);
      const label = `${mod?.name || ""} - ${dom?.name || ""} - ${p.name}`;
      return label.toLowerCase().includes(programSearch.toLowerCase());
    });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md lg:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-col items-center text-center capitalize">
            {renderTitle()}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-2 gap-4">
          {/* Select Program */}
          <div className="space-y-2">
            <Label htmlFor="program-select">Select Program</Label>

            <Select
              value={programId}
              onValueChange={(value) => {
                setProgramId(value);
                setProgramSearch(""); // reset search when selecting
              }}
              disabled={loading}
            >
              <SelectTrigger id="program-select">
                <SelectValue placeholder="Choose a program">
                  {selectedProgramLabel}
                </SelectValue>
              </SelectTrigger>

              <SelectContent>
                {/* 🔍 Search Input */}
                <div className="px-2 py-2 sticky top-0 bg-white z-10">
                  <Input
                    placeholder="Search programs..."
                    value={programSearch}
                    onChange={(e) => setProgramSearch(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()} // IMPORTANT FIX
                    className="h-8"
                  />
                </div>

                {/* List */}
                {sortedFilteredPrograms.length > 0 ? (
                  sortedFilteredPrograms.map((program) => {
                    const dom = domains.find((d) => d.id === program.domainId);
                    const mod = modules.find((m) => m.id === dom?.moduleId);

                    return (
                      <SelectItem key={program.id} value={program.id}>
                        {mod?.name} - {dom?.name} - {program.name}
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
          <div className="">
            <Label htmlFor="target-type">Activity Type</Label>
            <Select
              value={activityType}
              onValueChange={setActivityType}
              disabled={loading}
            >
              <SelectTrigger id="target-type">
                <SelectValue placeholder="Select type" />
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
            <Label htmlFor="target-name">Target Name</Label>
            <Input
              id="target-name"
              placeholder="Enter target name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal-description">Goal Description</Label>
            <Textarea
              id="goal-description"
              placeholder="Enter goal description"
              value={goalDescription}
              onChange={(e) => setGoalDescription(e.target.value)}
              disabled={loading}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea
              id="instructions"
              placeholder="Enter instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              disabled={loading}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="trials">Number of Trials (Enter 1-100)</Label>
            <Input
              id="trials"
              type="number"
              min="1"
              max="100"
              value={trials}
              onChange={(e) => setTrials(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>Select Prompts</Label>
            <MultiSelectPrompts />
          </div>

          {activityType === "Task Analysis" && (
            <Card className="bg-slate-50 border-teal-200">
              <CardHeader>
                <CardTitle className="text-base">Task Steps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Task step text"
                      value={newTaskName}
                      onChange={(e) => setNewTaskName(e.target.value)}
                      disabled={loading}
                    />
                    <Input
                      type="number"
                      min="1"
                      placeholder="Sequence"
                      value={newTaskSequence}
                      onChange={(e) => setNewTaskSequence(e.target.value)}
                      className="w-20"
                      disabled={loading}
                    />
                    <Button
                      type="button"
                      onClick={handleAddTask}
                      disabled={loading}
                      size="sm"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {tasks.length > 0 && (
                  <div className="space-y-2">
                    {tasks
                      .sort((a, b) => a.sequence - b.sequence)
                      .map((task) => (
                        <div
                          key={task.id}
                          className="flex justify-between items-center p-2 rounded bg-white border border-slate-200"
                        >
                          <span className="font-medium text-sm">
                            {task.sequence}. {task.name}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTask(task.id)}
                            disabled={loading}
                            className="text-red-500 hover:text-red-700 h-6 w-6 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus} disabled={loading}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Buttons */}
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
