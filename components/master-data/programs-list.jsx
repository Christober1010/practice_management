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
  Layers,
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
import { fetchPrograms, toggleArchiveProgram } from "@/app/store/programSlice";

import AddProgramModal from "./add-program-modal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import ArchiveConfirmModal from "./ArchiveConfirmModal";

export default function ProgramsList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);

  const [viewMode, setViewMode] = useState("generic"); // "generic" | "client" | "all"

  const [clientProgramsData, setClientProgramsData] = useState({
    modules: [],
    domains: [],
    programs: [],
  });
  const [loadingClientData, setLoadingClientData] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [programToDelete, setProgramToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

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

  useEffect(() => {
    dispatch(fetchPrograms());
  }, [dispatch]);

  const fetchClientSpecificData = async () => {
    try {
      setLoadingClientData(true);
      const res = await fetch(`${baseUrl}/get-all.php`);
      const data = await res.json();
      if (data && data.success) {
        setClientProgramsData({
          modules: Array.isArray(data.modules) ? data.modules : [],
          domains: Array.isArray(data.domains) ? data.domains : [],
          programs: Array.isArray(data.programs) ? data.programs : [],
        });
      } else {
        setClientProgramsData({ modules: [], domains: [], programs: [] });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load client programs");
      setClientProgramsData({ modules: [], domains: [], programs: [] });
    } finally {
      setLoadingClientData(false);
    }
  };

  useEffect(() => {
    if (viewMode === "client" || viewMode === "all") {
      fetchClientSpecificData();
    } else {
      setClientProgramsData({ modules: [], domains: [], programs: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  const genericPrograms = useMemo(() => {
    if (!programsData?.programs) return [];
    return programsData.programs.map((p) => {
      const domain = programsData.domains?.find(
        (d) => String(d.id) === String(p.domain_id || p.domainId)
      );
      const module = programsData.modules?.find(
        (m) => String(m.id) === String(domain?.module_id || domain?.moduleId)
      );
      return {
        id: `generic-${p.id}`,
        rawId: p.id,
        name: p.name || p.NAME || "Unnamed Program",
        description: p.description || "",
        status: p.status || p.STATUS || "Active",
        archived: !!p.archived,
        domainId: p.domain_id || p.domainId,
        domainName: domain?.name || domain?.NAME || "N/A",
        moduleName: module?.name || module?.NAME || "N/A",
        type: "generic",
      };
    });
  }, [programsData]);

  const clientPrograms = useMemo(() => {
    if (!clientProgramsData.programs?.length) return [];
    return clientProgramsData.programs.map((p) => {
      const domain = clientProgramsData.domains?.find(
        (d) => String(d.id) === String(p.domain_id || p.domainId)
      );
      const module = clientProgramsData.modules?.find(
        (m) => String(m.id) === String(domain?.module_id || domain?.moduleId)
      );
      return {
        id: `client-${p.id}`,
        rawId: p.id,
        name: p.NAME || p.name || "Unnamed Program",
        description: p.description || "",
        status: p.STATUS || p.status || "Active",
        archived: p.archived === 1 || p.archived === true,
        domainId: p.domain_id || p.domainId,
        domainName: domain?.NAME || domain?.name || "N/A",
        moduleName: module?.NAME || module?.name || "N/A",
        type: "client",
      };
    });
  }, [
    clientProgramsData.programs,
    clientProgramsData.domains,
    clientProgramsData.modules,
  ]);

  const displayedPrograms = useMemo(() => {
    let basePrograms = [];
    if (viewMode === "generic") {
      basePrograms = genericPrograms;
    } else if (viewMode === "client") {
      basePrograms = clientPrograms;
    } else {
      basePrograms = [...genericPrograms, ...clientPrograms];
    }

    return basePrograms
      .filter((program) => {
        const matchesSearch = [
          program.name,
          program.description,
          program.domainName,
          program.moduleName,
        ].some((v) =>
          String(v || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
        );
        const matchesStatus =
          statusFilter === "all" || program.status === statusFilter;
        const matchesArchived = program.archived === showArchived;
        return matchesSearch && matchesStatus && matchesArchived;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [
    viewMode,
    genericPrograms,
    clientPrograms,
    searchTerm,
    statusFilter,
    showArchived,
  ]);

  const activeCount = genericPrograms.filter((p) => !p.archived).length || 0;
  const archivedCount = genericPrograms.filter((p) => p.archived).length || 0;

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
        toast.error(`Failed: ${result.message || "unknown error"}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error adding program");
    }
  };

  const handleEditProgram = async (updatedProgram) => {
    try {
      const payload = {
        programId: updatedProgram.rawId || updatedProgram.id,
        name: updatedProgram.name,
        description: updatedProgram.description,
        status: updatedProgram.status,
        domainId: updatedProgram.domainId,
      };

      const res = await fetch(`${baseUrl}/programs.php`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (result.success) {
        toast.success("Program updated!");
        dispatch(fetchPrograms());
        setIsAddModalOpen(false);
        setEditingProgram(null);
      } else {
        toast.error(`Failed: ${result.message || "unknown error"}`);
      }
    } catch (err) {
      console.error("Error updating program:", err);
      toast.error("Error updating program");
    }
  };

  const handleDeleteProgram = async () => {
    if (!programToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`${baseUrl}/programs.php`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId: programToDelete.rawId || programToDelete.id,
          delete: true,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Program deleted!");
        dispatch(fetchPrograms());
        setIsDeleteModalOpen(false);
      } else {
        toast.error(`Delete failed: ${result.message || "unknown"}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error deleting program");
    } finally {
      setDeleting(false);
      setProgramToDelete(null);
    }
  };

  const handleArchiveProgram = async (programId) => {
    const program =
      genericPrograms.find((p) => p.id === programId) ||
      clientPrograms.find((p) => p.id === programId);
    if (!program || !program.rawId) {
      toast.error("Program not found");
      return;
    }

    const willArchive = !program.archived;
    const updatedStatus = willArchive ? "Inactive" : "Active";

    try {
      const res = await fetch(`${baseUrl}/programs.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId: program.rawId,
          archived: willArchive ? 1 : 0,
          status: updatedStatus,
        }),
      });

      const result = await res.json();

      if (result.success) {
        dispatch(
          toggleArchiveProgram({
            programId: program.rawId,
            archived: willArchive ? 1 : 0,
            status: updatedStatus,
          })
        );
        toast.success(willArchive ? "Program archived!" : "Program restored!");
      } else {
        toast.error(`Failed: ${result.message || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Archive error:", err);
      toast.error("Network error. Try again.");
    }
  };

  const openEditModal = (program) => {
    setEditingProgram(program);
    setIsAddModalOpen(true);
  };

  return (
    <div className="space-y-8">
      <Toaster />

      {/* <AddProgramModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingProgram(null);
        }}
        onAdd={handleAddProgram}
        onEdit={handleEditProgram}
        domains={programsData?.domains || []}
        loading={loading}
        editingProgram={editingProgram}
      /> */}
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
        onConfirm={() =>
          programToArchive && handleArchiveProgram(programToArchive.id)
        }
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

      <Card className="shadow-lg border-0">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search programs..."
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
                    Generic programs
                  </div>
                </SelectItem>
                <SelectItem value="client">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-600" />
                    Client programs
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
          </div>
        </CardContent>
      </Card>

      {loading || loadingClientData ? (
        <div className="h-64 mx-auto">
          <p className="text-center animate-pulse text-gray-500">
            Fetching programs…
          </p>
        </div>
      ) : (
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-teal-600" />
                {viewMode === "generic" && "Generic"}
                {viewMode === "client" && "Client"}
                {viewMode === "all" && "All"} Programs
              </div>
              <Badge variant="secondary">
                {displayedPrograms.length} program
                {displayedPrograms.length !== 1 ? "s" : ""}
              </Badge>
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
                      Program Name
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700">
                      Type
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
                  {displayedPrograms.map((program) => (
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
                      <TableCell className="p-4">
                        <Badge
                          variant="outline"
                          className={
                            program.type === "generic"
                              ? "text-teal-700 border-teal-300"
                              : "text-purple-700 border-purple-300"
                          }
                        >
                          {program.type === "generic" ? "Generic" : "Client"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell p-4">
                        <Badge className={getStatusColor(program.status)}>
                          {program.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell p-4 text-slate-600">
                        {program.description || "N/A"}
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
                                className="border-slate-300"
                                onClick={() => {
                                  setProgramToArchive(program);
                                  setIsArchiveModalOpen(true);
                                }}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem
                                onClick={() => handleArchiveProgram(program.id)}
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

              {displayedPrograms.length === 0 && (
                <div className="text-center py-12">
                  <Layers className="h-12 w-12 text-slate-400 mx-auto mb-4" />
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
