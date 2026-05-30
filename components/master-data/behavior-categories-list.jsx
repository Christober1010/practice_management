"use client";

import { mahaverseFetch } from "@/lib/mahaverse-api";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, Plus, Edit, Archive, ArchiveRestore, Search } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import DeleteConfirmModal from "./DeleteConfirmModal";
import { isDbArchived } from "@/lib/behavior-recording-types";

function generateId() {
  return `bcat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function BehaviorCategoriesList() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    if (!baseUrl) return;
    setLoading(true);
    try {
      const res = await mahaverseFetch('/behaviors.php');
      const data = await res.json();
      if (data?.success) {
        setCategories(data.data?.categories || []);
      }
    } catch {
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return categories.filter(
      (c) =>
        (showArchived || !isDbArchived(c)) && (!q || (c.name || "").toLowerCase().includes(q))
    );
  }, [categories, searchTerm, showArchived]);

  const openAdd = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setFormOpen(true);
  };

  const openEdit = (cat) => {
    setEditing(cat);
    setName(cat.name || "");
    setDescription(cat.description || "");
    setFormOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Category name is required");
      return;
    }
    try {
      const payload = {
        categories: [
          {
            id: editing?.id || generateId(),
            name: name.trim(),
            description: description.trim(),
            status: "Active",
            archived: 0,
          },
        ],
      };
      const res = await mahaverseFetch('/behaviors.php', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || "Save failed");
      toast.success(editing ? "Category updated" : "Category added");
      setFormOpen(false);
      load();
    } catch (err) {
      toast.error(err?.message || "Save failed");
    }
  };

  const handleArchive = async (cat) => {
    try {
      const res = await mahaverseFetch('/behaviors.php', {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "category", id: cat.id }),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || "Archive failed");
      toast.success("Category archived");
      load();
    } catch (err) {
      toast.error(err?.message || "Archive failed");
    }
  };

  const handleRestoreCategory = async (cat) => {
    try {
      const payload = {
        categories: [
          {
            id: cat.id,
            name: cat.name || "",
            description: (cat.description ?? "").trim(),
            status: "Active",
            archived: 0,
          },
        ],
      };
      const res = await mahaverseFetch('/behaviors.php', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || "Restore failed");
      toast.success("Category restored");
      load();
    } catch (err) {
      toast.error(err?.message || "Restore failed");
    }
  };

  return (
    <div className="space-y-6">
      <Toaster />
      <DeleteConfirmModal
        variant="archive"
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          handleArchive(deleteTarget);
          setDeleteTarget(null);
        }}
        title="Archive category?"
        message={`Archive "${deleteTarget?.name}"?`}
      />

      {formOpen && (
        <Dialog open={formOpen} onOpenChange={(open) => !open && setFormOpen(false)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-center">
                <div className="flex items-center justify-center gap-2 text-lg font-semibold">
                  <FolderOpen className="h-5 w-5 text-amber-600" />
                  {editing ? "Edit Behavior Category" : "Add Behavior Category"}
                </div>
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="category-name">Category Name *</Label>
                <Input
                  id="category-name"
                  placeholder="e.g., Aggression, Self-Injury"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-description">Description (optional)</Label>
                <Textarea
                  id="category-description"
                  placeholder="Brief description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFormOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
                  {editing ? "Save Changes" : "Add Category"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Behavior Categories</h2>
          <p className="text-slate-600 mt-1">Master categories for behavior reduction</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowArchived((v) => !v)}>
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
          <Button onClick={openAdd} className="bg-teal-600 hover:bg-teal-700">
            <Plus className="h-4 w-4 mr-2" /> Add Category
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              className="pl-10"
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-teal-600" />
            Categories ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-center text-slate-500">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Archived</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-slate-500">
                      No categories found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell className="font-medium">{cat.name}</TableCell>
                      <TableCell className="text-slate-600">{cat.description || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{cat.status || "Active"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            isDbArchived(cat)
                              ? "border-amber-300 text-amber-800"
                              : "border-transparent"
                          }
                        >
                          {isDbArchived(cat) ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 whitespace-nowrap">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          {!isDbArchived(cat) ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-slate-300"
                                title="Edit"
                                onClick={() => openEdit(cat)}
                              >
                                <span>
                                  <Edit className="h-4 w-4" />
                                </span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-slate-300 text-amber-600"
                                title="Archive"
                                onClick={() => setDeleteTarget(cat)}
                              >
                                <span>
                                  <Archive className="h-4 w-4" />
                                </span>
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-slate-300 text-green-600"
                              title="Restore"
                              onClick={() => handleRestoreCategory(cat)}
                            >
                              <span>
                                <ArchiveRestore className="h-4 w-4" />
                              </span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
