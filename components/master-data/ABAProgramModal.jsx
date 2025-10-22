// components/master-data/ABAProgramModal.jsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  Layers,
  Target,
  Zap,
  Plus,
  Trash2,
  ChevronRight,
} from "lucide-react";

const activityTypes = ["DTT", "Task Analysis", "Frequency", "Duration"];
const statusOptions = ["Active", "Inactive"];

export default function ABAProgramModal({ isOpen, onClose, onSave }) {
  const [activeTab, setActiveTab] = useState("modules");
  const [errors, setErrors] = useState({});

  // Data state
  const [modules, setModules] = useState([]);
  const [domains, setDomains] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [activities, setActivities] = useState([]);

  // Form state
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
  });

  const [editingId, setEditingId] = useState(null);

  // Helper functions
  const generateId = () => `${Date.now()}-${Math.random()}`;

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

  const renderSelectWithError = (id, label, value, onValueChange, children) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value || "none"}
        onValueChange={(val) => onValueChange(val === "none" ? "" : val)}
      >
        <SelectTrigger
          id={id}
          className={errors[id] ? "border-red-500 focus:border-red-500" : ""}
        >
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
      {errors[id] && <p className="text-red-500 text-sm mt-1">{errors[id]}</p>}
    </div>
  );

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

  // Module handlers
  const handleAddModule = () => {
    if (!moduleForm.name.trim()) {
      setErrors({ ...errors, moduleName: "Module name is required" });
      return;
    }
    const newModule = {
      id: generateId(),
      ...moduleForm,
    };
    setModules([...modules, newModule]);
    setModuleForm({ name: "", description: "", status: "Active" });
    setErrors({});
  };

  const handleDeleteModule = (id) => {
    setModules(modules.filter((m) => m.id !== id));
    setDomains(domains.filter((d) => d.moduleId !== id));
  };

  // Domain handlers
  const handleAddDomain = () => {
    if (!domainForm.moduleId) {
      setErrors({ ...errors, domainModuleId: "Please select a module" });
      return;
    }
    if (!domainForm.name.trim()) {
      setErrors({ ...errors, domainName: "Domain name is required" });
      return;
    }
    const newDomain = {
      id: generateId(),
      ...domainForm,
    };
    setDomains([...domains, newDomain]);
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
  };

  // Program handlers
  const handleAddProgram = () => {
    if (!programForm.domainId) {
      setErrors({ ...errors, programDomainId: "Please select a domain" });
      return;
    }
    if (!programForm.name.trim()) {
      setErrors({ ...errors, programName: "Program name is required" });
      return;
    }
    const newProgram = {
      id: generateId(),
      ...programForm,
    };
    setPrograms([...programs, newProgram]);
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
  };

  // Activity handlers
  const handleAddActivity = () => {
    if (!activityForm.programId) {
      setErrors({ ...errors, activityProgramId: "Please select a program" });
      return;
    }
    if (!activityForm.name.trim()) {
      setErrors({ ...errors, activityName: "Activity name is required" });
      return;
    }
    if (activityForm.trials < 1 || activityForm.trials > 100) {
      setErrors({
        ...errors,
        activityTrials: "Trials must be between 1 and 100",
      });
      return;
    }
    const newActivity = {
      id: generateId(),
      ...activityForm,
    };
    setActivities([...activities, newActivity]);
    setActivityForm({
      programId: "",
      name: "",
      goalDescription: "",
      trials: 1,
      activityType: "DTT",
      instructions: "",
      status: "Active",
    });
    setErrors({});
  };

  const handleDeleteActivity = (id) => {
    setActivities(activities.filter((a) => a.id !== id));
  };

  const handleSave = () => {
    onSave({ modules, domains, programs, activities });
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
    });
    setErrors({});
    onClose();
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
            <TabsTrigger value="activities" className="flex items-center gap-2">
              <Zap className="h-4 w-4" /> Activities
            </TabsTrigger>
          </TabsList>

          {/* Modules Tab */}
          <TabsContent value="modules" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-teal-600" /> Add Module
                  <Badge variant="secondary" className="ml-2">
                    e.g., Skill Acquisition
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <Button
                  onClick={handleAddModule}
                  className="bg-teal-600 hover:bg-teal-700 w-full"
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Module
                </Button>
              </CardContent>
            </Card>

            {modules.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Modules List</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {modules.map((module) => (
                    <div
                      key={module.id}
                      className="flex items-start justify-between p-3 border border-slate-200 rounded-lg"
                    >
                      <div className="flex-1">
                        <h4 className="font-semibold">{module.name}</h4>
                        <p className="text-sm text-slate-600">
                          {module.description}
                        </p>
                        <Badge
                          variant={
                            module.status === "Active" ? "default" : "secondary"
                          }
                          className="mt-2"
                        >
                          {module.status}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteModule(module.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
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
                  <Layers className="h-5 w-5 text-teal-600" /> Add Domain
                  <Badge variant="secondary" className="ml-2">
                    e.g., Intraverbals
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {renderSelectWithError(
                    "domainModuleId",
                    "Select Module *",
                    domainForm.moduleId,
                    (value) =>
                      setDomainForm({ ...domainForm, moduleId: value }),
                    modules.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No modules available
                      </SelectItem>
                    ) : (
                      modules.map((module) => (
                        <SelectItem key={module.id} value={module.id}>
                          {module.name}
                        </SelectItem>
                      ))
                    )
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
                <Button
                  onClick={handleAddDomain}
                  className="bg-teal-600 hover:bg-teal-700 w-full"
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Domain
                </Button>
              </CardContent>
            </Card>

            {domains.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Domains List</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {domains.map((domain) => {
                    const module = modules.find(
                      (m) => m.id === domain.moduleId
                    );
                    return (
                      <div
                        key={domain.id}
                        className="flex items-start justify-between p-3 border border-slate-200 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{domain.name}</h4>
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                            <span className="text-sm text-slate-600">
                              {module?.name}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 mt-1">
                            {domain.description}
                          </p>
                          <Badge
                            variant={
                              domain.status === "Active"
                                ? "default"
                                : "secondary"
                            }
                            className="mt-2"
                          >
                            {domain.status}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDomain(domain.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
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
                  <Target className="h-5 w-5 text-teal-600" /> Add Program
                  <Badge variant="secondary" className="ml-2">
                    e.g., Mand for missing items
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {renderSelectWithError(
                    "programDomainId",
                    "Select Domain *",
                    programForm.domainId,
                    (value) =>
                      setProgramForm({ ...programForm, domainId: value }),
                    domains.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No domains available
                      </SelectItem>
                    ) : (
                      domains.map((domain) => (
                        <SelectItem key={domain.id} value={domain.id}>
                          {domain.name}
                        </SelectItem>
                      ))
                    )
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
                <Button
                  onClick={handleAddProgram}
                  className="bg-teal-600 hover:bg-teal-700 w-full"
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Program
                </Button>
              </CardContent>
            </Card>

            {programs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Programs List</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {programs.map((program) => {
                    const domain = domains.find(
                      (d) => d.id === program.domainId
                    );
                    return (
                      <div
                        key={program.id}
                        className="flex items-start justify-between p-3 border border-slate-200 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{program.name}</h4>
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                            <span className="text-sm text-slate-600">
                              {domain?.name}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 mt-1">
                            {program.description}
                          </p>
                          <Badge
                            variant={
                              program.status === "Active"
                                ? "default"
                                : "secondary"
                            }
                            className="mt-2"
                          >
                            {program.status}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteProgram(program.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Activities Tab */}
          <TabsContent value="activities" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-teal-600" /> Add Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderSelectWithError(
                    "activityProgramId",
                    "Select Program *",
                    activityForm.programId,
                    (value) =>
                      setActivityForm({ ...activityForm, programId: value }),
                    programs.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No programs available
                      </SelectItem>
                    ) : (
                      programs.map((program) => (
                        <SelectItem key={program.id} value={program.id}>
                          {program.name}
                        </SelectItem>
                      ))
                    )
                  )}
                  {renderInputWithError(
                    "activityName",
                    "Activity Name *",
                    activityForm.name,
                    (value) => setActivityForm({ ...activityForm, name: value })
                  )}
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
                    "Activity Type *",
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
                  {renderTextareaWithError(
                    "activityInstructions",
                    "Activity Instructions (Rich Text)",
                    activityForm.instructions,
                    (value) =>
                      setActivityForm({ ...activityForm, instructions: value }),
                    {
                      rows: 4,
                      placeholder: "Enter detailed activity instructions...",
                    }
                  )}
                </div>

                <Button
                  onClick={handleAddActivity}
                  className="bg-teal-600 hover:bg-teal-700 w-full"
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Activity
                </Button>
              </CardContent>
            </Card>

            {activities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Activities List</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {activities.map((activity) => {
                    const program = programs.find(
                      (p) => p.id === activity.programId
                    );
                    return (
                      <div
                        key={activity.id}
                        className="flex items-start justify-between p-3 border border-slate-200 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{activity.name}</h4>
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                            <span className="text-sm text-slate-600">
                              {program?.name}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 mt-1">
                            {activity.goalDescription}
                          </p>
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <Badge variant="outline">
                              Trials: {activity.trials}
                            </Badge>
                            <Badge variant="outline">
                              Type: {activity.activityType}
                            </Badge>
                            <Badge
                              variant={
                                activity.status === "Active"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {activity.status}
                            </Badge>
                          </div>
                          {activity.instructions && (
                            <p className="text-xs text-slate-500 mt-2 italic">
                              Instructions:{" "}
                              {activity.instructions.substring(0, 100)}
                              {activity.instructions.length > 100 ? "..." : ""}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteActivity(activity.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

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
