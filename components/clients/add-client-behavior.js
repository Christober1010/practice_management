"use client";

import { mahaverseFetch } from "@/lib/mahaverse-api";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, Edit, Archive, Activity } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import AddBehaviorModal from "@/components/master-data/add-behavior-modal";
import {
  normalizeBehaviorRow,
  recordingTypeLabel,
  isDbArchived,
  isDbActive,
} from "@/lib/behavior-recording-types";

export function BehaviorsListModal({
  isOpen,
  onClose,
  clientId,
  clientName,
  onReload,
}) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
  const [behaviors, setBehaviors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    if (!baseUrl || !clientId) return;
    setLoading(true);
    try {
      const [behRes, catRes] = await Promise.all([
        mahaverseFetch(`/client-behaviors.php?client_id=${encodeURIComponent(clientId)}`),
        mahaverseFetch('/behaviors.php'),
      ]);
      const behData = await behRes.json();
      const catData = await catRes.json();
      if (behData?.success) setBehaviors(behData.data?.behaviors || []);
      if (catData?.success) setCategories(catData.data?.categories || []);
    } catch {
      toast.error("Failed to load behaviors");
    } finally {
      setLoading(false);
    }
  }, [baseUrl, clientId]);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  const handleSave = async (payload) => {
    const res = await mahaverseFetch('/client-behaviors.php', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        behaviors: [{ ...payload, client_id: clientId }],
      }),
    });
    const data = await res.json();
    if (!data?.success) throw new Error(data?.message || "Save failed");
    toast.success(editing ? "Behavior updated" : "Behavior added");
    setAddOpen(false);
    setEditing(null);
    load();
    onReload?.();
  };

  const handleArchive = async (row) => {
    if (!confirm(`Archive "${row.name}"?`)) return;
    try {
      const res = await mahaverseFetch('/client-behaviors.php', {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "behavior", id: row.id, client_id: clientId }),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || "Archive failed");
      toast.success("Behavior archived");
      load();
      onReload?.();
    } catch (err) {
      toast.error(err?.message || "Archive failed");
    }
  };

  const active = behaviors.filter((b) => !isDbArchived(b) && isDbActive(b));

  return (
    <>
      <Toaster />
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Activity className="h-6 w-6 text-red-600" />
              Behaviors for {clientName || "Client"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Button
              onClick={() => {
                setEditing(null);
                setAddOpen(true);
              }}
              className="bg-teal-600 hover:bg-teal-700"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Behavior
            </Button>

            {loading ? (
              <p className="text-center py-8 text-gray-500">Loading...</p>
            ) : active.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Activity className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-slate-600">No behaviors yet. Create one!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {active.map((b) => {
                  const n = normalizeBehaviorRow(b);
                  const category = categories.find((c) => c.id === n.category_id);
                  return (
                    <Card key={b.id} className="border-l-4 border-l-red-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg">{n.name}</h3>
                            {n.definition && (
                              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                {n.definition}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <Badge variant="outline">
                                {recordingTypeLabel(n.recording_type)}
                              </Badge>
                              {category?.name && (
                                <Badge variant="secondary">{category.name}</Badge>
                              )}
                              <Badge
                                variant={n.status === "Active" ? "default" : "secondary"}
                              >
                                {n.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-slate-300"
                              title="Edit"
                              onClick={() => {
                                setEditing(b);
                                setAddOpen(true);
                              }}
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
                              onClick={() => handleArchive(n)}
                            >
                              <span>
                                <Archive className="h-4 w-4" />
                              </span>
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AddBehaviorModal
        isOpen={addOpen}
        onClose={() => {
          setAddOpen(false);
          setEditing(null);
        }}
        onSave={(payload) => handleSave({ ...payload, client_id: clientId })}
        categories={categories.filter((c) => !isDbArchived(c))}
        clients={[{ id: clientId, name: clientName }]}
        clientName={clientName}
        hideClientSelector
        editingBehavior={editing ? { ...editing, client_id: clientId } : null}
      />
    </>
  );
}

export default BehaviorsListModal;
