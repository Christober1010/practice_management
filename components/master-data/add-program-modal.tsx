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
  normalizeAssignedClientIds,
  pendingMasterDataClientIds,
} from "@/lib/master-data-client-scope";
import ClientAssignMultiSelect from "@/components/master-data/client-assign-multi-select";

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
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [domainSearch, setDomainSearch] = useState("");

  const modulesForLookup = mergeCanonicalDomainModules(modules);

  const getDomainName = (dom) => {
    return dom?.name || dom?.NAME || "Unnamed Domain";
  };

  const selectedClientId =
    selectedClientIds.length === 1 ? selectedClientIds[0] : "";
  const isGenericScope = selectedClientIds.length !== 1;

  // Reset / fill form
  useEffect(() => {
    if (isEditing && editingProgram) {
      setName(editingProgram.name || "");
      setDescription(editingProgram.description || "");
      setStatus(editingProgram.status || "Active");

      const domId = editingProgram.domainId || editingProgram.domain_id || "";
      setDomainId(String(domId));

      setSelectedClientIds(normalizeAssignedClientIds(editingProgram));
    } else {
      setName("");
      setDescription("");
      setDomainId("");
      setStatus("Active");
      setDomainSearch("");
      setSelectedClientIds(isOpen ? pendingMasterDataClientIds(clients) : []);
    }
  }, [editingProgram, isEditing, isOpen, clients]);

  // Client selected → only that client's domains; generic → master domains only
  const domainsForClient = filterMasterDataForClientScope(domains, {
    clientId: selectedClientId,
    isGeneric: isGenericScope,
    keepId: domainId,
  });

  useEffect(() => {
    if (!domainId) return;
    const stillValid = domainsForClient.some((d) => String(d.id) === String(domainId));
    if (!stillValid) setDomainId("");
  }, [selectedClientIds, selectedClientId, domains, domainId]);

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
      client_ids: selectedClientIds,
      ...(selectedClientIds.length === 1 ? { client_id: selectedClientIds[0] } : {}),
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
          <ClientAssignMultiSelect
            clients={clients}
            selectedIds={selectedClientIds}
            onChange={(ids) => {
              setSelectedClientIds(ids);
              setDomainSearch("");
            }}
            disabled={loading}
          />

          {/* Domain Selector */}
          <div className="space-y-2">
            <Label>Domain *</Label>
            {selectedClientId ? (
              <p className="text-xs text-slate-500">
                Showing domains assigned to this client only.
              </p>
            ) : selectedClientIds.length > 1 ? (
              <p className="text-xs text-slate-500">
                Showing generic domains. A copy is created for each selected client.
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
