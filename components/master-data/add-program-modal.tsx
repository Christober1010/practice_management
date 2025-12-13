"use client";

import React, { useEffect, useState } from "react";
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

function generateId() {
  return `program_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

interface AddProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (program: any) => Promise<void>;
  onEdit: (program: any) => Promise<void>;
  domains?: any[];
  modules?: any[];
  clients?: any[];
  loading?: boolean;
  editingProgram?: any | null;
}

export default function AddProgramModal({
  isOpen,
  onClose,
  onAdd,
  onEdit,
  domains = [],
  modules = [],
  clients = [],
  loading = false,
  editingProgram = null,
}: AddProgramModalProps) {
  const isEditing = !!editingProgram;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [domainId, setDomainId] = useState("");
  const [status, setStatus] = useState("Active");
  const [selectedClientValue, setSelectedClientValue] = useState("generic");
  const [domainSearch, setDomainSearch] = useState("");

  // Safe way to get module/domain name
  const getModuleName = (mod) => {
    return mod?.name || mod?.NAME || "Unnamed Module";
  };

  const getDomainName = (dom) => {
    return dom?.name || dom?.NAME || "Unnamed Domain";
  };

  // Find selected client
  const selectedClientObj =
    selectedClientValue === "generic"
      ? null
      : clients.find((c) => String(c.id) === String(selectedClientValue)) || null;

  // Reset / fill form
  useEffect(() => {
    if (isEditing && editingProgram) {
      setName(editingProgram.name || "");
      setDescription(editingProgram.description || "");
      setStatus(editingProgram.status || "Active");

      const domId = editingProgram.domainId || editingProgram.domain_id || "";
      setDomainId(String(domId));

      setSelectedClientValue(editingProgram.client_id ? String(editingProgram.client_id) : "generic");
    } else {
      setName("");
      setDescription("");
      setDomainId("");
      setStatus("Active");
      setDomainSearch("");
      
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
      } else {
        setSelectedClientValue("generic");
      }
    }
  }, [editingProgram, isEditing, isOpen, clients]);

  const selectedDomain = domains.find((d) => String(d.id) === String(domainId));
  const selectedModule = modules.find(
    (m) => String(m.id) === String(selectedDomain?.moduleId || selectedDomain?.module_id)
  );
  const selectedDomainName = selectedDomain ? getDomainName(selectedDomain) : "";
  const selectedModuleName = selectedModule ? getModuleName(selectedModule) : "";

  // SAFE filtering + sorting
  const filteredDomains = domains
    .filter((d) => d.id != null && String(d.id).trim() !== "")
    .filter((d) => {
      const search = domainSearch.toLowerCase();
      const moduleName = getModuleName(
        modules.find((m) => String(m.id) === String(d.moduleId || d.module_id))
      ).toLowerCase();
      const domainName = getDomainName(d).toLowerCase();
      const label = `${moduleName} - ${domainName}`;
      return label.includes(search);
    })
    .sort((a, b) => {
      const moduleA = getModuleName(
        modules.find((m) => String(m.id) === String(a.moduleId || a.module_id))
      );
      const moduleB = getModuleName(
        modules.find((m) => String(m.id) === String(b.moduleId || b.module_id))
      );
      const moduleCompare = moduleA.localeCompare(moduleB);
      if (moduleCompare !== 0) return moduleCompare;
      return getDomainName(a).localeCompare(getDomainName(b));
    });

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

    const payload = {
      id: editingProgram?.id || generateId(),
      name: name.trim(),
      description: description.trim(),
      domainId: domainId,
      status: status,
      archived: 0,
      ...(selectedClientValue !== "generic"
        ? { client_id: selectedClientObj?.id || selectedClientValue }
        : {}),
    };

    try {
      if (isEditing) {
        await onEdit(payload);
      } else {
        await onAdd(payload);
      }
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save program");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-center">
            <div className="text-lg font-semibold">
              {isEditing ? "Edit Program" : "Add New Program"}
            </div>
            {selectedModule && selectedDomain && (
              <div className="flex items-center justify-center gap-2 mt-3 text-sm text-muted-foreground">
                <span className="font-medium">{selectedModuleName}</span>
                <ChevronRight className="h-4 w-4" />
                <span className="font-medium">{selectedDomainName}</span>
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

          {/* Domain Selector */}
          <div className="space-y-2">
            <Label>Domain *</Label>
            <Select value={domainId} onValueChange={setDomainId} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a domain">
                  {selectedModuleName && selectedDomainName
                    ? `${selectedModuleName} - ${selectedDomainName}`
                    : "Select a domain"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <div className="p-2 sticky top-0 bg-white border-b z-10">
                  <Input
                    placeholder="Search domains..."
                    value={domainSearch}
                    onChange={(e) => setDomainSearch(e.target.value)}
                    className="h-8"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {filteredDomains.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No domains found
                  </div>
                ) : (
                  filteredDomains
                    .filter((dom) => dom.id != null && String(dom.id).trim() !== "")
                    .map((dom) => {
                      const mod = modules.find((m) => String(m.id) === String(dom.moduleId || dom.module_id));
                      const modName = mod ? getModuleName(mod) : "";
                      const label = `${modName} - ${getDomainName(dom)}`;
                      return (
                        <SelectItem key={dom.id} value={String(dom.id)}>
                          {label}
                        </SelectItem>
                      );
                    })
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Program Name */}
          <div className="space-y-2">
            <Label>Program Name *</Label>
            <Input
              placeholder="e.g., Matching Objects"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              placeholder="Brief description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={loading}
            />
          </div>

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
              {loading ? "Saving..." : isEditing ? "Update Program" : "Add Program"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
