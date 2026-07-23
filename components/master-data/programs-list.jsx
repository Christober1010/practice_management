"use client";

import { mahaverseFetch } from "@/lib/mahaverse-api";

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
  Layers,
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

import AddProgramModal from "./add-program-modal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import {
  getDomainModuleLabel,
  mergeCanonicalDomainModules,
} from "@/lib/domain-module-options";

export default function ProgramsList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState("all"); // "generic" | "client" | "all"
  const [selectedClient, setSelectedClient] = useState("all");

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

  const dispatch = useAppDispatch();
  const programsData = useAppSelector((state) => state.programs.items || {});
  const clients = useAppSelector((state) => state.clients?.items || []);
  const loading = useAppSelector((state) => state.programs.loading);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;


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

      const url = selectedClientId
        ? `/client-modules.php?client_id=${encodeURIComponent(String(selectedClientId))}`
        : `/get-all.php`;

      const res = await mahaverseFetch(url);
      const data = await res.json();
      if (data && data.success) {
        const payload = data.data ?? data;
        setClientProgramsData({
          modules: Array.isArray(payload.modules) ? payload.modules : [],
          domains: Array.isArray(payload.domains) ? payload.domains : [],
          programs: Array.isArray(payload.programs) ? payload.programs : [],
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
    }
  }, [viewMode, selectedClient, clients]);

  // Check for pending client from client view navigation
  useEffect(() => {
    const pendingClient = localStorage.getItem("pendingClientForMasterData");
    const pendingAction = localStorage.getItem("pendingAction");
    const pendingType = localStorage.getItem("pendingMasterDataType");
    
    if (pendingClient && pendingAction === "add" && pendingType === "programs") {
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

  const allModules = useMemo(
    () =>
      mergeCanonicalDomainModules([
        ...(programsData?.modules || []),
        ...(clientProgramsData.modules || []),
      ]),
    [programsData?.modules, clientProgramsData.modules]
  );

  const genericPrograms = useMemo(() => {
    if (!programsData?.programs) return [];
    return programsData.programs.map((p) => {
      const domain = programsData.domains?.find(
        (d) => String(d.id) === String(p.domain_id || p.domainId)
      );
      const moduleId = domain?.module_id || domain?.moduleId;
      return {
        id: `generic-${p.id}`,
        rawId: p.id,
        name: p.name || p.NAME || "Unnamed Program",
        description: p.description || "",
        status: p.status || p.STATUS || "Active",
        archived: !!p.archived,
        domainId: p.domain_id || p.domainId,
        domainName: domain?.name || domain?.NAME || "N/A",
        moduleName: getDomainModuleLabel(allModules, moduleId),
        type: "generic",
      };
    });
  }, [programsData, allModules]);

  const clientPrograms = useMemo(() => {
    if (!clientProgramsData.programs?.length) return [];

    const clientMap = {};
    clients.forEach((c) => {
      clientMap[String(c.id)] =
        `${c.first_name || ""} ${c.last_name || ""}`.trim() ||
        c.name ||
        c.client_name ||
        "Unknown Client";
    });

    return clientProgramsData.programs.map((p) => {
      const domain = clientProgramsData.domains?.find(
        (d) => String(d.id) === String(p.domain_id || p.domainId)
      );
      const moduleId = domain?.module_id || domain?.moduleId;
      const clientName = clientMap[String(p.client_id)] || "Unknown Client";

      return {
        id: `client-${p.id}`,
        rawId: p.id,
        name: p.NAME || p.name || "Unnamed Program",
        description: p.description || "",
        status: p.STATUS || p.status || "Active",
        archived: p.archived === 1 || p.archived === true,
        domainId: p.domain_id || p.domainId,
        domainName: domain?.NAME || domain?.name || "—",
        moduleName: getDomainModuleLabel(allModules, moduleId),
        client_name: clientName,
        client_id: p.client_id,
        type: "client",
      };
    });
  }, [clientProgramsData.programs, clientProgramsData.domains, clients, allModules]);

  const clientNames = useMemo(() => {
    const names = clientPrograms.map((p) => p.client_name).filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [clientPrograms]);

  const displayedPrograms = useMemo(() => {
    let list = [];
    if (viewMode === "generic") list = genericPrograms;
    else if (viewMode === "client") list = clientPrograms;
    else list = [...genericPrograms, ...clientPrograms];

    if (selectedClient !== "all" && viewMode !== "generic") {
      list = list.filter((p) => p.client_name === selectedClient);
    }

    return list
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
    selectedClient,
  ]);


  const handleAddProgram = async (newProgram) => {
    const isClientProgram = newProgram.client_id != null;

    const payload = isClientProgram
      ? {
          client_id: newProgram.client_id,
          programs: [
            {
              id: newProgram.id,
              domainId: newProgram.domainId,
              name: newProgram.name,
              description: newProgram.description || "",
              status: newProgram.status || "Active",
              archived: 0,
            },
          ],
        }
      : {
          programs: [
            {
              id: newProgram.id,
              domainId: newProgram.domainId,
              name: newProgram.name,
              description: newProgram.description || "",
              status: newProgram.status || "Active",
              archived: 0,
            },
          ],
        };

    try {
      const url = isClientProgram ? "/client-modules.php" : "/programs.php";
      const res = await mahaverseFetch(`${url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (result.success) {
        toast.success("Program saved!");
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

  const handleEditProgram = async (updatedProgram) => {
    const isClientProgram = updatedProgram.client_id != null;

    try {
      let res;
      if (isClientProgram) {
        const payload = {
          client_id: updatedProgram.client_id,
          programs: [
            {
              id: updatedProgram.rawId || updatedProgram.id,
              domainId: updatedProgram.domainId,
              name: updatedProgram.name,
              description: updatedProgram.description || "",
              status: updatedProgram.status || "Active",
            },
          ],
        };
        res = await mahaverseFetch('/client-modules.php', {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        const payload = {
          programId: updatedProgram.rawId || updatedProgram.id,
          name: updatedProgram.name,
          description: updatedProgram.description,
          status: updatedProgram.status,
          domainId: updatedProgram.domainId,
        };
        res = await mahaverseFetch('/programs.php', {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      }

      const result = await res.json();

      if (result.success) {
        toast.success("Program updated!");
        dispatch(fetchPrograms());
        if (viewMode === "client" || viewMode === "all") {
          fetchClientSpecificData();
        }
        setIsAddModalOpen(false);
        setEditingProgram(null);
      } else {
        toast.error(result.message || "Update failed");
      }
    } catch (err) {
      toast.error("Network error");
    }
  };


  const handleDeleteProgram = async () => {
    const program = programToDelete;
    if (!program) return;
    const isClientProgram = program.type === "client";
    const programId = program.rawId || program.id;
    try {
      const res = await mahaverseFetch(
        isClientProgram ? "/client-modules.php" : "/programs.php",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isClientProgram
              ? {
                  client_id: program.client_id,
                  programId,
                }
              : {
                  programId,
                  delete: true,
                }
          ),
        }
      );
      const result = await res.json().catch(() => ({}));
      if (res.ok && result.success) {
        toast.success("Program deleted!");
        dispatch(fetchPrograms());
        if (viewMode === "client" || viewMode === "all") {
          fetchClientSpecificData();
        }
        setIsDeleteModalOpen(false);
        setProgramToDelete(null);
      } else {
        toast.error(result.message || "Delete failed");
      }
    } catch (err) {
      toast.error("Network error");
    }
  };

  const openEditModal = (program) => {
    setEditingProgram(program);
    setIsAddModalOpen(true);
  };

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
        domains={[...(programsData?.domains || []), ...(clientProgramsData.domains || [])]}
        modules={[...(programsData?.modules || []), ...(clientProgramsData.modules || [])]}
        clients={clients}
        loading={loading || loadingClientData}
        editingProgram={editingProgram}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setProgramToDelete(null);
        }}
        onConfirm={handleDeleteProgram}
        entityType="program"
        moduleName={programToDelete?.name || ""}
        loading={false}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Programs</h2>
          <p className="text-slate-600">Manage program master data</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => {
              setEditingProgram(null);
              setIsAddModalOpen(true);
            }}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Program
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
                placeholder="Search programs..."
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
                    programs
                  </div>
                </SelectItem>
                <SelectItem value="client">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-600" /> Client programs
                  </div>
                </SelectItem>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-teal-600" />
                    <Users className="h-4 w-4 text-purple-600" />
                    All programs
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
          </div>
        </CardContent>
      </Card>

      {loading || loadingClientData ? (
        <div className="text-center py-20 text-gray-500">Loading...</div>
      ) : displayedPrograms.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-slate-500">
            No programs found.
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                {viewMode === "generic" && "Generic"}
                {viewMode === "client" && "Client"}
                {viewMode === "all" && "All"} Programs
              </div>
              <Badge variant="secondary">
                {displayedPrograms.length} program
                {displayedPrograms.length !== 1 && "s"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-1">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="px-2">Program Name</TableHead>
                    <TableHead className="px-2">Module</TableHead>
                    <TableHead className="px-2">Domain</TableHead>
                    <TableHead className="px-2">Type</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Status
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {displayedPrograms.map((program) => (
                    <TableRow key={program.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium p-2">
                        {program.name}
                        {program.archived && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Archived
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="p-2 text-slate-700">
                        {program.moduleName || "—"}
                      </TableCell>

                      <TableCell className="p-2 text-slate-700">
                        {program.domainName || "—"}
                      </TableCell>

                      <TableCell className="p-2">
                        <Badge
                          variant="outline"
                          className={
                            program.type === "generic"
                              ? "text-teal-700 border-teal-300"
                              : "text-purple-700 border-purple-300"
                          }
                        >
                          {program.type === "generic"
                            ? "Generic"
                            : program.client_name || "Client"}
                        </Badge>
                      </TableCell>

                      <TableCell className="hidden sm:table-cell p-2">
                        <Badge
                          className={
                            program.status === "Active"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }
                        >
                          {program.status}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right p-2">
                        <div className="flex justify-end gap-2 p-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(program)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-300"
                            onClick={() => {
                              setProgramToDelete(program);
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
