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
import toast from "react-hot-toast";

export default function AddServiceCodeModal({
  isOpen,
  onClose,
  onAdd,
  loading = false,
  editingCode = null,
}) {
  const isEditing = !!editingCode;

  const [form, setForm] = useState({
    code: "",
    code_description: "",
    supervising_provider_rule: "",
  });

  useEffect(() => {
    if (isEditing && editingCode) {
      setForm({
        code: editingCode.code || "",
        code_description: editingCode.code_description || "",
        supervising_provider_rule: editingCode.supervising_provider_rule || "",
      });
    } else {
      setForm({
        code: "",
        code_description: "",
        supervising_provider_rule: "",
      });
    }
  }, [editingCode, isEditing, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.code.trim()) {
      toast.error("Service code is required");
      return;
    }
    if (!form.code_description.trim()) {
      toast.error("Service code description is required");
      return;
    }

    const payload = {
      ...(isEditing ? { code_id: editingCode.code_id } : {}),
      ...form,
    };

    try {
      await onAdd(payload);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save service code");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-center">
            <div className="text-lg font-semibold">
              {isEditing ? "Edit Service Code" : "Add New Service Code"}
            </div>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Service Code *</Label>
            <Input
              name="code"
              placeholder="e.g., H2019"
              value={form.code}
              onChange={handleChange}
              required
              disabled={loading || isEditing}
            />
          </div>

          <div className="space-y-2">
            <Label>Service Code Description *</Label>
            <Input
              name="code_description"
              placeholder="Description"
              value={form.code_description}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>Supervising Provider Rule</Label>
            <select
              name="supervising_provider_rule"
              value={form.supervising_provider_rule || ""}
              onChange={handleChange}
              disabled={loading}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Default (no special rule)</option>
              <option value="provider_as_supervising">Supervising = Provider</option>
              <option value="staff_assigned_supervisor">Supervising = Staff Assigned Supervisor</option>
            </select>
            <p className="text-xs text-slate-500">
              Used by Scheduling to auto-populate and validate Supervising Provider for this CPT.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {loading ? "Saving..." : isEditing ? "Update Service Code" : "Add Service Code"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

