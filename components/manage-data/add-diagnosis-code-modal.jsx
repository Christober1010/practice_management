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

export default function AddDiagnosisCodeModal({
  isOpen,
  onClose,
  onAdd,
  loading = false,
  editingCode = null,
}) {
  const isEditing = !!editingCode;

  const [form, setForm] = useState({
    diagnosis_code: "",
    diagnosis_description: "",
  });

  useEffect(() => {
    if (isEditing && editingCode) {
      setForm({
        diagnosis_code: editingCode.diagnosis_code || "",
        diagnosis_description: editingCode.diagnosis_description || "",
      });
    } else {
      setForm({
        diagnosis_code: "",
        diagnosis_description: "",
      });
    }
  }, [editingCode, isEditing, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.diagnosis_code.trim()) {
      toast.error("Diagnosis code is required");
      return;
    }
    if (!form.diagnosis_description.trim()) {
      toast.error("Diagnosis description is required");
      return;
    }

    const payload = {
      ...(isEditing ? { id: editingCode.id } : {}),
      ...form,
    };

    try {
      await onAdd(payload);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save diagnosis code");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-center">
            <div className="text-lg font-semibold">
              {isEditing ? "Edit Diagnosis Code" : "Add New Diagnosis Code"}
            </div>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Diagnosis Code *</Label>
            <Input
              name="diagnosis_code"
              placeholder="e.g., F84.0"
              value={form.diagnosis_code}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>Diagnosis Description *</Label>
            <Input
              name="diagnosis_description"
              placeholder="e.g., Autistic disorder"
              value={form.diagnosis_description}
              onChange={handleChange}
              required
              disabled={loading}
            />
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
              {loading ? "Saving..." : isEditing ? "Update Diagnosis Code" : "Add Diagnosis Code"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

