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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Zap,
  Plus,
  Edit,
  Trash2,
  Archive,
  ArchiveRestore,
  MoreVertical,
  BookOpen,
  Users,
} from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import { fetchPrograms } from "@/app/store/programSlice";
import AddTargetModal from "./add-target-modal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import ArchiveConfirmModal from "./ArchiveConfirmModal";

export default function TargetsList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);

  const [viewMode, setViewMode] = useState("generic"); // "generic" | "client" | "all"

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
  const [deleting, setDeleting] = useState(false);

  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [targetToArchive, setTargetToArchive] = useState(null);
  const [archiving, setArchiving] = useState(false);

  const dispatch = useAppDispatch();
  const programsData = useAppSelector((state) => state.programs.items) || {};
  const loading = useAppSelector((state) => state.programs.loading);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const allPrompts = programsData.prompts || [];

  const genericActivities = programsData.activities || [];
  const genericPrograms = programsData.programs || [];
  const genericDomains = programsData.domains || [];
  const genericModules = programsData.modules || [];

  const getStatusColor = (status) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800";
      case "Inactive":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  useEffect(() => {
    dispatch(fetchPrograms());
  }, [dispatch]);

  const fetchClientSpecificData = async () => {
    try {
      setLoadingClientData(true);
      const res = await fetch(`${baseUrl}/get-all.php`);
      const data = await res.json();
      if (data && data.success) {
        setClientTargetsData({
          modules: Array.isArray(data.modules) ? data.modules : [],
          domains: Array.isArray(data.domains) ? data.domains : [],
          programs: Array.isArray(data.programs) ? data.programs : [],
          targets:
            Array.isArray(data.targets || data.activities) // support either key
              ? (data.targets || data.activities)
              : [],
        });
      } else {
        setClientTargetsData({
          modules: [],
          domains: [],
          programs: [],
          targets: [],
        });
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
    } else {
      setClientTargetsData({
        modules: [],
        domains: [],
        programs: [],
        targets: [],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

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
    return targets.map((a) => {
      const program = programs?.find(
        (p) => String(p.id) === String(a.programId || a.program_id)
      );
      const domain = program
        ? domains?.find(
            (d) => String(d.id) === String(program.domainId || program.domain_id)
          )
        : null;
      const module = domain
        ? modules?.find(
            (m) => String(m.id) === String(domain.moduleId || domain.module_id)
          )
        : null;
      return {
        id: `client-${a.id}`,
        rawId: a.id,
        name: a.NAME || a.name,
        goalDescription: a.goal_description || a.goalDescription || "",
        activityType: a.activity_type || a.activityType || "",
        trials: a.trials,
        status: a.STATUS || a.status || "Active",
        archived: a.archived === 1 || a.archived === true,
        programId: a.programId || a.program_id,
        programName: program?.NAME || program?.name || "N/A",
        domainName: domain?.NAME || domain?.name || "N/A",
        moduleName: module?.NAME || module?.name || "N/A",
        prompts: a.prompts || [],
        tasks: a.tasks || [],
        type: "client",
      };
    });
  }, [clientTargetsData]);

  // combined list according to viewMode + filters
  const displayedTargets = useMemo(() => {
    let baseTargets = [];
    if (viewMode === "generic") {
      baseTargets = genericTargets;
    } else if (viewMode === "client") {
      baseTargets = clientTargets;
    } else {
      baseTargets = [...genericTargets, ...clientTargets];
    }

    return baseTargets
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
  ]);

  const activeCount =
    genericTargets.filter((t) => !t.archived).length || 0;
  const archivedCount =
    genericTargets.filter((t) => t.archived).length || 0;

  const activityTypes = useMemo(() => {
    const all = [...genericTargets, ...clientTargets];
    return [
      ...new Set(all.map((a) => a.activityType).filter(Boolean)),
    ];
  }, [genericTargets, clientTargets]);

  const handleAddTarget = async (newTarget) => {
    try {
      const res = await fetch(`${baseUrl}/programs.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activities: [newTarget] }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Target added successfully!");
        dispatch(fetchPrograms());
        setIsAddModalOpen(false);
      } else {
        toast.error(result.message || "Failed to add target");
      }
    } catch (err) {
      console.error("Error adding target:", err);
      toast.error("An error occurred while adding target.");
    }
  };

  const handleEditTarget = async (updatedTarget) => {
    try {
      const res = await fetch(`${baseUrl}/programs.php`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Target updated successfully!");
        dispatch(fetchPrograms());
        setIsAddModalOpen(false);
        setEditingTarget(null);
      } else {
        toast.error(result.message || "Failed to update target");
      }
    } catch (err) {
      console.error("Error updating target:", err);
      toast.error("Failed to update target");
    }
  };

  const handleDeleteTarget = async () => {
    if (!targetToDelete) return;
    setDeleting(true);
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
        toast.success("Target deleted successfully!");
        dispatch(fetchPrograms());
        setIsDeleteModalOpen(false);
      } else {
        toast.error(result.message || "Failed to delete target");
      }
    } catch (err) {
      console.error("Error deleting target:", err);
      toast.error("Failed to delete target");
    } finally {
      setDeleting(false);
      setTargetToDelete(null);
    }
  };

  const handleArchiveTarget = async (targetId) => {
    const target =
      genericTargets.find((t) => t.id === targetId) ||
      clientTargets.find((t) => t.id === targetId);
    if (!target || !target.rawId) {
      toast.error("Target not found");
      return;
    }

    const willArchive = !target.archived;
    const updatedStatus = willArchive ? "Inactive" : "Active";

    setArchiving(true);
    try {
      const res = await fetch(`${baseUrl}/programs.php`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId: target.rawId,
          programId: target.programId,
          name: target.name,
          goalDescription: target.goalDescription,
          trials: target.trials,
          activityType: target.activityType,
          instructions: target.instructions,
          status: updatedStatus,
          archived: willArchive ? 1 : 0,
          prompts: target.prompts || [],
          tasks: target.tasks || [],
        }),
      });

      const result = await res.json();
      if (result.success) {
        toast.success(willArchive ? "Target archived!" : "Target restored!");
        dispatch(fetchPrograms());
        setIsArchiveModalOpen(false);
      } else {
        toast.error(result.message || "Failed to update target");
      }
    } catch (err) {
      console.error("Error archiving target:", err);
      toast.error("Failed to update target");
    } finally {
      setArchiving(false);
      setTargetToArchive(null);
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
        programs={genericPrograms}
        domains={genericDomains}
        modules={genericModules}
        allPrompts={allPrompts}
        loading={loading}
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
        loading={deleting}
      />

      <ArchiveConfirmModal
        isOpen={isArchiveModalOpen}
        onClose={() => {
          setIsArchiveModalOpen(false);
          setTargetToArchive(null);
        }}
        onConfirm={() =>
          targetToArchive && handleArchiveTarget(targetToArchive.id)
        }
        domainName={targetToArchive?.name || ""}
        willArchive={!targetToArchive?.archived}
        loading={archiving}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Targets</h2>
          <p className="text-slate-600 mt-1">
            Manage target/activity master data
          </p>
        </div>
        <div className="flex flex-row flex-wrap gap-2 sm:items-center sm:justify-end">
          <Button
            onClick={() => {
              setEditingTarget(null);
              setIsAddModalOpen(true);
            }}
            className="bg-teal-600 hover:bg-teal-700 text-white"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Target
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
            className="border-slate-300"
          >
            {showArchived ? (
              <>
                <ArchiveRestore className="h-4 w-4 mr-2" /> Show Active (
                {activeCount})
              </>
            ) : (
              <>
                <Archive className="h-4 w-4 mr-2" /> Show Archived (
                {archivedCount})
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="shadow-lg border-0">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search targets..."
                className="pl-10 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Select value={viewMode} onValueChange={setViewMode}>
              <SelectTrigger className="w-full sm:w-64 border-slate-200">
                <SelectValue placeholder="Select view" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="generic">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-teal-600" />
                    Generic targets
                  </div>
                </SelectItem>
                <SelectItem value="client">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-600" />
                    Client targets
                  </div>
                </SelectItem>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1">
                      <BookOpen className="h-5 w-5 text-teal-600" />
                      <Users className="h-5 w-5 text-purple-600" />
                    </div>
                    All (Generic + Client)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48 border-slate-200">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-48 border-slate-200">
                <SelectValue placeholder="Filter by type" />
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

      {/* Table */}
      {loading || loadingClientData ? (
        <div className="h-64 w-64 mx-auto">
          <p className="text-center animate-pulse text-gray-500">
            Fetching targets…
          </p>
        </div>
      ) : (
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-teal-600" />
                {viewMode === "generic" && "Generic"}
                {viewMode === "client" && "Client"}
                {viewMode === "all" && "All"} Targets
              </div>
              <Badge variant="secondary">
                {displayedTargets.length} target
                {displayedTargets.length !== 1 ? "s" : ""}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 border-b">
                    <TableHead>Module</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Target Name</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Type
                    </TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Status
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedTargets.map((t) => (
                    <TableRow
                      key={t.id}
                      className="hover:bg-slate-50 transition-colors border-b"
                    >
                      <TableCell className="p-4 font-medium text-slate-800">
                        {t.moduleName}
                      </TableCell>
                      <TableCell className="p-4 font-medium text-slate-800">
                        {t.domainName}
                      </TableCell>
                      <TableCell className="p-4 font-medium text-slate-800">
                        {t.programName}
                      </TableCell>
                      <TableCell className="p-4 font-medium text-slate-800">
                        {t.name}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell p-4">
                        <Badge
                          variant="outline"
                          className="bg-blue-50 text-blue-700 border-blue-200"
                        >
                          {t.activityType || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell p-4">
                        <Badge className={getStatusColor(t.status)}>
                          {t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(t)}
                            className="border-slate-300 hover:bg-teal-50"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setTargetToDelete(t);
                              setIsDeleteModalOpen(true);
                            }}
                            className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                            disabled={deleting}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-slate-300 bg-transparent"
                                onClick={() => {
                                  setTargetToArchive(t);
                                  setIsArchiveModalOpen(true);
                                }}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-48"
                            >
                              <DropdownMenuItem
                                onClick={() => handleArchiveTarget(t.id)}
                                className={
                                  t.archived
                                    ? "text-green-600"
                                    : "text-amber-600"
                                }
                              >
                                {t.archived ? (
                                  <>
                                    <ArchiveRestore className="h-4 w-4 mr-2" />
                                    Restore Target
                                  </>
                                ) : (
                                  <>
                                    <Archive className="h-4 w-4 mr-2" />
                                    Archive Target
                                  </>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {displayedTargets.length === 0 && (
                <div className="text-center py-12">
                  <Zap className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500">
                    No targets match your search.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
