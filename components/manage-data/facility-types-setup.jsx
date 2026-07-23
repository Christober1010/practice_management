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
  Building2,
  Plus,
  Edit,
  Trash2,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import AddFacilityTypeModal from "./add-facility-type-modal";
import DeleteConfirmModal from "../master-data/DeleteConfirmModal";

export default function FacilityTypesSetup() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [facilityTypes, setFacilityTypes] = useState([]);
  const [loading, setLoading] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingFacilityType, setEditingFacilityType] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [facilityTypeToDelete, setFacilityTypeToDelete] = useState(null);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const loadFacilityTypes = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        showArchived: showArchived.toString(),
        showInactive: showInactive.toString(),
      });
      const res = await mahaverseFetch(`/facility-types.php?${params}`);
      const data = await res.json();
      if (data?.success) {
        // Ensure pos_code is always a string and normalize any 3-digit codes with trailing zero
        const normalizedData = (data.data || []).map((ft) => ({
          ...ft,
          pos_code: (() => {
            const code = String(ft.pos_code || '').trim();
            // Normalize "010" -> "01", "030" -> "03", etc.
            if (code.length === 3 && code.match(/^\d{2}0$/)) {
              return code.slice(0, 2);
            }
            return code;
          })(),
        }));
        setFacilityTypes(normalizedData);
      } else {
        toast.error(data?.message || "Failed to load facility types");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load facility types");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!baseUrl) return;
    loadFacilityTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, showArchived, showInactive]);

  const displayedFacilityTypes = useMemo(() => {
    return facilityTypes
      .filter((ft) => {
        const matchesSearch = [
          ft.pos_code,
          ft.facility_name,
          ft.description,
        ].some((v) =>
          String(v || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
        );
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" && ft.active === 1) ||
          (statusFilter === "inactive" && ft.active === 0);
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        // Sort by pos_code numerically
        const codeA = parseInt(a.pos_code) || 999;
        const codeB = parseInt(b.pos_code) || 999;
        return codeA - codeB;
      });
  }, [facilityTypes, searchTerm, statusFilter]);

  const handleAddFacilityType = async (facilityType) => {
    try {
      const method = editingFacilityType ? "PUT" : "POST";

      const res = await mahaverseFetch("/facility-types.php", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(facilityType),
      });
      const result = await res.json();

      if (result.success) {
        toast.success(
          editingFacilityType
            ? "Facility type updated!"
            : "Facility type saved!"
        );
        await loadFacilityTypes();
        setIsAddModalOpen(false);
        setEditingFacilityType(null);
      } else {
        toast.error(result.message || "Save failed");
      }
    } catch (err) {
      toast.error("Network error");
    }
  };

  const openEditModal = (facilityType) => {
    setEditingFacilityType(facilityType);
    setIsAddModalOpen(true);
  };

  const handleDelete = async () => {
    if (!facilityTypeToDelete) return;
    try {
      const res = await mahaverseFetch('/facility-types.php', {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: facilityTypeToDelete.id }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Facility type archived");
        await loadFacilityTypes();
        setIsDeleteModalOpen(false);
        setFacilityTypeToDelete(null);
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

      <AddFacilityTypeModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingFacilityType(null);
        }}
        onAdd={handleAddFacilityType}
        loading={loading}
        editingFacilityType={editingFacilityType}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setFacilityTypeToDelete(null);
        }}
        onConfirm={handleDelete}
        entityType="facility type"
        moduleName={facilityTypeToDelete?.facility_name || ""}
        loading={loading}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Facility Types</h2>
          <p className="text-slate-600">
            Manage CMS Place of Service (POS) codes
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => {
              setEditingFacilityType(null);
              setIsAddModalOpen(true);
            }}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Facility Type
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
                placeholder="Search by POS code, name, or description..."
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
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">Loading...</div>
      ) : displayedFacilityTypes.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-slate-500">
            No facility types found.
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Facility Types
              </div>
              <Badge variant="secondary">
                {displayedFacilityTypes.length} facility type
                {displayedFacilityTypes.length !== 1 && "s"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-1">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="px-2">POS Code</TableHead>
                    <TableHead className="px-2">Facility Name</TableHead>
                    <TableHead className="hidden md:table-cell">Description</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {displayedFacilityTypes.map((facilityType) => (
                    <TableRow
                      key={facilityType.id}
                      className="hover:bg-slate-50"
                    >
                      <TableCell className="font-medium p-2">
                        {facilityType.pos_code}
                      </TableCell>
                      <TableCell className="p-2">
                        {facilityType.facility_name}
                      </TableCell>
                      <TableCell className="hidden md:table-cell p-2">
                        <div className="max-w-md truncate">
                          {facilityType.description || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell p-2">
                        <Badge
                          className={
                            facilityType.active === 1
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }
                        >
                          {facilityType.active === 1 ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right p-2">
                        <div className="flex justify-end gap-2 p-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(facilityType)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-300"
                            onClick={() => {
                              setFacilityTypeToDelete(facilityType);
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
