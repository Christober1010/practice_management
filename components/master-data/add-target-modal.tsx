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
  programs?: any[];
  domains?: any[];
  modules?: any[];
  clients?: any[];
  allPrompts?: any[];
  loading?: boolean;
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
  programs = [],
  domains = [],
  modules = [],
  clients = [],
  allPrompts = [],
  loading = false,
  editingTarget = null,
}: AddTargetModalProps) {
  const isEditing = !!editingTarget;

  const [name, setName] = useState("");
  const [programId, setProgramId] = useState("");
  const [activityType, setActivityType] = useState("");
  const [status, setStatus] = useState("Active");
  const [selectedClientValue, setSelectedClientValue] = useState("generic");

  const [goalDescription, setGoalDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [trials, setTrials] = useState("1");
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([]);

  const [tasks, setTasks] = useState<
    { id: string; name: string; sequence: number }[]
  >([]);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskSequence, setNewTaskSequence] = useState("1");
  const [programSearch, setProgramSearch] = useState("");

  // Find selected client
  const selectedClientObj =
    selectedClientValue === "generic"
      ? null
      : clients.find((c) => String(c.id) === String(selectedClientValue)) || null;

  // Pre-fill fields when editing
  useEffect(() => {
    if (isEditing && editingTarget) {
      setName(editingTarget.name || "");
      setProgramId(editingTarget.programId || editingTarget.program_id || "");
      setActivityType(editingTarget.activityType || editingTarget.activity_type || "");
      setStatus(editingTarget.status || "Active");
      setGoalDescription(editingTarget.goalDescription || editingTarget.goal_description || "");
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

      setSelectedClientValue(editingTarget.client_id ? String(editingTarget.client_id) : "generic");
    } else {
      resetForm();
      
      // Check for pending client from client view navigation
      const pendingClient = localStorage.getItem("pendingClientForMasterData");
      if (pendingClient && isOpen) {
        try {
          const clientInfo = JSON.parse(pendingClient);
          // Try to find client by ID first, then by name
          const foundClient = clients.find(
            (c) => String(c.id) === String(clientInfo.id) || c.name === clientInfo.name
          );
          if (foundClient) {
            setSelectedClientValue(String(foundClient.id ?? foundClient.name));
          } else if (clientInfo.id) {
            setSelectedClientValue(String(clientInfo.id));
          } else if (clientInfo.name) {
            setSelectedClientValue(clientInfo.name);
          } else {
            setSelectedClientValue("generic");
          }
        } catch (err) {
          console.error("Error parsing pending client info:", err);
          setSelectedClientValue("generic");
        }
      }
    }
  }, [editingTarget, isEditing, isOpen, clients]);

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
      if (isEditing) {
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
          ...(selectedClientValue !== "generic"
            ? { client_id: selectedClientObj?.id || selectedClientValue }
            : {}),
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
          ...(selectedClientValue !== "generic"
            ? { client_id: selectedClientObj?.id || selectedClientValue }
            : {}),
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
    setSelectedClientValue("generic");
    setProgramSearch("");
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

  // Safe way to get names
  const getModuleName = (mod) => {
    return mod?.name || mod?.NAME || "Unnamed Module";
  };

  const getDomainName = (dom) => {
    return dom?.name || dom?.NAME || "Unnamed Domain";
  };

  const getProgramName = (prog) => {
    return prog?.name || prog?.NAME || "Unnamed Program";
  };

  const selectedProgram = programs.find((p) => String(p.id) === String(programId));
  const selectedDomain = domains.find(
    (d) => String(d.id) === String(selectedProgram?.domainId || selectedProgram?.domain_id)
  );
  const selectedModule = modules.find((m) => String(m.id) === String(selectedDomain?.moduleId || selectedDomain?.module_id));

  const selectedDomainName = selectedDomain ? getDomainName(selectedDomain) : "";
  const selectedModuleName = selectedModule ? getModuleName(selectedModule) : "";
  const selectedProgramName = selectedProgram ? getProgramName(selectedProgram) : "";

  // SAFE filtering + sorting
  const filteredPrograms = programs
    .filter((p) => p.id != null && String(p.id).trim() !== "")
    .filter((p) => {
      const search = programSearch.toLowerCase();
      const domain = domains.find((d) => String(d.id) === String(p.domainId || p.domain_id));
      const module = modules.find((m) => String(m.id) === String(domain?.moduleId || domain?.module_id));
      const moduleName = module ? getModuleName(module).toLowerCase() : "";
      const domainName = domain ? getDomainName(domain).toLowerCase() : "";
      const programName = getProgramName(p).toLowerCase();
      const label = `${moduleName} - ${domainName} - ${programName}`;
      return label.includes(search);
    })
    .sort((a, b) => {
      const domainA = domains.find((d) => String(d.id) === String(a.domainId || a.domain_id));
      const domainB = domains.find((d) => String(d.id) === String(b.domainId || b.domain_id));
      const moduleA = modules.find((m) => String(m.id) === String(domainA?.moduleId || domainA?.module_id));
      const moduleB = modules.find((m) => String(m.id) === String(domainB?.moduleId || domainB?.module_id));

      const moduleCompare = getModuleName(moduleA).localeCompare(getModuleName(moduleB));
      if (moduleCompare !== 0) return moduleCompare;

      const domainCompare = getDomainName(domainA).localeCompare(getDomainName(domainB));
      if (domainCompare !== 0) return domainCompare;

      return getProgramName(a).localeCompare(getProgramName(b));
    });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md lg:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center">
            <div className="text-lg font-semibold">
              {isEditing ? "Edit Target" : "Add New Target"}
            </div>
            {selectedModule && selectedDomain && selectedProgram && (
              <div className="flex items-center justify-center gap-2 mt-3 text-sm text-muted-foreground">
                <span className="font-medium">{selectedModuleName}</span>
                <ChevronRight className="h-4 w-4" />
                <span className="font-medium">{selectedDomainName}</span>
                <ChevronRight className="h-4 w-4" />
                <span className="font-medium">{selectedProgramName}</span>
                {name && (
                  <>
                    <ChevronRight className="h-4 w-4" />
                    <span className="font-medium text-teal-600 truncate max-w-[200px]">
                      {name}
                    </span>
                  </>
                )}
              </div>
            )}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Client Selector */}
          <div className="space-y-2">
            <Label>Assign to Client</Label>
            <Select
              value={selectedClientValue === "generic" ? "generic" : selectedClientValue}
              onValueChange={(val) => setSelectedClientValue(val === "generic" ? "generic" : val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Generic (no client)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="generic">Generic (no client)</SelectItem>
                {clients
                  .filter((client) => client.id != null && String(client.id).trim() !== "")
                  .map((client) => {
                    const displayName =
                      `${client.first_name || ""} ${client.last_name || ""}`.trim() ||
                      client.name ||
                      "Unnamed Client";
                    return (
                      <SelectItem key={client.id} value={String(client.id)}>
                        {displayName}
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>

            {selectedClientObj && (
              <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-md text-sm">
                <div className="font-medium text-purple-900">
                  {selectedClientObj.first_name || ""} {selectedClientObj.last_name || ""}
                </div>
                {selectedClientObj.email && (
                  <div className="text-purple-700">Email: {selectedClientObj.email}</div>
                )}
              </div>
            )}
          </div>

          {/* Select Program */}
          <div className="space-y-2">
            <Label>Program *</Label>
            <Select
              value={programId}
              onValueChange={(value) => {
                setProgramId(value);
                setProgramSearch("");
              }}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a program">
                  {selectedModuleName && selectedDomainName && selectedProgramName
                    ? `${selectedModuleName} - ${selectedDomainName} - ${selectedProgramName}`
                    : "Select a program"}
                </SelectValue>
              </SelectTrigger>

              <SelectContent>
                <div className="p-2 sticky top-0 bg-white border-b z-10">
                  <Input
                    placeholder="Search programs..."
                    value={programSearch}
                    onChange={(e) => setProgramSearch(e.target.value)}
                    className="h-8"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {filteredPrograms.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No programs found
                  </div>
                ) : (
                  filteredPrograms.map((program) => {
                    const dom = domains.find((d) => String(d.id) === String(program.domainId || program.domain_id));
                    const mod = modules.find((m) => String(m.id) === String(dom?.moduleId || dom?.module_id));
                    const modName = mod ? getModuleName(mod) : "";
                    const domName = dom ? getDomainName(dom) : "";
                    const progName = getProgramName(program);
                    const label = `${modName} - ${domName} - ${progName}`;

                    return (
                      <SelectItem key={program.id} value={String(program.id)}>
                        {label}
                      </SelectItem>
                    );
                  })
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

          {/* Status on edit */}
          {isEditing && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-teal-600 hover:bg-teal-700">
              {loading ? "Saving..." : isEditing ? "Update Target" : "Add Target"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
