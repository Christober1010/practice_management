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
  User,
  Plus,
  Edit,
  Trash2,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import AddProviderModal from "./add-provider-modal";
import DeleteConfirmModal from "../master-data/DeleteConfirmModal";

export default function ProviderSetup() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState(null);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const loadProviders = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${baseUrl}/providers.php?showArchived=${showArchived}`);
      const data = await res.json();
      if (data?.success) {
        setProviders(data.data || []);
      } else {
        toast.error(data?.message || "Failed to load providers");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load providers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!baseUrl) return;
    loadProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, showArchived]);

  const displayedProviders = useMemo(() => {
    return providers
      .filter((p) => {
        const matchesSearch = [
          p.provider_name,
          p.provider_code,
          p.email,
          p.phone,
          p.city,
          p.state,
        ].some((v) =>
          String(v || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
        );
        const matchesStatus =
          statusFilter === "all" || p.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => a.provider_name.localeCompare(b.provider_name));
  }, [providers, searchTerm, statusFilter]);

  const handleAddProvider = async (provider) => {
    try {
      const url = editingProvider
        ? `${baseUrl}/providers.php`
        : `${baseUrl}/providers.php`;
      const method = editingProvider ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(provider),
      });
      const result = await res.json();

      if (result.success) {
        toast.success(editingProvider ? "Provider updated!" : "Provider saved!");
        await loadProviders();
        setIsAddModalOpen(false);
        setEditingProvider(null);
      } else {
        toast.error(result.message || "Save failed");
      }
    } catch (err) {
      toast.error("Network error");
    }
  };

  const openEditModal = (provider) => {
    setEditingProvider(provider);
    setIsAddModalOpen(true);
  };

  const handleDelete = async () => {
    if (!providerToDelete) return;
    try {
      const res = await fetch(`${baseUrl}/providers.php`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: providerToDelete.id }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Provider archived");
        await loadProviders();
        setIsDeleteModalOpen(false);
        setProviderToDelete(null);
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

      <AddProviderModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingProvider(null);
        }}
        onAdd={handleAddProvider}
        loading={loading}
        editingProvider={editingProvider}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setProviderToDelete(null);
        }}
        onConfirm={handleDelete}
        moduleName={providerToDelete?.provider_name || ""}
        loading={loading}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Providers</h2>
          <p className="text-slate-600">Manage provider master data</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => {
              setEditingProvider(null);
              setIsAddModalOpen(true);
            }}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Provider
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
                placeholder="Search providers..."
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
      ) : displayedProviders.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-slate-500">
            No providers found.
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Providers
              </div>
              <Badge variant="secondary">
                {displayedProviders.length} provider
                {displayedProviders.length !== 1 && "s"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-1">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="px-2">Provider Name</TableHead>
                    <TableHead className="px-2">Provider ID</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead className="hidden md:table-cell">Phone</TableHead>
                    <TableHead className="hidden lg:table-cell">City</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {displayedProviders.map((provider) => (
                    <TableRow key={provider.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium p-2">
                        {provider.provider_name}
                        
                      </TableCell>
                      <TableCell className="p-2">{provider.provider_code || "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell p-2">
                        {provider.email || "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell p-2">
                        {provider.phone || "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell p-2">
                        {provider.city || "—"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell p-2">
                        <Badge
                          className={
                            provider.status === "Active"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }
                        >
                          {provider.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right p-2">
                        <div className="flex justify-end gap-2 p-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(provider)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-300"
                            onClick={() => {
                              setProviderToDelete(provider);
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
