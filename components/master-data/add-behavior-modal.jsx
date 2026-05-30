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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Activity, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import {
  DEFAULT_RECORDING_TYPE,
  RECORDING_TYPES,
  recordingTypeLabel,
  isDbActive,
  isDbTruthy,
} from "@/lib/behavior-recording-types";

function generateId() {
  return `beh_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function AddBehaviorModal({
  isOpen,
  onClose,
  onSave,
  categories = [],
  clients = [],
  loading = false,
  editingBehavior = null,
  recordingTypeLocked = false,
  clientName = "",
  hideClientSelector = false,
}) {
  const isEditing = !!editingBehavior;

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [goalName, setGoalName] = useState("");
  const [behaviorFunction, setBehaviorFunction] = useState("");
  const [definition, setDefinition] = useState("");
  const [recordingType, setRecordingType] = useState(DEFAULT_RECORDING_TYPE);
  const [doNotZeroOut, setDoNotZeroOut] = useState(false);
  const [excludeFromAbc, setExcludeFromAbc] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [status, setStatus] = useState("Active");
  const [selectedClientValue, setSelectedClientValue] = useState("generic");

  const selectedClientObj =
    selectedClientValue === "generic"
      ? null
      : clients.find(
          (c) => String(c.id || c.client_id) === String(selectedClientValue)
        ) || null;

  const selectedCategory = categories.find((c) => c.id === categoryId);

  useEffect(() => {
    if (isEditing && editingBehavior) {
      setName(editingBehavior.name || "");
      setCategoryId(editingBehavior.category_id || editingBehavior.categoryId || "");
      setGoalName(editingBehavior.goal_name || editingBehavior.goalName || "");
      setBehaviorFunction(editingBehavior.function || "");
      setDefinition(editingBehavior.definition || "");
      setRecordingType(
        editingBehavior.recording_type ||
          editingBehavior.recordingType ||
          DEFAULT_RECORDING_TYPE
      );
      setDoNotZeroOut(isDbTruthy(editingBehavior.do_not_zero_out ?? editingBehavior.doNotZeroOut));
      setExcludeFromAbc(isDbTruthy(editingBehavior.exclude_from_abc ?? editingBehavior.excludeFromAbc));
      setIsActive(isDbActive(editingBehavior));
      setStatus(editingBehavior.status || "Active");
      setSelectedClientValue(
        editingBehavior.client_id ? String(editingBehavior.client_id) : "generic"
      );
    } else {
      setName("");
      setCategoryId("");
      setGoalName("");
      setBehaviorFunction("");
      setDefinition("");
      setRecordingType(DEFAULT_RECORDING_TYPE);
      setDoNotZeroOut(false);
      setExcludeFromAbc(false);
      setIsActive(true);
      setStatus("Active");

      if (hideClientSelector && clients.length === 1) {
        setSelectedClientValue(String(clients[0].id || clients[0].client_id));
      } else {
        const pendingClient = localStorage.getItem("pendingClientForMasterData");
        if (pendingClient && isOpen) {
          try {
            const info = JSON.parse(pendingClient);
            if (info?.clientId) setSelectedClientValue(String(info.clientId));
            else setSelectedClientValue("generic");
          } catch {
            setSelectedClientValue("generic");
          }
        } else {
          setSelectedClientValue("generic");
        }
      }
    }
  }, [isEditing, editingBehavior, isOpen, hideClientSelector, clients]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Behavior name is required");
      return;
    }

    const payload = {
      id: editingBehavior?.id || generateId(),
      category_id: categoryId || null,
      name: name.trim(),
      goal_name: goalName.trim(),
      function: behaviorFunction.trim(),
      definition: definition.trim(),
      recording_type: recordingType,
      do_not_zero_out: doNotZeroOut ? 1 : 0,
      exclude_from_abc: excludeFromAbc ? 1 : 0,
      is_active: isActive ? 1 : 0,
      status,
      archived: 0,
    };

    if (selectedClientValue !== "generic") {
      payload.client_id = selectedClientValue;
    }

    try {
      await onSave(payload, selectedClientValue !== "generic");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Failed to save behavior");
    }
  };

  const displayClientName =
    clientName ||
    (selectedClientObj
      ? `${selectedClientObj.first_name || ""} ${selectedClientObj.last_name || ""}`.trim() ||
        selectedClientObj.NAME ||
        selectedClientObj.name ||
        selectedClientObj.client_name
      : "");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={24} className="text-red-600" />
              <span className="text-xl font-semibold">
                {isEditing ? "Edit Behavior" : "Add New Behavior"}
              </span>
            </div>

            {(displayClientName || selectedCategory?.name) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap justify-center mt-1">
                {displayClientName && (
                  <>
                    <span className="font-medium">{displayClientName}</span>
                    {(selectedCategory?.name || name) && <ChevronRight size={16} />}
                  </>
                )}
                {selectedCategory?.name && (
                  <>
                    <span className="font-medium text-amber-700">
                      {selectedCategory.name}
                    </span>
                    {name && <ChevronRight size={16} />}
                  </>
                )}
                {name && (
                  <span className="font-medium text-teal-600">{name}</span>
                )}
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!hideClientSelector && (
              <>
                <div className="sm:col-span-2 space-y-2">
                  <Label>Assign to Client</Label>
                  <Select
                    value={selectedClientValue}
                    onValueChange={setSelectedClientValue}
                    disabled={isEditing || loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Generic (master library)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="generic">Generic (master library)</SelectItem>
                      {clients.map((c) => {
                        const displayName =
                          `${c.first_name || ""} ${c.last_name || ""}`.trim() ||
                          c.NAME ||
                          c.name ||
                          c.client_name ||
                          "Unnamed Client";
                        return (
                          <SelectItem
                            key={c.id || c.client_id}
                            value={String(c.id || c.client_id)}
                          >
                            {displayName}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {selectedClientObj && (
                  <div className="sm:col-span-2 p-3 bg-purple-50 border border-purple-200 rounded-md text-sm">
                    <div className="font-medium text-purple-900">{displayClientName}</div>
                    {selectedClientObj.email && (
                      <div className="text-purple-700">Email: {selectedClientObj.email}</div>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="behavior-name">Behavior Name *</Label>
              <Input
                id="behavior-name"
                placeholder="e.g., Tantrum - Frequency"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Include recording type in the name when helpful.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={categoryId || "none"}
                onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal-name">Goal Name</Label>
              <Input
                id="goal-name"
                placeholder="Optional goal label"
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="behavior-function">Function</Label>
              <Input
                id="behavior-function"
                placeholder="e.g., Escape, Attention"
                value={behaviorFunction}
                onChange={(e) => setBehaviorFunction(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="behavior-definition">Operational Definition</Label>
              <Textarea
                id="behavior-definition"
                placeholder="Describe exactly how this behavior is measured..."
                value={definition}
                onChange={(e) => setDefinition(e.target.value)}
                rows={3}
                disabled={loading}
              />
            </div>

            <div className={`space-y-2 ${!isEditing ? "sm:col-span-2" : ""}`}>
              <Label>Recording Type *</Label>
              <Select
                value={recordingType}
                onValueChange={setRecordingType}
                disabled={recordingTypeLocked || loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECORDING_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {recordingTypeLocked ? (
                <p className="text-xs text-amber-600">
                  Locked — session data exists for this behavior.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Selected: {recordingTypeLabel(recordingType)}
                </p>
              )}
            </div>

            {isEditing && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="sm:col-span-2 rounded-lg border bg-slate-50/80 p-4 space-y-3">
              <p className="text-sm font-medium text-slate-700">Collection options</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between gap-3 rounded-md border bg-white px-3 py-2">
                  <div className="min-w-0">
                    <Label className="text-sm">Do not zero out</Label>
                    <p className="text-xs text-muted-foreground">
                      Skip 0 when no data collected.
                    </p>
                  </div>
                  <Switch
                    checked={doNotZeroOut}
                    onCheckedChange={setDoNotZeroOut}
                    disabled={loading}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border bg-white px-3 py-2">
                  <div className="min-w-0">
                    <Label className="text-sm">Exclude from ABC</Label>
                    <p className="text-xs text-muted-foreground">
                      Hide in ABC data panel.
                    </p>
                  </div>
                  <Switch
                    checked={excludeFromAbc}
                    onCheckedChange={setExcludeFromAbc}
                    disabled={loading}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border bg-white px-3 py-2">
                  <div className="min-w-0">
                    <Label className="text-sm">Active</Label>
                    <p className="text-xs text-muted-foreground">
                      Show in session collection.
                    </p>
                  </div>
                  <Switch
                    checked={isActive}
                    onCheckedChange={setIsActive}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
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
              {loading
                ? "Saving..."
                : isEditing
                  ? "Save Changes"
                  : "Add Behavior"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
