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
import {
  getDomainModuleLabel,
  mergeCanonicalDomainModules,
} from "@/lib/domain-module-options";
import {
  filterMasterDataForClientScope,
  findClientByValue,
  resolveClientRecordId,
} from "@/lib/master-data-client-scope";

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

  const modulesForLookup = mergeCanonicalDomainModules(modules);

  const getDomainName = (dom) => {
    return dom?.name || dom?.NAME || "Unnamed Domain";
  };

  // Find selected client
  const selectedClientObj = findClientByValue(clients, selectedClientValue);

  const selectedClientId =
    selectedClientValue === "generic"
      ? ""
      : resolveClientRecordId(selectedClientObj) || String(selectedClientValue).trim();

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
            setSelectedClientValue(
              resolveClientRecordId(foundClient) || String(foundClient.id ?? foundClient.name)
            );
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

  // Client selected → only that client's domains; generic → master domains only
  const domainsForClient = filterMasterDataForClientScope(domains, {
    clientId: selectedClientId,
    isGeneric: selectedClientValue === "generic",
    keepId: domainId,
  });

  useEffect(() => {
    if (!domainId) return;
    const stillValid = domainsForClient.some((d) => String(d.id) === String(domainId));
    if (!stillValid) setDomainId("");
  }, [selectedClientValue, selectedClientId, domains, domainId]);

  const selectedDomain = domainsForClient.find((d) => String(d.id) === String(domainId));
  const selectedDomainName = selectedDomain ? getDomainName(selectedDomain) : "";
  const selectedModuleName = selectedDomain
    ? getDomainModuleLabel(
        modulesForLookup,
        selectedDomain.moduleId || selectedDomain.module_id
      )
    : "";

  // SAFE filtering + sorting (scoped to client or generic)
  const filteredDomains = domainsForClient
    .filter((d) => {
      const search = domainSearch.toLowerCase();
      const moduleName = getDomainModuleLabel(
        modulesForLookup,
        d.moduleId || d.module_id
      ).toLowerCase();
      const domainName = getDomainName(d).toLowerCase();
      const label = `${moduleName} - ${domainName}`;
      return label.includes(search);
    })
    .sort((a, b) => {
      const moduleA = getDomainModuleLabel(
        modulesForLookup,
        a.moduleId || a.module_id
      );
      const moduleB = getDomainModuleLabel(
        modulesForLookup,
        b.moduleId || b.module_id
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
        ? {
            client_id:
              resolveClientRecordId(selectedClientObj) || selectedClientValue,
          }
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
            {selectedDomain && selectedModuleName !== "—" && (
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
              onValueChange={(val) => {
                setSelectedClientValue(val === "generic" ? "generic" : val);
                setDomainSearch("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Generic (no client)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="generic">Generic (no client)</SelectItem>
                {clients
                  .map((client) => {
                    const cid = resolveClientRecordId(client);
                    if (!cid) return null;
                    const displayName =
                      `${client.first_name || ""} ${client.last_name || ""}`.trim() ||
                      client.name ||
                      client.NAME ||
                      "Unnamed Client";
                    return (
                      <SelectItem key={cid} value={cid}>
                        {displayName}
                      </SelectItem>
                    );
                  })
                  .filter(Boolean)}
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

          {/* Domain Selector */}
          <div className="space-y-2">
            <Label>Domain *</Label>
            {selectedClientId ? (
              <p className="text-xs text-slate-500">
                Showing domains assigned to this client only.
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Showing generic (master) domains only.
              </p>
            )}
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
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    {selectedClientId
                      ? "No domains for this client. Add a domain under Domains with this client selected."
                      : "No generic domains found. Add a master domain or assign a client."}
                  </div>
                ) : (
                  filteredDomains
                    .filter((dom) => dom.id != null && String(dom.id).trim() !== "")
                    .map((dom) => {
                      const modName = getDomainModuleLabel(
                        modulesForLookup,
                        dom.moduleId || dom.module_id
                      );
                      const label = `${modName !== "—" ? modName : "—"} - ${getDomainName(dom)}`;
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
