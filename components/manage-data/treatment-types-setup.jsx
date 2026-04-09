"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Heart, Plus, Edit, Trash2, Archive, ArchiveRestore } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import AddTreatmentTypeModal from "./add-treatment-type-modal";
import DeleteConfirmModal from "../master-data/DeleteConfirmModal";

export default function TreatmentTypesSetup() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const loadItems = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ showArchived: showArchived.toString() });
      const res = await fetch(`${baseUrl}/treatment-types.php?${params}`);
      const data = await res.json();
      if (data?.success) setItems(data.data || []);
      else toast.error(data?.message || "Failed to load treatment types");
    } catch { toast.error("Failed to load treatment types"); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (baseUrl) loadItems(); }, [baseUrl, showArchived]);

  const displayed = useMemo(() => {
    return items.filter((t) =>
      [t.treatment_name, t.description].some((v) =>
        String(v || "").toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [items, searchTerm]);

  const handleSave = async (payload) => {
    try {
      const method = editingItem ? "PUT" : "POST";
      const res = await fetch(`${baseUrl}/treatment-types.php`, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(editingItem ? "Treatment type updated!" : "Treatment type saved!");
        await loadItems();
        setIsAddModalOpen(false);
        setEditingItem(null);
      } else toast.error(result.message || "Save failed");
    } catch { toast.error("Network error"); }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      const res = await fetch(`${baseUrl}/treatment-types.php`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: itemToDelete.id }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Treatment type archived");
        await loadItems();
        setIsDeleteModalOpen(false);
        setItemToDelete(null);
      } else toast.error(result.message || "Failed to archive");
    } catch { toast.error("Network error"); }
  };

  return (
    <div className="space-y-8">
      <Toaster />
      <AddTreatmentTypeModal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); setEditingItem(null); }}
        onAdd={handleSave}
        loading={loading}
        editingItem={editingItem}
      />
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => { setIsDeleteModalOpen(false); setItemToDelete(null); }}
        onConfirm={handleDelete}
        moduleName={itemToDelete?.treatment_name || ""}
        loading={loading}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Treatment Types</h2>
          <p className="text-slate-600">Manage treatment types for insurance records</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => { setEditingItem(null); setIsAddModalOpen(true); }} className="bg-teal-600 hover:bg-teal-700">
            <Plus className="h-4 w-4 mr-2" /> Add Treatment Type
          </Button>
          <Button variant="outline" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? <><ArchiveRestore className="h-4 w-4 mr-2" /> Show Active</> : <><Archive className="h-4 w-4 mr-2" /> Show Archived</>}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search treatment types..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-20 text-gray-500">Loading...</div>
      ) : displayed.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-slate-500">No treatment types found.</CardContent></Card>
      ) : (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <div className="flex items-center gap-2"><Heart className="h-5 w-5" /> Treatment Types</div>
              <Badge variant="secondary">{displayed.length} type{displayed.length !== 1 && "s"}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-1">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="px-2">Treatment Name</TableHead>
                    <TableHead className="hidden md:table-cell">Description</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayed.map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium p-2">{item.treatment_name}</TableCell>
                      <TableCell className="hidden md:table-cell p-2"><div className="max-w-md truncate">{item.description || "—"}</div></TableCell>
                      <TableCell className="hidden sm:table-cell p-2">
                        <Badge className={item.active === 1 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                          {item.active === 1 ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right p-2">
                        <div className="flex justify-end gap-2 p-2">
                          <Button variant="outline" size="sm" onClick={() => { setEditingItem(item); setIsAddModalOpen(true); }}><Edit className="h-4 w-4" /></Button>
                          <Button variant="outline" size="sm" className="text-red-600 border-red-300" onClick={() => { setItemToDelete(item); setIsDeleteModalOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
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
