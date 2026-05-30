"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, ClipboardList } from "lucide-react";
import toast from "react-hot-toast";

function generateId() {
  return `abc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function AbcDataPanel({
  sessionNotes,
  setSessionNotes,
  abcSetup,
  onAddAbcItem,
  clientId,
  baseUrl,
}) {
  const [antecedentId, setAntecedentId] = useState("");
  const [behaviorId, setBehaviorId] = useState("");
  const [consequenceId, setConsequenceId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [notes, setNotes] = useState("");
  const [addingType, setAddingType] = useState(null);
  const [newItemName, setNewItemName] = useState("");

  const abcBehaviors = useMemo(() => {
    const rows = sessionNotes.behaviorReductionData || [];
    return rows.filter((b) => !b.archived && !b.excludeFromAbc);
  }, [sessionNotes.behaviorReductionData]);

  const abcData = Array.isArray(sessionNotes.abcData) ? sessionNotes.abcData : [];

  const lookup = (list, id) => (list || []).find((i) => i.id === id)?.name || "—";
  const behaviorName = (id) =>
    abcBehaviors.find((b) => b.id === id)?.behaviorName ||
    (sessionNotes.behaviorReductionData || []).find((b) => b.id === id)?.behaviorName ||
    "—";

  const handleSave = () => {
    if (!behaviorId) {
      toast.error("Select a behavior");
      return;
    }
    const entry = {
      id: generateId(),
      antecedent_id: antecedentId || null,
      behavior_id: behaviorId,
      consequence_id: consequenceId || null,
      location_id: locationId || null,
      notes: notes.trim(),
    };
    setSessionNotes((prev) => ({
      ...prev,
      abcData: [...(prev.abcData || []), entry],
    }));
    setAntecedentId("");
    setBehaviorId("");
    setConsequenceId("");
    setLocationId("");
    setNotes("");
    toast.success("ABC entry added");
  };

  const handleDelete = (id) => {
    setSessionNotes((prev) => ({
      ...prev,
      abcData: (prev.abcData || []).filter((r) => r.id !== id),
    }));
  };

  const handleInlineAdd = async () => {
    if (!newItemName.trim() || !addingType) return;
    if (onAddAbcItem) {
      const newId = await onAddAbcItem(addingType, newItemName.trim());
      if (newId) {
        if (addingType === "antecedent") setAntecedentId(newId);
        if (addingType === "consequence") setConsequenceId(newId);
        if (addingType === "location") setLocationId(newId);
      }
    }
    setNewItemName("");
    setAddingType(null);
  };

  const renderSelect = (label, value, onChange, items, type) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1">
        <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" ? "" : v)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">—</SelectItem>
            {(items || []).filter((i) => i.is_active !== 0).map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-9 w-9 shrink-0"
          onClick={() => setAddingType(type)}
          title={`Add ${label}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-purple-600" />
          ABC Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {addingType && (
          <div className="flex gap-2 items-end border rounded-md p-3 bg-slate-50">
            <div className="flex-1">
              <Label className="text-xs">New {addingType}</Label>
              <input
                className="flex h-9 w-full rounded-md border px-3 text-sm"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Name"
              />
            </div>
            <Button type="button" size="sm" onClick={handleInlineAdd}>
              Save
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setAddingType(null)}>
              Cancel
            </Button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {renderSelect(
            "Antecedent",
            antecedentId,
            setAntecedentId,
            abcSetup?.antecedents,
            "antecedent"
          )}
          <div className="space-y-1">
            <Label className="text-xs">Behavior *</Label>
            <Select value={behaviorId || "none"} onValueChange={(v) => setBehaviorId(v === "none" ? "" : v)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select behavior" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {abcBehaviors.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.behaviorName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {renderSelect(
            "Consequence",
            consequenceId,
            setConsequenceId,
            abcSetup?.consequences,
            "consequence"
          )}
          {renderSelect("Location", locationId, setLocationId, abcSetup?.locations, "location")}
        </div>

        <div>
          <Label className="text-xs">Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        <Button type="button" onClick={handleSave}>
          Save ABC Entry
        </Button>

        <div>
          <h4 className="text-sm font-medium mb-2">Today&apos;s ABC Data</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Antecedent</TableHead>
                <TableHead>Behavior</TableHead>
                <TableHead>Consequence</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {abcData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500">
                    No ABC entries for this session yet.
                  </TableCell>
                </TableRow>
              ) : (
                abcData.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{lookup(abcSetup?.antecedents, row.antecedent_id)}</TableCell>
                    <TableCell>{behaviorName(row.behavior_id)}</TableCell>
                    <TableCell>{lookup(abcSetup?.consequences, row.consequence_id)}</TableCell>
                    <TableCell>{lookup(abcSetup?.locations, row.location_id)}</TableCell>
                    <TableCell className="max-w-[160px] truncate">{row.notes || "—"}</TableCell>
                    <TableCell>
                      <Button type="button" size="icon" variant="ghost" onClick={() => handleDelete(row.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
