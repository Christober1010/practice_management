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
import { fetchPrograms, toggleArchiveDomain } from "@/app/store/programSlice";

import AddDomainModal from "./add-domain-modal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import ArchiveConfirmModal from "./ArchiveConfirmModal";

export default function DomainsList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const [viewMode, setViewMode] = useState("generic"); // "generic" | "client" | "all"

  const [clientDomainsData, setClientDomainsData] = useState({
    domains: [],
    modules: [],
  });
  const [loadingClientData, setLoadingClientData] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [domainToDelete, setDomainToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [domainToArchive, setDomainToArchive] = useState(null);
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
        setClientDomainsData({
          domains: Array.isArray(data.domains) ? data.domains : [],
          modules: Array.isArray(data.modules) ? data.modules : [],
        });
      } else {
        setClientDomainsData({ domains: [], modules: [] });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load client domains");
      setClientDomainsData({ domains: [], modules: [] });
    } finally {
      setLoadingClientData(false);
    }
  };

  useEffect(() => {
    if (viewMode === "client" || viewMode === "all") {
      fetchClientSpecificData();
    } else {
      setClientDomainsData({ domains: [], modules: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  const genericDomains = useMemo(() => {
    if (!programsData?.domains) return [];
    return programsData.domains.map((d) => {
      const module = programsData.modules?.find(
        (m) => String(m.id) === String(d.module_id || d.moduleId)
      );
      return {
        id: `generic-${d.id}`,
        rawId: d.id,
        name: d.name || d.NAME || "Unnamed Domain",
        description: d.description || "",
        status: d.status || d.STATUS || "Active",
        archived: !!d.archived,
        moduleId: d.module_id || d.moduleId,
        moduleName: module?.name || module?.NAME || "N/A",
        type: "generic",
      };
    });
  }, [programsData]);

  const clientDomains = useMemo(() => {
    if (!clientDomainsData.domains?.length) return [];
    return clientDomainsData.domains.map((d) => {
      const module = clientDomainsData.modules?.find(
        (m) => String(m.id) === String(d.module_id || d.moduleId)
      );
      return {
        id: `client-${d.id}`,
        rawId: d.id,
        name: d.NAME || d.name || "Unnamed Domain",
        description: d.description || "",
        status: d.STATUS || d.status || "Active",
        archived: d.archived === 1 || d.archived === true,
        moduleId: d.module_id || d.moduleId,
        moduleName: module?.NAME || module?.name || "N/A",
        type: "client",
      };
    });
  }, [clientDomainsData.domains, clientDomainsData.modules]);

  const displayedDomains = useMemo(() => {
    let baseDomains = [];
    if (viewMode === "generic") {
      baseDomains = genericDomains;
    } else if (viewMode === "client") {
      baseDomains = clientDomains;
    } else {
      baseDomains = [...genericDomains, ...clientDomains];
    }

    return baseDomains
      .filter((domain) => {
        const matchesSearch = [
          domain.name,
          domain.description,
          domain.moduleName,
        ].some((v) =>
          String(v || "").toLowerCase().includes(searchTerm.toLowerCase())
        );
        const matchesStatus =
          statusFilter === "all" || domain.status === statusFilter;
        const matchesArchived = domain.archived === showArchived;
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
  ]);

  const activeDomainCount =
    genericDomains.filter((m) => !m.archived).length || 0;
  const archivedDomainCount =
    genericDomains.filter((m) => m.archived).length || 0;

  const handleAddDomain = async (newDomain) => {
    try {
      const res = await fetch(`${baseUrl}/programs.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains: [newDomain] }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Domain added successfully!");
        dispatch(fetchPrograms());
        setIsAddModalOpen(false);
      } else {
        toast.error(`Failed: ${result.message || "unknown error"}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error adding domain");
    }
  };

  const handleEditDomain = async (updatedDomain) => {
    try {
      const payload = {
        domainId: updatedDomain.rawId || updatedDomain.id,
        name: updatedDomain.name,
        description: updatedDomain.description,
        status: updatedDomain.status,
        moduleId: updatedDomain.moduleId,
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
        toast.success("Domain updated!");
        dispatch(fetchPrograms());
        setIsAddModalOpen(false);
        setEditingDomain(null);
      } else {
        toast.error(`Failed: ${result.message || "unknown error"}`);
      }
    } catch (err) {
      console.error("Error updating domain:", err);
      toast.error("Error updating domain");
    }
  };

  const handleDeleteDomain = async () => {
    if (!domainToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`${baseUrl}/programs.php`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domainId: domainToDelete.rawId || domainToDelete.id,
          delete: true,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Domain deleted!");
        dispatch(fetchPrograms());
        setIsDeleteModalOpen(false);
      } else {
        toast.error(`Delete failed: ${result.message || "unknown"}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error deleting domain");
    } finally {
      setDeleting(false);
      setDomainToDelete(null);
    }
  };

  const handleArchiveDomain = async (domainId) => {
    const domain =
      genericDomains.find((d) => d.id === domainId) ||
      clientDomains.find((d) => d.id === domainId);
    if (!domain || !domain.rawId) {
      toast.error("Domain not found");
      return;
    }

    const willArchive = !domain.archived;
    const updatedStatus = willArchive ? "Inactive" : "Active";

    try {
      const res = await fetch(`${baseUrl}/programs.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domainId: domain.rawId,
          archived: willArchive ? 1 : 0,
          status: updatedStatus,
        }),
      });

      const result = await res.json();

      if (result.success) {
        dispatch(
          toggleArchiveDomain({
            domainId: domain.rawId,
            archived: willArchive ? 1 : 0,
            status: updatedStatus,
          })
        );
        toast.success(willArchive ? "Domain archived!" : "Domain restored!");
      } else {
        toast.error(`Failed: ${result.message || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Archive error:", err);
      toast.error("Network error. Try again.");
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
        onEdit={handleEditDomain}
        modules={programsData?.modules || []}
        loading={loading}
        editingDomain={editingDomain}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDomainToDelete(null);
        }}
        onConfirm={handleDeleteDomain}
        moduleName={domainToDelete?.name || ""}
        loading={deleting}
      />

      <ArchiveConfirmModal
        isOpen={isArchiveModalOpen}
        onClose={() => {
          setIsArchiveModalOpen(false);
          setDomainToArchive(null);
        }}
        onConfirm={() => domainToArchive && handleArchiveDomain(domainToArchive.id)}
        domainName={domainToArchive?.name || ""}
        willArchive={!domainToArchive?.archived}
        loading={archiving}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Domains</h2>
          <p className="text-slate-600 mt-1">Manage domain master data</p>
        </div>
        <div className="flex flex-row flex-wrap gap-2 sm:items-center sm:justify-end">
          <Button
            onClick={() => {
              setEditingDomain(null);
              setIsAddModalOpen(true);
            }}
            className="bg-teal-600 hover:bg-teal-700 text-white"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Domain
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
                {activeDomainCount})
              </>
            ) : (
              <>
                <Archive className="h-4 w-4 mr-2" /> Show Archived (
                {archivedDomainCount})
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
                placeholder="Search domains..."
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
                    Generic domains
                  </div>
                </SelectItem>
                <SelectItem value="client">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-600" />
                    Client domains
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
            Fetching domains…
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
                {viewMode === "all" && "All"} Domains
              </div>
              <Badge variant="secondary">
                {displayedDomains.length} domain
                {displayedDomains.length !== 1 ? "s" : ""}
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
                      Domain Name
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
                  {displayedDomains.map((domain) => (
                    <TableRow
                      key={domain.id}
                      className="hover:bg-slate-50 transition-colors border-b"
                    >
                      <TableCell className="p-4 font-medium text-slate-800">
                        {domain.moduleName}
                      </TableCell>
                      <TableCell className="p-4 font-medium text-slate-800">
                        {domain.name}
                      </TableCell>
                      <TableCell className="p-4">
                        <Badge
                          variant="outline"
                          className={
                            domain.type === "generic"
                              ? "text-teal-700 border-teal-300"
                              : "text-purple-700 border-purple-300"
                          }
                        >
                          {domain.type === "generic" ? "Generic" : "Client"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell p-4">
                        <Badge className={getStatusColor(domain.status)}>
                          {domain.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell p-4 text-slate-600">
                        {domain.description || "N/A"}
                      </TableCell>

                      <TableCell className="py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(domain)}
                            className="border-slate-300 hover:bg-teal-50"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setDomainToDelete(domain);
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
                                  setDomainToArchive(domain);
                                  setIsArchiveModalOpen(true);
                                }}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem
                                onClick={() => handleArchiveDomain(domain.id)}
                                className={
                                  domain.archived
                                    ? "text-green-600"
                                    : "text-amber-600"
                                }
                              >
                                {domain.archived ? (
                                  <>
                                    <ArchiveRestore className="h-4 w-4 mr-2" />
                                    Restore Domain
                                  </>
                                ) : (
                                  <>
                                    <Archive className="h-4 w-4 mr-2" />
                                    Archive Domain
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

              {displayedDomains.length === 0 && (
                <div className="text-center py-12">
                  <Layers className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500">
                    No domains match your search.
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
