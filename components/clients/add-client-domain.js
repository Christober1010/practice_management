"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Edit, Archive, ArchiveRestore, Layers } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import {
  DEFAULT_DOMAIN_MODULE_KEY,
  getDomainModuleLabel,
} from "@/lib/domain-module-options";
import AddDomainModal from "@/components/master-data/add-domain-modal";
import { mahaverseFetch } from "@/lib/mahaverse-api";
import { setClientConfigArchived } from "@/lib/client-config-archive";

const generateUUID = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

/** MySQL on some hosts returns NAME/STATUS uppercase — normalize for UI. */
function normalizeDomainRow(d) {
  if (!d || typeof d !== "object") return d;
  const moduleId =
    d.module_id ||
    d.moduleId ||
    d.MODULE_ID ||
    DEFAULT_DOMAIN_MODULE_KEY;
  return {
    ...d,
    id: d.id,
    name: d.name || d.NAME || d.Name || "Unnamed Domain",
    description: d.description || d.DESCRIPTION || "",
    status: d.status || d.STATUS || "Active",
    module_id: moduleId,
    moduleId,
    archived: d.archived === 1 || d.archived === true || d.archived === "1",
  };
}

function normalizeModuleRow(m) {
  if (!m || typeof m !== "object") return m;
  return {
    ...m,
    id: m.id,
    name: m.name || m.NAME || m.Name || "Unnamed Module",
    description: m.description || m.DESCRIPTION || "",
    status: m.status || m.STATUS || "Active",
  };
}

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
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (isOpen && clientId) {
      fetchDomains();
      fetchModules();
    }
  }, [isOpen, clientId]);

  const fetchDomains = async () => {
    setLoading(true);
    try {
      const response = await mahaverseFetch(
        `/client-modules.php?client_id=${clientId}`
      );
      const result = await response.json();

      if (result.success && result.data.domains) {
        setDomains(
          (result.data.domains || []).map(normalizeDomainRow).filter(Boolean)
        );
      }
    } catch (error) {
      toast.error("Failed to load domains");
    } finally {
      setLoading(false);
    }
  };

  const fetchModules = async () => {
    try {
      const response = await mahaverseFetch(
        `/client-modules.php?client_id=${clientId}`
      );
      const result = await response.json();

      if (result.success && result.data.modules) {
        setModules((result.data.modules || []).map(normalizeModuleRow));
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
    const domainRow = {
      id: domainData.id || editingDomain?.id || generateUUID(),
      name: domainData.name,
      description: domainData.description || "",
      status: domainData.status || "Active",
      archived: domainData.archived ?? 0,
      moduleId: domainData.moduleId || domainData.module_id,
      module_id: domainData.module_id || domainData.moduleId,
      client_id: clientId,
    };

    try {
      // POST upsert (PUT domainId path is a different shape) — matches Configure data master list
      const res = await mahaverseFetch("/client-modules.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          domains: [domainRow],
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(editingDomain ? "Domain updated" : "Domain added");
        setIsDomainFormOpen(false);
        setEditingDomain(null);
        await fetchDomains();
        return true;
      }
      toast.error(json.message || "Failed to save domain");
      return false;
    } catch (err) {
      toast.error("Failed to save domain");
      return false;
    }
  };

  const handleToggleArchiveDomain = async (domain) => {
    const archiving = !domain.archived;
    if (
      archiving &&
      !confirm("Archive this domain? You can restore it from Show Archived.")
    ) {
      return;
    }
    const ok = await setClientConfigArchived({
      clientId,
      kind: "domain",
      id: domain.id,
      archived: archiving,
    });
    if (ok) await fetchDomains();
  };

  const visibleDomains = domains.filter((d) => !!d.archived === showArchived);

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
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleAddDomain}
                className="bg-teal-600 hover:bg-teal-700"
              >
                <Plus className="h-4 w-4 mr-2" /> Add Domain
              </Button>
              <Button variant="outline" onClick={() => setShowArchived(!showArchived)}>
                {showArchived ? (
                  <>
                    <ArchiveRestore className="h-4 w-4 mr-2" /> Show Active
                  </>
                ) : (
                  <>
                    <Archive className="h-4 w-4 mr-2" /> Show Archived
                  </>
                )}
              </Button>
            </div>

            {loading ? (
              <p className="text-center py-8 text-gray-500">Loading...</p>
            ) : visibleDomains.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Layers className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p>{showArchived ? "No archived domains." : "No domains yet. Create one!"}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {visibleDomains.map((domain) => {
                  const moduleLabel = getDomainModuleLabel(
                    modules,
                    domain.module_id ||
                      domain.moduleId ||
                      domain.MODULE_ID ||
                      DEFAULT_DOMAIN_MODULE_KEY
                  );
                  const moduleName =
                    moduleLabel && moduleLabel !== "—" ? moduleLabel : null;
                  return (
                    <Card
                      key={domain.id}
                      className="border-l-4 border-l-teal-500 shadow-sm"
                    >
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-base truncate">
                              {domain.name || "Unnamed Domain"}
                            </h3>
                            {domain.description ? (
                              <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                                {domain.description}
                              </p>
                            ) : null}
                            {moduleName ? (
                              <p className="text-xs text-slate-500 mt-1">
                                Module: {moduleName}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
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
                              onClick={() => handleToggleArchiveDomain(domain)}
                              title={domain.archived ? "Restore" : "Archive"}
                              className={
                                domain.archived
                                  ? "text-green-600 hover:text-green-700"
                                  : "text-amber-600 hover:text-amber-700"
                              }
                            >
                              {domain.archived ? (
                                <ArchiveRestore className="h-4 w-4" />
                              ) : (
                                <Archive className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AddDomainModal
        isOpen={isDomainFormOpen}
        onClose={() => {
          setIsDomainFormOpen(false);
          setEditingDomain(null);
        }}
        onAdd={handleSaveDomain}
        modules={modules}
        loading={loading}
        editingDomain={
          editingDomain
            ? { ...editingDomain, client_id: clientId }
            : null
        }
        lockedClientId={clientId ? String(clientId) : ""}
        lockedClientName={clientName || ""}
      />
    </>
  );
}
