"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import toast from "react-hot-toast";

export default function AddTreatmentTypeModal({ isOpen, onClose, onAdd, loading = false, editingItem = null }) {
  const isEditing = !!editingItem;
  const [form, setForm] = useState({ treatment_name: "", description: "", active: true });

  useEffect(() => {
    if (isEditing && editingItem) {
      setForm({ treatment_name: editingItem.treatment_name || "", description: editingItem.description || "", active: editingItem.active === 1 });
    } else {
      setForm({ treatment_name: "", description: "", active: true });
    }
  }, [editingItem, isEditing, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.treatment_name.trim()) { toast.error("Treatment name is required"); return; }
    const payload = {
      ...(isEditing ? { id: editingItem.id } : {}),
      treatment_name: form.treatment_name.trim(),
      description: form.description.trim() || null,
      active: form.active ? 1 : 0,
    };
    await onAdd(payload);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Treatment Type" : "Add Treatment Type"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="treatment_name">Treatment Name <span className="text-red-500">*</span></Label>
            <Input id="treatment_name" name="treatment_name" value={form.treatment_name} onChange={handleChange} placeholder="e.g., Behavioral therapy" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" value={form.description} onChange={handleChange} placeholder="Enter description..." rows={3} className="resize-none" />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="active" checked={form.active} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, active: checked }))} />
            <Label htmlFor="active" className="cursor-pointer">Active (visible in dropdowns)</Label>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-teal-600 hover:bg-teal-700">
              {loading ? "Saving..." : isEditing ? "Update" : "Add Treatment Type"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
