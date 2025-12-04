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
  BookOpen,
  Search,
  Archive,
  ArchiveRestore,
  MoreVertical,
  Plus,
  Edit,
  Trash2,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import { toggleArchiveProgram, fetchPrograms } from "@/app/store/programSlice";
import AddModuleModal from "./add-module-modal";
import DeleteConfirmModal from "./DeleteConfirmModal";

export default function ModulesList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [moduleToDelete, setModuleToDelete] = useState();
  const [deleting, setDeleting] = useState(false);

  const dispatch = useAppDispatch();
  const programsData = useAppSelector((state) => state.programs.items);
  const loading = useAppSelector((state) => state.programs.loading);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const modules = useMemo(() => {
    if (!programsData?.modules) return [];

    return programsData.modules.map((m) => ({
      id: m.id,
      name: m.name || m.NAME || "Unnamed",
      description: m.description || "",
      status: m.status || m.STATUS || "Active",
      archived: m.archived === 1 || m.archived === true,
      created_at: m.created_at,
      updated_at: m.updated_at,
    }));
  }, [programsData]);

  const handleArchiveModule = async (moduleId) => {
    const module = modules.find((m) => m.id === moduleId);
    if (!module) return;

    const updatedModule = {
      ...module,
      archived: !module.archived,
      status: !module.archived ? "Inactive" : "Active",
    };

    try {
      const res = await fetch(`${baseUrl}/programs.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId,
          archived: updatedModule.archived ? 1 : 0,
          status: updatedModule.status,
        }),
      });

      const result = await res.json();

      if (result.success) {
        dispatch(
          toggleArchiveProgram({
            moduleId,
            archived: updatedModule.archived,
            status: updatedModule.status,
          }),
        );

        toast.success(
          updatedModule.archived ? "Module archived!" : "Module restored!",
        );

        dispatch(fetchPrograms());
      } else {
        toast.error(
          `Failed to update module: ${result.message || "Unknown error"}`,
        );
      }
    } catch (err) {
      console.error("Error archiving/restoring module:", err);
      toast.error("An error occurred while updating module status.");
    }
  };

  const handleAddModule = async (newModule) => {
    try {
      const res = await fetch(`${baseUrl}/programs.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modules: [newModule] }),
      });

      const result = await res.json();

      if (result.success) {
        toast.success("Module added successfully!");
        dispatch(fetchPrograms());
      } else {
        toast.error(
          `Failed to add module: ${result.message || "Unknown error"}`,
        );
      }
    } catch (err) {
      console.error("Error adding module:", err);
      toast.error("An error occurred while adding module.");
    }
  };

  const handleEditModule = async (updatedModule) => {
    try {
      const res = await fetch(`${baseUrl}/programs.php`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId: updatedModule.id,
          name: updatedModule.name,
          description: updatedModule.description,
          status: updatedModule.status,
        }),
      });

      const result = await res.json();

      if (result.success) {
        toast.success("Module updated successfully!");
        dispatch(fetchPrograms());
        setEditingModule(null);
      } else {
        toast.error(
          `Failed to update module: ${result.message || "Unknown error"}`,
        );
      }
    } catch (err) {
      console.error("Error updating module:", err);
      toast.error("An error occurred while updating module.");
    }
  };

  const handleDeleteModule = async (moduleId) => {
    const module = modules.find((m) => m.id === moduleId);
    if (!module) return;

    setModuleToDelete({ id: moduleId, name: module.name });
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!moduleToDelete) return;

    setDeleting(true);

    try {
      const res = await fetch(`${baseUrl}/programs.php`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId: moduleToDelete.id,
          delete: true,
        }),
      });

      const result = await res.json();

      if (result.success) {
        toast.success("Module deleted successfully!");
        dispatch(fetchPrograms());
        setIsDeleteModalOpen(false);
      } else {
        toast.error(
          `Failed to delete module: ${result.message || "Unknown error"}`,
        );
      }
    } catch (err) {
      console.error("Error deleting module:", err);
      toast.error("An error occurred while deleting the module.");
    } finally {
      setDeleting(false);
      setModuleToDelete(null);
    }
  };

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

  const handleOpenEditModal = (module) => {
    setEditingModule(module);
    setIsAddModalOpen(true);
  };

  const filteredModules = useMemo(() => {
    return modules.filter((module) => {
      const matchesSearch = [module.name, module.description].some(
        (value) =>
          value && value.toLowerCase().includes(searchTerm.toLowerCase()),
      );

      const matchesStatus =
        statusFilter === "all" || module.status === statusFilter;

      const matchesArchived = module.archived === showArchived;

      return matchesSearch && matchesStatus && matchesArchived;
    });
  }, [modules, searchTerm, statusFilter, showArchived]);

  const activeModuleCount = modules.filter((m) => !m.archived).length;
  const archivedModuleCount = modules.filter((m) => m.archived).length;

  return (
    <div className="space-y-8">
      <Toaster />

      <AddModuleModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingModule(null);
        }}
        onAdd={handleAddModule}
        onEdit={handleEditModule}
        loading={loading}
        editingModule={editingModule}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setModuleToDelete(null);
        }}
        onConfirm={confirmDelete}
        moduleName={moduleToDelete?.name || ""}
        loading={deleting}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row lg:justify-between sm:items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Modules</h2>
          <p className="text-slate-600 mt-1">Manage module master data</p>
        </div>

        <div className="flex flex-row flex-wrap gap-2 sm:items-center sm:justify-end">
          <Button
            onClick={() => {
              setEditingModule(null);
              setIsAddModalOpen(true);
            }}
            className="bg-teal-600 hover:bg-teal-700 text-white"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Module
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
                {activeModuleCount})
              </>
            ) : (
              <>
                <Archive className="h-4 w-4 mr-2" /> Show Archived (
                {archivedModuleCount})
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card className="shadow-lg border-0">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search modules..."
                className="pl-10 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

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
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {loading ? (
        <div className="h-64 w-64 mx-auto">
          <p className="text-center animate-pulse text-gray-500">
            Fetching modules...
          </p>
        </div>
      ) : (
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800 flex items-center">
              <BookOpen className="h-5 w-5 mr-2 text-teal-600" />
              {showArchived ? "Archived" : "Active"} Modules (
              {filteredModules.length})
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 border-b">
                    <TableHead className="font-semibold text-slate-700">
                      Module Name
                    </TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold text-slate-700">
                      Status
                    </TableHead>
                    <TableHead className="hidden md:table-cell font-semibold text-slate-700">
                      Description
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredModules.map((module) => (
                    <TableRow
                      key={module.id}
                      className="hover:bg-slate-50 transition-colors border-b"
                    >
                      <TableCell className="p-4 font-medium text-slate-800">
                        {module.name}
                        {module.archived && (
                          <Badge
                            variant="outline"
                            className="border-amber-300 text-amber-700 text-xs ml-2"
                          >
                            Archived
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="hidden sm:table-cell p-4">
                        <Badge className={getStatusColor(module.status)}>
                          {module.status}
                        </Badge>
                      </TableCell>

                      <TableCell className="hidden md:table-cell p-4 text-slate-600">
                        {module.description || "N/A"}
                      </TableCell>

                      <TableCell className="py-4">
                        <div className="flex items-center justify-end gap-2">
                          {/* Edit Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditModal(module)}
                            className="border-slate-300 hover:bg-teal-50"
                          >
                            <Edit className="h-4 w-4 mr-1" />
                          </Button>

                          {/* Delete Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteModule(module.id)}
                            className="border-red-300 text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-400"
                            disabled={deleting}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                          </Button>

                          {/* Actions Dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-slate-300 bg-transparent"
                                title="More Actions"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="end" className="w-48">
                              {/* Archive / Restore */}
                              <DropdownMenuItem
                                onClick={() => handleArchiveModule(module.id)}
                                className={
                                  module.archived
                                    ? "text-green-600"
                                    : "text-amber-600"
                                }
                              >
                                {module.archived ? (
                                  <>
                                    <ArchiveRestore className="h-4 w-4 mr-2" />
                                    Restore Module
                                  </>
                                ) : (
                                  <>
                                    <Archive className="h-4 w-4 mr-2" />
                                    Archive Module
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

              {filteredModules.length === 0 && (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500">
                    {showArchived
                      ? "No archived modules found."
                      : "No modules match your search."}
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
