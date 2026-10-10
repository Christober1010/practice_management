"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  Edit,
  ListChecks,
  Plus,
} from "lucide-react";
import toast from "react-hot-toast";
import { Card, CardContent, CardHeader } from "../ui/card";
import { isRowArchived, setClientConfigArchived } from "@/lib/client-config-archive";
import {
  DEFAULT_DOMAIN_MODULE_KEY,
  getDomainModuleLabel,
} from "@/lib/domain-module-options";
import AddProgramModal from "@/components/master-data/add-program-modal";

function normalizeProgramRow(p, clientId) {
  if (!p || typeof p !== "object") return p;
  return {
    id: p.id,
    name: p.NAME || p.name || "Unnamed Program",
    description: p.description || p.DESCRIPTION || "",
    domain_id: p.domain_id || p.domainId,
    domainId: p.domainId || p.domain_id,
    status: p.status || p.STATUS || "Active",
    archived: p.archived === 1 || p.archived === true || p.archived === "1",
    client_id: p.client_id || clientId,
  };
}

export function ProgramsListModal({
  isOpen,
  onClose,
  clientId,
  clientName,
  programs,
  domains,
  modules,
  loading,
  onReload,
  onAddProgram,
  onEditProgram,
}) {
  const [isProgramFormOpen, setIsProgramFormOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const openAdd = () => {
    setEditingProgram(null);
    setIsProgramFormOpen(true);
  };

  const openEdit = (program) => {
    setEditingProgram(normalizeProgramRow(program, clientId));
    setIsProgramFormOpen(true);
  };

  const handleProgramSaved = async (program, isEdit) => {
    const ok = isEdit
      ? await onEditProgram(program)
      : await onAddProgram(program);
    if (ok === false) return false;
    await onReload();
    return true;
  };

  const handleToggleArchiveProgram = async (program) => {
    const archiving = !isRowArchived(program);
    if (
      archiving &&
      !confirm("Archive this program? You can restore it from Show Archived.")
    ) {
      return;
    }
    const ok = await setClientConfigArchived({
      clientId,
      kind: "program",
      id: program.id,
      archived: archiving,
    });
    if (ok) await onReload();
  };

  const visiblePrograms = (programs || [])
    .filter(Boolean)
    .filter((p) => isRowArchived(p) === showArchived);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <ListChecks className="h-6 w-6 text-teal-600" />
              Programs for {clientName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={openAdd} className="bg-teal-600 hover:bg-teal-700">
                <Plus className="h-4 w-4 mr-2" /> Add Program
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
            ) : visiblePrograms.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <ListChecks className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p>{showArchived ? "No archived programs." : "No programs yet. Create one!"}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {visiblePrograms.map((program) => {
                  const domain = domains.find(
                    (d) =>
                      String(d.id) ===
                      String(program.domain_id || program.domainId)
                  );
                  const moduleLabel = domain
                    ? getDomainModuleLabel(
                        modules,
                        domain.module_id ||
                          domain.moduleId ||
                          domain.MODULE_ID ||
                          DEFAULT_DOMAIN_MODULE_KEY
                      )
                    : "—";
                  const domainLabel =
                    domain?.name || domain?.NAME || "Not assigned";

                  return (
                    <Card
                      key={program.id}
                      className="border-l-4 border-l-teal-500"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">
                              {program.name || program.NAME || "Unnamed Program"}
                            </h3>
                            {program.description && (
                              <p className="text-sm text-gray-600 mt-1">
                                {program.description}
                              </p>
                            )}
                            <div className="flex items-center gap-1 mt-2 flex-wrap text-xs text-black">
                              <span className="flex items-center gap-1">
                                <span className="font-medium">Module:</span>
                                <span>
                                  {moduleLabel && moduleLabel !== "—"
                                    ? moduleLabel
                                    : "Not assigned"}
                                </span>
                              </span>

                              <ArrowRight className="w-3 h-3 text-muted-foreground" />

                              <span className="flex items-center gap-1">
                                <span className="font-medium">Domain:</span>
                                <span>{domainLabel}</span>
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(program)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleArchiveProgram(program)}
                              title={isRowArchived(program) ? "Restore" : "Archive"}
                              className={
                                isRowArchived(program)
                                  ? "text-green-600 hover:text-green-700"
                                  : "text-amber-600 hover:text-amber-700"
                              }
                            >
                              {isRowArchived(program) ? (
                                <ArchiveRestore className="h-4 w-4" />
                              ) : (
                                <Archive className="h-4 w-4" />
                              )}
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

      <AddProgramModal
        isOpen={isProgramFormOpen}
        onClose={() => {
          setIsProgramFormOpen(false);
          setEditingProgram(null);
        }}
        onAdd={(program) => handleProgramSaved(program, false)}
        onEdit={(program) => handleProgramSaved(program, true)}
        domains={domains}
        modules={modules}
        loading={loading}
        editingProgram={editingProgram}
        lockedClientId={clientId ? String(clientId) : ""}
        lockedClientName={clientName || ""}
      />
    </>
  );
}

export default function ClientProgramModal({
  isOpen,
  onClose,
  onAdd,
  onEdit,
  clientId,
  clientName,
  domains = [],
  modules = [],
  loading = false,
  editingProgram,
}) {
  return (
    <AddProgramModal
      isOpen={isOpen}
      onClose={onClose}
      onAdd={onAdd}
      onEdit={onEdit}
      domains={domains}
      modules={modules}
      loading={loading}
      editingProgram={editingProgram}
      lockedClientId={clientId ? String(clientId) : ""}
      lockedClientName={clientName || ""}
    />
  );
}
