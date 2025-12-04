"use client";

import type React from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronRight } from "lucide-react";
import toast from "react-hot-toast";

interface Domain {
  id?: number | string;
  name: string;
  description: string;
  moduleId?: string | number;
  module_id?: string | number; // Database format
  status?: string;
  STATUS?: string; // Database format
  archived?: number | boolean;
}

interface AddDomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (domain: Domain) => Promise<void>;
  onEdit?: (domain: Domain) => Promise<void>;
  modules: any[];
  loading?: boolean;
  editingDomain?: Domain | null;
}

function generateUUID(): string {
  return `${Math.random().toString(16).slice(2)}${Math.random()
    .toString(16)
    .slice(2)}-${Date.now().toString(16)}`;
}

export default function AddDomainModal({
  isOpen,
  onClose,
  onAdd,
  onEdit,
  modules,
  loading = false,
  editingDomain = null,
}: AddDomainModalProps) {
  const isEditing = !!editingDomain;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [status, setStatus] = useState("Active");
  const [moduleSearch, setModuleSearch] = useState("");

  const selectedModule = modules.find(
    (mod) => String(mod.id) === String(moduleId)
  );

  // Pre-fill form when editing
  useEffect(() => {
    if (isEditing && editingDomain) {
      console.log("Editing domain:", editingDomain);
      setName(editingDomain.name || "");
      setDescription(editingDomain.description || "");
      // CRITICAL FIX: Handle both module_id and moduleId formats
      const modId = editingDomain.module_id || editingDomain.moduleId;
      console.log("Module ID from domain:", modId);
      setModuleId(modId ? String(modId) : "");
      setStatus(editingDomain.STATUS || editingDomain.status || "Active");
    } else {
      // Reset for "Add" mode
      setName("");
      setDescription("");
      setModuleId("");
      setStatus("Active");
    }
  }, [editingDomain, isEditing, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Domain name is required");
      return;
    }

    if (!moduleId || moduleId === "" || moduleId === "0") {
      toast.error("Please select a module");
      return;
    }

    console.log("ModuleId value before submission:", moduleId);

    const domainData: Domain = {
      id: isEditing && editingDomain?.id ? editingDomain.id : generateUUID(),
      name: name.trim(),
      description: description.trim(),
      moduleId: moduleId,
      status,
      archived: 0,
    };

    console.log("Submitting domain data:", domainData);

    try {
      if (isEditing && onEdit && editingDomain?.id) {
        await onEdit({
          ...domainData,
        });
        toast.success("done");
      } else {
        await onAdd(domainData);
      }
      // Reset form
      setName("");
      setDescription("");
      setModuleId("");
      setStatus("Active");
      onClose();
    } catch (error) {
      console.error("Error saving domain:", error);
      toast.error(`Failed to ${isEditing ? "update" : "add"} domain`);
    }
  };
  const sortedFilteredModules = [...modules] // clone first
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((m) => m.name.toLowerCase().includes(moduleSearch.toLowerCase()));
  const selectedModuleName = modules.find(
    (m) => String(m.id) === String(moduleId)
  )?.name;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex flex-col items-center text-center">
            <span className="text-lg font-semibold">
              {isEditing ? "Edit Domain" : "Add Domain"}
            </span>
            {selectedModule && (
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <span className="font-medium">{selectedModule.name}</span>
                {name && (
                  <>
                    <ChevronRight size={18} className="text-muted-foreground" />
                    <span className="font-medium truncate max-w-[180px]">
                      {name}
                    </span>
                  </>
                )}
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Module Selection */}
          <div className="space-y-2">
            <Label htmlFor="module-select">Module *</Label>
            <Select
              value={moduleId}
              onValueChange={setModuleId}
              disabled={loading}
            >
              <SelectTrigger id="module-select">
                <SelectValue placeholder="Choose a module">
                  {" "}
                  {selectedModuleName}
                </SelectValue>
              </SelectTrigger>

              <SelectContent>
                <div className="px-2 py-2 sticky top-0 bg-white z-10">
                  <Input
                    placeholder="Search modules..."
                    value={moduleSearch}
                    onChange={(e) => setModuleSearch(e.target.value)}
                    className="h-8"
                  />
                </div>

                {sortedFilteredModules.length > 0 ? (
                  sortedFilteredModules.map((module) => (
                    <SelectItem key={module.id} value={String(module.id)}>
                      {module.name}
                    </SelectItem>
                  ))
                ) : (
                  <div className="py-2 px-3 text-sm text-muted-foreground">
                    No modules found
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Domain Name */}
          <div className="space-y-2">
            <Label htmlFor="domain-name">Domain Name *</Label>
            <Input
              id="domain-name"
              placeholder="e.g., Communication Skills"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="domain-description">Description (optional)</Label>
            <Textarea
              id="domain-description"
              placeholder="Brief description of this domain"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              rows={3}
            />
          </div>

          {/* Status */}
          {isEditing && (
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={status}
                onValueChange={setStatus}
                disabled={loading}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {loading
                ? "Saving..."
                : isEditing
                ? "Update Domain"
                : "Add Domain"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
