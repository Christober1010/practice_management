"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import toast from "react-hot-toast";

export default function AddMaintenancePeriodModal({
  isOpen,
  onClose,
  onSave,
  loading = false,
  editingPeriod = null,
}) {
  const isEditing = !!editingPeriod;
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("100");
  const [active, setActive] = useState("1");

  useEffect(() => {
    if (isEditing && editingPeriod) {
      setName(editingPeriod.name || "");
      setSortOrder(String(editingPeriod.sort_order ?? 100));
      setActive(String(editingPeriod.active === 0 || editingPeriod.active === "0" ? "0" : "1"));
    } else {
      setName("");
      setSortOrder("100");
      setActive("1");
    }
  }, [editingPeriod, isEditing, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    await onSave({
      ...(isEditing ? { id: editingPeriod.id } : {}),
      name: name.trim(),
      sort_order: Number.parseInt(sortOrder, 10) || 100,
      active: active === "1",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Maintenance Period" : "Add Maintenance Period"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mp-name">Name *</Label>
            <Input
              id="mp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Every Other Week"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mp-order">Sort order</Label>
            <Input
              id="mp-order"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={active} onValueChange={setActive} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Active</SelectItem>
                <SelectItem value="0">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {isEditing ? "Save" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
