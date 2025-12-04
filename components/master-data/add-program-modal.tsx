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

interface AddProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (program: any) => Promise<void>;
  onEdit: (program: any) => Promise<void>;
  domains: any[];
  modules: any[];
  loading: boolean;
  editingProgram?: any | null;
}

export default function AddProgramModal({
  isOpen,
  onClose,
  onAdd,
  onEdit,
  domains,
  modules,
  loading,
  editingProgram,
}: AddProgramModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [domainId, setDomainId] = useState("");
  const isEditMode = !!editingProgram;

  // 🔹 Pre-fill fields when editing
  useEffect(() => {
    if (editingProgram) {
      setName(editingProgram.name || "");
      setDescription(editingProgram.description || "");
      setDomainId(
        editingProgram.domainId ? String(editingProgram.domainId) : ""
      );
    } else {
      setName("");
      setDescription("");
      setDomainId("");
    }
  }, [editingProgram]);

  // 🔹 Derive selected domain/module
  const selectedDomain = domains.find((d) => String(d.id) === domainId);
  const selectedModule = modules.find((m) => m.id === selectedDomain?.moduleId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !domainId) {
      toast.error("Program name and domain are required");
      return;
    }

    try {
      if (isEditMode) {
        // 🔸 Update existing program
        const updatedProgram = {
          ...editingProgram,
          name: name.trim(),
          description: description.trim(),
          domainId: domainId,
        };
        await onEdit(updatedProgram);
        // toast.success("Program updated successfully!");
      } else {
        // 🔹 Add new program
        const newProgram = {
          id: `program_${Date.now()}`,
          domainId,
          name: name.trim(),
          description: description.trim(),
          status: "Active",
          archived: 0,
        };
        await onAdd(newProgram);
        // toast.success("Program added successfully!");
      }

      // Reset and close modal
      setName("");
      setDescription("");
      setDomainId("");
      onClose();
    } catch (error) {
      console.error("Error saving program:", error);
      toast.error("Failed to save program");
    }
  };
  const [domainSearch, setDomainSearch] = useState("");
  const selectedDomainObj = domains.find(
    (d) => String(d.id) === String(domainId)
  );

  const selectedDomainLabel = selectedDomainObj
    ? `${
        modules.find((m) => m.id === selectedDomainObj.moduleId)?.name ||
        "Module"
      } - ${selectedDomainObj.name}`
    : "";
  const sortedFilteredDomains = [...domains]
    .filter((d) => d.id && String(d.id).trim() !== "")
    .sort((a, b) => {
      const moduleA = modules.find((m) => m.id === a.moduleId)?.name || "";
      const moduleB = modules.find((m) => m.id === b.moduleId)?.name || "";

      // 🔹 Step 1: Compare modules
      const moduleCompare = moduleA.localeCompare(moduleB);
      if (moduleCompare !== 0) return moduleCompare;

      // 🔹 Step 2: If same module → sort by domain name
      return a.name.localeCompare(b.name);
    })
    .filter((d) => {
      const label = `${
        modules.find((m) => m.id === d.moduleId)?.name || ""
      } - ${d.name}`;
      return label.toLowerCase().includes(domainSearch.toLowerCase());
    });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          {/* ---- Dynamic Title ---- */}
          <DialogTitle className="flex flex-col items-center text-center capitalize">
            <span className="text-lg font-semibold">
              {isEditMode ? "Edit Program" : "Add Program"}
            </span>

            {selectedModule && selectedDomain && (
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <span className="font-medium">{selectedModule.name}</span>
                <ChevronRight size={18} className="text-muted-foreground" />
                <span className="font-medium">{selectedDomain.name}</span>
                {name && (
                  <>
                    <ChevronRight size={18} className="text-muted-foreground" />
                    <span className="font-medium">{name}</span>
                  </>
                )}
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Domain Selection */}
          <div className="space-y-2">
            <Label htmlFor="domain-select">Select Domain</Label>

            <Select
              value={domainId}
              onValueChange={(value) => {
                setDomainId(value);
                setDomainSearch(""); // Clear search on selection
              }}
              disabled={loading}
              >
              <SelectTrigger id="domain-select">
                <SelectValue placeholder="Choose a domain">
                  {selectedDomainLabel}
                </SelectValue>
              </SelectTrigger>

              <SelectContent>
                {/* Search box */}
                <div className="px-2 py-2 sticky top-0 bg-white z-10">
                  <Input
                    placeholder="Search domain..."
                    value={domainSearch}
                    onChange={(e) => setDomainSearch(e.target.value)}
                    className="h-8"
                    onKeyDown={(e) => e.stopPropagation()} // ← FIX
                  />
                </div>

                {/* Domain list */}
                {sortedFilteredDomains.length > 0 ? (
                  sortedFilteredDomains.map((domain) => {
                    const module = modules.find(
                      (m) => m.id === domain.moduleId
                    );
                    const label = `${module?.name} - ${domain.name}`;

                    return (
                      <SelectItem key={domain.id} value={String(domain.id)}>
                        {label}
                      </SelectItem>
                    );
                  })
                ) : (
                  <div className="py-2 px-3 text-sm text-muted-foreground">
                    No domains found
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Program Name */}
          <div className="space-y-2">
            <Label htmlFor="program-name">Program Name</Label>
            <Input
              id="program-name"
              placeholder="Enter program name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Program Description */}
          <div className="space-y-2">
            <Label htmlFor="program-description">Description (optional)</Label>
            <Textarea
              id="program-description"
              placeholder="Enter program description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
          </div>

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
                : "Add Program"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
