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
  Target,
  Plus,
  Edit,
  Trash2,
  Archive,
  ArchiveRestore,
  MoreVertical,
} from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  fetchPrograms,
  toggleArchiveProgram,
  updateProgramStructure,
} from "@/app/store/programSlice";
import AddProgramModal from "./add-program-modal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import ArchiveConfirmModal from "./ArchiveConfirmModal";

export default function ProgramsList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  // Delete modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [programToDelete, setProgramToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Archive modal
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [programToArchive, setProgramToArchive] = useState(null);
  const [archiving, setArchiving] = useState(false);

  const dispatch = useAppDispatch();
  const programsData = useAppSelector((state) => state.programs.items);
  const loading = useAppSelector((state) => state.programs.loading);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

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

  const filteredPrograms = useMemo(() => {
    if (!programsData?.programs) return [];
    return programsData.programs
      .map((p) => {
        const domain = programsData.domains?.find((d) => d.id === p.domainId);
        const module = domain
          ? programsData.modules?.find((m) => m.id === domain.moduleId)
          : null;
        return {
          ...p,
          moduleName: module?.name || "N/A",
          domainName: domain?.name || "N/A",
          archived: !!p.archived,
        };
      })
      .filter((program) => {
        const matchesSearch = [
          program.name,
          program.description,
          program.domainName,
          program.moduleName,
        ].some(
          (value) =>
            value && value.toLowerCase().includes(searchTerm.toLowerCase())
        );
        const matchesStatus =
          statusFilter === "all" || program.status === statusFilter;
        const matchesArchived = program.archived === showArchived;
        return matchesSearch && matchesStatus && matchesArchived;
      });
  }, [programsData, searchTerm, statusFilter, showArchived]);

  const activeProgramCount =
    programsData.programs?.filter((p) => !p.archived).length || 0;
  const archivedProgramCount =
    programsData.programs?.filter((p) => p.archived).length || 0;

  const handleAddProgram = async (newProgram) => {
    try {
      const res = await fetch(`${baseUrl}/programs.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programs: [newProgram] }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Program added successfully!");
        dispatch(fetchPrograms());
        setIsAddModalOpen(false);
      } else {
        toast.error(result.message || "Failed to add program");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to add program");
    }
  };

  const handleEditProgram = async (updatedProgram) => {
    try {
      const res = await fetch(`${baseUrl}/programs.php`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId: updatedProgram.id,
          name: updatedProgram.name,
          description: updatedProgram.description,
          status: updatedProgram.status,
          domainId: updatedProgram.domainId,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Program updated!");
        dispatch(fetchPrograms());
        setIsAddModalOpen(false);
        setEditingProgram(null);
      } else {
        toast.error(result.message || "Failed to update program");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update program");
    }
  };

  const handleDeleteProgram = async () => {
    if (!programToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`${baseUrl}/programs.php`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId: programToDelete.id, delete: true }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Program deleted!");
        dispatch(fetchPrograms());
        setIsDeleteModalOpen(false);
      } else {
        toast.error(result.message || "Failed to delete program");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete program");
    } finally {
      setDeleting(false);
      setProgramToDelete(null);
    }
  };

  useEffect(() => {
    console.log("Programs in store:", programsData?.programs);
  }, [programsData]);

  const handleArchiveProgram = async (programId) => {
    if (!programId) {
      toast.error("Program ID missing");
      return;
    }

    // Convert both to string — ensures match even if backend uses UUID or prefixed IDs
    const program = programsData?.programs?.find(
      (p) => String(p.id) === String(programId)
    );

    if (!program) {
      toast.error("Program not found");
      console.warn("Program lookup failed for ID:", programId);
      return;
    }

    console.log("Archiving:", program.id, program.name);

    const willArchive = !Boolean(program.archived); // archived: 0 → false, 1 → true
    const updatedStatus = willArchive ? "Inactive" : "Active";

    setArchiving(true);

    try {
      const res = await fetch(`${baseUrl}/programs.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId: program.id,
          archived: willArchive ? 1 : 0,
          status: updatedStatus,
        }),
      });

      const result = await res.json();

      if (result.success) {
        dispatch(
          toggleArchiveProgram({
            programId: program.id,
            archived: willArchive ? 1 : 0,
            status: updatedStatus,
          })
        );

        toast.success(willArchive ? "Program archived!" : "Program restored!");
        dispatch(fetchPrograms());
        setIsArchiveModalOpen(false);
      } else {
        toast.error(result.message || "Failed to update program");
      }
    } catch (err) {
      console.error("Archive error:", err);
      toast.error("Failed to update program");
    } finally {
      setArchiving(false);
      setProgramToArchive(null);
    }
  };

  const openEditModal = (program) => {
    setEditingProgram(program);
    setIsAddModalOpen(true);
  };

  useEffect(() => {
    dispatch(fetchPrograms());
  }, [dispatch]);

  return (
    <div className="space-y-8">
      <Toaster />

      <AddProgramModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingProgram(null);
        }}
        onAdd={handleAddProgram}
        onEdit={handleEditProgram}
        domains={programsData?.domains || []}
        modules={programsData?.modules || []}
        loading={loading}
        editingProgram={editingProgram}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setProgramToDelete(null);
        }}
        onConfirm={handleDeleteProgram}
        moduleName={programToDelete?.name || ""}
        loading={deleting}
      />

      <ArchiveConfirmModal
        isOpen={isArchiveModalOpen}
        onClose={() => {
          setIsArchiveModalOpen(false);
          setProgramToArchive(null);
        }}
        onConfirm={() => handleArchiveProgram(programToArchive?.id)}
        domainName={programToArchive?.name || ""}
        willArchive={!programToArchive?.archived}
        loading={archiving}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Programs</h2>
          <p className="text-slate-600 mt-1">Manage program master data</p>
        </div>
        <div className="flex flex-row flex-wrap gap-2 sm:items-center sm:justify-end">
          <Button
            onClick={() => {
              setEditingProgram(null);
              setIsAddModalOpen(true);
            }}
            className="bg-teal-600 hover:bg-teal-700 text-white"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Program
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
                {activeProgramCount})
              </>
            ) : (
              <>
                <Archive className="h-4 w-4 mr-2" /> Show Archived (
                {archivedProgramCount})
              </>
            )}
          </Button>
        </div>
      </div>

      <Card className="shadow-lg border-0">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search programs..."
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

      {loading ? (
        <div className="h-64 w-64 mx-auto">
          <p className="text-center animate-pulse text-gray-500">
            Fetching programs
          </p>
        </div>
      ) : (
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800 flex items-center">
              <Target className="h-5 w-5 mr-2 text-teal-600" />
              Programs ({filteredPrograms.length})
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
                    <TableHead className="font-semibold text-slate-700">
                      Domain Name
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700">
                      Program Name
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
                  {filteredPrograms.map((program) => (
                    <TableRow
                      key={program.id}
                      className="hover:bg-slate-50 transition-colors border-b"
                    >
                      <TableCell className="p-4 font-medium text-slate-800">
                        {program.moduleName}
                      </TableCell>
                      <TableCell className="p-4 font-medium text-slate-800">
                        {program.domainName}
                      </TableCell>
                      <TableCell className="p-4 font-medium text-slate-800">
                        {program.name}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell p-4">
                        <Badge className={getStatusColor(program.status)}>
                          {program.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell p-4">
                        <div className="text-sm text-slate-600">
                          {program.description || "N/A"}
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(program)}
                            className="border-slate-300 hover:bg-teal-50"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setProgramToDelete(program);
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
                                  setProgramToArchive(program);
                                  setIsArchiveModalOpen(true);
                                  console.log(program, "program");
                                }}
                                className={
                                  program.archived
                                    ? "text-green-600"
                                    : "text-amber-600"
                                }
                              >
                                {program.archived ? (
                                  <>
                                    <ArchiveRestore className="h-4 w-4 mr-2" />
                                    Restore Program
                                  </>
                                ) : (
                                  <>
                                    <Archive className="h-4 w-4 mr-2" />
                                    Archive Program
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
              {filteredPrograms.length === 0 && (
                <div className="text-center py-12">
                  <Target className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500">
                    No programs match your search.
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
