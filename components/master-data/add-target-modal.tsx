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
import {
  getDomainModuleLabel,
  mergeCanonicalDomainModules,
} from "@/lib/domain-module-options";
import {
  filterMasterDataForClientScope,
  findClientByValue,
  resolveClientRecordId,
} from "@/lib/master-data-client-scope";
import {
  formatTargetInstructions,
  normalizeTaskStepsForApi,
  parseTargetInstructions,
} from "@/lib/target-instructions-format";

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
  const [sd, setSd] = useState("");
  const [instructions, setInstructions] = useState("");
  const [trials, setTrials] = useState("1");
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([]);

  const [tasks, setTasks] = useState<
    { id: string; name: string; sequence: number }[]
  >([]);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskSequence, setNewTaskSequence] = useState("1");
  const [programSearch, setProgramSearch] = useState("");

  const selectedClientObj = findClientByValue(clients, selectedClientValue);

  const selectedClientId =
    selectedClientValue === "generic"
      ? ""
      : resolveClientRecordId(selectedClientObj) || String(selectedClientValue).trim();

  const modulesForLookup = mergeCanonicalDomainModules(modules);

  const domainsForClient = filterMasterDataForClientScope(domains, {
    clientId: selectedClientId,
    isGeneric: selectedClientValue === "generic",
    keepId: "",
  });

  const programsForClient = filterMasterDataForClientScope(programs, {
    clientId: selectedClientId,
    isGeneric: selectedClientValue === "generic",
    keepId: programId,
  });

  const isTaskAnalysisType = activityType === "Task Analysis";

  // Pre-fill fields when editing
  useEffect(() => {
    if (isEditing && editingTarget) {
      setName(editingTarget.name || "");
      setProgramId(editingTarget.programId || editingTarget.program_id || "");
      setActivityType(editingTarget.activityType || editingTarget.activity_type || "");
      setStatus(editingTarget.status || "Active");
      setGoalDescription(editingTarget.goalDescription || editingTarget.goal_description || "");
      const parsed = parseTargetInstructions(editingTarget.instructions || "");
      setSd(parsed.sd);
      setInstructions(parsed.instructions);
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
            setSelectedClientValue(
              resolveClientRecordId(foundClient) || String(foundClient.id ?? foundClient.name)
            );
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

  useEffect(() => {
    if (!programId) return;
    const stillValid = programsForClient.some((p) => String(p.id) === String(programId));
    if (!stillValid) setProgramId("");
  }, [selectedClientValue, selectedClientId, programs, programId]);

  const handleAddTask = () => {
    if (!newTaskName.trim()) {
      toast.error("Task name is required");
      return;
    }
    const nextOrder =
      tasks.length > 0
        ? Math.max(...tasks.map((t) => t.sequence || 0), 0) + 1
        : Number.parseInt(newTaskSequence, 10) || 1;
    const newTask = {
      id: generateId(),
      name: newTaskName.trim(),
      sequence: Number.parseInt(newTaskSequence, 10) || nextOrder,
    };
    setTasks([...tasks, newTask]);
    setNewTaskName("");
    setNewTaskSequence(String(newTask.sequence + 1));
  };

  const handleUpdateTaskSequence = (taskId: string, sequence: number) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, sequence: Number.isFinite(sequence) && sequence > 0 ? sequence : 1 } : t
      )
    );
  };

  const handleUpdateTaskName = (taskId: string, name: string) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, name } : t)));
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
      toast.error(
        isTaskAnalysisType
          ? "Goal name and target instructions are required"
          : "Goal description and instructions are required"
      );
      return;
    }

    if (isTaskAnalysisType && !sd.trim()) {
      toast.error("SD (discriminative stimulus) is required for Task Analysis");
      return;
    }

    const storedInstructions = isTaskAnalysisType
      ? formatTargetInstructions(sd, instructions)
      : instructions.trim();

    if (Number.parseInt(trials) < 1 || Number.parseInt(trials) > 100) {
      toast.error("Number of Trials must be between 1 and 100");
      return;
    }

    if (activityType === "Task Analysis" && tasks.length === 0) {
      toast.error("Task Analysis requires at least one task step");
      return;
    }

    const taskPayload =
      activityType === "Task Analysis" ? normalizeTaskStepsForApi(tasks) : [];

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
          instructions: storedInstructions,
          trials: Number.parseInt(trials) || 1,
          prompts: promptObjects,
          tasks: taskPayload,
          ...(selectedClientValue !== "generic"
            ? {
                client_id:
                  resolveClientRecordId(selectedClientObj) || selectedClientValue,
              }
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
          instructions: storedInstructions,
          trials: Number.parseInt(trials) || 1,
          prompts: promptObjects,
          tasks: taskPayload,
          ...(selectedClientValue !== "generic"
            ? {
                client_id:
                  resolveClientRecordId(selectedClientObj) || selectedClientValue,
              }
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
    setSd("");
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

  const getDomainName = (dom) => {
    return dom?.name || dom?.NAME || "Unnamed Domain";
  };

  const getProgramName = (prog) => {
    return prog?.name || prog?.NAME || "Unnamed Program";
  };

  const selectedProgram = programsForClient.find(
    (p) => String(p.id) === String(programId)
  );
  const selectedDomain = domainsForClient.find(
    (d) => String(d.id) === String(selectedProgram?.domainId || selectedProgram?.domain_id)
  );

  const selectedDomainName = selectedDomain ? getDomainName(selectedDomain) : "";
  const selectedModuleName = selectedDomain
    ? getDomainModuleLabel(
        modulesForLookup,
        selectedDomain.moduleId || selectedDomain.module_id
      )
    : "";
  const selectedProgramName = selectedProgram ? getProgramName(selectedProgram) : "";

  const programLabel = (program) => {
    const domain = domainsForClient.find(
      (d) => String(d.id) === String(program.domainId || program.domain_id)
    );
    const modName = domain
      ? getDomainModuleLabel(
          modulesForLookup,
          domain.moduleId || domain.module_id
        )
      : "—";
    const domName = domain ? getDomainName(domain) : "";
    const progName = getProgramName(program);
    return `${modName !== "—" ? modName : "—"} - ${domName} - ${progName}`;
  };

  // SAFE filtering + sorting (scoped to client or generic)
  const filteredPrograms = programsForClient
    .filter((p) => {
      const search = programSearch.toLowerCase();
      return programLabel(p).toLowerCase().includes(search);
    })
    .sort((a, b) => programLabel(a).localeCompare(programLabel(b)));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md lg:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center">
            <div className="text-lg font-semibold">
              {isEditing ? "Edit Target" : "Add New Target"}
            </div>
            {selectedDomain && selectedProgram && (
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
              onValueChange={(val) => {
                setSelectedClientValue(val === "generic" ? "generic" : val);
                setProgramSearch("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Generic (no client)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="generic">Generic (no client)</SelectItem>
                {clients
                  .map((client) => {
                    const cid = resolveClientRecordId(client);
                    if (!cid) return null;
                    const displayName =
                      `${client.first_name || ""} ${client.last_name || ""}`.trim() ||
                      client.name ||
                      client.NAME ||
                      "Unnamed Client";
                    return (
                      <SelectItem key={cid} value={cid}>
                        {displayName}
                      </SelectItem>
                    );
                  })
                  .filter(Boolean)}
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
            {selectedClientId ? (
              <p className="text-xs text-slate-500">
                Showing programs for this client only.
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Showing generic (master) programs only.
              </p>
            )}
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
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    {selectedClientId
                      ? "No programs for this client. Add a program with this client selected."
                      : "No generic programs found. Add a master program or assign a client."}
                  </div>
                ) : (
                  filteredPrograms.map((program) => (
                    <SelectItem key={program.id} value={String(program.id)}>
                      {programLabel(program)}
                    </SelectItem>
                  ))
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
            <Label htmlFor="goal-description">
              {isTaskAnalysisType ? "Goal Name *" : "Goal Description *"}
            </Label>
            <Textarea
              id="goal-description"
              placeholder={
                isTaskAnalysisType
                  ? "e.g. Learner will follow a visual task analysis to complete…"
                  : "Enter goal description"
              }
              value={goalDescription}
              onChange={(e) => setGoalDescription(e.target.value)}
              disabled={loading}
              rows={2}
            />
          </div>

          {isTaskAnalysisType && (
            <div className="space-y-2">
              <Label htmlFor="target-sd">SD (Discriminative Stimulus) *</Label>
              <Input
                id="target-sd"
                placeholder='e.g. Lets go potty'
                value={sd}
                onChange={(e) => setSd(e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="instructions">
              {isTaskAnalysisType ? "Target Instructions *" : "Instructions *"}
            </Label>
            <Textarea
              id="instructions"
              placeholder={
                isTaskAnalysisType
                  ? "1. Present SD\n2. Follow steps in task analysis\n3. Provide prompting as needed"
                  : "Enter instructions"
              }
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              disabled={loading}
              rows={isTaskAnalysisType ? 4 : 2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="trials">
              {isTaskAnalysisType ? "Desired Daily Trials *" : "Number of Trials (Enter 1-100)"}
            </Label>
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

          {!isTaskAnalysisType && (
            <div className="space-y-2">
              <Label>Select Prompts</Label>
              <MultiSelectPrompts />
            </div>
          )}

          {isTaskAnalysisType && (
            <Card className="bg-slate-50 border-teal-200">
              <CardHeader>
                <CardTitle className="text-base">Task Analysis Steps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Task name"
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    disabled={loading}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min="1"
                    placeholder="Order"
                    value={newTaskSequence}
                    onChange={(e) => setNewTaskSequence(e.target.value)}
                    className="w-24"
                    disabled={loading}
                  />
                  <Button
                    type="button"
                    onClick={handleAddTask}
                    disabled={loading}
                    size="sm"
                    className="shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {tasks.length > 0 ? (
                  <div className="rounded-md border border-slate-200 overflow-hidden">
                    <div className="grid grid-cols-[1fr_88px_40px] gap-2 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                      <span>Task Name</span>
                      <span>Display Order</span>
                      <span />
                    </div>
                    {[...tasks]
                      .sort((a, b) => a.sequence - b.sequence)
                      .map((task) => (
                        <div
                          key={task.id}
                          className="grid grid-cols-[1fr_88px_40px] gap-2 items-center px-3 py-2 border-t border-slate-200 bg-white"
                        >
                          <Input
                            value={task.name}
                            onChange={(e) => handleUpdateTaskName(task.id, e.target.value)}
                            disabled={loading}
                            className="h-8"
                          />
                          <Input
                            type="number"
                            min="1"
                            value={task.sequence}
                            onChange={(e) =>
                              handleUpdateTaskSequence(
                                task.id,
                                Number.parseInt(e.target.value, 10) || 1
                              )
                            }
                            disabled={loading}
                            className="h-8"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTask(task.id)}
                            disabled={loading}
                            className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">
                    Add at least one task step for this target.
                  </p>
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
