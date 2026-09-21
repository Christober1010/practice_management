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
import toast from "react-hot-toast";
import {
  DEFAULT_DOMAIN_MODULE_KEY,
  DOMAIN_MODULE_OPTIONS,
  inferDomainModuleKey,
  resolveModuleIdForDomain,
} from "@/lib/domain-module-options";
import {
  normalizeAssignedClientIds,
  pendingMasterDataClientIds,
} from "@/lib/master-data-client-scope";
import ClientAssignMultiSelect from "@/components/master-data/client-assign-multi-select";

function generateId() {
  return `domain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default function AddDomainModal({
  isOpen,
  onClose,
  onAdd,
  modules = [], // Keep for backward compatibility but not used
  clients = [],
  loading = false,
  editingDomain = null,
}) {
  const isEditing = !!editingDomain;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("Active");
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [moduleKey, setModuleKey] = useState(DEFAULT_DOMAIN_MODULE_KEY);

  // Reset / fill form
  useEffect(() => {
    if (isEditing && editingDomain) {
      setName(editingDomain.name || "");
      setDescription(editingDomain.description || "");
      setStatus(editingDomain.status || "Active");
      setModuleKey(
        inferDomainModuleKey(
          modules,
          editingDomain.moduleId || editingDomain.module_id
        )
      );

      setSelectedClientIds(normalizeAssignedClientIds(editingDomain));
    } else {
      setName("");
      setDescription("");
      setStatus("Active");
      setModuleKey(DEFAULT_DOMAIN_MODULE_KEY);
      setSelectedClientIds(isOpen ? pendingMasterDataClientIds(clients) : []);
    }
  }, [editingDomain, isEditing, isOpen, clients, modules]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Domain name is required");
      return;
    }

    const moduleId = resolveModuleIdForDomain(modules, moduleKey);
    if (!moduleId) {
      toast.error("Please select a module");
      return;
    }

    const payload = {
      id: editingDomain?.rawId || editingDomain?.id || generateId(),
      name: name.trim(),
      description: description.trim(),
      status: status,
      archived: 0,
      moduleId,
      module_id: moduleId,
      client_ids: selectedClientIds,
      ...(selectedClientIds.length === 1 ? { client_id: selectedClientIds[0] } : {}),
    };

    try {
      await onAdd(payload);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save domain");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-center">
            <div className="text-lg font-semibold">
              {isEditing ? "Edit Domain" : "Add New Domain"}
            </div>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Module (parent of domain) */}
          <div className="space-y-2">
            <Label>Module *</Label>
            <Select value={moduleKey} onValueChange={setModuleKey} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder="Select module" />
              </SelectTrigger>
              <SelectContent>
                {DOMAIN_MODULE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ClientAssignMultiSelect
            clients={clients}
            selectedIds={selectedClientIds}
            onChange={setSelectedClientIds}
            disabled={loading}
          />

          {/* Domain Name */}
          <div className="space-y-2">
            <Label>Domain Name *</Label>
            <Input
              placeholder="e.g., Receptive Language"
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
              {loading ? "Saving..." : isEditing ? "Update Domain" : "Add Domain"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}