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
  Link,
  Plus,
  Edit,
  Trash2,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import AddProviderServiceCodeModal from "./add-provider-service-code-modal";
import DeleteConfirmModal from "../master-data/DeleteConfirmModal";

export default function ProviderServiceCodeSetup() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [mappingToDelete, setMappingToDelete] = useState(null);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const loadMappings = async () => {
    try {
      setLoading(true);
      const res = await mahaverseFetch(`/provider-service-codes.php?showArchived=${showArchived}`);
      const data = await res.json();
      if (data?.success) {
        setMappings(data.data || []);
      } else {
        toast.error(data?.message || "Failed to load provider service codes");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load provider service codes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!baseUrl) return;
    loadMappings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, showArchived]);

  const displayedMappings = useMemo(() => {
    return mappings
      .filter((m) => {
        const matchesSearch = [
          m.provider_name,
          m.service_code,
          m.code_description,
        ].some((v) =>
          String(v || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
        );
        const matchesStatus =
          statusFilter === "all" || m.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const nameCompare = (a.provider_name || "").localeCompare(b.provider_name || "");
        if (nameCompare !== 0) return nameCompare;
        return (a.service_code || "").localeCompare(b.service_code || "");
      });
  }, [mappings, searchTerm, statusFilter]);

  const handleAddMapping = async (mapping) => {
    try {
      const method = editingMapping ? "PUT" : "POST";

      const res = await mahaverseFetch("/provider-service-codes.php", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mapping),
      });
      const result = await res.json();

      if (result.success) {
        toast.success(editingMapping ? "Mapping updated!" : "Mapping saved!");
        await loadMappings();
        setIsAddModalOpen(false);
        setEditingMapping(null);
      } else {
        toast.error(result.message || "Save failed");
      }
    } catch (err) {
      toast.error("Network error");
    }
  };

  const openEditModal = (mapping) => {
    setEditingMapping(mapping);
    setIsAddModalOpen(true);
  };

  const handleDelete = async () => {
    if (!mappingToDelete) return;
    try {
      const res = await mahaverseFetch('/provider-service-codes.php', {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: mappingToDelete.id }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Mapping archived");
        await loadMappings();
        setIsDeleteModalOpen(false);
        setMappingToDelete(null);
      } else {
        toast.error(result.message || "Failed to archive");
      }
    } catch (err) {
      toast.error("Network error");
    }
  };

  return (
    <div className="space-y-8">
      <Toaster />

      <AddProviderServiceCodeModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingMapping(null);
        }}
        onAdd={handleAddMapping}
        loading={loading}
        editingMapping={editingMapping}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setMappingToDelete(null);
        }}
        onConfirm={handleDelete}
        moduleName={`${mappingToDelete?.provider_name || ""} - ${mappingToDelete?.service_code || ""}`}
        loading={loading}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Provider Service Code Mapping</h2>
          <p className="text-slate-600">Map providers to service codes with rates and unit types</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => {
              setEditingMapping(null);
              setIsAddModalOpen(true);
            }}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Mapping
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
                placeholder="Search mappings..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

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
      {loading ? (
        <div className="text-center py-20 text-gray-500">Loading...</div>
      ) : displayedMappings.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-slate-500">
            No mappings found.
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                Provider Service Code Mappings
              </div>
              <Badge variant="secondary">
                {displayedMappings.length} mapping
                {displayedMappings.length !== 1 && "s"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-1">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="px-2">Provider</TableHead>
                    <TableHead className="px-2">Service Code</TableHead>
                    <TableHead className="hidden md:table-cell">Description</TableHead>
                    <TableHead className="hidden lg:table-cell">Unit Duration</TableHead>
                    <TableHead className="hidden lg:table-cell">Unit Type</TableHead>
                    <TableHead className="hidden md:table-cell">Rate ($)</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {displayedMappings.map((mapping) => (
                    <TableRow key={mapping.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium p-2">
                        {mapping.provider_name}
                        {mapping.archived && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Archived
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="p-2">{mapping.service_code}</TableCell>
                      <TableCell className="hidden md:table-cell p-2">
                        {mapping.code_description || "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell p-2">
                        {mapping.unit_duration || "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell p-2">
                        {mapping.unit_type || "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell p-2">
                        {mapping.rate ? `$${parseFloat(mapping.rate).toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell p-2">
                        <Badge
                          className={
                            mapping.status === "Active"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }
                        >
                          {mapping.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right p-2">
                        <div className="flex justify-end gap-2 p-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(mapping)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-300"
                            onClick={() => {
                              setMappingToDelete(mapping);
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

