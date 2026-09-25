"use client";

import type React from "react";
import { useState, useEffect } from "react";
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
  ChevronRight,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  DEFAULT_DOMAIN_MODULE_KEY,
  getDomainModuleLabel,
  mergeCanonicalDomainModules,
} from "@/lib/domain-module-options";
import {
  filterMasterDataForClientScope,
  findClientByValue,
  isArchivedEntity,
  resolveClientRecordId,
} from "@/lib/master-data-client-scope";
import {
  formatTargetInstructions,
  normalizeTaskStepsForApi,
  parseTargetInstructions,
  TARGET_STATUS_OPTIONS,
  MASTERY_TYPE_OPTIONS,
  DEFAULT_TARGET_META,
  todayLocalYmd,
} from "@/lib/target-instructions-format";
import PromptMultiSelect from "@/components/master-data/prompt-multi-select";
import { mahaverseFetch } from "@/lib/mahaverse-api";

interface AddTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (target: any) => Promise<void | boolean>;
  onEdit: (target: any) => Promise<void | boolean>;
  programs?: any[];
  domains?: any[];
  modules?: any[];
  clients?: any[];
  allPrompts?: any[];
  loading?: boolean;
  editingTarget?: any | null;
  /** When set, locks the form to this client (Configure data → client Targets). */
  lockedClientId?: string;
  lockedClientName?: string;
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

const EMPTY_CLIENTS: any[] = [];
const EMPTY_PROGRAMS: any[] = [];
const EMPTY_DOMAINS: any[] = [];
const EMPTY_MODULES: any[] = [];
const EMPTY_PROMPTS: any[] = [];

export default function AddTargetModal({
  isOpen,
  onClose,
  onAdd,
  onEdit,
  programs = EMPTY_PROGRAMS,
  domains = EMPTY_DOMAINS,
  modules = EMPTY_MODULES,
  clients = EMPTY_CLIENTS,
  allPrompts = EMPTY_PROMPTS,
  loading = false,
  editingTarget = null,
  lockedClientId = "",
  lockedClientName = "",
}: AddTargetModalProps) {
  const isEditing = !!editingTarget;
  const isClientLocked = Boolean(lockedClientId);

  const [name, setName] = useState("");
  const [programId, setProgramId] = useState("");
  const [activityType, setActivityType] = useState("");
  const [status, setStatus] = useState("Active");
  const [selectedClientValue, setSelectedClientValue] = useState("generic");

  const [goalDescription, setGoalDescription] = useState("");
  const [sd, setSd] = useState("");
  const [generalizationPlan, setGeneralizationPlan] = useState("");
  const [instructions, setInstructions] = useState("");
  const [trials, setTrials] = useState("1");
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([]);
  const [masteryType, setMasteryType] = useState(DEFAULT_TARGET_META.mastery_type);
  const [targetStatus, setTargetStatus] = useState(DEFAULT_TARGET_META.target_status);
  const [dateOpened, setDateOpened] = useState("");
  const [dateMastered, setDateMastered] = useState("");
  const [dateClosed, setDateClosed] = useState("");
  const [metBaseline, setMetBaseline] = useState("");
  const [overrideResponseCriteria, setOverrideResponseCriteria] = useState(
    DEFAULT_TARGET_META.override_response_criteria
  );
  const [overrideConsecutiveDays, setOverrideConsecutiveDays] = useState(
    DEFAULT_TARGET_META.override_consecutive_days
  );
  const [overrideFirstTrialIndependent, setOverrideFirstTrialIndependent] =
    useState(DEFAULT_TARGET_META.override_first_trial_independent);
  const [maintenanceLevel, setMaintenanceLevel] = useState("");
  const [maintenancePeriods, setMaintenancePeriods] = useState<
    { id: string; name: string }[]
  >([]);

  const [tasks, setTasks] = useState<
    { id: string; name: string; sequence: number }[]
  >([]);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskSequence, setNewTaskSequence] = useState("1");
  const [programSearch, setProgramSearch] = useState("");

  function resetForm() {
    setName("");
    setProgramId("");
    setActivityType("");
    setStatus("Active");
    setGoalDescription("");
    setSd("");
    setGeneralizationPlan("");
    setInstructions("");
    setTrials("1");
    setTasks([]);
    setNewTaskName("");
    setNewTaskSequence("1");
    setSelectedPrompts([]);
    setSelectedClientValue(isClientLocked ? String(lockedClientId) : "generic");
    setProgramSearch("");
    setMasteryType(DEFAULT_TARGET_META.mastery_type);
    setTargetStatus(DEFAULT_TARGET_META.target_status);
    setDateOpened(todayLocalYmd());
    setDateMastered("");
    setDateClosed("");
    setMetBaseline("");
    setOverrideResponseCriteria(DEFAULT_TARGET_META.override_response_criteria);
    setOverrideConsecutiveDays(DEFAULT_TARGET_META.override_consecutive_days);
    setOverrideFirstTrialIndependent(
      DEFAULT_TARGET_META.override_first_trial_independent
    );
    setMaintenanceLevel("");
  }

  const selectedClientObj = isClientLocked
    ? findClientByValue(clients, lockedClientId) || {
        id: lockedClientId,
        client_id: lockedClientId,
        first_name: lockedClientName || "",
        last_name: "",
        name: lockedClientName || "",
      }
    : findClientByValue(clients, selectedClientValue);

  const selectedClientId = isClientLocked
    ? String(lockedClientId).trim()
    : selectedClientValue === "generic"
      ? ""
      : resolveClientRecordId(selectedClientObj) || String(selectedClientValue).trim();

  const modulesForLookup = mergeCanonicalDomainModules(modules);

  const filterClientScopedRows = (items: any[], keepId = "") =>
    (items || []).filter((item) => {
      if (item?.id == null || String(item.id).trim() === "") return false;
      if (isArchivedEntity(item) && String(item.id) !== String(keepId ?? "")) {
        return false;
      }
      return true;
    });

  // Client Configure data already passes this client's rows (often without client_id).
  const domainsForClient = isClientLocked
    ? filterClientScopedRows(domains)
    : filterMasterDataForClientScope(domains, {
        clientId: selectedClientId,
        isGeneric: selectedClientValue === "generic",
        keepId: "",
      });

  const programsForClient = isClientLocked
    ? filterClientScopedRows(programs, programId)
    : filterMasterDataForClientScope(programs, {
        clientId: selectedClientId,
        isGeneric: selectedClientValue === "generic",
        keepId: programId,
      });

  const isTaskAnalysisType = activityType === "Task Analysis";
  const isDttOrTa =
    activityType === "Task Analysis" ||
    activityType === "Discrete Trial Training";

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await mahaverseFetch("/maintenance-periods.php?activeOnly=true");
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (data?.success && Array.isArray(data.data)) {
          setMaintenancePeriods(
            data.data.map((row: any) => ({
              id: String(row.id),
              name: String(row.name || row.period_name || ""),
            }))
          );
        }
      } catch {
        if (!cancelled) setMaintenancePeriods([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Pre-fill fields when editing / reset when opening for create
  useEffect(() => {
    if (!isOpen) return;

    if (isEditing && editingTarget) {
      setName(editingTarget.name || "");
      setProgramId(editingTarget.programId || editingTarget.program_id || "");
      setActivityType(editingTarget.activityType || editingTarget.activity_type || "");
      setStatus(editingTarget.status || "Active");
      setGoalDescription(
        editingTarget.goalDescription ||
          editingTarget.goal_description ||
          editingTarget.description ||
          ""
      );
      const parsed = parseTargetInstructions(editingTarget.instructions || "");
      setSd(parsed.sd);
      setGeneralizationPlan(parsed.generalizationPlan || "");
      setInstructions(parsed.instructions);
      const meta = parsed.meta || DEFAULT_TARGET_META;
      setMasteryType(meta.mastery_type || DEFAULT_TARGET_META.mastery_type);
      setTargetStatus(meta.target_status || DEFAULT_TARGET_META.target_status);
      setDateOpened(meta.date_opened || "");
      setDateMastered(meta.date_mastered || "");
      setDateClosed(meta.date_closed || "");
      setMetBaseline(meta.met_baseline || "");
      setOverrideResponseCriteria(
        meta.override_response_criteria || DEFAULT_TARGET_META.override_response_criteria
      );
      setOverrideConsecutiveDays(
        meta.override_consecutive_days || DEFAULT_TARGET_META.override_consecutive_days
      );
      setOverrideFirstTrialIndependent(
        meta.override_first_trial_independent ||
          DEFAULT_TARGET_META.override_first_trial_independent
      );
      setMaintenanceLevel(meta.maintenance_level || "");
      setTrials(String(editingTarget.trials || 1));

      // Set prompts - extract IDs from prompt objects
      const promptIds =
        editingTarget.prompts?.map((p) =>
          String(typeof p === "string" || typeof p === "number" ? p : p.id)
        ) || [];
      setSelectedPrompts(promptIds);

      // Set tasks
      const taskList =
        editingTarget.tasks?.map((t) => ({
          id: t.id || generateId(),
          name: t.name,
          sequence: t.step_order || t.sequence || 1,
        })) || [];
      setTasks(taskList);

      setSelectedClientValue(
        editingTarget.client_id
          ? String(editingTarget.client_id)
          : isClientLocked
            ? String(lockedClientId)
            : "generic"
      );
    } else {
      resetForm();
      if (isClientLocked) {
        setSelectedClientValue(String(lockedClientId));
      } else {
        // Check for pending client from client view navigation
        const pendingClient = localStorage.getItem("pendingClientForMasterData");
        if (pendingClient) {
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when modal opens / edit target changes
  }, [isOpen, editingTarget, isEditing, isClientLocked, lockedClientId]);

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

    const targetMeta = {
      mastery_type: masteryType,
      target_status: targetStatus,
      date_opened: dateOpened,
      date_mastered: dateMastered,
      date_closed: dateClosed,
      met_baseline: metBaseline,
      override_response_criteria: overrideResponseCriteria,
      override_consecutive_days: overrideConsecutiveDays,
      override_first_trial_independent: overrideFirstTrialIndependent,
      maintenance_level: maintenanceLevel,
    };

    const storedInstructions = formatTargetInstructions(
      sd,
      instructions,
      generalizationPlan,
      targetMeta
    );

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
          : null;
      })
      .filter(Boolean);

    try {
      const clientPayload =
        isClientLocked || selectedClientValue !== "generic"
          ? {
              client_id:
                (isClientLocked
                  ? lockedClientId
                  : resolveClientRecordId(selectedClientObj) || selectedClientValue) ||
                undefined,
            }
          : {};

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
          ...clientPayload,
        };
        const result = await onEdit(updatedTarget);
        if (result === false) return;
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
          ...clientPayload,
        };
        const result = await onAdd(newTarget);
        if (result === false) return;
      }

      resetForm();
      onClose();
    } catch (error) {
      console.error("Error saving target:", error);
      toast.error("Failed to save target");
    }
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
        selectedDomain.moduleId ||
          selectedDomain.module_id ||
          selectedDomain.MODULE_ID ||
          DEFAULT_DOMAIN_MODULE_KEY
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
          domain.moduleId ||
            domain.module_id ||
            domain.MODULE_ID ||
            DEFAULT_DOMAIN_MODULE_KEY
        )
      : "—";
    const domName = domain ? getDomainName(domain) : "Domain";
    const progName = getProgramName(program);
    const modulePart =
      modName && modName !== "—" ? modName : domain ? "Skill Acquisition" : "Module";
    return `${modulePart} - ${domName || "Domain"} - ${progName}`;
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
            {isClientLocked ? (
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-md text-sm">
                <div className="font-medium text-teal-900">
                  {lockedClientName ||
                    `${selectedClientObj?.first_name || ""} ${selectedClientObj?.last_name || ""}`.trim() ||
                    "This client"}
                </div>
                <p className="text-xs text-teal-700 mt-1">
                  Target will be saved for this client.
                </p>
              </div>
            ) : (
              <>
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
                  </div>
                )}
              </>
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

          <div className="space-y-2">
            <Label htmlFor="target-sd">
              SD (Discriminative Stimulus){isTaskAnalysisType ? " *" : ""}
            </Label>
            <Input
              id="target-sd"
              placeholder='e.g. Lets go potty'
              value={sd}
              onChange={(e) => setSd(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="generalization-plan">Generalization Plan</Label>
            <Textarea
              id="generalization-plan"
              placeholder="Describe how this skill will be generalized across people, settings, and materials"
              value={generalizationPlan}
              onChange={(e) => setGeneralizationPlan(e.target.value)}
              disabled={loading}
              rows={2}
            />
          </div>

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Mastery Type</Label>
              <Select value={masteryType} onValueChange={setMasteryType} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder="Mastery Type" />
                </SelectTrigger>
                <SelectContent>
                  {MASTERY_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target Status</Label>
              <Select
                value={targetStatus}
                onValueChange={setTargetStatus}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Target Status" />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="border-slate-200">
            <CardHeader className="py-3">
              <CardTitle className="text-base">Advanced Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="date-opened">Date Opened</Label>
                <Input
                  id="date-opened"
                  type="date"
                  value={dateOpened}
                  onChange={(e) => setDateOpened(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date-mastered">Date Mastered</Label>
                <Input
                  id="date-mastered"
                  type="date"
                  value={dateMastered}
                  onChange={(e) => setDateMastered(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date-closed">Date Closed</Label>
                <Input
                  id="date-closed"
                  type="date"
                  value={dateClosed}
                  onChange={(e) => setDateClosed(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="met-baseline">Met Baseline</Label>
                <Input
                  id="met-baseline"
                  type="date"
                  value={metBaseline}
                  onChange={(e) => setMetBaseline(e.target.value)}
                  disabled={loading}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="py-3">
              <CardTitle className="text-base">Override Mastery Criterion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="response-criteria">Response Criteria</Label>
                  <Input
                    id="response-criteria"
                    type="number"
                    min="0"
                    max="100"
                    value={overrideResponseCriteria}
                    onChange={(e) => setOverrideResponseCriteria(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="consecutive-days">Consecutive Days</Label>
                  <Input
                    id="consecutive-days"
                    type="number"
                    min="1"
                    value={overrideConsecutiveDays}
                    onChange={(e) => setOverrideConsecutiveDays(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>First Trial Must Be Independent</Label>
                <Select
                  value={overrideFirstTrialIndependent}
                  onValueChange={setOverrideFirstTrialIndependent}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
                {!isDttOrTa && (
                  <p className="text-xs text-red-600">
                    This field is applicable only for DTT or TA.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="py-3">
              <CardTitle className="text-base">Maintenance Level</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Maintenance Level</Label>
                <Select
                  value={maintenanceLevel || "__none__"}
                  onValueChange={(v) =>
                    setMaintenanceLevel(v === "__none__" ? "" : v)
                  }
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Maintenance Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {maintenancePeriods.map((p) => (
                      <SelectItem key={p.id} value={p.name}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

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
              <PromptMultiSelect
                allPrompts={allPrompts}
                selectedIds={selectedPrompts}
                onChange={setSelectedPrompts}
                disabled={loading}
              />
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
