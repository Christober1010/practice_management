"use client";

import React, { useEffect, useState, useMemo } from "react";
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
import {
  ArrowRight,
  Badge,
  ChevronRight,
  Edit,
  ListChecks,
  Plus,
} from "lucide-react";
import toast from "react-hot-toast";
import { Card, CardContent, CardHeader } from "../ui/card";

export function ProgramsListModal({
  isOpen,
  onClose,
  clientId,
  clientName,
  programs,
  domains,
  modules,
  loading,
  onReload, // call fetchPrograms again after save/delete
  onAddProgram, // wraps handleAddProgram
  onEditProgram, // wraps handleEditProgram
}) {
  const [isProgramFormOpen, setIsProgramFormOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);

  const openAdd = () => {
    setEditingProgram(null);
    setIsProgramFormOpen(true);
  };

  const openEdit = (program) => {
    setEditingProgram(program);
    setIsProgramFormOpen(true);
  };

  const handleProgramSaved = async (payload, isEdit) => {
    if (isEdit) {
      await onEditProgram(payload);
    } else {
      await onAddProgram(payload);
    }
    await onReload();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <ListChecks className="h-6 w-6 text-teal-600" />
              Programs for {clientName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Button onClick={openAdd} className="bg-teal-600 hover:bg-teal-700">
              <Plus className="h-4 w-4 mr-2" /> Add Program
            </Button>

            {loading ? (
              <p className="text-center py-8 text-gray-500">Loading...</p>
            ) : programs.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <ListChecks className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p>No programs yet. Create one!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {programs.filter(Boolean).map((program) => {
                  const domain = domains.find(
                    (d) => String(d.id) === String(program.domain_id)
                  );
                  const module = modules.find(
                    (m) => m.id === domain?.module_id
                  );

                  return (
                    <Card
                      key={program.id}
                      className="border-l-4 border-l-teal-500"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">
                              {program.name}
                            </h3>
                            {program.description && (
                              <p className="text-sm text-gray-600 mt-1">
                                {program.description}
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
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(program)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {/* Optional delete button if you have API */}
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

      <ClientProgramModal
        isOpen={isProgramFormOpen}
        onClose={() => {
          setIsProgramFormOpen(false);
          setEditingProgram(null);
        }}
        onAdd={(payload) => handleProgramSaved(payload, false)}
        onEdit={(payload) => handleProgramSaved(payload, true)}
        clientId={clientId}
        clientName={clientName}
        domains={domains}
        modules={modules}
        loading={loading}
        editingProgram={editingProgram}
      />
    </>
  );
}

export default function ClientProgramModal({
  isOpen,
  onClose,
  onAdd,
  onEdit,
  clientId,
  clientName,
  domains = [],
  modules = [],
  loading = false,
  editingProgram,
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [domainId, setDomainId] = useState("");
  const [domainSearch, setDomainSearch] = useState("");

  const isEditMode = !!editingProgram;

  // Normalize API data to consistent lowercase keys
  const normalizedDomains = useMemo(() => {
    return domains.map((d) => ({
      id: d.id || d.ID,
      name: d.NAME || d.name || "Unnamed Domain",
      module_id: d.module_id || d.moduleId,
      description: d.description || d.DESCRIPTION || "",
    }));
  }, [domains]);

  const normalizedModules = useMemo(() => {
    return modules.map((m) => ({
      id: m.id || m.ID,
      name: m.NAME || m.name || "Unnamed Module",
      description: m.description || m.DESCRIPTION || "",
    }));
  }, [modules]);

  // Reset form when modal opens/closes or editing changes
  useEffect(() => {
    if (isOpen) {
      if (editingProgram) {
        setName(editingProgram.name || "");
        setDescription(editingProgram.description || "");
        setDomainId(editingProgram.domain_id || editingProgram.domainId || "");
      } else {
        setName("");
        setDescription("");
        setDomainId("");
        setDomainSearch("");
      }
    }
  }, [editingProgram, isOpen]);

  // Find selected domain and its module
  const selectedDomain = normalizedDomains.find(
    (d) => String(d.id) === String(domainId)
  );
  const selectedModule = normalizedModules.find(
    (m) => m.id === selectedDomain?.module_id
  );

  // Filter and sort domains with search
  const filteredDomains = useMemo(() => {
    return normalizedDomains
      .filter((domain) => {
        if (!domain.id) return false;
        const module = normalizedModules.find((m) => m.id === domain.module_id);
        const moduleName = module?.name || "";
        const domainName = domain.name || "";
        const fullLabel = `${moduleName} - ${domainName}`.toLowerCase();
        const search = domainSearch.toLowerCase();
        return fullLabel.includes(search);
      })
      .sort((a, b) => {
        const moduleA =
          normalizedModules.find((m) => m.id === a.module_id)?.name || "";
        const moduleB =
          normalizedModules.find((m) => m.id === b.module_id)?.name || "";
        if (moduleA !== moduleB) return moduleA.localeCompare(moduleB);
        return a.name.localeCompare(b.name);
      });
  }, [normalizedDomains, normalizedModules, domainSearch]);

  const selectedDomainLabel = selectedDomain
    ? `${selectedModule?.name || "Unknown Module"} - ${selectedDomain.name}`
    : "Select a domain";

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Program name is required");
      return;
    }
    if (!domainId) {
      toast.error("Please select a domain");
      return;
    }

    try {
      const programData = {
        id: isEditMode ? editingProgram.id : `program_${Date.now()}`,
        name: name.trim(),
        description: description.trim(),
        domain_id: domainId,
        status: "Active",
        archived: 0,
      };

      if (isEditMode) {
        // For edit, send root client_id + programs array with one element
        await onEdit({
          client_id: clientId,
          programs: [{ ...editingProgram, ...programData }],
        });
      } else {
        // For add, send root client_id + programs array with new program
        await onAdd({
          client_id: clientId,
          programs: [programData],
        });
      }

      toast.success(isEditMode ? "Program updated!" : "Program added!");
      onClose();
    } catch (error) {
      console.error("Error saving program:", error);
      toast.error("Failed to save program");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2 mb-3">
              <ListChecks size={24} className="text-blue-600" />
              <span className="text-xl font-semibold">
                {isEditMode ? "Edit Program" : "Add New Program"}
              </span>
            </div>

            {/* Breadcrumb */}
            {clientName && selectedModule && selectedDomain && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap justify-center mt-2">
                <span className="font-medium">{clientName}</span>
                <ChevronRight size={16} />
                <span className="font-medium text-blue-600">
                  {selectedModule.name}
                </span>
                <ChevronRight size={16} />
                <span className="font-medium text-teal-600">
                  {selectedDomain.name}
                </span>
                {name && (
                  <>
                    <ChevronRight size={16} />
                    <span className="font-medium text-teal-600">{name}</span>
                  </>
                )}
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* Domain Selection */}
          <div className="space-y-2">
            <Label htmlFor="domain-select">Domain *</Label>
            <Select
              value={domainId}
              onValueChange={(value) => {
                setDomainId(value);
                setDomainSearch("");
              }}
              disabled={loading}
            >
              <SelectTrigger id="domain-select">
                <SelectValue placeholder="Choose a domain">
                  {domainId ? selectedDomainLabel : "Select a domain"}
                </SelectValue>
              </SelectTrigger>

              <SelectContent className="max-h-96">
                <div className="sticky top-0 z-10 bg-white border-b px-2 py-2">
                  <Input
                    placeholder="Search domains..."
                    value={domainSearch}
                    onChange={(e) => setDomainSearch(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="h-9 text-sm"
                    autoFocus={false}
                  />
                </div>

                {filteredDomains.length > 0 ? (
                  filteredDomains.map((domain) => {
                    const module = normalizedModules.find(
                      (m) => m.id === domain.module_id
                    );
                    const displayLabel = `${module?.name || "No Module"} - ${
                      domain.name
                    }`;
                    return (
                      <SelectItem
                        key={domain.id}
                        value={String(domain.id)}
                        className="cursor-pointer"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{domain.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {module?.name || "Unknown Module"}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    {domainSearch
                      ? "No domains match your search"
                      : "No domains available"}
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Program Name */}
          <div className="space-y-2">
            <Label htmlFor="program-name">Program Name *</Label>
            <Input
              id="program-name"
              placeholder="e.g., Matching, Receptive ID, Manding"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="program-description">Description (Optional)</Label>
            <Textarea
              id="program-description"
              placeholder="Add any notes or goals for this program..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              rows={3}
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>Saving...</>
              ) : isEditMode ? (
                "Save Changes"
              ) : (
                "Add Program"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
