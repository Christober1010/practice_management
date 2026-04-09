"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import toast from "react-hot-toast";

export default function AddFacilityTypeModal({
  isOpen,
  onClose,
  onAdd,
  loading = false,
  editingFacilityType = null,
}) {
  const isEditing = !!editingFacilityType;

  const [form, setForm] = useState({
    pos_code: "",
    facility_name: "",
    description: "",
    active: true,
  });

  useEffect(() => {
    if (isEditing && editingFacilityType) {
      setForm({
        pos_code: editingFacilityType.pos_code || "",
        facility_name: editingFacilityType.facility_name || "",
        description: editingFacilityType.description || "",
        active: editingFacilityType.active === 1,
      });
    } else {
      setForm({
        pos_code: "",
        facility_name: "",
        description: "",
        active: true,
      });
    }
  }, [editingFacilityType, isEditing, isOpen]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSelectChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.pos_code.trim()) {
      toast.error("POS code is required");
      return;
    }

    if (!form.facility_name.trim()) {
      toast.error("Facility name is required");
      return;
    }

    // Validate POS code format (should be numeric, 2 digits)
    if (!/^\d{2}$/.test(form.pos_code.trim())) {
      toast.error("POS code must be a 2-digit number (01-99)");
      return;
    }

    const payload = {
      ...(isEditing ? { id: editingFacilityType.id } : {}),
      pos_code: form.pos_code.trim(),
      facility_name: form.facility_name.trim(),
      description: form.description.trim() || null,
      active: form.active ? 1 : 0,
    };

    await onAdd(payload);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Facility Type" : "Add Facility Type"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pos_code">
                POS Code <span className="text-red-500">*</span>
              </Label>
              <Input
                id="pos_code"
                name="pos_code"
                value={form.pos_code}
                onChange={handleChange}
                placeholder="e.g., 11, 12, 21"
                maxLength={2}
                disabled={isEditing}
                required
              />
              <p className="text-xs text-gray-500">
                CMS Place of Service code (2 digits, 01-99)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="facility_name">
                Facility Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="facility_name"
                name="facility_name"
                value={form.facility_name}
                onChange={handleChange}
                placeholder="e.g., Office, Home, Hospital"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Enter full CMS description..."
              rows={4}
              className="resize-none"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="active"
              name="active"
              checked={form.active}
              onCheckedChange={(checked) =>
                setForm((prev) => ({ ...prev, active: checked }))
              }
            />
            <Label htmlFor="active" className="cursor-pointer">
              Active (visible in dropdowns)
            </Label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-teal-600 hover:bg-teal-700">
              {loading
                ? "Saving..."
                : isEditing
                ? "Update Facility Type"
                : "Add Facility Type"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
