import React, { useState, useEffect } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Edit,
  Trash2,
  Archive,
  ArchiveRestore,
  FolderKanban,
  Layers,
  ListChecks,
  Target,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

// Generate UUID function
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Main Modal Component
export default function ClientModulesModal({
  isOpen,
  onClose,
  clientId,
  clientName,
}) {
  const [modules, setModules] = useState([]);
  const [domains, setDomains] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Modal states
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [isDomainModalOpen, setIsDomainModalOpen] = useState(false);
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);

  // Editing states
  const [editingModule, setEditingModule] = useState(null);
  const [editingDomain, setEditingDomain] = useState(null);
  const [editingProgram, setEditingProgram] = useState(null);
  const [editingActivity, setEditingActivity] = useState(null);

  // Selected items for hierarchy
  const [selectedModuleId, setSelectedModuleId] = useState(null);
  const [selectedDomainId, setSelectedDomainId] = useState(null);
  const [selectedProgramId, setSelectedProgramId] = useState(null);

  // Expanded state for tree
  const [expandedModules, setExpandedModules] = useState(new Set());
  const [expandedDomains, setExpandedDomains] = useState(new Set());
  const [expandedPrograms, setExpandedPrograms] = useState(new Set());

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost";

  // Fetch data
  useEffect(() => {
    if (isOpen && clientId) {
      fetchClientData();
    }
  }, [isOpen, clientId]);

  const fetchClientData = async () => {
  setLoading(true);
  try {
    const response = await fetch(
      `${baseUrl}/client-modules.php?client_id=${clientId}`
    );
    const result = await response.json();

    if (result.success) {
      const normalizeItem = (item) => ({
        ...item,
        // Fix uppercase field names
        id: item.id || item.ID || item.Id,
        name: item.name || item.NAME || item.Name || item.title || item.TITLE,
        description:
          item.description ||
          item.DESCRIPTION ||
          item.Description ||
          item.desc ||
          item.DESC ||
          "",
        status:
          item.status ||
          item.STATUS ||
          item.Status ||
          "Active",
        archived:
          item.archived === "1" ||
          item.archived === 1 ||
          item.ARCHIVED === "1" ||
          item.ARCHIVED === 1 ||
          item.archived === true,

        // Fix foreign keys (snake_case + possible uppercase)
        moduleId:
          item.moduleId ||
          item.module_id ||
          item.MODULE_ID ||
          item.moduleId ||
          null,
        domainId:
          item.domainId ||
          item.domain_id ||
          item.DOMAIN_ID ||
          item.domainId ||
          null,
        programId:
          item.programId ||
          item.program_id ||
          item.PROGRAM_ID ||
          null,

        // Keep originals just in case
        client_id: item.client_id || item.CLIENT_ID,
      });

      const normalizedModules = (result.data.modules || []).map(normalizeItem);
      const normalizedDomains = (result.data.domains || []).map(normalizeItem);
      const normalizedPrograms = (result.data.programs || []).map(normalizeItem);
      const normalizedActivities = (result.data.activities || []).map(normalizeItem);

      setModules(normalizedModules);
      setDomains(normalizedDomains);
      setPrograms(normalizedPrograms);
      setActivities(normalizedActivities);

      // Optional: Auto-expand first module
      if (normalizedModules.length > 0) {
        setExpandedModules(new Set([normalizedModules[0].id]));
      }
    } else {
      toast.error("Failed to load client modules");
    }
  } catch (error) {
    console.error("Error fetching client modules:", error);
    toast.error("Error loading data");
  } finally {
    setLoading(false);
  }
};

  // Toggle expand
  const toggleModule = (id) => {
    const newSet = new Set(expandedModules);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedModules(newSet);
  };

  const toggleDomain = (id) => {
    const newSet = new Set(expandedDomains);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedDomains(newSet);
  };

  const toggleProgram = (id) => {
    const newSet = new Set(expandedPrograms);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedPrograms(newSet);
  };

  // Add Module
  const handleAddModule = async (moduleData) => {
    const newModule = {
      id: generateUUID(),
      ...moduleData,
      status: "Active",
      archived: false,
    };

    try {
      const response = await fetch(`${baseUrl}/client-modules.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          modules: [newModule],
        }),
      });

      const result = await response.json();
      if (result.success) {
        setModules([...modules, newModule]);
        toast.success("Module added successfully");
        setIsModuleModalOpen(false);
      } else {
        toast.error("Failed to add module");
      }
    } catch (error) {
      console.error("Error adding module:", error);
      toast.error("Error adding module");
    }
  };

  // Edit Module
  const handleEditModule = async (moduleData) => {
    try {
      const response = await fetch(`${baseUrl}/client-modules.php`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          moduleId: moduleData.id,
          ...moduleData,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setModules(
          modules.map((m) => (m.id === moduleData.id ? moduleData : m))
        );
        toast.success("Module updated successfully");
        setIsModuleModalOpen(false);
        setEditingModule(null);
      } else {
        toast.error("Failed to update module");
      }
    } catch (error) {
      console.error("Error updating module:", error);
      toast.error("Error updating module");
    }
  };

  // Archive/Restore Module
  const handleArchiveModule = async (moduleId, archived) => {
    try {
      const response = await fetch(`${baseUrl}/client-modules.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          moduleId,
          archived: archived ? 1 : 0,
          status: archived ? "Inactive" : "Active",
        }),
      });

      const result = await response.json();
      if (result.success) {
        setModules(
          modules.map((m) =>
            m.id === moduleId
              ? { ...m, archived, status: archived ? "Inactive" : "Active" }
              : m
          )
        );
        toast.success(archived ? "Module archived" : "Module restored");
      }
    } catch (error) {
      toast.error("Error updating module");
    }
  };

  // Delete Module
  const handleDeleteModule = async (moduleId) => {
    if (
      !confirm(
        "Are you sure you want to delete this module? This will also delete all associated domains, programs, and activities."
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/client-modules.php`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          moduleId,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setModules(modules.filter((m) => m.id !== moduleId));
        toast.success("Module deleted successfully");
      }
    } catch (error) {
      toast.error("Error deleting module");
    }
  };

  // Domain handlers
  const handleAddDomain = async (domainData) => {
    const newDomain = {
      id: generateUUID(),
      moduleId: selectedModuleId || "",
      ...domainData,
      status: "Active",
      archived: false,
    };

    try {
      const response = await fetch(`${baseUrl}/client-modules.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          domains: [newDomain],
        }),
      });

      const result = await response.json();
      if (result.success) {
        setDomains([...domains, newDomain]);
        toast.success("Domain added successfully");
        setIsDomainModalOpen(false);
      }
    } catch (error) {
      toast.error("Error adding domain");
    }
  };

  const handleAddProgram = async (programData) => {
    const newProgram = {
      id: generateUUID(),
      domainId: selectedDomainId || "",
      ...programData,
      status: "Active",
      archived: false,
    };

    try {
      const response = await fetch(`${baseUrl}/client-modules.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          programs: [newProgram],
        }),
      });

      const result = await response.json();
      if (result.success) {
        setPrograms([...programs, newProgram]);
        toast.success("Program added successfully");
        setIsProgramModalOpen(false);
      }
    } catch (error) {
      toast.error("Error adding program");
    }
  };

  const filteredModules = modules.filter((m) => m.archived === showArchived);
  const filteredDomains = domains.filter((d) => d.archived === showArchived);
  const filteredPrograms = programs.filter((p) => p.archived === showArchived);
  const filteredActivities = activities.filter(
    (a) => a.archived === showArchived
  );

  return (
    <>
      <Toaster />
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <FolderKanban className="h-6 w-6 text-teal-600" />
              Modules for {clientName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Header Actions */}
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowArchived(!showArchived)}
              >
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

              <Button
                onClick={() => {
                  setEditingModule(null);
                  setIsModuleModalOpen(true);
                }}
                className="bg-teal-600 hover:bg-teal-700"
              >
                <Plus className="h-4 w-4 mr-2" /> Add Module
              </Button>
            </div>

            {/* Module Tree */}
            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-500 animate-pulse">
                  Loading modules...
                </p>
              </div>
            ) : filteredModules.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <FolderKanban className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">
                    No modules found. Create one to get started!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredModules.map((module) => {
                  const isExpanded = expandedModules.has(module.id);
                  // Inside the render — replace these lines:
                  const moduleDomains = filteredDomains.filter(
                    (d) => d.moduleId === module.id
                  );
                  return (
                    <Card
                      key={module.id}
                      className="border-l-4 border-l-teal-500"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleModule(module.id)}
                              className="p-1 h-6 w-6"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                            <FolderKanban className="h-5 w-5 text-teal-600" />
                            <div>
                              <h3 className="font-semibold capitalize">{module.name}</h3>
                              {module.description && (
                                <p className="text-sm text-gray-600">
                                  {module.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{module.status}</Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedModuleId(module.id);
                                setEditingDomain(null);
                                setIsDomainModalOpen(true);
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingModule(module);
                                setIsModuleModalOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleArchiveModule(module.id, !module.archived)
                              }
                            >
                              {module.archived ? (
                                <ArchiveRestore className="h-4 w-4" />
                              ) : (
                                <Archive className="h-4 w-4" />
                              )}
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
                      </CardHeader>

                      {isExpanded && moduleDomains.length > 0 && (
                        <CardContent className="pl-12">
                          {moduleDomains.map((domain) => {
                            const isDomainExpanded = expandedDomains.has(
                              domain.id
                            );
                            const domainPrograms = filteredPrograms.filter(
                              (p) => p.domainId === domain.id
                            );

                            return (
                              <Card
                                key={domain.id}
                                className="mb-2 border-l-4 border-l-teal-500"
                              >
                                <CardHeader className="px-2 py-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 flex-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleDomain(domain.id)}
                                        className="p-1 h-6 w-6"
                                      >
                                        {isDomainExpanded ? (
                                          <ChevronDown className="h-4 w-4" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4" />
                                        )}
                                      </Button>
                                      <Layers className="h-4 w-4 text-teal-600" />
                                      <div>
                                        <h4 className="font-medium text-sm">
                                          {domain.name}
                                        </h4>
                                        {domain.description && (
                                          <p className="text-xs text-gray-600">
                                            {domain.description}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedDomainId(domain.id);
                                          setEditingProgram(null);
                                          setIsProgramModalOpen(true);
                                        }}
                                        className="h-7 w-7 p-0"
                                      >
                                        <Plus className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </CardHeader>

                                {isDomainExpanded &&
                                  domainPrograms.length > 0 && (
                                    <CardContent className="pl-8">
                                      {domainPrograms.map((program) => (
                                        <div
                                          key={program.id}
                                          className="flex items-center gap-2 p-2 bg-gray-50 rounded mb-1"
                                        >
                                          <ListChecks className="h-4 w-4 text-green-600" />
                                          <span className="text-sm font-medium">
                                            {program.name}
                                          </span>
                                        </div>
                                      ))}
                                    </CardContent>
                                  )}
                              </Card>
                            );
                          })}
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Module Modal */}
      <AddItemModal
        isOpen={isModuleModalOpen}
        onClose={() => {
          setIsModuleModalOpen(false);
          setEditingModule(null);
        }}
        onSave={editingModule ? handleEditModule : handleAddModule}
        title={editingModule ? "Edit Module" : "Add Module"}
        editingItem={editingModule}
      />

      {/* Domain Modal */}
      <AddItemModal
        isOpen={isDomainModalOpen}
        onClose={() => {
          setIsDomainModalOpen(false);
          setEditingDomain(null);
        }}
        onSave={handleAddDomain}
        title={editingDomain ? "Edit Domain" : "Add Domain"}
        editingItem={editingDomain}
      />

      {/* Program Modal */}
      <AddItemModal
        isOpen={isProgramModalOpen}
        onClose={() => {
          setIsProgramModalOpen(false);
          setEditingProgram(null);
        }}
        onSave={handleAddProgram}
        title={editingProgram ? "Edit Program" : "Add Program"}
        editingItem={editingProgram}
      />
    </>
  );
}

// Reusable Add/Edit Item Modal
function AddItemModal({ isOpen, onClose, onSave, title, editingItem }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name || "");
      setDescription(editingItem.description || "");
    } else {
      setName("");
      setDescription("");
    }
  }, [editingItem, isOpen]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    setLoading(true);
    try {
      if (editingItem) {
        await onSave({
          ...editingItem,
          name: name.trim(),
          description: description.trim(),
        });
      } else {
        await onSave({ name: name.trim(), description: description.trim() });
      }
      setName("");
      setDescription("");
    } catch (error) {
      console.error("Error saving:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="Enter name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Enter description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              rows={3}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {loading ? "Saving..." : editingItem ? "Update" : "Add"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
