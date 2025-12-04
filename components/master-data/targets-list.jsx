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
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  // Delete modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [targetToDelete, setTargetToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Archive modal
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [targetToArchive, setTargetToArchive] = useState(null);
  const [archiving, setArchiving] = useState(false);

  const dispatch = useAppDispatch();
  const programsData = useAppSelector((state) => state.programs.items);
  const loading = useAppSelector((state) => state.programs.loading);
  console.log(programsData,"programs")
  const allPrompts = programsData?.prompts || [];

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const filteredTargets = useMemo(() => {
    if (!programsData?.activities) return [];
    return programsData.activities
      .map((activity) => {
        const program = programsData.programs?.find(
          (p) => p.id === activity.programId
        );
        const domain = program
          ? programsData.domains?.find((d) => d.id === program.domainId)
          : null;
        const module = domain
          ? programsData.modules?.find((m) => m.id === domain.moduleId)
          : null;

        return {
          ...activity,
          programName: program?.name || "N/A",
          domainName: domain?.name || "N/A",
          moduleName: module?.name || "N/A",
          archived: !!activity.archived,
        };
      })
      .filter((activity) => {
        const matchesSearch = [
          activity.name,
          activity.goalDescription,
          activity.programName,
          activity.domainName,
          activity.moduleName,
        ].some(
          (value) =>
            value && value.toLowerCase().includes(searchTerm.toLowerCase())
        );

        const matchesStatus =
          statusFilter === "all" || activity.status === statusFilter;
        const matchesType =
          typeFilter === "all" || activity.activityType === typeFilter;
        const matchesArchived = activity.archived === showArchived;

        return matchesSearch && matchesStatus && matchesType && matchesArchived;
      });
  }, [programsData, searchTerm, statusFilter, typeFilter, showArchived]);

  const activeTargetCount =
    programsData.activities?.filter((a) => !a.archived).length || 0;
  const archivedTargetCount =
    programsData.activities?.filter((a) => a.archived).length || 0;

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

  const activityTypes = useMemo(() => {
    if (!programsData?.activities) return [];
    return [
      ...new Set(
        programsData.activities.map((a) => a.activityType).filter(Boolean)
      ),
    ];
  }, [programsData]);

  useEffect(() => {
    dispatch(fetchPrograms());
  }, [dispatch]);

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
          activityId: updatedTarget.id,
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
          activityId: targetToDelete.id,
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
    const target = programsData?.activities?.find((a) => a.id === targetId);
    // if (!target) {
    //   toast.error("Target not found");
    //   return;
    // }
console.log(targetId)
    const willArchive = !target.archived;
    const updatedStatus = willArchive ? "Inactive" : "Active";

    setArchiving(true);
    try {
      const res = await fetch(`${baseUrl}/programs.php`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId: target.id,
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
        programs={programsData?.programs || []}
        domains={programsData?.domains || []}
        modules={programsData?.modules || []}
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
        onConfirm={() => handleArchiveTarget(targetToArchive?.id)}
        domainName={targetToArchive?.name || ""}
        willArchive={!targetToArchive?.archived}
        loading={archiving}
      />

      {/* Header with Add Button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Targets</h2>
          <p className="text-slate-600 mt-1">Manage target/activity master data</p>
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
                {activeTargetCount})
              </>
            ) : (
              <>
                <Archive className="h-4 w-4 mr-2" /> Show Archived (
                {archivedTargetCount})
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="shadow-lg border-0">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search targets..."
                className="pl-10 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40 border-slate-200">
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

      {/* Targets Table */}
      {loading ? (
        <div className="h-64 w-64 mx-auto">
          <p className="text-center animate-pulse text-gray-500">
            Fetching targets
          </p>
        </div>
      ) : (
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800 flex items-center">
              <Zap className="h-5 w-5 mr-2 text-teal-600" />
              Targets ({filteredTargets.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 border-b">
                    <TableHead className="font-semibold text-slate-700">
                      Module
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700">
                      Domain
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700">
                      Program
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700">
                      Target Name
                    </TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold text-slate-700">
                      Type
                    </TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold text-slate-700">
                      Status
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTargets.map((activity) => (
                    <TableRow
                      key={activity.id}
                      className="hover:bg-slate-50 transition-colors border-b"
                    >
                      <TableCell className="p-4 font-medium text-slate-800">
                        {activity.moduleName}
                      </TableCell>
                      <TableCell className="p-4 font-medium text-slate-800">
                        {activity.domainName}
                      </TableCell>
                      <TableCell className="p-4 font-medium text-slate-800">
                        {activity.programName}
                      </TableCell>
                      <TableCell className="p-4 font-medium text-slate-800">
                        {activity.name}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell p-4">
                        <Badge
                          variant="outline"
                          className="bg-blue-50 text-blue-700 border-blue-200"
                        >
                          {activity.activityType || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell p-4">
                        <Badge className={getStatusColor(activity.status)}>
                          {activity.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(activity)}
                            className="border-slate-300 hover:bg-teal-50"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setTargetToDelete(activity);
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
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem
                                onClick={() => {
                                  setTargetToArchive(activity);
                                  setIsArchiveModalOpen(true);
                                }}
                                className={
                                  activity.archived
                                    ? "text-green-600"
                                    : "text-amber-600"
                                }
                              >
                                {activity.archived ? (
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
              {filteredTargets.length === 0 && (
                <div className="text-center py-12">
                  <Zap className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500">No targets match your search.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}