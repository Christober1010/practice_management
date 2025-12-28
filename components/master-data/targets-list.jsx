"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Zap,
  Plus,
  Edit,
  Trash2,
  Archive,
  ArchiveRestore,
  BookOpen,
  Users,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import { fetchPrograms } from "@/app/store/programSlice";
import { fetchClients } from "@/app/store/clientSlice";
import AddTargetModal from "./add-target-modal";
import DeleteConfirmModal from "./DeleteConfirmModal";

export default function TargetsList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState("all"); // "generic" | "client" | "all"
  const [selectedClient, setSelectedClient] = useState("all");

  const [clientTargetsData, setClientTargetsData] = useState({
    modules: [],
    domains: [],
    programs: [],
    targets: [],
  });
  const [loadingClientData, setLoadingClientData] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [targetToDelete, setTargetToDelete] = useState(null);

  const dispatch = useAppDispatch();
  const programsData = useAppSelector((state) => state.programs.items || {});
  const clients = useAppSelector((state) => state.clients?.items || []);
  const loading = useAppSelector((state) => state.programs.loading);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const allPrompts = programsData.prompts || [];

  const genericActivities = programsData.activities || [];
  const genericPrograms = programsData.programs || [];
  const genericDomains = programsData.domains || [];
  const genericModules = programsData.modules || [];


  useEffect(() => {
    dispatch(fetchPrograms());
    dispatch(fetchClients());
  }, [dispatch]);

  const fetchClientSpecificData = async () => {
    try {
      setLoadingClientData(true);
      const selectedClientObj =
        selectedClient === "all"
          ? null
          : clients.find((c) => String(c?.NAME || c?.name || "").trim() === selectedClient);

      const selectedClientId =
        selectedClientObj?.client_id || selectedClientObj?.id || selectedClientObj?.clientId || null;

      // If a specific client is selected, prefer client-modules.php so we get per-client activities (+ tasks/prompts if backend supports)
      const url = selectedClientId
        ? `${baseUrl}/client-modules.php?client_id=${encodeURIComponent(String(selectedClientId))}`
        : `${baseUrl}/get-all.php`;

      const res = await fetch(url);
      const data = await res.json();

      if (data && data.success) {
        const payload = data.data ?? data; // client-modules.php returns {data:{...}}, get-all.php returns top-level arrays
        setClientTargetsData({
          modules: Array.isArray(payload.modules) ? payload.modules : [],
          domains: Array.isArray(payload.domains) ? payload.domains : [],
          programs: Array.isArray(payload.programs) ? payload.programs : [],
          targets: Array.isArray(payload.targets || payload.activities)
            ? (payload.targets || payload.activities)
            : [],
        });
      } else {
        setClientTargetsData({ modules: [], domains: [], programs: [], targets: [] });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load client targets");
      setClientTargetsData({
        modules: [],
        domains: [],
        programs: [],
        targets: [],
      });
    } finally {
      setLoadingClientData(false);
    }
  };

  useEffect(() => {
    if (viewMode === "client" || viewMode === "all") {
      fetchClientSpecificData();
    }
  }, [viewMode, selectedClient, clients]);

  // Check for pending client from client view navigation
  useEffect(() => {
    const pendingClient = localStorage.getItem("pendingClientForMasterData");
    const pendingAction = localStorage.getItem("pendingAction");
    const pendingType = localStorage.getItem("pendingMasterDataType");
    
    if (pendingClient && pendingAction === "add" && pendingType === "targets") {
      try {
        // Just open the add modal - client will be pre-selected in the modal
        setIsAddModalOpen(true);
        // Clear localStorage
        localStorage.removeItem("pendingClientForMasterData");
        localStorage.removeItem("pendingAction");
        localStorage.removeItem("pendingMasterDataType");
      } catch (err) {
        console.error("Error parsing pending client info:", err);
        localStorage.removeItem("pendingClientForMasterData");
        localStorage.removeItem("pendingAction");
        localStorage.removeItem("pendingMasterDataType");
      }
    }
  }, []);

  // normalize generic targets
  const genericTargets = useMemo(() => {
    if (!Array.isArray(genericActivities)) return [];
    return genericActivities.map((a) => {
      const program = genericPrograms.find(
        (p) => String(p.id) === String(a.programId || a.program_id)
      );
      const domain = program
        ? genericDomains.find(
            (d) => String(d.id) === String(program.domainId || program.domain_id)
          )
        : null;
      const module = domain
        ? genericModules.find(
            (m) => String(m.id) === String(domain.moduleId || domain.module_id)
          )
        : null;
      return {
        id: `generic-${a.id}`,
        rawId: a.id,
        name: a.name,
        goalDescription: a.goalDescription || a.goal_description || "",
        activityType: a.activityType || a.activity_type || "",
        trials: a.trials,
        instructions: a.instructions || a.INSTRUCTIONS || "",
        status: a.status || a.STATUS || "Active",
        archived: !!a.archived,
        programId: a.programId || a.program_id,
        programName: program?.name || program?.NAME || "N/A",
        domainName: domain?.name || domain?.NAME || "N/A",
        moduleName: module?.name || module?.NAME || "N/A",
        prompts: a.prompts || [],
        tasks: a.tasks || [],
        type: "generic",
      };
    });
  }, [
    genericActivities,
    genericPrograms,
    genericDomains,
    genericModules,
  ]);

  // normalize client targets
  const clientTargets = useMemo(() => {
    const { targets, programs, domains, modules } = clientTargetsData;
    if (!Array.isArray(targets)) return [];
    
    // Ensure arrays exist and are arrays - merge with generic data for lookups
    const clientProgramsArray = Array.isArray(programs) ? programs : [];
    const clientDomainsArray = Array.isArray(domains) ? domains : [];
    const clientModulesArray = Array.isArray(modules) ? modules : [];
    
    // Merge generic and client data for comprehensive lookups
    const allProgramsArray = [...genericPrograms, ...clientProgramsArray];
    const allDomainsArray = [...genericDomains, ...clientDomainsArray];
    const allModulesArray = [...genericModules, ...clientModulesArray];

    const clientMap = {};
    clients.forEach((c) => {
      clientMap[String(c.id)] =
        `${c.first_name || ""} ${c.last_name || ""}`.trim() ||
        c.name ||
        c.client_name ||
        "Unknown Client";
    });

    return targets.map((a) => {
      const targetProgramId = a.program_id || a.programId;
      
      // Find program in merged array (generic + client)
      const program = targetProgramId
        ? allProgramsArray.find((p) => {
            const pid = String(p?.id || "");
            const tid = String(targetProgramId || "");
            return pid === tid && pid !== "";
          })
        : null;
      
      // Debug: log if program not found
      if (targetProgramId && !program) {
        console.warn(`Program not found for target ${a.id}:`, {
          targetProgramId,
          availableProgramIds: allProgramsArray.map(p => p?.id).slice(0, 5),
          targetName: a.name
        });
      }
      
      // Get domain ID from program (try both field names)
      const programDomainId = program?.domain_id || program?.domainId;
      
      // Find domain in merged array
      const domain = programDomainId
        ? allDomainsArray.find((d) => {
            const did = String(d?.id || "");
            const pdid = String(programDomainId || "");
            return did === pdid && did !== "";
          })
        : null;
      
      // Get module ID from domain (try both field names)
      const domainModuleId = domain?.module_id || domain?.moduleId;
      
      // Find module in merged array
      const module = domainModuleId
        ? allModulesArray.find((m) => {
            const mid = String(m?.id || "");
            const dmid = String(domainModuleId || "");
            return mid === dmid && mid !== "";
          })
        : null;
      
      const clientName = clientMap[String(a.client_id)] || "Unknown Client";

      return {
        id: `client-${a.id}`,
        rawId: a.id,
        name: a.name || a.NAME || "Unnamed Target",
        goalDescription: a.goal_description || a.goalDescription || "",
        activityType: a.activity_type || a.activityType || "",
        trials: a.trials,
        instructions: a.instructions || a.INSTRUCTIONS || "",
        status: a.status || a.STATUS || "Active",
        archived: a.archived === 1 || a.archived === true,
        programId: targetProgramId,
        programName: program?.name || program?.NAME || "—",
        domainName: domain?.name || domain?.NAME || "—",
        moduleName: module?.name || module?.NAME || "—",
        client_name: clientName,
        client_id: a.client_id,
        prompts: a.prompts || [],
        tasks: a.tasks || [],
        type: "client",
      };
    });
  }, [clientTargetsData, clients, genericPrograms, genericDomains, genericModules]);

  const clientNames = useMemo(() => {
    const names = clientTargets.map((t) => t.client_name).filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [clientTargets]);

  // combined list according to viewMode + filters
  const displayedTargets = useMemo(() => {
    let list = [];
    if (viewMode === "generic") list = genericTargets;
    else if (viewMode === "client") list = clientTargets;
    else list = [...genericTargets, ...clientTargets];

    if (selectedClient !== "all" && viewMode !== "generic") {
      list = list.filter((t) => t.client_name === selectedClient);
    }

    return list
      .filter((t) => {
        const matchesSearch = [
          t.name,
          t.goalDescription,
          t.programName,
          t.domainName,
          t.moduleName,
        ].some((v) =>
          String(v || "").toLowerCase().includes(searchTerm.toLowerCase())
        );
        const matchesStatus =
          statusFilter === "all" || t.status === statusFilter;
        const matchesType =
          typeFilter === "all" || t.activityType === typeFilter;
        const matchesArchived = t.archived === showArchived;
        return (
          matchesSearch &&
          matchesStatus &&
          matchesType &&
          matchesArchived
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [
    viewMode,
    genericTargets,
    clientTargets,
    searchTerm,
    statusFilter,
    typeFilter,
    showArchived,
    selectedClient,
  ]);


  const activityTypes = useMemo(() => {
    const all = [...genericTargets, ...clientTargets];
    return [
      ...new Set(all.map((a) => a.activityType).filter(Boolean)),
    ];
  }, [genericTargets, clientTargets]);

  const handleAddTarget = async (newTarget) => {
    const isClientTarget = newTarget.client_id != null;

    const payload = isClientTarget
      ? {
          client_id: newTarget.client_id,
          activities: [
            {
              id: newTarget.id,
              programId: newTarget.programId,
              name: newTarget.name,
              goalDescription: newTarget.goalDescription || "",
              trials: newTarget.trials || 1,
              activityType: newTarget.activityType || "",
              instructions: newTarget.instructions || "",
              status: newTarget.status || "Active",
              archived: 0,
              prompts: newTarget.prompts || [],
              tasks: newTarget.tasks || [],
            },
          ],
        }
      : {
          activities: [
            {
              id: newTarget.id,
              programId: newTarget.programId,
              name: newTarget.name,
              goalDescription: newTarget.goalDescription || "",
              trials: newTarget.trials || 1,
              activityType: newTarget.activityType || "",
              instructions: newTarget.instructions || "",
              status: newTarget.status || "Active",
              archived: 0,
              prompts: newTarget.prompts || [],
              tasks: newTarget.tasks || [],
            },
          ],
        };

    try {
      const url = isClientTarget ? "/client-modules.php" : "/programs.php";
      const res = await fetch(`${baseUrl}${url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (result.success) {
        toast.success("Target saved!");
        dispatch(fetchPrograms());
        if (viewMode === "client" || viewMode === "all") {
          fetchClientSpecificData();
        }
        setIsAddModalOpen(false);
      } else {
        toast.error(result.message || "Save failed");
      }
    } catch (err) {
      toast.error("Network error");
    }
  };

  const handleEditTarget = async (updatedTarget) => {
    const isClientTarget = updatedTarget.client_id != null;

    try {
      let res;
      if (isClientTarget) {
        const payload = {
          client_id: updatedTarget.client_id,
          activities: [
            {
              id: updatedTarget.rawId || updatedTarget.id,
              programId: updatedTarget.programId,
              name: updatedTarget.name,
              goalDescription: updatedTarget.goalDescription || "",
              trials: updatedTarget.trials || 1,
              activityType: updatedTarget.activityType || "",
              instructions: updatedTarget.instructions || "",
              status: updatedTarget.status || "Active",
              prompts: updatedTarget.prompts || [],
              tasks: updatedTarget.tasks || [],
            },
          ],
        };
        res = await fetch(`${baseUrl}/client-modules.php`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        const payload = {
          activityId: updatedTarget.rawId || updatedTarget.id,
          programId: updatedTarget.programId,
          name: updatedTarget.name,
          goalDescription: updatedTarget.goalDescription,
          trials: updatedTarget.trials,
          activityType: updatedTarget.activityType,
          instructions: updatedTarget.instructions,
          status: updatedTarget.status,
          prompts: updatedTarget.prompts,
          tasks: updatedTarget.tasks,
        };
        res = await fetch(`${baseUrl}/programs.php`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const result = await res.json();

      if (result.success) {
        toast.success("Target updated!");
        dispatch(fetchPrograms());
        if (viewMode === "client" || viewMode === "all") {
          fetchClientSpecificData();
        }
        setIsAddModalOpen(false);
        setEditingTarget(null);
      } else {
        toast.error(result.message || "Update failed");
      }
    } catch (err) {
      toast.error("Network error");
    }
  };

  const handleDeleteTarget = async () => {
    if (!targetToDelete) return;
    try {
      const res = await fetch(`${baseUrl}/programs.php`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId: targetToDelete.rawId || targetToDelete.id,
          delete: true,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Target deleted!");
        dispatch(fetchPrograms());
        if (viewMode === "client" || viewMode === "all") {
          fetchClientSpecificData();
        }
        setIsDeleteModalOpen(false);
      } else {
        toast.error(result.message || "Delete failed");
      }
    } catch (err) {
      toast.error("Network error");
    } finally {
      setTargetToDelete(null);
    }
  };


  const openEditModal = (target) => {
    setEditingTarget(target);
    setIsAddModalOpen(true);
  };

  return (
    <div className="space-y-8">
      <Toaster />

      <AddTargetModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingTarget(null);
        }}
        onAdd={handleAddTarget}
        onEdit={handleEditTarget}
        programs={[...(genericPrograms || []), ...(clientTargetsData.programs || [])]}
        domains={[...(genericDomains || []), ...(clientTargetsData.domains || [])]}
        modules={[...(genericModules || []), ...(clientTargetsData.modules || [])]}
        clients={clients}
        allPrompts={allPrompts}
        loading={loading || loadingClientData}
        editingTarget={editingTarget}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setTargetToDelete(null);
        }}
        onConfirm={handleDeleteTarget}
        moduleName={targetToDelete?.name || ""}
        loading={false}
      />


      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Targets</h2>
          <p className="text-slate-600">Manage target/activity master data</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => {
              setEditingTarget(null);
              setIsAddModalOpen(true);
            }}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Target
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowArchived(!showArchived)}
          >
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
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search targets..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {viewMode !== "generic" && (
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {clientNames.map((NAME) => (
                    <SelectItem key={NAME} value={NAME}>
                      {NAME}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={viewMode} onValueChange={setViewMode}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="generic">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-teal-600" /> Generic
                    targets
                  </div>
                </SelectItem>
                <SelectItem value="client">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-600" /> Client targets
                  </div>
                </SelectItem>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-teal-600" />
                    <Users className="h-4 w-4 text-purple-600" />
                    All targets
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {activityTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading || loadingClientData ? (
        <div className="text-center py-20 text-gray-500">Loading...</div>
      ) : displayedTargets.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-slate-500">
            No targets found.
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                {viewMode === "generic" && "Generic"}
                {viewMode === "client" && "Client"}
                {viewMode === "all" && "All"} Targets
              </div>
              <Badge variant="secondary">
                {displayedTargets.length} target
                {displayedTargets.length !== 1 && "s"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-1">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="px-2">Module Name</TableHead>
                    <TableHead className="px-2">Domain Name</TableHead>
                    <TableHead className="px-2">Program Name</TableHead>
                    <TableHead className="px-2">Target Name</TableHead>
                    <TableHead className="px-2">Type</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Activity Type
                    </TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Status
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {displayedTargets.map((t) => (
                    <TableRow key={t.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium p-2">
                        {t.moduleName}
                      </TableCell>

                      <TableCell className="font-medium p-2">
                        {t.domainName}
                      </TableCell>

                      <TableCell className="font-medium p-2">
                        {t.programName}
                      </TableCell>

                      <TableCell className="font-medium p-2">
                        {t.name}
                        {t.archived && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Archived
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="p-2">
                        <Badge
                          variant="outline"
                          className={
                            t.type === "generic"
                              ? "text-teal-700 border-teal-300"
                              : "text-purple-700 border-purple-300"
                          }
                        >
                          {t.type === "generic"
                            ? "Generic"
                            : t.client_name || "Client"}
                        </Badge>
                      </TableCell>

                      <TableCell className="hidden md:table-cell p-2">
                        <Badge
                          variant="outline"
                          className="bg-blue-50 text-blue-700 border-blue-200"
                        >
                          {t.activityType || "N/A"}
                        </Badge>
                      </TableCell>

                      <TableCell className="hidden sm:table-cell p-2">
                        <Badge
                          className={
                            t.status === "Active"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }
                        >
                          {t.status}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right p-2">
                        <div className="flex justify-end gap-2 p-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(t)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-300"
                            onClick={() => {
                              setTargetToDelete(t);
                              setIsDeleteModalOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
