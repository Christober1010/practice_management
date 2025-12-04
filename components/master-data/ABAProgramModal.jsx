"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  Layers,
  Target,
  Zap,
  Plus,
  Trash2,
  ChevronDown,
  CheckIcon,
  XIcon,
} from "lucide-react";
import { BreadcrumbDisplay } from "./breadcrumb-display";
import { cn } from "@/lib/utils";

const activityTypes = ["DTT", "Task Analysis", "Frequency", "Duration"];
const statusOptions = ["Active", "Inactive"];

function generateId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function ABAProgramModal({
  isOpen,
  onClose,
  onSave,
  existingData = null,
}) {
  const [activeTab, setActiveTab] = useState("modules");

  const [editingModuleId, setEditingModuleId] = useState(null);
  const [editingDomainId, setEditingDomainId] = useState(null);
  const [editingProgramId, setEditingProgramId] = useState(null);
  const [editingActivityId, setEditingActivityId] = useState(null);

  const [moduleForm, setModuleForm] = useState({
    name: "",
    description: "",
    status: "Active",
  });
  const [domainForm, setDomainForm] = useState({
    moduleId: "",
    name: "",
    description: "",
    status: "Active",
  });
  const [programForm, setProgramForm] = useState({
    domainId: "",
    name: "",
    description: "",
    status: "Active",
  });
  const [activityForm, setActivityForm] = useState({
    programId: "",
    name: "",
    goalDescription: "",
    trials: 1,
    activityType: "DTT",
    instructions: "",
    status: "Active",
    tasks: [],
  });

  const [modules, setModules] = useState([]);
  const [domains, setDomains] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [activities, setActivities] = useState([]);
  const [errors, setErrors] = useState({});

  // Load existing data when modal opens
  useEffect(() => {
    if (isOpen && existingData) {
      setModules(existingData.modules || []);
      setDomains(existingData.domains || []);
      setPrograms(existingData.programs || []);
      setActivities(existingData.activities || []);

      if (existingData.modules && existingData.modules.length > 0) {
        const firstModule = existingData.modules[0];
        setEditingModuleId(firstModule.id);
        setModuleForm({
          name: firstModule.name || "",
          description: firstModule.description || "",
          status: firstModule.status || "Active",
        });
      }

      if (existingData.domains && existingData.domains.length > 0) {
        const firstDomain = existingData.domains[0];
        setEditingDomainId(firstDomain.id);
        setDomainForm({
          moduleId: firstDomain.moduleId || "",
          name: firstDomain.name || "",
          description: firstDomain.description || "",
          status: firstDomain.status || "Active",
        });
      }

      if (existingData.programs && existingData.programs.length > 0) {
        const firstProgram = existingData.programs[0];
        setEditingProgramId(firstProgram.id);
        setProgramForm({
          domainId: firstProgram.domainId || "",
          name: firstProgram.name || "",
          description: firstProgram.description || "",
          status: firstProgram.status || "Active",
        });
      }

      if (existingData.activities && existingData.activities.length > 0) {
        const firstActivity = existingData.activities[0];
        setEditingActivityId(firstActivity.id);
        setActivityForm({
          programId: firstActivity.programId || "",
          name: firstActivity.name || "",
          goalDescription: firstActivity.goalDescription || "",
          trials: firstActivity.trials || 1,
          activityType: firstActivity.activityType || "DTT",
          instructions: firstActivity.instructions || "",
          status: firstActivity.status || "Active",
          tasks: firstActivity.tasks || [],
          prompts: firstActivity.prompts || [],
        });
      }
    }
  }, [isOpen, existingData]);

  const renderInputWithError = (id, label, value, onChange, props = {}) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={errors[id] ? "border-red-500 focus:border-red-500" : ""}
        {...props}
      />
      {errors[id] && <p className="text-red-500 text-sm mt-1">{errors[id]}</p>}
    </div>
  );

  const renderSelectWithError = (id, label, value, onValueChange, children) => {
    const validChildren = children
      ? Array.isArray(children)
        ? children.filter(
            (child) => child?.props?.value && child.props.value !== ""
          )
        : children
      : null;

    return (
      <div>
        <Label htmlFor={id}>{label}</Label>
        <Select
          value={value || ""}
          onValueChange={(val) => {
            onValueChange(val);
          }}
        >
          <SelectTrigger
            id={id}
            className={errors[id] ? "border-red-500 focus:border-red-500" : ""}
          >
            <SelectValue placeholder={`Select ${label}`} />
          </SelectTrigger>
          <SelectContent>
            {validChildren && validChildren.length > 0 ? (
              validChildren
            ) : (
              <div className="p-2 text-sm text-slate-500">
                No {label.toLowerCase()} available
              </div>
            )}
          </SelectContent>
        </Select>
        {errors[id] && (
          <p className="text-red-500 text-sm mt-1">{errors[id]}</p>
        )}
      </div>
    );
  };

  const renderTextareaWithError = (id, label, value, onChange, props = {}) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={errors[id] ? "border-red-500 focus:border-red-500" : ""}
        {...props}
      />
      {errors[id] && <p className="text-red-500 text-sm mt-1">{errors[id]}</p>}
    </div>
  );

  const renderBreadcrumb = (type) => {
    const breadcrumbs = [];

    if (type === "domain" && domainForm.moduleId) {
      const module = modules.find((m) => m.id === domainForm.moduleId);
      if (module) breadcrumbs.push({ label: module.name });
    }

    if (type === "program" && programForm.domainId) {
      const domain = domains.find((d) => d.id === programForm.domainId);
      const module = domain
        ? modules.find((m) => m.id === domain.moduleId)
        : null;
      if (module) breadcrumbs.push({ label: module.name });
      if (domain) breadcrumbs.push({ label: domain.name });
    }

    if (type === "activity" && activityForm.programId) {
      const program = programs.find((p) => p.id === activityForm.programId);
      const domain = program
        ? domains.find((d) => d.id === program.domainId)
        : null;
      const module = domain
        ? modules.find((m) => m.id === domain.moduleId)
        : null;
      if (module) breadcrumbs.push({ label: module.name });
      if (domain) breadcrumbs.push({ label: domain.name });
      if (program) breadcrumbs.push({ label: program.name });
    }

    return breadcrumbs.length > 0 ? breadcrumbs : null;
  };

  const handleAddModule = () => {
    if (!moduleForm.name.trim()) {
      setErrors({ ...errors, moduleName: "Module name is required" });
      return;
    }

    if (editingModuleId) {
      const updatedModules = modules.map((m) =>
        m.id === editingModuleId
          ? {
              ...m,
              name: moduleForm.name,
              description: moduleForm.description,
              status: moduleForm.status,
            }
          : m
      );
      setModules(updatedModules);
      setEditingModuleId(null);
    } else {
      const newModule = {
        id: generateId(),
        name: moduleForm.name,
        description: moduleForm.description,
        status: moduleForm.status,
        archived: false,
      };
      setModules([...modules, newModule]);
    }

    setModuleForm({ name: "", description: "", status: "Active" });
    setErrors({});
  };

  const handleDeleteModule = (id) => {
    setModules(modules.filter((m) => m.id !== id));
    setDomains(domains.filter((d) => d.moduleId !== id));
    if (editingModuleId === id) setEditingModuleId(null);
  };

  const handleEditModule = (module) => {
    setEditingModuleId(module.id);
    setModuleForm({
      name: module.name,
      description: module.description,
      status: module.status,
    });
  };

  const handleCancelEditModule = () => {
    setEditingModuleId(null);
    setModuleForm({ name: "", description: "", status: "Active" });
  };

  const handleAddDomain = () => {
    if (!domainForm.moduleId) {
      setErrors({ ...errors, domainModuleId: "Please select a module" });
      return;
    }

    const selectedModule = modules.find((m) => m.id === domainForm.moduleId);
    if (!selectedModule) {
      setErrors({ ...errors, domainModuleId: "Selected module not available" });
      return;
    }

    if (!domainForm.name.trim()) {
      setErrors({ ...errors, domainName: "Domain name is required" });
      return;
    }

    const capturedModuleId = domainForm.moduleId;

    if (editingDomainId) {
      const updatedDomains = domains.map((d) =>
        d.id === editingDomainId
          ? {
              ...d,
              moduleId: capturedModuleId,
              name: domainForm.name,
              description: domainForm.description,
              status: domainForm.status,
            }
          : d
      );
      setDomains(updatedDomains);
      setEditingDomainId(null);
    } else {
      const newDomain = {
        id: generateId(),
        moduleId: capturedModuleId,
        name: domainForm.name,
        description: domainForm.description,
        status: domainForm.status,
        archived: false,
      };

      setDomains((prevDomains) => [...prevDomains, newDomain]);
    }

    setDomainForm({
      moduleId: "",
      name: "",
      description: "",
      status: "Active",
    });
    setErrors({});
  };

  const handleDeleteDomain = (id) => {
    setDomains(domains.filter((d) => d.id !== id));
    setPrograms(programs.filter((p) => p.domainId !== id));
    if (editingDomainId === id) setEditingDomainId(null);
  };

  const handleEditDomain = (domain) => {
    setEditingDomainId(domain.id);
    setDomainForm({
      moduleId: domain.moduleId,
      name: domain.name,
      description: domain.description,
      status: domain.status,
    });
  };

  const handleCancelEditDomain = () => {
    setEditingDomainId(null);
    setDomainForm({
      moduleId: "",
      name: "",
      description: "",
      status: "Active",
    });
  };

  const handleAddProgram = () => {
    if (!programForm.domainId) {
      setErrors({ ...errors, programDomainId: "Please select a domain" });
      return;
    }

    const selectedDomain = domains.find((d) => d.id === programForm.domainId);
    if (!selectedDomain) {
      setErrors({
        ...errors,
        programDomainId: "Selected domain not available",
      });
      return;
    }

    if (!programForm.name.trim()) {
      setErrors({ ...errors, programName: "Program name is required" });
      return;
    }

    const capturedDomainId = programForm.domainId;

    if (editingProgramId) {
      const updatedPrograms = programs.map((p) =>
        p.id === editingProgramId
          ? {
              ...p,
              domainId: capturedDomainId,
              name: programForm.name,
              description: programForm.description,
              status: programForm.status,
            }
          : p
      );
      setPrograms(updatedPrograms);
      setEditingProgramId(null);
    } else {
      const newProgram = {
        id: generateId(),
        domainId: capturedDomainId,
        name: programForm.name,
        description: programForm.description,
        status: programForm.status,
        archived: false,
      };

      setPrograms((prevPrograms) => [...prevPrograms, newProgram]);
    }

    setProgramForm({
      domainId: "",
      name: "",
      description: "",
      status: "Active",
    });
    setErrors({});
  };

  const handleDeleteProgram = (id) => {
    setPrograms(programs.filter((p) => p.id !== id));
    setActivities(activities.filter((a) => a.programId !== id));
    if (editingProgramId === id) setEditingProgramId(null);
  };

  const handleEditProgram = (program) => {
    setEditingProgramId(program.id);
    setProgramForm({
      domainId: program.domainId,
      name: program.name,
      description: program.description,
      status: program.status,
    });
  };

  const handleCancelEditProgram = () => {
    setEditingProgramId(null);
    setProgramForm({
      domainId: "",
      name: "",
      description: "",
      status: "Active",
    });
  };

  const handleAddActivity = () => {
    if (!activityForm.programId) {
      setErrors({ ...errors, activityProgramId: "Please select a program" });
      return;
    }
    if (
      activityForm.activityType === "Task Analysis" &&
      activityForm.tasks.length === 0
    ) {
      setErrors({
        ...errors,
        activityTasks: "Task Analysis requires at least one task step.",
      });
      return;
    }
    setErrors({ ...errors, activityTasks: "" }); // Clear previous error

    const selectedProgram = programs.find(
      (p) => p.id === activityForm.programId
    );
    if (!selectedProgram) {
      setErrors({
        ...errors,
        activityProgramId: "Selected program not available",
      });
      return;
    }

    if (!activityForm.name.trim()) {
      setErrors({ ...errors, activityName: "Target name is required" });
      return;
    }

    if (activityForm.trials < 1 || activityForm.trials > 100) {
      setErrors({
        ...errors,
        activityTrials: "Trials must be between 1 and 100",
      });
      return;
    }

    const capturedProgramId = activityForm.programId;

    if (editingActivityId) {
      const updatedActivities = activities.map((a) =>
        a.id === editingActivityId
          ? {
              ...a,
              programId: capturedProgramId,
              name: activityForm.name,
              goalDescription: activityForm.goalDescription,
              trials: activityForm.trials,
              activityType: activityForm.activityType,
              instructions: activityForm.instructions,
              status: activityForm.status,
              tasks: activityForm.tasks,
              prompts: activityForm.prompts,
            }
          : a
      );
      setActivities(updatedActivities);
      setEditingActivityId(null);
    } else {
      const newActivity = {
        id: generateId(),
        programId: capturedProgramId,
        name: activityForm.name,
        goalDescription: activityForm.goalDescription,
        trials: activityForm.trials,
        activityType: activityForm.activityType,
        instructions: activityForm.instructions,
        status: activityForm.status,
        tasks: activityForm.tasks,
        prompts: activityForm.prompts,
        archived: false,
      };

      setActivities((prevActivities) => [...prevActivities, newActivity]);
    }

    setActivityForm({
      programId: "",
      name: "",
      goalDescription: "",
      trials: 1,
      activityType: "DTT",
      instructions: "",
      status: "Active",
      tasks: [],
      prompts: [],
    });
    setErrors({});
  };

  const handleDeleteActivity = (id) => {
    setActivities(activities.filter((a) => a.id !== id));
    if (editingActivityId === id) setEditingActivityId(null);
  };

  const handleEditActivity = (activity) => {
    setEditingActivityId(activity.id);
    setActivityForm({
      programId: activity.programId,
      name: activity.name,
      goalDescription: activity.goalDescription,
      trials: activity.trials,
      activityType: activity.activityType,
      instructions: activity.instructions,
      status: activity.status,
      tasks: activity.tasks || [],
      prompts: activity.prompts || [],
    });
  };

  const handleCancelEditActivity = () => {
    setEditingActivityId(null);
    setActivityForm({
      programId: "",
      name: "",
      goalDescription: "",
      trials: 1,
      activityType: "DTT",
      instructions: "",
      status: "Active",
      tasks: [],
      prompts: [],
    });
  };

  const handleSave = () => {
    const dataToSave = { modules, domains, programs, activities };
    onSave(dataToSave);
    handleClose();
  };

  const handleClose = () => {
    setModules([]);
    setDomains([]);
    setPrograms([]);
    setActivities([]);
    setModuleForm({ name: "", description: "", status: "Active" });
    setDomainForm({
      moduleId: "",
      name: "",
      description: "",
      status: "Active",
    });
    setProgramForm({
      domainId: "",
      name: "",
      description: "",
      status: "Active",
    });
    setActivityForm({
      programId: "",
      name: "",
      goalDescription: "",
      trials: 1,
      activityType: "DTT",
      instructions: "",
      status: "Active",
      tasks: [], // <-- ADDED: Clear tasks
      prompts: [],
    });
    setErrors({});
    onClose();
  };
  const handleAddTask = (taskName) => {
    if (!taskName.trim()) return;

    const newTask = {
      id: generateId(),
      name: taskName.trim(),
    };

    setActivityForm((prev) => ({
      ...prev,
      tasks: [...prev.tasks, newTask],
    }));
  };

  const handleDeleteTask = (taskId) => {
    setActivityForm((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((task) => task.id !== taskId),
    }));
  };
  const [newTaskName, setNewTaskName] = useState("");
  const promptOptions = [
    { value: "Correct", label: "Correct" },
    { value: "Full Physical", label: "Full Physical" },
    { value: "Gestural prompt", label: "Gestural prompt" },
    { value: "Verbal prompt", label: "Verbal prompt" },
    { value: "Partial Physical", label: "Partial Physical" },
    { value: "Incorrect", label: "Incorrect" },
  ];
  const [selectedPrompts, setSelectedPrompts] = useState([]);

  const MultiSelect = ({ options, selected, onChange, placeholder }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const dropdownRef = useRef(null);

    // Filter options based on search input - **Use option.label**
    const filteredOptions = options.filter((option) =>
      option.label.toLowerCase().includes(search.toLowerCase())
    );

    // Handle clicks outside the dropdown to close it (logic is fine, no change)
    useEffect(() => {
      const handleClickOutside = (event) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target)
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

    const handleSelect = (value) => {
      if (selected.includes(value)) {
        onChange(selected.filter((item) => item !== value));
      } else {
        onChange([...selected, value]);
      }
    };
    const handleRemovePrompt = (promptToRemove) => {
      setSelectedPrompts(
        selectedPrompts.filter((prompt) => prompt !== promptToRemove)
      );
    };
  
    return (
      <div ref={dropdownRef} className="relative">
        {" "}
        {/* Added relative for positioning */}
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-transparent"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(!open);
            setSearch("");
          }}
        >
          {selected.length > 0 ? `${selected.length} selected` : placeholder}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
        {open && (
          // Added absolute positioning to place the dropdown panel
          <div className="absolute z-10 w-full p-0 mt-2 border border-slate-200 bg-white rounded-lg shadow-lg">
            <div className="p-2">
              <Input
                placeholder="Search..."
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
                  No results found
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <div
                    // **Use option.value for key**
                    key={option.value}
                    className="p-2 flex items-center space-x-2 cursor-pointer hover:bg-slate-100 text-sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // **Use option.value for selection**
                      handleSelect(option.value);
                    }}
                  >
                    <CheckIcon
                      className={cn(
                        "mr-2 h-4 w-4",
                        // **Check selected array against option.value**
                        selected.includes(option.value)
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {/* **Display option.label** */}
                    {option.label}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {selectedPrompts.map((item) => (
            <Badge
              key={item}
              variant="outline"
              // This ensures the badge is flexible and can hold the icon
              className="flex items-center space-x-1 pr-1"
            >
              <span>{item}</span>
              <button
                type="button"
                onClick={() => handleRemovePrompt(item)} // Call the removal handler
                className="p-0.5 rounded-full hover:bg-red-200 hover:text-red-800 transition-colors"
                aria-label={`Remove ${item}`}
              >
                <XIcon className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>
    );
  };
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-teal-600" />
            ABA Program Builder
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="modules" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> Modules
            </TabsTrigger>
            <TabsTrigger value="domains" className="flex items-center gap-2">
              <Layers className="h-4 w-4" /> Domains
            </TabsTrigger>
            <TabsTrigger value="programs" className="flex items-center gap-2">
              <Target className="h-4 w-4" /> Programs
            </TabsTrigger>
            <TabsTrigger value="targets" className="flex items-center gap-2">
              <Zap className="h-4 w-4" /> Targets
            </TabsTrigger>
          </TabsList>

          {/* Modules Tab */}
          <TabsContent value="modules" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-teal-600" />{" "}
                  {editingModuleId ? "Edit" : "Add"} Module
                  <Badge variant="secondary" className="ml-2">
                    e.g., Skill Acquisition
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderInputWithError(
                    "moduleName",
                    "Module Name *",
                    moduleForm.name,
                    (value) => setModuleForm({ ...moduleForm, name: value })
                  )}
                  {renderSelectWithError(
                    "moduleStatus",
                    "Status",
                    moduleForm.status,
                    (value) => setModuleForm({ ...moduleForm, status: value }),
                    statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))
                  )}
                </div>
                <div>
                  {renderTextareaWithError(
                    "moduleDescription",
                    "Module Description",
                    moduleForm.description,
                    (value) =>
                      setModuleForm({ ...moduleForm, description: value }),
                    { rows: 3, placeholder: "Enter module description..." }
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleAddModule}
                    className="bg-teal-600 hover:bg-teal-700 flex-1"
                  >
                    <Plus className="h-4 w-4 mr-2" />{" "}
                    {editingModuleId ? "Update" : "Add"} Module
                  </Button>
                  {editingModuleId && (
                    <Button
                      onClick={handleCancelEditModule}
                      variant="outline"
                      className="flex-1 bg-transparent"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Modules List */}
            {modules.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Added Modules ({modules.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {modules.map((module) => (
                    <div
                      key={module.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        editingModuleId === module.id
                          ? "bg-teal-50 border-teal-300"
                          : "bg-slate-50"
                      }`}
                    >
                      <div>
                        <p className="font-medium">{module.name}</p>
                        <p className="text-sm text-slate-500">
                          {module.description}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          ID: {module.id}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditModule(module)}
                          className="text-teal-600 hover:text-teal-700"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteModule(module.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Domains Tab */}
          <TabsContent value="domains" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-teal-600" />{" "}
                  {editingDomainId ? "Edit" : "Add"} Domain
                  <Badge variant="secondary" className="ml-2">
                    e.g., Intraverbals
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderBreadcrumb("domain") && (
                  <div className="mb-4 p-3 bg-teal-50 rounded-lg">
                    <BreadcrumbDisplay items={renderBreadcrumb("domain")} />
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {renderSelectWithError(
                    "domainModuleId",
                    "Select Module *",
                    domainForm.moduleId,
                    (value) => {
                      setDomainForm((prev) => ({ ...prev, moduleId: value }));
                    },
                    modules.length === 0
                      ? null
                      : modules.map((module) => (
                          <SelectItem key={module.id} value={module.id}>
                            {module.name}
                          </SelectItem>
                        ))
                  )}
                  {renderInputWithError(
                    "domainName",
                    "Domain Name *",
                    domainForm.name,
                    (value) => setDomainForm({ ...domainForm, name: value })
                  )}
                  {renderSelectWithError(
                    "domainStatus",
                    "Status",
                    domainForm.status,
                    (value) => setDomainForm({ ...domainForm, status: value }),
                    statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))
                  )}
                </div>
                <div>
                  {renderTextareaWithError(
                    "domainDescription",
                    "Domain Description",
                    domainForm.description,
                    (value) =>
                      setDomainForm({ ...domainForm, description: value }),
                    { rows: 3, placeholder: "Enter domain description..." }
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleAddDomain}
                    className="bg-teal-600 hover:bg-teal-700 flex-1"
                  >
                    <Plus className="h-4 w-4 mr-2" />{" "}
                    {editingDomainId ? "Update" : "Add"} Domain
                  </Button>
                  {editingDomainId && (
                    <Button
                      onClick={handleCancelEditDomain}
                      variant="outline"
                      className="flex-1 bg-transparent"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Domains List */}
            {domains.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Added Domains ({domains.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {domains.map((domain) => {
                    const parentModule = modules.find(
                      (m) => m.id === domain.moduleId
                    );
                    return (
                      <div
                        key={domain.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          editingDomainId === domain.id
                            ? "bg-teal-50 border-teal-300"
                            : "bg-slate-50"
                        }`}
                      >
                        <div>
                          <p className="font-medium">{domain.name}</p>
                          <p className="text-sm text-slate-500">
                            {domain.description}
                          </p>
                          <p className="text-xs text-teal-600 mt-1">
                            Module: {parentModule?.name || "Unknown"}
                          </p>
                          <p className="text-xs text-slate-400">
                            ID: {domain.id}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditDomain(domain)}
                            className="text-teal-600 hover:text-teal-700"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteDomain(domain.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Programs Tab */}
          <TabsContent value="programs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-teal-600" />{" "}
                  {editingProgramId ? "Edit" : "Add"} Program
                  <Badge variant="secondary" className="ml-2">
                    e.g., Mand for missing items
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderBreadcrumb("program") && (
                  <div className="mb-4 p-3 bg-teal-50 rounded-lg">
                    <BreadcrumbDisplay items={renderBreadcrumb("program")} />
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {renderSelectWithError(
                    "programDomainId",
                    "Select Domain *",
                    programForm.domainId,
                    (value) => {
                      setProgramForm((prev) => ({ ...prev, domainId: value }));
                    },
                    domains.length === 0
                      ? null
                      : domains.map((domain) => (
                          <SelectItem key={domain.id} value={domain.id}>
                            {domain.name}
                          </SelectItem>
                        ))
                  )}
                  {renderInputWithError(
                    "programName",
                    "Program Name *",
                    programForm.name,
                    (value) => setProgramForm({ ...programForm, name: value })
                  )}
                  {renderSelectWithError(
                    "programStatus",
                    "Status",
                    programForm.status,
                    (value) =>
                      setProgramForm({ ...programForm, status: value }),
                    statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))
                  )}
                </div>
                <div>
                  {renderTextareaWithError(
                    "programDescription",
                    "Program Description",
                    programForm.description,
                    (value) =>
                      setProgramForm({ ...programForm, description: value }),
                    { rows: 3, placeholder: "Enter program description..." }
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleAddProgram}
                    className="bg-teal-600 hover:bg-teal-700 flex-1"
                  >
                    <Plus className="h-4 w-4 mr-2" />{" "}
                    {editingProgramId ? "Update" : "Add"} Program
                  </Button>
                  {editingProgramId && (
                    <Button
                      onClick={handleCancelEditProgram}
                      variant="outline"
                      className="flex-1 bg-transparent"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Programs List */}
            {programs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Added Programs ({programs.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {programs.map((program) => {
                    const parentDomain = domains.find(
                      (d) => d.id === program.domainId
                    );
                    const parentModule = parentDomain
                      ? modules.find((m) => m.id === parentDomain.moduleId)
                      : null;
                    return (
                      <div
                        key={program.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          editingProgramId === program.id
                            ? "bg-teal-50 border-teal-300"
                            : "bg-slate-50"
                        }`}
                      >
                        <div>
                          <p className="font-medium">{program.name}</p>
                          <p className="text-sm text-slate-500">
                            {program.description}
                          </p>
                          <p className="text-xs text-teal-600 mt-1">
                            {parentModule?.name} → {parentDomain?.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            ID: {program.id}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditProgram(program)}
                            className="text-teal-600 hover:text-teal-700"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteProgram(program.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Targets Tab */}
          <TabsContent value="targets" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-teal-600" />{" "}
                  {editingActivityId ? "Edit" : "Add"} Target
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderBreadcrumb("activity") && (
                  <div className="mb-4 p-3 bg-teal-50 rounded-lg">
                    <BreadcrumbDisplay items={renderBreadcrumb("activity")} />
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderSelectWithError(
                    "activityProgramId",
                    "Select Program *",
                    activityForm.programId,
                    (value) => {
                      setActivityForm((prev) => ({
                        ...prev,
                        programId: value,
                      }));
                    },
                    programs.length === 0
                      ? null
                      : programs.map((program) => (
                          <SelectItem key={program.id} value={program.id}>
                            {program.name}
                          </SelectItem>
                        ))
                  )}
                  {renderInputWithError(
                    "activityName",
                    "Target Name *",
                    activityForm.name,
                    (value) => setActivityForm({ ...activityForm, name: value })
                  )}
                </div>
                <div className="">
                  <div>
                    <Label>Select Prompt</Label>

                    <MultiSelect
                      options={promptOptions}
                      selected={selectedPrompts} // Pass the selected state
                      onChange={setSelectedPrompts} // Pass the setter function
                      placeholder="Select Prompts..."
                    />
                  </div>
                </div>
                <div>
                  {renderTextareaWithError(
                    "activityGoalDescription",
                    "Goal Description",
                    activityForm.goalDescription,
                    (value) =>
                      setActivityForm({
                        ...activityForm,
                        goalDescription: value,
                      }),
                    { rows: 2, placeholder: "Enter goal description..." }
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {renderInputWithError(
                    "activityTrials",
                    "Trials (1-100) *",
                    activityForm.trials,
                    (value) =>
                      setActivityForm({
                        ...activityForm,
                        trials: Math.min(
                          100,
                          Math.max(1, Number.parseInt(value) || 1)
                        ),
                      }),
                    { type: "number", min: 1, max: 100 }
                  )}
                  {renderSelectWithError(
                    "activityType",
                    "Target Type *",
                    activityForm.activityType,
                    (value) =>
                      setActivityForm({ ...activityForm, activityType: value }),
                    activityTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))
                  )}
                  {renderSelectWithError(
                    "activityStatus",
                    "Status",
                    activityForm.status,
                    (value) =>
                      setActivityForm({ ...activityForm, status: value }),
                    statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))
                  )}
                </div>

                <div>
                  {activityForm.activityType === "Task Analysis" && (
                    <Card className="bg-white p-4 border border-teal-200">
                      <CardTitle className="text-base mb-3 flex items-center gap-2">
                        <Layers className="h-4 w-4 text-teal-600" />
                        Task Steps
                      </CardTitle>
                      <div>
                        <Label htmlFor="newTask">Add New Task Step</Label>
                        <div className="flex gap-2">
                          <Input
                            id="newTask"
                            placeholder="e.g., Wash hands"
                            value={newTaskName}
                            onChange={(e) => setNewTaskName(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === "Enter") {
                                handleAddTask(newTaskName);
                                setNewTaskName("");
                              }
                            }}
                          />
                          <Button
                            type="button"
                            onClick={() => {
                              handleAddTask(newTaskName);
                              setNewTaskName("");
                            }}
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                      {errors.activityTasks && (
                        <p className="text-red-500 text-sm mt-2">
                          {errors.activityTasks}
                        </p>
                      )}
                    </Card>
                  )}
                </div>
                <div>
                  {activityForm.activityType === "Task Analysis" &&
                    activityForm.tasks?.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {activityForm.tasks.map((task, index) => (
                          <div
                            key={task.id}
                            className="flex justify-between items-center p-2 border rounded bg-slate-100"
                          >
                            <span className="font-medium text-sm">
                              {index + 1}. {task.name}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-red-500 hover:text-red-700 h-6 w-6"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                </div>

                <div>
                  {renderTextareaWithError(
                    "activityInstructions",
                    "Target Instructions",
                    activityForm.instructions,
                    (value) =>
                      setActivityForm({ ...activityForm, instructions: value }),
                    {
                      rows: 4,
                      placeholder: "Enter detailed activity instructions...",
                    }
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleAddActivity}
                    className="bg-teal-600 hover:bg-teal-700 flex-1"
                  >
                    <Plus className="h-4 w-4 mr-2" />{" "}
                    {editingActivityId ? "Update" : "Add"} Target
                  </Button>
                  {editingActivityId && (
                    <Button
                      onClick={handleCancelEditActivity}
                      variant="outline"
                      className="flex-1 bg-transparent"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Activities List */}
            {activities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Added Targets ({activities.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {activities.map((activity) => {
                    const parentProgram = programs.find(
                      (p) => p.id === activity.programId
                    );
                    const parentDomain = parentProgram
                      ? domains.find((d) => d.id === parentProgram.domainId)
                      : null;
                    const parentModule = parentDomain
                      ? modules.find((m) => m.id === parentDomain.moduleId)
                      : null;
                    return (
                      <div
                        key={activity.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          editingActivityId === activity.id
                            ? "bg-teal-50 border-teal-300"
                            : "bg-slate-50"
                        }`}
                      >
                        <div>
                          <p className="font-medium">{activity.name}</p>
                          <p className="text-sm text-slate-500">
                            {activity.goalDescription}
                          </p>
                          <p className="text-xs text-teal-600 mt-1">
                            {parentModule?.name} → {parentDomain?.name} →{" "}
                            {parentProgram?.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {activity.activityType} • {activity.trials} trials •
                            ID: {activity.id}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditActivity(activity)}
                            className="text-teal-600 hover:text-teal-700"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteActivity(activity.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex justify-between gap-3 pt-6 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-teal-600 hover:bg-teal-700"
          >
            Save Program Structure
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
