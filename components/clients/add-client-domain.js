"use client";

import { mahaverseFetch } from "@/lib/mahaverse-api";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, Edit, Trash2, Layers } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_DOMAIN_MODULE_KEY,
  DOMAIN_MODULE_OPTIONS,
  inferDomainModuleKey,
  resolveModuleIdForDomain,
} from "@/lib/domain-module-options";

const generateUUID = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

export default function DomainsListModal({
  isOpen,
  onClose,
  clientId,
  clientName,
}) {
  const [domains, setDomains] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isDomainFormOpen, setIsDomainFormOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState(null);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost";

  useEffect(() => {
    if (isOpen && clientId) {
      fetchDomains();
      fetchModules();
    }
  }, [isOpen, clientId]);

  const fetchDomains = async () => {
    setLoading(true);
    try {
      const response = await mahaverseFetch(`/client-modules.php?client_id=${clientId}`
      );
      const result = await response.json();

      if (result.success && result.data.domains) {
        setDomains(result.data.domains);
      }
    } catch (error) {
      toast.error("Failed to load domains");
    } finally {
      setLoading(false);
    }
  };

  const fetchModules = async () => {
    try {
      const response = await mahaverseFetch(`/client-modules.php?client_id=${clientId}`
      );
      const result = await response.json();

      if (result.success && result.data.modules) {
        setModules(result.data.modules);
      }
    } catch (error) {
      console.error("Failed to load modules:", error);
    }
  };
  const handleAddDomain = () => {
    setEditingDomain(null);
    setIsDomainFormOpen(true);
  };

  const handleSaveDomain = async (domainData) => {
    const payload = editingDomain
      ? { ...editingDomain, ...domainData }
      : {
          id: generateUUID(),
          ...domainData,
          status: "Active",
          archived: false,
        };

    try {
      const res = await mahaverseFetch('/client-modules.php', {
        method: editingDomain ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          domains: [payload],
        }),
      });
      const json = await res.json();
      if (json.success) {
        setDomains((prev) =>
          editingDomain
            ? prev.map((d) => (d.id === payload.id ? payload : d))
            : [...prev, payload]
        );
        toast.success(editingDomain ? "Domain updated" : "Domain added");
        setIsDomainFormOpen(false);
        setEditingDomain(null);
      }
    } catch (err) {
      toast.error("Failed to save domain");
    }
  };

  const handleDeleteDomain = async (domainId) => {
    if (!confirm("Are you sure you want to delete this domain?")) return;

    try {
      const res = await mahaverseFetch('/client-modules.php', {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          domainId,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setDomains((prev) => prev.filter((d) => d.id !== domainId));
        toast.success("Domain deleted");
      }
    } catch (err) {
      toast.error("Failed to delete domain");
    }
  };

  return (
    <>
      <Toaster />
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Layers className="h-6 w-6 text-teal-600" />
              Domains for {clientName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Button
              onClick={handleAddDomain}
              className="bg-teal-600 hover:bg-teal-700"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Domain
            </Button>

            {loading ? (
              <p className="text-center py-8 text-gray-500">Loading...</p>
            ) : domains.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Layers className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p>No domains yet. Create one!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {domains.map((domain) => {
                  return (
                    <Card
                      key={domain.id}
                      className="border-l-4 border-l-teal-500"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">
                              {domain.name}
                            </h3>
                            {domain.description && (
                              <p className="text-sm text-gray-600 mt-1">
                                {domain.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingDomain(domain);
                                setIsDomainFormOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteDomain(domain.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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

      {/* Domain Form Modal */}
      <DomainFormModal
        isOpen={isDomainFormOpen}
        onClose={() => {
          setIsDomainFormOpen(false);
          setEditingDomain(null);
        }}
        onSave={handleSaveDomain}
        modules={modules}
        editingDomain={editingDomain}
      />
    </>
  );
}

export function DomainFormModal({
  isOpen,
  onClose,
  onSave,
  modules = [],
  editingDomain,
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [moduleKey, setModuleKey] = useState(DEFAULT_DOMAIN_MODULE_KEY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingDomain) {
      setName(editingDomain.name || "");
      setDescription(editingDomain.description || "");
      setModuleKey(
        inferDomainModuleKey(
          modules,
          editingDomain.moduleId || editingDomain.module_id
        )
      );
    } else {
      setName("");
      setDescription("");
      setModuleKey(DEFAULT_DOMAIN_MODULE_KEY);
    }
  }, [editingDomain, isOpen, modules]);

  const handleSubmit = async () => {
    if (!name.trim()) return toast.error("Name is required");

    const moduleId = resolveModuleIdForDomain(modules, moduleKey);
    if (!moduleId) return toast.error("Please select a module");

    setLoading(true);
    await onSave({
      name: name.trim(),
      description: description.trim(),
      moduleId,
      module_id: moduleId,
    });
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingDomain ? "Edit Domain" : "Add Domain"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Module *</Label>
            <Select value={moduleKey} onValueChange={setModuleKey}>
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

          <div>
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {loading ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
