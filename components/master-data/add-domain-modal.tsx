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
import { activeClientsForAssign, resolveClientRecordId } from "@/lib/master-data-client-scope";

function generateId() {
  return `domain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const EMPTY_MODULES: any[] = [];
const EMPTY_CLIENTS: any[] = [];

export default function AddDomainModal({
  isOpen,
  onClose,
  onAdd,
  modules = EMPTY_MODULES,
  clients = EMPTY_CLIENTS,
  loading = false,
  editingDomain = null,
  lockedClientId = "",
  lockedClientName = "",
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (domain: any) => Promise<void | boolean>;
  modules?: any[];
  clients?: any[];
  loading?: boolean;
  editingDomain?: any | null;
  lockedClientId?: string;
  lockedClientName?: string;
}) {
  const isEditing = !!editingDomain;
  const isClientLocked = Boolean(lockedClientId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("Active");
  const [selectedClientValue, setSelectedClientValue] = useState("generic");
  const [moduleKey, setModuleKey] = useState(DEFAULT_DOMAIN_MODULE_KEY);

  const selectedClientObj = isClientLocked
    ? clients.find(
        (c) =>
          String(c.id) === String(lockedClientId) ||
          String(c.client_id) === String(lockedClientId)
      ) || {
        id: lockedClientId,
        client_id: lockedClientId,
        first_name: lockedClientName || "",
        last_name: "",
        name: lockedClientName || "",
      }
    : selectedClientValue === "generic"
      ? null
      : clients.find((c) => String(c.id) === String(selectedClientValue)) || null;

  useEffect(() => {
    if (!isOpen) return;
    if (isEditing && editingDomain) {
      setName(editingDomain.name || editingDomain.NAME || "");
      setDescription(editingDomain.description || "");
      setStatus(editingDomain.status || "Active");
      setModuleKey(
        inferDomainModuleKey(
          modules,
          editingDomain.moduleId ||
            editingDomain.module_id ||
            editingDomain.MODULE_ID
        )
      );
      setSelectedClientValue(
        editingDomain.client_id
          ? String(editingDomain.client_id)
          : isClientLocked
            ? String(lockedClientId)
            : "generic"
      );
    } else {
      setName("");
      setDescription("");
      setStatus("Active");
      setModuleKey(DEFAULT_DOMAIN_MODULE_KEY);

      if (isClientLocked) {
        setSelectedClientValue(String(lockedClientId));
      } else {
        const pendingClient = localStorage.getItem("pendingClientForMasterData");
        if (pendingClient) {
          try {
            const clientInfo = JSON.parse(pendingClient);
            const foundClient = clients.find(
              (c) =>
                String(c.id) === String(clientInfo.id) ||
                c.name === clientInfo.name
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingDomain, isEditing, isOpen, isClientLocked, lockedClientId]);

  const handleSubmit = async (e: React.FormEvent) => {
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

    const clientPayload =
      isClientLocked || selectedClientValue !== "generic"
        ? {
            client_id: isClientLocked
              ? lockedClientId
              : resolveClientRecordId(selectedClientObj) ||
                selectedClientObj?.id ||
                selectedClientValue,
          }
        : {};

    const payload = {
      id: editingDomain?.rawId || editingDomain?.id || generateId(),
      name: name.trim(),
      description: description.trim(),
      status,
      archived: 0,
      moduleId,
      module_id: moduleId,
      ...clientPayload,
    };

    try {
      const result = await onAdd(payload);
      if (result === false) return;
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
                  Domain will be saved for this client.
                </p>
              </div>
            ) : (
              <>
                <Select
                  value={
                    selectedClientValue === "generic"
                      ? "generic"
                      : selectedClientValue
                  }
                  onValueChange={(val) =>
                    setSelectedClientValue(val === "generic" ? "generic" : val)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Generic (no client)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="generic">Generic (no client)</SelectItem>
                    {activeClientsForAssign(clients, selectedClientValue).map((client) => {
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
                      {selectedClientObj.first_name || ""}{" "}
                      {selectedClientObj.last_name || ""}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

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
