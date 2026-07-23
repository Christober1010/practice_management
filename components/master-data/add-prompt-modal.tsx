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

const EMPTY_FORM = {
  prompt_name: "",
  max_score: "",
  score_as_independent: "0",
  dtt: "0",
  ta: "0",
  maintenance: "0",
  status: "Active",
};

function yesNoValue(value) {
  return value === 1 || value === "1" || value === true ? "1" : "0";
}

export default function AddPromptModal({
  isOpen,
  onClose,
  onAdd,
  onEdit,
  editingPrompt = null,
  loading,
}) {
  const isEditMode = !!editingPrompt;
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!isOpen) return;
    if (editingPrompt) {
      setForm({
        prompt_name: editingPrompt.prompt_name || "",
        max_score:
          editingPrompt.max_score === null ||
          editingPrompt.max_score === undefined ||
          editingPrompt.max_score === ""
            ? ""
            : String(editingPrompt.max_score),
        score_as_independent: yesNoValue(editingPrompt.score_as_independent),
        dtt: yesNoValue(editingPrompt.dtt),
        ta: yesNoValue(editingPrompt.ta),
        maintenance: yesNoValue(editingPrompt.maintenance),
        status: editingPrompt.status || "Active",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [isOpen, editingPrompt]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.prompt_name.trim()) {
      toast.error("Prompt name is required.");
      return;
    }

    if (
      form.max_score !== "" &&
      form.max_score != null &&
      (Number.isNaN(Number(form.max_score)) ||
        Number(form.max_score) < 0 ||
        Number(form.max_score) > 100)
    ) {
      toast.error("Max Score must be a number between 0 and 100.");
      return;
    }

    const maxScore =
      form.max_score === "" || form.max_score == null ? null : form.max_score;

    try {
      if (isEditMode) {
        await onEdit({
          ...editingPrompt,
          ...form,
          id: editingPrompt.id,
          max_score: maxScore,
          updated_at: new Date().toISOString(),
        });
      } else {
        await onAdd({
          id: crypto.randomUUID(),
          ...form,
          max_score: maxScore,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      setForm(EMPTY_FORM);
      onClose();
    } catch (error) {
      console.error("Error saving prompt:", error);
      toast.error(isEditMode ? "Failed to update prompt." : "Failed to add prompt.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Master Prompt" : "Add New Master Prompt"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prompt_name">Prompt Name *</Label>
              <Input
                id="prompt_name"
                placeholder="Enter prompt name"
                value={form.prompt_name}
                onChange={(e) => handleChange("prompt_name", e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_score">Max Score (optional)</Label>
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
              {loading
                ? isEditMode
                  ? "Saving..."
                  : "Adding..."
                : isEditMode
                  ? "Save Changes"
                  : "Add Prompt"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
