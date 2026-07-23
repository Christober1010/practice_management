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
  const [selectedClientValue, setSelectedClientValue] = useState("generic");
  const [moduleKey, setModuleKey] = useState(DEFAULT_DOMAIN_MODULE_KEY);

  // Find selected client
  const selectedClientObj =
    selectedClientValue === "generic"
      ? null
      : clients.find((c) => String(c.id) === String(selectedClientValue)) || null;

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

      setSelectedClientValue(editingDomain.client_id ? String(editingDomain.client_id) : "generic");
    } else {
      setName("");
      setDescription("");
      setStatus("Active");
      setModuleKey(DEFAULT_DOMAIN_MODULE_KEY);
      
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
      ...(selectedClientValue !== "generic"
        ? { client_id: selectedClientObj?.id || selectedClientValue }
        : {}),
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
                {clients.map((client) => {
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
              </div>
            )}
          </div>

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