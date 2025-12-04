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
import { Search, Layers, Plus, Edit, Trash2, Archive, ArchiveRestore, MoreVertical } from 'lucide-react';
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

  // Delete modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [domainToDelete, setDomainToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Archive modal
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

  const filteredDomains = useMemo(() => {
    if (!programsData?.domains) return [];

    return programsData.domains
      .map((d) => {
        const module = programsData.modules?.find(
          (m) => String(m.id) === String(d.module_id || d.moduleId)
        );
        return {
          ...d,
          moduleName: module?.name || "N/A",
          archived: !!d.archived,
        };
      })
      .filter((domain) => {
        const matchesSearch = [
          domain.name,
          domain.description,
          domain.moduleName,
        ].some((v) => v?.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesStatus =
          statusFilter === "all" || domain.status === statusFilter;

        const matchesArchived = domain.archived === showArchived;

        return matchesSearch && matchesStatus && matchesArchived;
      });
  }, [programsData, searchTerm, statusFilter, showArchived]);

  const activeDomainCount = programsData?.domains?.filter(
    (m) => !m.archived
  ).length || 0;
  
  const archivedDomainCount = programsData?.domains?.filter(
    (m) => m.archived
  ).length || 0;


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
        domainId: updatedDomain.id || updatedDomain.domainId,
        name: updatedDomain.name,
        description: updatedDomain.description,
        status: updatedDomain.status,
        moduleId: updatedDomain.moduleId,
      };

      console.log("[v0] Sending PUT request with payload:", payload);

      const res = await fetch(`${baseUrl}/programs.php`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      
      console.log("[v0] Response status:", res.status);
      const result = await res.json();
      console.log("[v0] Response body:", result);
      
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
      console.log(domainToDelete, "domaintoDle");
      const res = await fetch(`${baseUrl}/programs.php`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId: domainToDelete.id, delete: true }),
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
    const domain = programsData?.domains?.find((d) => d.id === domainId);
    if (!domain || !domain.id) {
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
          domainId: domain.id,
          archived: willArchive ? 1 : 0,
          status: updatedStatus,
        }),
      });

      const result = await res.json();

      if (result.success) {
        dispatch(
          toggleArchiveDomain({
            domainId: domain.id,
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

  useEffect(() => {
    dispatch(fetchPrograms());
  }, [dispatch]);

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
        onConfirm={handleArchiveDomain}
        domainName={domainToArchive?.name || ""}
        willArchive={!domainToArchive?.archived}
        loading={archiving}
      />

      {/* Header */}
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

      {/* Search & Filter */}
      <Card className="shadow-lg border-0">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search domains..."
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
        <div className="h-64 mx-auto">
          <p className="text-center animate-pulse text-gray-500">
            Fetching domains…
          </p>
        </div>
      ) : (
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800 flex items-center">
              <Layers className="h-5 w-5 mr-2 text-teal-600" />
              Domains ({filteredDomains.length})
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
                  {filteredDomains.map((domain) => (
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
                              const domainCopy = {
                                ...domain,
                                id: domain.id || domain.module_id,
                              };

                              console.log(
                                "Setting domainToDelete:",
                                domainCopy
                              );
                              setDomainToDelete(domainCopy);
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

              {filteredDomains.length === 0 && (
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
