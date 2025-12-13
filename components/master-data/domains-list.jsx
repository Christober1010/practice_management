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
import toast, { Toaster } from "react-hot-toast";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import { fetchPrograms } from "@/app/store/programSlice";
import { fetchClients } from "@/app/store/clientSlice";

import AddDomainModal from "./add-domain-modal";
import DeleteConfirmModal from "./DeleteConfirmModal";

export default function DomainsList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState("all"); // "generic" | "client" | "all"
  const [selectedClient, setSelectedClient] = useState("all");

  const [clientData, setClientData] = useState({ modules: [], domains: [] });
  const [loadingClientData, setLoadingClientData] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [domainToDelete, setDomainToDelete] = useState(null);

  const dispatch = useAppDispatch();
  const programsData = useAppSelector((state) => state.programs.items || {});
  const clients = useAppSelector((state) => state.clients?.items || []);
  const loading = useAppSelector((state) => state.programs.loading);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  // Fetch data
  useEffect(() => {
    dispatch(fetchPrograms());
    dispatch(fetchClients());
  }, [dispatch]);

  const fetchClientData = async () => {
    try {
      setLoadingClientData(true);
      const res = await fetch(`${baseUrl}/get-all.php`);
      const data = await res.json();
      if (data?.success) {
        setClientData({
          modules: data.modules || [],
          domains: data.domains || [],
        });
      }
    } catch (err) {
      toast.error("Failed to load client data");
    } finally {
      setLoadingClientData(false);
    }
  };

  useEffect(() => {
    if (viewMode === "client" || viewMode === "all") {
      fetchClientData();
    }
  }, [viewMode]);

  // Check for pending client from client view navigation
  useEffect(() => {
    const pendingClient = localStorage.getItem("pendingClientForMasterData");
    const pendingAction = localStorage.getItem("pendingAction");
    const pendingType = localStorage.getItem("pendingMasterDataType");
    
    if (pendingClient && pendingAction === "add" && pendingType === "domains") {
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

  // Generic domains
  const genericDomains = useMemo(() => {
    if (!programsData.domains) return [];
    return programsData.domains.map((d) => {
      const module = programsData.modules?.find(
        (m) => String(m.id) === String(d.module_id || d.moduleId)
      );
      return {
        id: `generic-${d.id}`,
        rawId: d.id,
        name: d.name || d.NAME || "Unnamed",
        description: d.description || "",
        status: d.status || d.STATUS || "Active",
        archived: !!d.archived,
        moduleId: d.module_id || d.moduleId,
        moduleName: module?.name || module?.NAME || "—",
        type: "generic",
      };
    });
  }, [programsData]);

  // Client domains
  // Client domains - FIXED to get real client name
  const clientDomains = useMemo(() => {
    if (!clientData.domains.length) return [];

    // We'll match client_id with actual client from Redux store
    const clientMap = {};
    clients.forEach((c) => {
      clientMap[String(c.id)] =
        `${c.first_name || ""} ${c.last_name || ""}`.trim() ||
        c.name ||
        c.client_name ||
        "Unknown Client";
    });

    return clientData.domains.map((d) => {
      const module = clientData.modules.find(
        (m) => String(m.id) === String(d.module_id || d.moduleId)
      );

      const clientName = clientMap[String(d.client_id)] || "Unknown Client";

      return {
        id: `client-${d.id}`,
        rawId: d.id,
        name: d.name || d.NAME || "Unnamed Domain",
        description: d.description || "",
        status: d.status || d.STATUS || "Active",
        archived: d.archived === 1 || d.archived === true,
        moduleId: d.module_id || d.moduleId,
        moduleName: module?.name || module?.NAME || "—",
        client_name: clientName, // This will now show real name
        client_id: d.client_id,
        type: "client",
      };
    });
  }, [clientData.domains, clientData.modules, clients]);

  const clientNames = useMemo(() => {
    const names = clientDomains.map((d) => d.client_name).filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [clientDomains]);

  const displayedDomains = useMemo(() => {
    let list = [];
    if (viewMode === "generic") list = genericDomains;
    else if (viewMode === "client") list = clientDomains;
    else list = [...genericDomains, ...clientDomains];

    if (selectedClient !== "all" && viewMode !== "generic") {
      list = list.filter((d) => d.client_name === selectedClient);
    }

    return list
      .filter((d) => {
        const matchesSearch = [d.name, d.description, d.moduleName].some((v) =>
          String(v || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
        );
        const matchesStatus =
          statusFilter === "all" || d.status === statusFilter;
        const matchesArchived = d.archived === showArchived;
        return matchesSearch && matchesStatus && matchesArchived;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [
    viewMode,
    genericDomains,
    clientDomains,
    searchTerm,
    statusFilter,
    showArchived,
    selectedClient,
  ]);

  const handleAddDomain = async (domain) => {
    const isClientDomain = domain.client_id != null;

    const payload = isClientDomain
      ? {
          client_id: domain.client_id,
          domains: [
            {
              id: domain.id,
              moduleId: domain.moduleId,
              name: domain.name,
              description: domain.description || "",
              status: domain.status || "Active",
              archived: 0,
            },
          ],
        }
      : {
          domains: [
            {
              id: domain.id,
              moduleId: domain.moduleId,
              name: domain.name,
              description: domain.description || "",
              status: domain.status || "Active",
              archived: 0,
            },
          ],
        };

    try {
      const url = isClientDomain ? "/client-domain.php" : "/programs.php";
      const res = await fetch(`${baseUrl}${url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (result.success) {
        toast.success("Domain saved!");
        dispatch(fetchPrograms());
        if (viewMode === "client" || viewMode === "all") {
          fetchClientData();
        }
        setIsAddModalOpen(false);
      } else {
        toast.error(result.message || "Save failed");
      }
    } catch (err) {
      toast.error("Network error");
    }
  };

  const openEditModal = (domain) => {
    setEditingDomain(domain);
    setIsAddModalOpen(true);
  };

  return (
    <div className="space-y-8">
      <Toaster />

      <AddDomainModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingDomain(null);
        }}
        onAdd={handleAddDomain}
        modules={[...(programsData.modules || []), ...clientData.modules]}
        clients={clients}
        loading={loading || loadingClientData}
        editingDomain={editingDomain}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDomainToDelete(null);
        }}
        onConfirm={() => {
          // your delete logic here
        }}
        moduleName={domainToDelete?.name || ""}
        loading={false}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Domains</h2>
          <p className="text-slate-600">Manage domain master data</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => {
              setEditingDomain(null);
              setIsAddModalOpen(true);
            }}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Domain
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

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search domains..."
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
                  {console.log(clientNames, "clientNames")}
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
                    domains
                  </div>
                </SelectItem>
                <SelectItem value="client">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-600" /> Client domains
                  </div>
                </SelectItem>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-teal-600" />
                    <Users className="h-4 w-4 text-purple-600" />
                    All domains
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

      {/* Table */}
      {loading || loadingClientData ? (
        <div className="text-center py-20 text-gray-500">Loading...</div>
      ) : displayedDomains.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-slate-500">
            No domains found.
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
                {viewMode === "all" && "All"} Domains
              </div>
              <Badge variant="secondary">
                {displayedDomains.length} domain
                {displayedDomains.length !== 1 && "s"}
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
                    <TableHead className="px-2">Type</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Status
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {displayedDomains.map((domain) => (
                    <TableRow key={domain.id} className="hover:bg-slate-50">
                      {/* Module */}
                      <TableCell className="font-medium p-2">
                        {domain.moduleName}
                      </TableCell>

                      {/* Domain name + Archived badge */}
                      <TableCell className="font-medium p-2">
                        {domain.name}
                        {domain.archived && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Archived
                          </Badge>
                        )}
                      </TableCell>

                      {/* Type badge (same as modules table) */}
                      <TableCell className="p-2">
                        <Badge
                          variant="outline"
                          className={
                            domain.type === "generic"
                              ? "text-teal-700 border-teal-300"
                              : "text-purple-700 border-purple-300"
                          }
                        >
                          {domain.type === "generic"
                            ? "Generic"
                            : domain.client_name || "Client"}
                        </Badge>
                      </TableCell>

                      {/* Status badge with responsive visibility */}
                      <TableCell className="hidden sm:table-cell p-2">
                        <Badge
                          className={
                            domain.status === "Active"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }
                        >
                          {domain.status}
                        </Badge>
                      </TableCell>

                      {/* Actions aligned right, same spacing/buttons style */}
                      <TableCell className="text-right p-2">
                        <div className="flex justify-end gap-2 p-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(domain)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-300"
                            onClick={() => {
                              setDomainToDelete(domain);
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
