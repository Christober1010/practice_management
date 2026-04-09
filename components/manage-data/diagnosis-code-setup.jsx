"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  FileText,
  Plus,
  Edit,
  Trash2,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import AddDiagnosisCodeModal from "./add-diagnosis-code-modal";
import DeleteConfirmModal from "../master-data/DeleteConfirmModal";

export default function DiagnosisCodeSetup() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [diagnosisCodes, setDiagnosisCodes] = useState([]);
  const [loading, setLoading] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [codeToDelete, setCodeToDelete] = useState(null);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const loadDiagnosisCodes = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${baseUrl}/diagnosis-codes.php?showArchived=${showArchived}`);
      const data = await res.json();
      if (data?.success) {
        setDiagnosisCodes(data.data || []);
      } else {
        toast.error(data?.message || "Failed to load diagnosis codes");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load diagnosis codes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!baseUrl) return;
    loadDiagnosisCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, showArchived]);

  const displayedCodes = useMemo(() => {
    return diagnosisCodes
      .filter((c) => {
        const matchesSearch = [
          c.diagnosis_code,
          c.diagnosis_description,
        ].some((v) =>
          String(v || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
        );
        return matchesSearch;
      })
      .sort((a, b) => a.diagnosis_code.localeCompare(b.diagnosis_code));
  }, [diagnosisCodes, searchTerm]);

  const handleAddDiagnosisCode = async (code) => {
    try {
      const url = `${baseUrl}/diagnosis-codes.php`;
      const method = editingCode ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(code),
      });
      const result = await res.json();

      if (result.success) {
        toast.success(editingCode ? "Diagnosis code updated!" : "Diagnosis code saved!");
        await loadDiagnosisCodes();
        setIsAddModalOpen(false);
        setEditingCode(null);
      } else {
        toast.error(result.message || "Save failed");
      }
    } catch (err) {
      toast.error("Network error");
    }
  };

  const openEditModal = (code) => {
    setEditingCode(code);
    setIsAddModalOpen(true);
  };

  const handleDelete = async () => {
    if (!codeToDelete) return;
    try {
      const res = await fetch(`${baseUrl}/diagnosis-codes.php`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: codeToDelete.id }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Diagnosis code archived");
        await loadDiagnosisCodes();
        setIsDeleteModalOpen(false);
        setCodeToDelete(null);
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

      <AddDiagnosisCodeModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingCode(null);
        }}
        onAdd={handleAddDiagnosisCode}
        loading={loading}
        editingCode={editingCode}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setCodeToDelete(null);
        }}
        onConfirm={handleDelete}
        moduleName={codeToDelete?.diagnosis_code || ""}
        loading={loading}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Diagnosis Codes</h2>
          <p className="text-slate-600">Manage diagnosis code master data</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => {
              setEditingCode(null);
              setIsAddModalOpen(true);
            }}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Diagnosis Code
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
                placeholder="Search diagnosis codes..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">Loading...</div>
      ) : displayedCodes.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-slate-500">
            No diagnosis codes found.
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Diagnosis Codes
              </div>
              <Badge variant="secondary">
                {displayedCodes.length} code
                {displayedCodes.length !== 1 && "s"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-1">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="px-2">Diagnosis Code</TableHead>
                    <TableHead className="px-2">Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {displayedCodes.map((code) => (
                    <TableRow key={code.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium p-2">
                        {code.diagnosis_code}
                        {code.archived && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Archived
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="p-2">{code.diagnosis_description}</TableCell>
                      <TableCell className="text-right p-2">
                        <div className="flex justify-end gap-2 p-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(code)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-300"
                            onClick={() => {
                              setCodeToDelete(code);
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

