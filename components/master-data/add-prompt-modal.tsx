"use client";

import { useState } from "react";
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

export default function AddPromptModal({ isOpen, onClose, onAdd, loading }) {
  const [form, setForm] = useState({
    prompt_name: "",
    max_score: "",
    score_as_independent: "0",
    dtt: "0",
    ta: "0",
    maintenance: "0",
    status: "Active",
  });

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.prompt_name.trim() || !form.max_score) {
      toast.error("Prompt name and Max Score are required.");
      return;
    }

    try {
      const newPrompt = {
        id: crypto.randomUUID(),
        ...form,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await onAdd(newPrompt);

      setForm({
        prompt_name: "",
        max_score: "",
        score_as_independent: "0",
        dtt: "0",
        ta: "0",
        maintenance: "0",
        status: "Active",
      });
      onClose();
    } catch (error) {
      console.error("Error adding prompt:", error);
      toast.error("Failed to add prompt.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add New Master Prompt</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          {/* Prompt Name */}
          <div className="space-y-4 grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prompt_name">Prompt Name</Label>
              <Input
                id="prompt_name"
                placeholder="Enter prompt name"
                value={form.prompt_name}
                onChange={(e) => handleChange("prompt_name", e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Max Score */}
            <div className="space-y-2">
              <Label htmlFor="max_score">Max Score</Label>
              <Input
                id="max_score"
                type="number"
                min="0"
                max="100"
                placeholder="Enter max score"
                value={form.max_score}
                onChange={(e) => handleChange("max_score", e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Score as Independent */}
            <div className="space-y-2">
              <Label>Score as Independent</Label>
              <Select
                value={form.score_as_independent}
                onValueChange={(v) => handleChange("score_as_independent", v)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Yes</SelectItem>
                  <SelectItem value="0">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* DTT */}
            <div className="space-y-2">
              <Label>DTT</Label>
              <Select
                value={form.dtt}
                onValueChange={(v) => handleChange("dtt", v)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Yes</SelectItem>
                  <SelectItem value="0">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* TA */}
            <div className="space-y-2">
              <Label>TA</Label>
              <Select
                value={form.ta}
                onValueChange={(v) => handleChange("ta", v)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Yes</SelectItem>
                  <SelectItem value="0">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Maintenance */}
            <div className="space-y-2">
              <Label>Maintenance</Label>
              <Select
                value={form.maintenance}
                onValueChange={(v) => handleChange("maintenance", v)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Yes</SelectItem>
                  <SelectItem value="0">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => handleChange("status", v)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 justify-end mt-8">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Prompt"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
