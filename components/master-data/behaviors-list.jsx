"use client";

import { mahaverseFetch } from "@/lib/mahaverse-api";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Search,
  Activity,
  Plus,
  Edit,
  Archive,
  ArchiveRestore,
  BookOpen,
  Users,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import { fetchClients } from "@/app/store/clientSlice";
import AddBehaviorModal from "./add-behavior-modal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import {
  normalizeBehaviorRow,
  recordingTypeLabel,
  RECORDING_TYPES,
  isDbArchived,
} from "@/lib/behavior-recording-types";

export default function BehaviorsList() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
  const dispatch = useAppDispatch();
  const clients = useAppSelector((state) => state.clients?.items || []);

  const [masterCategories, setMasterCategories] = useState([]);
  const [masterBehaviors, setMasterBehaviors] = useState([]);
  const [clientBehaviors, setClientBehaviors] = useState([]);
  const [loading, setLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [recordingFilter, setRecordingFilter] = useState("all");
  const [viewMode, setViewMode] = useState("all");
  const [selectedClient, setSelectedClient] = useState("all");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBehavior, setEditingBehavior] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    dispatch(fetchClients());
  }, [dispatch]);

  const loadMaster = useCallback(async () => {
    const res = await mahaverseFetch('/behaviors.php');
    const data = await res.json();
    if (data?.success) {
      setMasterCategories(data.data?.categories || []);
      setMasterBehaviors(data.data?.behaviors || []);
    }
  }, [baseUrl]);

  const loadClientBehaviors = useCallback(async () => {
    if (viewMode === "generic") {
      setClientBehaviors([]);
      return;
    }

    const clientList = (clients || [])
      .map((c) => String(c.id || c.client_id || ""))
      .filter(Boolean);

    if (selectedClient !== "all") {
      if (!selectedClient) {
        setClientBehaviors([]);
        return;
      }
      try {
        const res = await mahaverseFetch(`/client-behaviors.php?client_id=${encodeURIComponent(selectedClient)}`
        );
        const data = await res.json();
        setClientBehaviors(data?.success ? data.data?.behaviors || [] : []);
      } catch {
        setClientBehaviors([]);
      }
      return;
    }

    if (!clientList.length) {
      setClientBehaviors([]);
      return;
    }

    try {
      const results = await Promise.all(
        clientList.map((clientId) =>
          mahaverseFetch(`/client-behaviors.php?client_id=${encodeURIComponent(clientId)}`
          ).then((res) => res.json())
        )
      );
      const merged = results.flatMap((data) =>
        data?.success ? data.data?.behaviors || [] : []
      );
      setClientBehaviors(merged);
    } catch {
      setClientBehaviors([]);
    }
  }, [baseUrl, selectedClient, viewMode, clients]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await loadMaster();
    } catch {
      toast.error("Failed to load behaviors");
    } finally {
      setLoading(false);
    }
  }, [loadMaster]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (viewMode === "client" || viewMode === "all") {
      loadClientBehaviors();
    } else {
      setClientBehaviors([]);
    }
  }, [viewMode, selectedClient, clients, loadClientBehaviors]);

  useEffect(() => {
    const pendingClient = localStorage.getItem("pendingClientForMasterData");
    const pendingAction = localStorage.getItem("pendingAction");
    const pendingType = localStorage.getItem("pendingMasterDataType");
    if (pendingClient && pendingAction === "add" && pendingType === "behaviors") {
      setIsAddModalOpen(true);
      localStorage.removeItem("pendingClientForMasterData");
      localStorage.removeItem("pendingAction");
      localStorage.removeItem("pendingMasterDataType");
    }
  }, []);

  const categoryName = (id) => {
    if (!id) return "—";
    const cat = masterCategories.find((c) => c.id === id);
    return cat?.name || id;
  };

  const allRows = useMemo(() => {
    const archivedOk = (b) => showArchived || !isDbArchived(b);
    const generic = (masterBehaviors || [])
      .filter(archivedOk)
      .map((b) => ({
        ...normalizeBehaviorRow(b),
        source: "generic",
        displayCategory: categoryName(b.category_id),
      }));
    const client = (clientBehaviors || [])
      .filter(archivedOk)
      .map((b) => ({
        ...normalizeBehaviorRow(b),
        source: "client",
        displayCategory: categoryName(b.category_id),
      }));

    if (viewMode === "generic") return generic;
    if (viewMode === "client") return client;
    return [...generic, ...client];
  }, [masterBehaviors, clientBehaviors, viewMode, masterCategories, showArchived]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return allRows.filter((b) => {
      if (q && !(b.name || "").toLowerCase().includes(q)) return false;
      if (categoryFilter !== "all" && b.category_id !== categoryFilter) return false;
      if (recordingFilter !== "all" && b.recording_type !== recordingFilter) return false;
      return true;
    });
  }, [allRows, searchTerm, categoryFilter, recordingFilter]);

  const handleSave = async (payload, isClient) => {
    const path = isClient ? "/client-behaviors.php" : "/behaviors.php";
    const body = isClient
      ? { client_id: payload.client_id, behaviors: [payload] }
      : { behaviors: [payload] };
    const res = await mahaverseFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data?.success) throw new Error(data?.message || "Save failed");
    toast.success(editingBehavior ? "Behavior updated" : "Behavior saved");
    setEditingBehavior(null);
    await loadAll();
    if (viewMode !== "generic") {
      await loadClientBehaviors();
    }
  };

  const handleArchive = async (row) => {
    try {
      const isClient = row.source === "client";
      const path = isClient ? "/client-behaviors.php" : "/behaviors.php";
      const body = isClient
        ? { type: "behavior", id: row.id, client_id: row.client_id }
        : { type: "behavior", id: row.id };
      const res = await mahaverseFetch(path, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || "Archive failed");
      toast.success("Behavior archived");
      await loadAll();
      if (viewMode !== "generic") {
        await loadClientBehaviors();
      }
    } catch (err) {
      toast.error(err?.message || "Archive failed");
    }
  };

  const behaviorToRestorePayload = (row) => ({
    id: row.id,
    client_id: row.client_id || undefined,
    master_behavior_id: row.master_behavior_id ?? null,
    category_id: row.category_id ?? null,
    name: row.name,
    goal_name: row.goal_name || "",
    function: row.function || "",
    definition: row.definition || "",
    recording_type: row.recording_type || "Frequency",
    do_not_zero_out: row.do_not_zero_out ? 1 : 0,
    exclude_from_abc: row.exclude_from_abc ? 1 : 0,
    is_active: 1,
    status: "Active",
    archived: 0,
  });

  const handleRestoreBehavior = async (row) => {
    try {
      const isClient = row.source === "client";
      const path = isClient ? "/client-behaviors.php" : "/behaviors.php";
      const payload = behaviorToRestorePayload(row);
      const body = isClient
        ? { client_id: String(row.client_id), behaviors: [payload] }
        : { behaviors: [payload] };
      const res = await mahaverseFetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || "Restore failed");
      toast.success("Behavior restored");
      await loadAll();
      if (viewMode !== "generic") {
        await loadClientBehaviors();
      }
    } catch (err) {
      toast.error(err?.message || "Restore failed");
    }
  };

  return (
    <div className="space-y-6">
      <Toaster />
      <AddBehaviorModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingBehavior(null);
        }}
        onSave={handleSave}
        categories={masterCategories.filter((c) => !isDbArchived(c))}
        clients={clients}
        loading={loading}
        editingBehavior={editingBehavior}
        recordingTypeLocked={!!editingBehavior?.has_session_data}
      />
      <DeleteConfirmModal
        variant="archive"
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          handleArchive(deleteTarget);
          setDeleteTarget(null);
        }}
        title="Archive behavior?"
        message={`Archive "${deleteTarget?.name}"?`}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Behaviors</h2>
          <p className="text-slate-600 mt-1">Master and client behavior definitions</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? (
              <>
                <ArchiveRestore className="h-4 w-4 mr-2" /> Show Active
              </>
            ) : (
              <>
                <Archive className="h-4 w-4 mr-2" /> Show Archived
              </>
            )}
          </Button>
          <Button
            onClick={() => {
              setEditingBehavior(null);
              setIsAddModalOpen(true);
            }}
            className="bg-teal-600 hover:bg-teal-700"
            >
            <Plus className="h-4 w-4 mr-2" /> Add Behavior
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              className="pl-10"
              placeholder="Search behaviors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={viewMode} onValueChange={setViewMode}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="generic">Generic only</SelectItem>
              <SelectItem value="client">Client only</SelectItem>
            </SelectContent>
          </Select>
          {viewMode !== "generic" && (
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger>
                <SelectValue placeholder="Client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {clients.map((c) => {
                  const label =
                    `${c.first_name || ""} ${c.last_name || ""}`.trim() ||
                    c.NAME ||
                    c.name ||
                    c.client_name ||
                    "Unnamed client";
                  return (
                    <SelectItem key={c.id || c.client_id} value={String(c.id || c.client_id)}>
                      {label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {masterCategories.filter((c) => !isDbArchived(c)).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={recordingFilter} onValueChange={setRecordingFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Recording type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {RECORDING_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-red-600" />
            Behaviors ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-auto">
          {loading ? (
            <p className="p-6 text-center text-slate-500">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Behavior</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Recording Type</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Archived</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500">
                      No behaviors found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((b) => (
                    <TableRow key={`${b.source}-${b.id}`}>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell>
                        {b.source === "generic" ? (
                          <Badge variant="outline" className="gap-1">
                            <BookOpen className="h-3 w-3" /> Generic
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <Users className="h-3 w-3" /> Client
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{b.displayCategory}</TableCell>
                      <TableCell>{recordingTypeLabel(b.recording_type)}</TableCell>
                      <TableCell>
                        <Badge variant={b.is_active ? "default" : "secondary"}>
                          {b.is_active ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={b.archived ? "outline" : "secondary"} className={b.archived ? "border-amber-300 text-amber-800" : ""}>
                          {b.archived ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          {!b.archived ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-slate-300"
                                title="Edit"
                                onClick={() => {
                                  setEditingBehavior(b);
                                  setIsAddModalOpen(true);
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
                                onClick={() => setDeleteTarget(b)}
                              >
                                <span>
                                  <Archive className="h-4 w-4" />
                                </span>
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-slate-300 text-green-600"
                              title="Restore"
                              onClick={() => handleRestoreBehavior(b)}
                            >
                              <span>
                                <ArchiveRestore className="h-4 w-4" />
                              </span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
