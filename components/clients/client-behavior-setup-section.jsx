"use client";

import { mahaverseFetch } from "@/lib/mahaverse-api";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Activity, MapPin, Archive } from "lucide-react";
import toast from "react-hot-toast";
import DeleteConfirmModal from "@/components/master-data/DeleteConfirmModal";
import { BehaviorsListModal } from "./add-client-behavior";
import {
  normalizeBehaviorRow,
  recordingTypeLabel,
  isDbArchived,
  isDbActive,
} from "@/lib/behavior-recording-types";

function AbcSetupCard({ title, items, onAdd, onDeactivate }) {
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd(name.trim());
    setName("");
    setAdding(false);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          {title}
          <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {adding && (
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="h-8"
            />
            <Button size="sm" onClick={handleAdd}>Save</Button>
          </div>
        )}
        <ul className="space-y-1">
          {(items || []).filter((i) => i.is_active !== 0).map((item) => (
            <li key={item.id} className="flex items-center justify-between text-sm">
              <span>{item.name}</span>
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0 border-slate-300 text-amber-600"
                title="Archive"
                onClick={() => onDeactivate(item)}
              >
                <span>
                  <Archive className="h-4 w-4" />
                </span>
              </Button>
            </li>
          ))}
          {(items || []).filter((i) => i.is_active !== 0).length === 0 && (
            <li className="text-xs text-slate-500">None configured</li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

export default function ClientBehaviorSetupSection({ clientId, clientName }) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
  const [behaviorsOpen, setBehaviorsOpen] = useState(false);
  const [behaviors, setBehaviors] = useState([]);
  const [abc, setAbc] = useState({ antecedents: [], consequences: [], locations: [] });
  const [rawAbc, setRawAbc] = useState([]);
  const [loading, setLoading] = useState(false);
  const [archiveBehaviorTarget, setArchiveBehaviorTarget] = useState(null);

  const load = useCallback(async () => {
    if (!baseUrl || !clientId) return;
    setLoading(true);
    try {
      const res = await mahaverseFetch(`/client-behaviors.php?client_id=${encodeURIComponent(clientId)}&raw_abc_limit=50`
      );
      const data = await res.json();
      if (data?.success) {
        setBehaviors(data.data?.behaviors || []);
        setAbc({
          antecedents: data.data?.abc_antecedents || [],
          consequences: data.data?.abc_consequences || [],
          locations: data.data?.abc_locations || [],
        });
        setRawAbc(data.data?.raw_abc || []);
      }
    } catch {
      toast.error("Failed to load behavior data");
    } finally {
      setLoading(false);
    }
  }, [baseUrl, clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const addAbcItem = async (type, name) => {
    const keyMap = {
      antecedent: "abc_antecedents",
      consequence: "abc_consequences",
      location: "abc_locations",
    };
    const id = `abc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    try {
      const res = await mahaverseFetch('/client-behaviors.php', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          [keyMap[type]]: [{ id, name, is_active: 1 }],
        }),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || "Failed");
      toast.success("Added");
      load();
    } catch (err) {
      toast.error(err?.message || "Failed to add");
    }
  };

  const deactivateAbc = async (type, item) => {
    try {
      const res = await mahaverseFetch('/client-behaviors.php', {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id: item.id, client_id: clientId }),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || "Failed");
      load();
    } catch (err) {
      toast.error(err?.message || "Failed");
    }
  };

  const handleArchiveConfiguredBehavior = async (row) => {
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
    } catch (err) {
      toast.error(err?.message || "Archive failed");
    }
  };

  const activeBehaviors = behaviors.filter((b) => !isDbArchived(b) && isDbActive(b));

  const lookupName = (list, id) => list.find((i) => i.id === id)?.name || id || "—";

  return (
    <div className="space-y-4">
      <DeleteConfirmModal
        variant="archive"
        isOpen={!!archiveBehaviorTarget}
        onClose={() => setArchiveBehaviorTarget(null)}
        onConfirm={() => {
          handleArchiveConfiguredBehavior(archiveBehaviorTarget);
          setArchiveBehaviorTarget(null);
        }}
        title="Archive behavior?"
        message={`Archive "${archiveBehaviorTarget?.name || ""}"? This removes it from active session data collection.`}
      />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setBehaviorsOpen(true)} className="bg-red-600 hover:bg-red-700">
          <Activity className="h-4 w-4 mr-2" /> Manage Behaviors
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Behaviors ({activeBehaviors.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : activeBehaviors.length === 0 ? (
            <p className="text-sm text-slate-500">No behaviors configured yet.</p>
          ) : (
            <ul className="space-y-2">
              {activeBehaviors.map((b) => {
                const n = normalizeBehaviorRow(b);
                return (
                  <li key={b.id} className="flex items-center justify-between gap-2 text-sm border rounded-md px-3 py-2">
                    <span className="font-medium min-w-0 truncate">{n.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline">{recordingTypeLabel(n.recording_type)}</Badge>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-slate-300 text-amber-600"
                        title="Archive"
                        onClick={() => setArchiveBehaviorTarget(b)}
                      >
                        <span>
                          <Archive className="h-4 w-4" />
                        </span>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div>
        <h4 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
          <MapPin className="h-4 w-4" /> ABC Setup
        </h4>
        <div className="grid gap-3 md:grid-cols-3">
          <AbcSetupCard
            title="Antecedents"
            items={abc.antecedents}
            onAdd={(name) => addAbcItem("antecedent", name)}
            onDeactivate={(item) => deactivateAbc("antecedent", item)}
          />
          <AbcSetupCard
            title="Consequences"
            items={abc.consequences}
            onAdd={(name) => addAbcItem("consequence", name)}
            onDeactivate={(item) => deactivateAbc("consequence", item)}
          />
          <AbcSetupCard
            title="Locations"
            items={abc.locations}
            onAdd={(name) => addAbcItem("location", name)}
            onDeactivate={(item) => deactivateAbc("location", item)}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Raw ABC Data</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Antecedent</TableHead>
                <TableHead>Behavior</TableHead>
                <TableHead>Consequence</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rawAbc.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500">
                    No ABC data recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                rawAbc.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.session_date}</TableCell>
                    <TableCell>{lookupName(abc.antecedents, row.antecedent_id)}</TableCell>
                    <TableCell>{lookupName(behaviors.map((b) => ({ id: b.id, name: b.name })), row.behavior_id)}</TableCell>
                    <TableCell>{lookupName(abc.consequences, row.consequence_id)}</TableCell>
                    <TableCell>{lookupName(abc.locations, row.location_id)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{row.notes || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <BehaviorsListModal
        isOpen={behaviorsOpen}
        onClose={() => setBehaviorsOpen(false)}
        clientId={clientId}
        clientName={clientName}
        onReload={load}
      />
    </div>
  );
}
